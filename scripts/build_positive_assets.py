#!/usr/bin/env python3
"""Build privacy-safe, browser-ready BeeCam positive-frame assets.

The input manifest stays local because it contains absolute filesystem paths.
This script emits native-resolution padded detection crops, dashboard JSON,
two curated CSV manifests, and a deterministic ZIP containing every crop.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = ROOT / "positives_manifests" / "bombus_positive_timeline_2026.csv"
DEFAULT_MAPPING = ROOT / "sensor_grid_status" / "cam_cellnums.txt"
CROP_DIR = ROOT / "public" / "positives" / "crops"
DOWNLOAD_DIR = ROOT / "public" / "downloads"
DATA_OUTPUT = ROOT / "src" / "data" / "positive-data.json"
ALL_FRAMES_OUTPUT = DOWNLOAD_DIR / "all_positive_frames_2026.csv"
UNIQUE_VISITS_OUTPUT = DOWNLOAD_DIR / "unique_visits_2026.csv"
ZIP_OUTPUT = DOWNLOAD_DIR / "beecam_positive_crops_2026.zip"
VISIT_GAP_SECONDS = 2.0
PADDING_PIXELS = 200


@dataclass
class Frame:
    site: str
    camera_id: int
    grid_cell: str
    date: str
    captured_at: str
    timestamp: datetime
    crop_filename: str
    crop_width: int
    crop_height: int
    sharpness: float
    visit_id: str = ""
    visit_frame_index: int = 0
    visit_frame_count: int = 0
    is_representative: bool = False


@dataclass
class Visit:
    visit_id: str
    site: str
    camera_id: int
    grid_cell: str
    date: str
    frames: list[Frame] = field(default_factory=list)

    @property
    def started_at(self) -> str:
        return self.frames[0].captured_at

    @property
    def ended_at(self) -> str:
        return self.frames[-1].captured_at

    @property
    def duration_seconds(self) -> float:
        return round((self.frames[-1].timestamp - self.frames[0].timestamp).total_seconds(), 6)

    @property
    def representative(self) -> Frame:
        return next(frame for frame in self.frames if frame.is_representative)


def parse_camera_id(label: str) -> int:
    match = re.search(r"\d+", label)
    if not match:
        raise ValueError(f"Cannot parse camera ID from {label!r}")
    return int(match.group())


def load_camera_mapping(path: Path) -> dict[int, str]:
    mapping: dict[int, str] = {}
    pattern = re.compile(r"^([A-L][0-7])\s*-\s*(\d+)$")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line.strip())
        if match:
            mapping[int(match.group(2))] = match.group(1)
    # Camera 18 occupied F5 before Camera 19 replaced it.
    mapping[18] = "F5"
    return mapping


def crop_bounds(boxes: list[list[int]], width: int, height: int) -> tuple[int, int, int, int]:
    if not boxes:
        raise ValueError("At least one detection box is required")
    for box in boxes:
        if len(box) != 4:
            raise ValueError(f"Invalid detection box: {box}")
        x_min, y_min, x_max, y_max = box
        if not (0 <= x_min < x_max <= width and 0 <= y_min < y_max <= height):
            raise ValueError(f"Detection box outside {width}x{height} image: {box}")
    return (
        max(0, min(box[0] for box in boxes) - PADDING_PIXELS),
        max(0, min(box[1] for box in boxes) - PADDING_PIXELS),
        min(width, max(box[2] for box in boxes) + PADDING_PIXELS),
        min(height, max(box[3] for box in boxes) + PADDING_PIXELS),
    )


def crop_filename(camera_id: int, captured_at: str) -> str:
    stamp = re.sub(r"[^0-9]", "", captured_at)
    return f"cam{camera_id:02d}_{stamp}.webp"


def run_image_command(arguments: list[str]) -> None:
    subprocess.run(arguments, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def create_crop(source: Path, target: Path, bounds: tuple[int, int, int, int]) -> tuple[int, int]:
    x_min, y_min, x_max, y_max = bounds
    width, height = x_max - x_min, y_max - y_min
    run_image_command(
        [
            "convert",
            str(source),
            "-crop",
            f"{width}x{height}+{x_min}+{y_min}",
            "+repage",
            "-strip",
            "-define",
            "webp:method=4",
            "-quality",
            "85",
            str(target),
        ]
    )
    return width, height


def sharpness_score(path: Path) -> float:
    result = subprocess.run(
        [
            "convert",
            str(path),
            "-colorspace",
            "Gray",
            "-resize",
            "256x256>",
            "-morphology",
            "Convolve",
            "Laplacian:0",
            "-format",
            "%[fx:standard_deviation]",
            "info:",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def assign_visits(frames: list[Frame]) -> list[Visit]:
    grouped: dict[tuple[int, str], list[Frame]] = defaultdict(list)
    for frame in frames:
        grouped[(frame.camera_id, frame.date)].append(frame)

    visits: list[Visit] = []
    for (camera_id, date), camera_frames in sorted(grouped.items()):
        camera_frames.sort(key=lambda frame: frame.timestamp)
        daily_visit_number = 0
        current: Visit | None = None
        previous: Frame | None = None
        for frame in camera_frames:
            starts_visit = previous is None or (frame.timestamp - previous.timestamp).total_seconds() >= VISIT_GAP_SECONDS
            if starts_visit:
                daily_visit_number += 1
                visit_id = f"eq-cam{camera_id:02d}-{date.replace('-', '')}-v{daily_visit_number:03d}"
                current = Visit(visit_id, frame.site, camera_id, frame.grid_cell, date)
                visits.append(current)
            assert current is not None
            current.frames.append(frame)
            previous = frame

    for visit in visits:
        count = len(visit.frames)
        midpoint = (count - 1) / 2
        representative_index = max(
            range(count),
            key=lambda index: (visit.frames[index].sharpness, -abs(index - midpoint)),
        )
        for index, frame in enumerate(visit.frames):
            frame.visit_id = visit.visit_id
            frame.visit_frame_index = index + 1
            frame.visit_frame_count = count
            frame.is_representative = index == representative_index
    return visits


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def build_zip(crop_dir: Path, output: Path) -> None:
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for crop in sorted(crop_dir.glob("*.webp")):
            info = zipfile.ZipInfo(f"crops/{crop.name}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, crop.read_bytes())


def build(manifest: Path, mapping_path: Path) -> dict[str, object]:
    if shutil.which("convert") is None:
        raise SystemExit("ImageMagick 'convert' is required")
    mapping = load_camera_mapping(mapping_path)
    CROP_DIR.parent.mkdir(parents=True, exist_ok=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DATA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary_crop_dir = CROP_DIR.with_name("crops-building")
    if temporary_crop_dir.exists():
        shutil.rmtree(temporary_crop_dir)
    temporary_crop_dir.mkdir(parents=True)

    with manifest.open(newline="", encoding="utf-8-sig") as handle:
        source_rows = list(csv.DictReader(handle))
    required = {"site", "camera", "date", "captured_at", "source_path", "width", "height", "boxes"}
    missing = required - set(source_rows[0])
    if missing:
        raise SystemExit(f"Manifest is missing required columns: {sorted(missing)}")

    frames: list[Frame] = []
    filenames: set[str] = set()
    for index, row in enumerate(source_rows, start=1):
        camera_id = parse_camera_id(row["camera"])
        if camera_id not in mapping:
            raise ValueError(f"No grid-cell mapping for Camera {camera_id}")
        source = Path(row["source_path"])
        if not source.is_file():
            raise FileNotFoundError(source)
        width, height = int(row["width"]), int(row["height"])
        boxes = json.loads(row["boxes"])
        bounds = crop_bounds(boxes, width, height)
        filename = crop_filename(camera_id, row["captured_at"])
        # Archive-cohort frames carry whole-second timestamps, so a burst can share one.
        suffix = 1
        while filename in filenames:
            suffix += 1
            filename = crop_filename(camera_id, row["captured_at"]).replace(".webp", f"_{suffix}.webp")
        filenames.add(filename)
        target = temporary_crop_dir / filename
        crop_width, crop_height = create_crop(source, target, bounds)
        frames.append(
            Frame(
                site=row["site"],
                camera_id=camera_id,
                grid_cell=mapping[camera_id],
                date=row["date"],
                captured_at=row["captured_at"],
                timestamp=datetime.fromisoformat(row["captured_at"]),
                crop_filename=filename,
                crop_width=crop_width,
                crop_height=crop_height,
                sharpness=sharpness_score(target),
            )
        )
        if index % 50 == 0 or index == len(source_rows):
            print(f"processed {index}/{len(source_rows)} crops", file=sys.stderr)

    visits = assign_visits(frames)
    frames.sort(key=lambda frame: (frame.timestamp, frame.camera_id))
    visits.sort(key=lambda visit: (visit.frames[0].timestamp, visit.camera_id))

    all_frame_rows = [
        {
            "site": frame.site,
            "camera_id": frame.camera_id,
            "grid_cell": frame.grid_cell,
            "date": frame.date,
            "captured_at": frame.captured_at,
            "visit_id": frame.visit_id,
            "visit_frame_index": frame.visit_frame_index,
            "visit_frame_count": frame.visit_frame_count,
            "crop_filename": frame.crop_filename,
        }
        for frame in frames
    ]
    unique_visit_rows = [
        {
            "site": visit.site,
            "camera_id": visit.camera_id,
            "grid_cell": visit.grid_cell,
            "date": visit.date,
            "visit_id": visit.visit_id,
            "visit_started_at": visit.started_at,
            "visit_ended_at": visit.ended_at,
            "duration_seconds": f"{visit.duration_seconds:.6f}".rstrip("0").rstrip("."),
            "frame_count": len(visit.frames),
            "representative_captured_at": visit.representative.captured_at,
            "crop_filename": visit.representative.crop_filename,
        }
        for visit in visits
    ]
    write_csv(ALL_FRAMES_OUTPUT, list(all_frame_rows[0]), all_frame_rows)
    write_csv(UNIQUE_VISITS_OUTPUT, list(unique_visit_rows[0]), unique_visit_rows)

    public_data = {
        "summary": {
            "totalFrames": len(frames),
            "uniqueVisits": len(visits),
            "singleFrameVisits": sum(len(visit.frames) == 1 for visit in visits),
            "multiFrameVisits": sum(len(visit.frames) > 1 for visit in visits),
            "dateMin": min(frame.date for frame in frames),
            "dateMax": max(frame.date for frame in frames),
        },
        "frames": [
            {
                "cameraId": frame.camera_id,
                "gridCell": frame.grid_cell,
                "date": frame.date,
                "capturedAt": frame.captured_at,
                "visitId": frame.visit_id,
                "visitFrameIndex": frame.visit_frame_index,
                "visitFrameCount": frame.visit_frame_count,
                "cropPath": f"positives/crops/{frame.crop_filename}",
                "cropWidth": frame.crop_width,
                "cropHeight": frame.crop_height,
                "isRepresentative": frame.is_representative,
            }
            for frame in frames
        ],
        "visits": [
            {
                "visitId": visit.visit_id,
                "cameraId": visit.camera_id,
                "gridCell": visit.grid_cell,
                "date": visit.date,
                "startedAt": visit.started_at,
                "endedAt": visit.ended_at,
                "durationSeconds": visit.duration_seconds,
                "frameCount": len(visit.frames),
                "representativeCropPath": f"positives/crops/{visit.representative.crop_filename}",
                "representativeCapturedAt": visit.representative.captured_at,
            }
            for visit in visits
        ],
    }
    DATA_OUTPUT.write_text(json.dumps(public_data, separators=(",", ":")) + "\n", encoding="utf-8")

    if CROP_DIR.exists():
        shutil.rmtree(CROP_DIR)
    temporary_crop_dir.rename(CROP_DIR)
    build_zip(CROP_DIR, ZIP_OUTPUT)

    digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
    return {
        "frames": len(frames),
        "visits": len(visits),
        "crop_bytes": sum(path.stat().st_size for path in CROP_DIR.glob("*.webp")),
        "zip_bytes": ZIP_OUTPUT.stat().st_size,
        "source_manifest_sha256": digest,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    args = parser.parse_args()
    result = build(args.manifest, args.mapping)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
