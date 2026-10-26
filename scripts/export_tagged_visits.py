#!/usr/bin/env python3
"""Write the public table of tagged-bee visits from the dashboard's positive data.

One row per visit whose bee carries a tag, with the ArUco or n8tag ID a person read from it, or
"unreadable" when the tag was seen but could not be read. visit_number counts each tag's visits in
time order. build_positive_assets.py runs this after every rebuild.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_INPUT = ROOT / "src" / "data" / "positive-data.json"
TAGGED_VISITS_OUTPUT = ROOT / "public" / "downloads" / "tagged_bee_visits_2026.csv"
FIELDNAMES = [
    "tag_id", "visit_number", "total_visits_for_tag", "camera", "grid_cell", "arrival_date",
    "arrival_time", "departure_time", "duration_seconds", "frames", "visit_id", "crop_filename",
]
UNREADABLE = "unreadable"


def tag_order(tag: str) -> tuple[int, str, int]:
    """ArUco IDs first, then n8tag IDs, each numerically, then unreadable tags."""
    kind, _, number = tag.partition(":")
    rank = {"aruco": 0, "n8tag": 1}.get(kind, 2)
    return rank, kind, int(number) if re.fullmatch(r"\d+", number) else 0


def export(data_path: Path = DATA_INPUT, output: Path = TAGGED_VISITS_OUTPUT) -> int:
    visits = json.loads(data_path.read_text(encoding="utf-8"))["visits"]
    by_tag: dict[str, list[dict]] = {}
    for visit in visits:
        if not visit["arucoTag"] and not visit["tagIds"]:
            continue
        for tag in visit["tagIds"] or [UNREADABLE]:
            by_tag.setdefault(tag, []).append(visit)

    rows = []
    for tag in sorted(by_tag, key=tag_order):
        tag_visits = sorted(by_tag[tag], key=lambda visit: visit["startedAt"])
        for number, visit in enumerate(tag_visits, start=1):
            readable = tag != UNREADABLE
            rows.append({
                "tag_id": tag,
                "visit_number": number if readable else "",
                "total_visits_for_tag": len(tag_visits) if readable else "",
                "camera": visit["cameraId"],
                "grid_cell": visit["gridCell"],
                "arrival_date": visit["date"],
                "arrival_time": visit["startedAt"][11:19],
                "departure_time": visit["endedAt"][11:19],
                "duration_seconds": f"{visit['durationSeconds']:.6f}".rstrip("0").rstrip("."),
                "frames": visit["frameCount"],
                "visit_id": visit["visitId"],
                "crop_filename": visit["representativeCropPath"].split("/")[-1],
            })

    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    print(f"wrote {export()} tagged visits to {TAGGED_VISITS_OUTPUT.relative_to(ROOT)}")
