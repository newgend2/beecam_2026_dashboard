#!/usr/bin/env python3
"""Rescore the published crops for sharpness without rebuilding them.

Reads scripts/crop_boxes.json (the Bombus boxes inside every crop, written by the asset builders) and
scores each crop with sharpness.bee_sharpness. Every frame gets its score, each visit's representative
becomes its sharpest frame, and the dashboard JSON and CSV downloads are updated in place. The asset
builders score crops the same way as they make them, so this is only needed when the scoring changes.

  python3 scripts/score_sharpness.py
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sharpness import CROP_BOXES, bee_sharpness, representative_index  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
DOWNLOADS = PUBLIC / "downloads"
DATASETS = [
    (ROOT / "src" / "data" / "positive-data.json", DOWNLOADS / "all_positive_frames_2026.csv", DOWNLOADS / "unique_visits_2026.csv"),
    (ROOT / "src" / "data" / "clover-data.json", DOWNLOADS / "clover_all_positive_frames_2026.csv", DOWNLOADS / "clover_unique_visits_2026.csv"),
]


def rewrite_csv(path: Path, key: str, updates: dict[str, dict[str, object]]) -> None:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    if "sharpness" not in fieldnames:
        fieldnames.append("sharpness")
    for row in rows:
        row.update(updates[row[key]])
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def rescore(data_path: Path, frames_csv: Path, visits_csv: Path, boxes: dict[str, list[int]]) -> dict[str, int]:
    data = json.loads(data_path.read_text(encoding="utf-8"))
    for index, frame in enumerate(data["frames"], 1):
        width, height, crop_boxes = boxes[frame["cropPath"]]
        if (width, height) != (frame["cropWidth"], frame["cropHeight"]):
            raise SystemExit(f"{frame['cropPath']}: crop_boxes.json says {width}x{height}, data says {frame['cropWidth']}x{frame['cropHeight']}")
        frame["sharpness"] = bee_sharpness(PUBLIC / frame["cropPath"], [tuple(box) for box in crop_boxes])
        if index % 500 == 0 or index == len(data["frames"]):
            print(f"{data_path.name}: scored {index}/{len(data['frames'])} crops", file=sys.stderr)

    by_visit: dict[str, list[dict]] = defaultdict(list)
    for frame in data["frames"]:
        by_visit[frame["visitId"]].append(frame)
    changed = 0
    for visit in data["visits"]:
        frames = sorted(by_visit[visit["visitId"]], key=lambda frame: frame["visitFrameIndex"])
        best = frames[representative_index([frame["sharpness"] for frame in frames])]
        for frame in frames:
            frame["isRepresentative"] = frame is best
        changed += visit["representativeCropPath"] != best["cropPath"]
        visit["representativeCropPath"] = best["cropPath"]
        visit["representativeCapturedAt"] = best["capturedAt"]
        visit["sharpness"] = best["sharpness"]
    data_path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")

    rewrite_csv(frames_csv, "crop_filename", {
        frame["cropPath"].split("/")[-1]: {"sharpness": frame["sharpness"]} for frame in data["frames"]
    })
    rewrite_csv(visits_csv, "visit_id", {
        visit["visitId"]: {
            "representative_captured_at": visit["representativeCapturedAt"],
            "crop_filename": visit["representativeCropPath"].split("/")[-1],
            "sharpness": visit["sharpness"],
        }
        for visit in data["visits"]
    })
    return {"frames": len(data["frames"]), "visits": len(data["visits"]), "representatives_changed": changed}


def main() -> int:
    boxes = json.loads(CROP_BOXES.read_text(encoding="utf-8"))["crops"]
    result = {data_path.name: rescore(data_path, frames_csv, visits_csv, boxes) for data_path, frames_csv, visits_csv in DATASETS}
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
