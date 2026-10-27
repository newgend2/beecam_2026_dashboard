#!/usr/bin/env python3
"""Where in the full camera frame Bombus were seen: Emerald Queen (triggered) vs clover (timelapse).

Inputs, both read-only:
- positives_manifests/bombus_positive_timeline_2026.csv: every human-confirmed Emerald Queen Bombus box
  (pixels on the 4056 x 3040 frame). These frames were saved only when the camera's on-board insect model
  triggered.
- bombus_cascade runs/timelapse_eval_2026/box_positions.json (scripts/export_clover_box_positions.py):
  every human Bombus box of the reviewed clover timelapse cohort, with its frame's inclusion weight and
  whether the camera's int8 trigger model (score >= 0.25) would have fired on it.

Writes src/data/position-analytics.json with only aggregated, normalised numbers (no paths or ids).
Emerald Queen statistics are weighted so each visit counts once (a visit's boxes share weight 1); clover
statistics use the cohort's inverse-inclusion weights, so they estimate all clover Bombus boxes.
Intervals are 95% bootstrap intervals that resample visits (Emerald Queen) or frames (clover).

  python3 scripts/build_position_analytics.py
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_positive_assets import VISIT_GAP_SECONDS, starts_new_visit  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CASCADE = Path.home() / "Desktop" / "beecam_2026" / "bombus_cascade"
POSITIVES = ROOT / "positives_manifests" / "bombus_positive_timeline_2026.csv"
CLOVER = CASCADE / "runs" / "timelapse_eval_2026" / "box_positions.json"
OUTPUT = ROOT / "src" / "data" / "position-analytics.json"
COLS, ROWS = 8, 6          # heat-map grid on the 4:3 frame
BINS = 10                  # marginal histograms
EDGE = 0.05                # a box within 5% of the frame border counts as at the edge
RINGS = [(0.1, "Outer ring"), (0.25, "Middle ring"), (0.51, "Centre")]  # by the box centre's distance to the nearest border
RADIAL_BINS = 8
SIZE_BINS = [0, 0.0025, 0.005, 0.01, 0.02, 0.04, 1.0]  # box area as a share of the frame
SIZE_LABELS = ["<0.25%", "0.25–0.5%", "0.5–1%", "1–2%", "2–4%", "≥4%"]
BOOT = 1000


def region3(v: float) -> int:
    return min(2, int(v * 3))


def ring(b: dict) -> int:
    d = min(b["x"], 1 - b["x"], b["y"], 1 - b["y"])
    return next(i for i, (limit, _) in enumerate(RINGS) if d < limit)


def radial(b: dict) -> float:
    """Distance of the box centre from the frame centre, 0 at the centre and 1 at a corner (pixel geometry)."""
    dx, dy = (b["x"] - 0.5) * 4056, (b["y"] - 0.5) * 3040
    return min(1.0, (dx * dx + dy * dy) ** 0.5 / (0.5 * (4056 ** 2 + 3040 ** 2) ** 0.5))


def at_edge(b: dict) -> bool:
    return b["x"] - b["w"] / 2 <= EDGE or b["y"] - b["h"] / 2 <= EDGE or b["x"] + b["w"] / 2 >= 1 - EDGE or b["y"] + b["h"] / 2 >= 1 - EDGE


def wilson(k: int, n: int) -> list[float] | None:
    if not n:
        return None
    z, p = 1.96, k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * ((p * (1 - p) + z * z / (4 * n)) / n) ** 0.5 / (1 + z * z / n)
    return [max(0.0, centre - half), min(1.0, centre + half)]


def size_bin(area: float) -> int:
    for index in range(len(SIZE_BINS) - 1):
        if area < SIZE_BINS[index + 1]:
            return index
    return len(SIZE_BINS) - 2


def eq_boxes() -> list[dict]:
    csv.field_size_limit(sys.maxsize)
    rows = sorted(csv.DictReader(POSITIVES.open(newline="", encoding="utf-8")), key=lambda r: (r["camera"], r["captured_at"]))
    boxes, visit, last = [], 0, None
    for row in rows:
        camera = int(row["camera"].replace("cam", "").replace("-", ""))
        t = datetime.fromisoformat(row["captured_at"]).timestamp()
        if last is None or last[0] != camera or last[1] != row["date"] or starts_new_visit(t - last[2]):
            visit += 1
        last = (camera, row["date"], t)
        W, H = float(row["width"]), float(row["height"])
        for x1, y1, x2, y2 in json.loads(row["boxes"] or "[]"):
            boxes.append({"camera": camera, "group": visit, "visit": visit, "t": t, "x": (x1 + x2) / 2 / W, "y": (y1 + y2) / 2 / H,
                          "w": (x2 - x1) / W, "h": (y2 - y1) / H, "hour": int(row["captured_at"][11:13])})
    per_visit = defaultdict(int)
    for box in boxes:
        per_visit[box["group"]] += 1
    for box in boxes:
        box["weight"] = 1 / per_visit[box["group"]]
    return boxes


def clover_boxes() -> list[dict]:
    """Clover boxes grouped into visits by the dashboard's visit rule (build_positive_assets.starts_new_visit); each visit counts once, its boxes sharing that weight in
    proportion to their frames' inverse-inclusion weights (Q2/Q3 frames stand for many unreviewed ones)."""
    data = json.loads(CLOVER.read_text())
    boxes = []
    for b in data["boxes"]:
        boxes.append({"camera": b["camera"], "group": f"{b['card']}/{b['member']}", "t": b["t"], "date": datetime.fromtimestamp(b["t"]).date().isoformat(), "card": b["card"],
                      "x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"], "weight": b["weight"],
                      "hit": b["int8_hit"], "saved": b["frame_saved"], "inclusionWeight": b["weight"]})
    boxes.sort(key=lambda b: (b["camera"], b["t"]))
    visit, last = 0, None
    for b in boxes:
        if last is None or last[0] != b["camera"] or b["date"] != last[2] or starts_new_visit(b["t"] - last[1]):
            visit += 1
        b["visit"] = visit
        last = (b["camera"], b["t"], b["date"])
    totals = defaultdict(float)
    for b in boxes:
        totals[b["visit"]] += b["inclusionWeight"]
    for b in boxes:
        b["weight"] = b["inclusionWeight"] / totals[b["visit"]]
    return boxes


