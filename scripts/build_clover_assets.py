#!/usr/bin/env python3
"""Build the clover-cams tab assets (farm near Philomath, Oregon) from the bombus_cascade manifest.

Reads the live bombus_cascade manifest (read-only) and keeps human-confirmed Bombus frames of site
`clover`: review_state annotated with at least one class-0 box. Crops, sharpness, visit grouping
(gap >= 2 s per camera and day) and CSV columns follow build_positive_assets.py; visit IDs use a
`clover-` prefix. Also writes the recall-analysis summary from the timelapse evaluation.

  python3 scripts/build_clover_assets.py
Outputs: src/data/clover-data.json, src/data/clover-recall.json, public/clover/crops/*.webp,
public/downloads/clover_all_positive_frames_2026.csv, public/downloads/clover_unique_visits_2026.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_positive_assets import (  # noqa: E402
    VISIT_GAP_SECONDS, Frame, Visit, create_crop, crop_bounds, crop_filename, parse_camera_id, sharpness_score, write_csv,
)
from export_cascade_positives import CASCADE, bombus_boxes, live_manifest  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CROP_DIR = ROOT / "public" / "clover" / "crops"
DOWNLOAD_DIR = ROOT / "public" / "downloads"
DATA_OUTPUT = ROOT / "src" / "data" / "clover-data.json"
RECALL_OUTPUT = ROOT / "src" / "data" / "clover-recall.json"
ALL_FRAMES_OUTPUT = DOWNLOAD_DIR / "clover_all_positive_frames_2026.csv"
UNIQUE_VISITS_OUTPUT = DOWNLOAD_DIR / "clover_unique_visits_2026.csv"
SITE = "clover"
LOCATION = "Clover"  # shown where the Emerald Queen tab shows a grid cell
EVAL_RESULTS = "runs/timelapse_eval_2026/eval_r1_final_v2/results.json"


def assign_visits(frames: list[Frame]) -> list[Visit]:
    """build_positive_assets.assign_visits with a clover- visit ID."""
    grouped: dict[tuple[int, str], list[Frame]] = defaultdict(list)
    for frame in frames:
        grouped[(frame.camera_id, frame.date)].append(frame)
    visits: list[Visit] = []
    for (camera_id, date), camera_frames in sorted(grouped.items()):
        camera_frames.sort(key=lambda frame: frame.timestamp)
        number, current, previous = 0, None, None
        for frame in camera_frames:
            if previous is None or (frame.timestamp - previous.timestamp).total_seconds() >= VISIT_GAP_SECONDS:
                number += 1
                current = Visit(f"clover-cam{camera_id:02d}-{date.replace('-', '')}-v{number:03d}", frame.site, camera_id, frame.grid_cell, date)
                visits.append(current)
            current.frames.append(frame)
            previous = frame
    for visit in visits:
        count = len(visit.frames)
        midpoint = (count - 1) / 2
        best = max(range(count), key=lambda i: (visit.frames[i].sharpness, -abs(i - midpoint)))
        for index, frame in enumerate(visit.frames):
            frame.visit_id, frame.visit_frame_index, frame.visit_frame_count = visit.visit_id, index + 1, count
            frame.is_representative = index == best
    return visits


def recall_summary(cascade: Path) -> dict:
    results = json.loads((cascade / EVAL_RESULTS).read_text())
    names = {"int8@0.25": "Camera model (int8) at 0.25", "int8@0.25 +stale": "Camera model (int8) at 0.25, stale filter",
             "pt@0.43": "Full-precision model at 0.43", "pt@0.25": "Full-precision model at 0.25"}
    rows = []
    for key, label in names.items():
        point = results["settings"][key]["point"]
        visits = results["visit_sensitivity"]["variants"][key]["gap10_edge_as_one"]
        rows.append({"setting": label, "visitsCaught": visits["caught"], "visits": visits["visits"],
                     "frameRecall": round(point["frame_recall"], 3), "bombusPrecision": round(point["bombus_precision"], 4),
                     "triggersPerBombusFrame": round(point["triggers_per_bombus_frame"], 1)})
    per_camera = []
    for camera, m in results["visit_sensitivity"]["variants"]["int8@0.25"]["per_camera_edge_as_one"].items():
        pt = results["visit_sensitivity"]["variants"]["pt@0.43"]["per_camera_edge_as_one"][camera]
        per_camera.append({"camera": camera, "visits": m["visits"], "int8Caught": m["caught"], "fullPrecisionCaught": pt["caught"]})
    return {"source": "bombus_cascade " + EVAL_RESULTS, "reviewedFrames": results["reviewed_frames"],
            "populationFrames": results["est_population_frames"], "settings": rows, "perCamera": per_camera}


def build(cascade: Path) -> dict:
    if shutil.which("convert") is None:
        raise SystemExit("ImageMagick 'convert' is required")
    manifest = live_manifest(cascade)
    csv.field_size_limit(sys.maxsize)
    rows = []
    with manifest.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["site"] != SITE or row["review_state"] != "annotated" or not row["label_path"]:
                continue
            label = Path(row["label_path"])
            label = label if label.is_absolute() else cascade / label
            boxes = bombus_boxes(label, int(row["width"]), int(row["height"]))
            if boxes:
                rows.append({**row, "boxes": boxes})
    building = CROP_DIR.with_name("crops-building")
    if building.exists():
        shutil.rmtree(building)
    building.mkdir(parents=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    frames, names = [], set()
    for index, row in enumerate(sorted(rows, key=lambda r: (r["captured_at"], r["camera"])), 1):
        camera_id = parse_camera_id(row["camera"])
        width, height = int(row["width"]), int(row["height"])
        name = crop_filename(camera_id, row["captured_at"])
        suffix = 1
        while name in names:
            suffix += 1
            name = crop_filename(camera_id, row["captured_at"]).replace(".webp", f"_{suffix}.webp")
        names.add(name)
        target = building / name
        crop_width, crop_height = create_crop(Path(row["source_path"]), target, crop_bounds(row["boxes"], width, height))
        frames.append(Frame(site=SITE, camera_id=camera_id, grid_cell=LOCATION, date=row["date"], captured_at=row["captured_at"],
                            timestamp=datetime.fromisoformat(row["captured_at"]), crop_filename=name,
                            crop_width=crop_width, crop_height=crop_height, sharpness=sharpness_score(target)))
        if index % 50 == 0 or index == len(rows):
            print(f"processed {index}/{len(rows)} crops", file=sys.stderr)
    visits = assign_visits(frames)
    frames.sort(key=lambda f: (f.timestamp, f.camera_id))
    visits.sort(key=lambda v: (v.frames[0].timestamp, v.camera_id))

    write_csv(ALL_FRAMES_OUTPUT, ["site", "camera_id", "date", "captured_at", "visit_id", "visit_frame_index", "visit_frame_count", "crop_filename"],
              [{"site": SITE, "camera_id": f.camera_id, "date": f.date, "captured_at": f.captured_at, "visit_id": f.visit_id,
                "visit_frame_index": f.visit_frame_index, "visit_frame_count": f.visit_frame_count, "crop_filename": f.crop_filename} for f in frames])
    write_csv(UNIQUE_VISITS_OUTPUT, ["site", "camera_id", "date", "visit_id", "visit_started_at", "visit_ended_at", "duration_seconds",
                                     "frame_count", "representative_captured_at", "crop_filename"],
              [{"site": SITE, "camera_id": v.camera_id, "date": v.date, "visit_id": v.visit_id, "visit_started_at": v.started_at,
                "visit_ended_at": v.ended_at, "duration_seconds": f"{v.duration_seconds:.6f}".rstrip("0").rstrip("."),
                "frame_count": len(v.frames), "representative_captured_at": v.representative.captured_at,
                "crop_filename": v.representative.crop_filename} for v in visits])
    cameras = sorted({f.camera_id for f in frames})
    data = {
        "summary": {"totalFrames": len(frames), "uniqueVisits": len(visits),
                    "singleFrameVisits": sum(len(v.frames) == 1 for v in visits), "multiFrameVisits": sum(len(v.frames) > 1 for v in visits),
                    "dateMin": min(f.date for f in frames), "dateMax": max(f.date for f in frames),
                    "arucoFrames": 0, "arucoVisits": 0, "tagIdentities": 0},
        "cameras": [{"cameraId": c, "frames": sum(f.camera_id == c for f in frames), "visits": sum(v.camera_id == c for v in visits),
                     "dateMin": min(f.date for f in frames if f.camera_id == c), "dateMax": max(f.date for f in frames if f.camera_id == c)}
                    for c in cameras],
        "frames": [{"cameraId": f.camera_id, "gridCell": f.grid_cell, "date": f.date, "capturedAt": f.captured_at, "visitId": f.visit_id,
                    "visitFrameIndex": f.visit_frame_index, "visitFrameCount": f.visit_frame_count, "cropPath": f"clover/crops/{f.crop_filename}",
                    "cropWidth": f.crop_width, "cropHeight": f.crop_height, "isRepresentative": f.is_representative,
                    "arucoTag": False, "tagId": None} for f in frames],
        "visits": [{"visitId": v.visit_id, "cameraId": v.camera_id, "gridCell": v.grid_cell, "date": v.date, "startedAt": v.started_at,
                    "endedAt": v.ended_at, "durationSeconds": v.duration_seconds, "frameCount": len(v.frames),
                    "representativeCropPath": f"clover/crops/{v.representative.crop_filename}",
                    "representativeCapturedAt": v.representative.captured_at, "arucoTag": False, "tagIds": []} for v in visits],
    }
    DATA_OUTPUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
    RECALL_OUTPUT.write_text(json.dumps(recall_summary(cascade), indent=1) + "\n", encoding="utf-8")
    if CROP_DIR.exists():
        shutil.rmtree(CROP_DIR)
    building.rename(CROP_DIR)
    return {"frames": len(frames), "visits": len(visits), "cameras": cameras,
            "crop_bytes": sum(p.stat().st_size for p in CROP_DIR.glob("*.webp")), "manifest": str(manifest)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cascade", type=Path, default=CASCADE)
    print(json.dumps(build(parser.parse_args().cascade), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
