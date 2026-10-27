#!/usr/bin/env python3
"""Regroup the published frames into visits without rebuilding the crops.

Reads the dashboard JSON (src/data/positive-data.json and clover-data.json), rebuilds each frame from it,
and reruns the builders' own visit grouping and output writers (build_positive_assets.write_outputs and
build_clover_assets.write_outputs). Visit IDs, frame indexes, representatives, the JSON, the CSV downloads
and the tagged-bee table change; crops and ZIPs are untouched. Run it after changing the visit rule
(build_positive_assets.starts_new_visit). With --refresh-tags it also takes each Emerald Queen frame's ArUco
flag and tag ID from the private positives manifest (after export_cascade_positives.py), for tag changes that
need no new crops.

  python3 scripts/regroup_visits.py [--refresh-tags]
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_clover_assets as clover  # noqa: E402
import build_positive_assets as positives  # noqa: E402


def published_frames(path: Path, site: str) -> list[positives.Frame]:
    return [
        positives.Frame(site=site, camera_id=f["cameraId"], grid_cell=f["gridCell"], date=f["date"], captured_at=f["capturedAt"],
                        timestamp=datetime.fromisoformat(f["capturedAt"]), crop_filename=f["cropPath"].split("/")[-1],
                        crop_width=f["cropWidth"], crop_height=f["cropHeight"], sharpness=f["sharpness"],
                        aruco=f["arucoTag"], tag_id=f["tagId"] or "")
        for f in json.loads(path.read_text(encoding="utf-8"))["frames"]
    ]


def manifest_tags() -> dict[str, tuple[bool, str]]:
    """Crop filename -> (aruco, tag_id) from the positives manifest, naming crops as build_positive_assets does."""
    csv.field_size_limit(sys.maxsize)
    tags, used = {}, set()
    for row in csv.DictReader(positives.DEFAULT_MANIFEST.open(newline="", encoding="utf-8-sig")):
        base = positives.crop_filename(positives.parse_camera_id(row["camera"]), row["captured_at"])
        name, suffix = base, 1
        while name in used:
            suffix += 1
            name = base.replace(".webp", f"_{suffix}.webp")
        used.add(name)
        tags[name] = (row.get("aruco") == "1", row.get("tag_id", ""))
    return tags


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh-tags", action="store_true")
    args = parser.parse_args()
    for name, module, site in (("Emerald Queen", positives, "emerald_queen"), ("Clover", clover, clover.SITE)):
        frames = published_frames(module.DATA_OUTPUT, site)
        if args.refresh_tags and module is positives:
            tags = manifest_tags()
            if set(tags) != {frame.crop_filename for frame in frames}:
                raise SystemExit("The positives manifest and the published frames differ; run the full rebuild instead")
            for frame in frames:
                frame.aruco, frame.tag_id = tags[frame.crop_filename]
        before = len(json.loads(module.DATA_OUTPUT.read_text(encoding="utf-8"))["visits"])
        visits = module.write_outputs(frames)
        print(f"{name}: {len(frames)} frames, {before} -> {len(visits)} visits (new visit after a gap > {positives.VISIT_GAP_SECONDS:g} s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
