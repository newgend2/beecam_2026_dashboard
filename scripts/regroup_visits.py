#!/usr/bin/env python3
"""Regroup the published frames into visits without rebuilding the crops.

Reads the dashboard JSON (src/data/positive-data.json and clover-data.json), rebuilds each frame from it,
and reruns the builders' own visit grouping and output writers (build_positive_assets.write_outputs and
build_clover_assets.write_outputs). Visit IDs, frame indexes, representatives, the JSON, the CSV downloads
and the tagged-bee table change; crops and ZIPs are untouched. Run it after changing the visit rule
(build_positive_assets.starts_new_visit).

  python3 scripts/regroup_visits.py
"""

from __future__ import annotations

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


def main() -> int:
    for name, module, site in (("Emerald Queen", positives, "emerald_queen"), ("Clover", clover, clover.SITE)):
        frames = published_frames(module.DATA_OUTPUT, site)
        before = len(json.loads(module.DATA_OUTPUT.read_text(encoding="utf-8"))["visits"])
        visits = module.write_outputs(frames)
        print(f"{name}: {len(frames)} frames, {before} -> {len(visits)} visits (new visit after a gap > {positives.VISIT_GAP_SECONDS:g} s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