def stats(boxes: list[dict]) -> dict:
    total = sum(b["weight"] for b in boxes) or 1.0
    heat = [[0.0] * COLS for _ in range(ROWS)]
    xs, ys, sizes = [0.0] * BINS, [0.0] * BINS, [0.0] * (len(SIZE_BINS) - 1)
    thirds = {"left": 0.0, "centre": 0.0, "right": 0.0, "top": 0.0, "middle": 0.0, "bottom": 0.0}
    centre = edge = 0.0
    rings, radials = [0.0] * len(RINGS), [0.0] * RADIAL_BINS
    for b in boxes:
        w = b["weight"] / total
        heat[min(ROWS - 1, int(b["y"] * ROWS))][min(COLS - 1, int(b["x"] * COLS))] += w
        xs[min(BINS - 1, int(b["x"] * BINS))] += w
        ys[min(BINS - 1, int(b["y"] * BINS))] += w
        sizes[size_bin(b["w"] * b["h"])] += w
        thirds[("left", "centre", "right")[region3(b["x"])]] += w
        thirds[("top", "middle", "bottom")[region3(b["y"])]] += w
        centre += w * (0.25 <= b["x"] < 0.75 and 0.25 <= b["y"] < 0.75)
        edge += w * at_edge(b)
        rings[ring(b)] += w
        radials[min(RADIAL_BINS - 1, int(radial(b) * RADIAL_BINS))] += w
    areas = sorted((b["w"] * b["h"], b["weight"]) for b in boxes)
    acc, median = 0.0, 0.0
    for area, weight in areas:
        acc += weight
        if acc >= total / 2:
            median = area
            break
    return {"heat": heat, "x": xs, "y": ys, "size": sizes, "thirds": thirds, "centreShare": centre,
            "edgeShare": edge, "rings": rings, "radial": radials, "meanRadial": sum(radial(b) * b["weight"] for b in boxes) / total, "meanX": sum(b["x"] * b["weight"] for b in boxes) / total,
            "meanY": sum(b["y"] * b["weight"] for b in boxes) / total, "medianArea": median}


