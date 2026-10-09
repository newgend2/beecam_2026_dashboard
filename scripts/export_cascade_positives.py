#!/usr/bin/env python3
"""Export human-confirmed 2026 Bombus frames from the bombus_cascade manifest.

Read-only against the cascade project: it resolves the live manifest through
data/workspace/current_manifest.json and reads the YOLO label files. It writes
the private source manifest that build_positive_assets.py consumes, plus a
small JSON summary of where every number came from.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASCADE = Path.home() / "Desktop" / "beecam_2026" / "bombus_cascade"
OUTPUT = ROOT / "positives_manifests" / "bombus_positive_timeline_2026.csv"
SUMMARY = ROOT / "positives_manifests" / "cascade_export_summary.json"
BOMBUS_CLASS = "0"
FIELDS = ["image_id", "site", "camera", "date", "captured_at", "event_id", "camera_period", "source_path", "width", "height", "boxes"]


def live_manifest(cascade: Path) -> Path:
    pointer = cascade / "data" / "workspace" / "current_manifest.json"
    if pointer.is_file():
        return Path(json.loads(pointer.read_text(encoding="utf-8"))["manifest"])
    return cascade / "data" / "manifest.csv"


def bombus_boxes(label_path: Path, width: int, height: int) -> list[list[int]]:
    boxes = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5 or parts[0] != BOMBUS_CLASS:
            continue
        cx, cy, w, h = (float(value) for value in parts[1:])
        x_min = max(0, round((cx - w / 2) * width))
        y_min = max(0, round((cy - h / 2) * height))
        x_max = min(width, round((cx + w / 2) * width))
        y_max = min(height, round((cy + h / 2) * height))
        if x_max > x_min and y_max > y_min:
            boxes.append([x_min, y_min, x_max, y_max])
    return boxes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cascade", type=Path, default=CASCADE)
    args = parser.parse_args()
    manifest = live_manifest(args.cascade)
    csv.field_size_limit(sys.maxsize)

    rows = []
    with manifest.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["year"] != "2026" or row["review_state"] != "annotated" or row["split"] == "excluded":
                continue
            if not row["label_path"]:
                continue
            label = Path(row["label_path"])
            if not label.is_absolute():
                label = args.cascade / label
            width, height = int(row["width"]), int(row["height"])
            boxes = bombus_boxes(label, width, height)
            if not boxes:
                continue
            rows.append({**{key: row[key] for key in FIELDS if key not in {"boxes"}}, "boxes": json.dumps(boxes)})

    rows.sort(key=lambda row: (row["captured_at"], row["camera"], row["image_id"]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "source_manifest": str(manifest),
        "source_manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "rule": "year 2026, review_state annotated, split not excluded, at least one class-0 (Bombus) human box",
        "frames": len(rows),
        "boxes": sum(len(json.loads(row["boxes"])) for row in rows),
        "events": len({row["event_id"] for row in rows}),
        "cameras": len({row["camera"] for row in rows}),
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