def boot(boxes: list[dict], fn, seed: int) -> list[float]:
    groups = defaultdict(list)
    for b in boxes:
        groups[b["visit"]].append(b)
    keys = list(groups)
    rng = random.Random(seed)
    values = []
    for _ in range(BOOT):
        sample = [b for key in rng.choices(keys, k=len(keys)) for b in groups[key]]
        values.append(fn(sample))
    values.sort()
    return [values[int(0.025 * BOOT)], values[int(0.975 * BOOT) - 1]]


def headline(boxes: list[dict], seed: int) -> dict:
    s = stats(boxes)
    out = {}
    for key, fn in {
        "centreShare": lambda b: stats(b)["centreShare"],
        "edgeShare": lambda b: stats(b)["edgeShare"],
        "meanRadial": lambda b: stats(b)["meanRadial"],
        "meanX": lambda b: stats(b)["meanX"],
        "meanY": lambda b: stats(b)["meanY"],
        "topShare": lambda b: stats(b)["thirds"]["top"],
        "bottomShare": lambda b: stats(b)["thirds"]["bottom"],
        "medianArea": lambda b: stats(b)["medianArea"],
    }.items():
        value = s["thirds"][key[:-5]] if key in ("topShare", "bottomShare") else s[key]
        out[key] = {"value": value, "ci95": boot(boxes, fn, seed)}
    return out


def trigger_bias(boxes: list[dict]) -> dict:
    """Weighted share of clover Bombus boxes the camera trigger would have caught, by region and by size."""
    def rate(sel):
        w = sum(b["weight"] for b in sel)
        caught, saved = sum(b["hit"] for b in sel), sum(b["saved"] for b in sel)
        return {"boxes": len(sel), "caught": caught, "saved": saved,
                "caughtRate": caught / len(sel) if sel else None, "caughtCi95": wilson(caught, len(sel)),
                "savedRate": saved / len(sel) if sel else None, "savedCi95": wilson(saved, len(sel)),
                "caughtWeighted": sum(b["weight"] * b["hit"] for b in sel) / w if w else None}
    grid = [[rate([b for b in boxes if region3(b["y"]) == r and region3(b["x"]) == c]) for c in range(3)] for r in range(3)]
    rings = [dict(rate([b for b in boxes if ring(b) == i]), label=label) for i, (_, label) in enumerate(RINGS)]
    size = [dict(rate([b for b in boxes if size_bin(b["w"] * b["h"]) == i]), label=SIZE_LABELS[i]) for i in range(len(SIZE_LABELS))]
    return {"overall": rate(boxes), "visitsByArrival": visit_bias(boxes), "grid3": grid, "rings": rings, "size": size,
            "edge": rate([b for b in boxes if at_edge(b)]), "interior": rate([b for b in boxes if not at_edge(b)])}


def arrivals(boxes: list[dict]) -> list[dict]:
    """The first box of each visit, weight 1 per visit."""
    first = {}
    for b in sorted(boxes, key=lambda b: b["t"]):
        first.setdefault(b["visit"], {**b, "weight": 1.0})
    return list(first.values())


def visit_bias(boxes: list[dict]) -> list[dict]:
    """Clover visits by where the bee arrived: did the trigger detect it in any reviewed frame, and would the
    camera (with its stale filter) have saved at least one of them?"""
    visits = defaultdict(list)
    for b in boxes:
        visits[b["visit"]].append(b)
    out = []
    for i, (_, label) in enumerate(RINGS):
        sel = [v for v in visits.values() if ring(min(v, key=lambda b: b["t"])) == i]
        caught, saved = sum(any(b["hit"] for b in v) for v in sel), sum(any(b["saved"] for b in v) for v in sel)
        out.append({"label": label, "visits": len(sel), "caught": caught, "saved": saved,
                    "caughtRate": caught / len(sel) if sel else None, "caughtCi95": wilson(caught, len(sel)),
                    "savedRate": saved / len(sel) if sel else None, "savedCi95": wilson(saved, len(sel))})
    return out


def per_camera(boxes: list[dict]) -> list[dict]:
    """Each camera's spread: share of its visit-weighted boxes in its single busiest heat-map cell."""
    out = []
    for camera in sorted({b["camera"] for b in boxes}, key=lambda c: (str(type(c)), c)):
        sel = [b for b in boxes if b["camera"] == camera]
        s = stats(sel)
        peak = max(max(row) for row in s["heat"])
        out.append({"camera": camera, "boxes": len(sel), "visits": len({b["visit"] for b in sel}),
                    "heat": s["heat"], "peakCellShare": peak,
                    "occupiedCells": sum(1 for row in s["heat"] for v in row if v > 0),
                    "meanX": s["meanX"], "meanY": s["meanY"], "edgeShare": s["edgeShare"]})
    return out


def rounded(value):
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    if isinstance(value, list):
        return [rounded(v) for v in value]
    return value


def main() -> int:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    eq, clover = eq_boxes(), clover_boxes()
    eq_stats, clover_stats = stats(eq), stats(clover)
    eq_arrive, clover_arrive = stats(arrivals(eq)), stats(arrivals(clover))
    data = {
        "grid": {"cols": COLS, "rows": ROWS, "bins": BINS, "radialBins": RADIAL_BINS, "sizeLabels": SIZE_LABELS,
                 "ringLabels": [label for _, label in RINGS], "edgeMargin": EDGE, "frameWidth": 4056, "frameHeight": 3040},
        "emeraldQueen": {
            "boxes": len(eq), "visits": len({b["group"] for b in eq}), "cameras": len({b["camera"] for b in eq}),
            "capture": "Saved only when the camera's on-board insect model triggered",
            "weighting": "each visit counts once",
            **{k: eq_stats[k] for k in ("heat", "x", "y", "size", "thirds", "rings", "radial")},
            "arrival": {k: eq_arrive[k] for k in ("heat", "thirds", "rings", "edgeShare", "meanRadial")},
            "headline": headline(eq, 1),
            "perCamera": per_camera(eq),
        },
        "clover": {
            "boxes": len(clover), "frames": len({b["group"] for b in clover}), "visits": len({b["visit"] for b in clover}),
            "cameras": len({b["camera"] for b in clover}), "estBoxes": sum(b["weight"] for b in clover),
            "capture": "Timelapse: every frame saved, no trigger",
            "weighting": f"each visit ({VISIT_GAP_SECONDS:g} s rule) counts once; within a visit, boxes are weighted by inverse inclusion probability",
            **{k: clover_stats[k] for k in ("heat", "x", "y", "size", "thirds", "rings", "radial")},
            "arrival": {k: clover_arrive[k] for k in ("heat", "thirds", "rings", "edgeShare", "meanRadial")},
            "headline": headline(clover, 2),
            "perCamera": per_camera(clover),
            "triggerBias": trigger_bias(clover),
        },
        "sources": {
            "emeraldQueen": "Human-confirmed Bombus boxes from the bombus_cascade live manifest (scripts/export_cascade_positives.py), test images excluded.",
            "clover": "Human Bombus boxes of the reviewed clover timelapse cohort timelapse_eval_2026_r1 (bombus_cascade scripts/export_clover_box_positions.py); trigger = int8 field model at score 0.25, box matched by IoU >= 0.3 or centre inside the box.",
        },
    }
    OUTPUT.write_text(json.dumps(rounded(data), indent=1) + "\n", encoding="utf-8")
    print(f"{data['emeraldQueen']['boxes']} Emerald Queen boxes ({data['emeraldQueen']['visits']} visits), "
          f"{data['clover']['boxes']} clover boxes ({data['clover']['visits']} visits) -> {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
