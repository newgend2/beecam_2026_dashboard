#!/usr/bin/env python3
"""Stage-by-stage numbers for the round 6 cascade, for the Model training tab.

Reads the bombus_cascade project read-only: the frozen pipeline config, the cached cascade runs (detector proposals after
the floor and NMS, and every member x view classifier probability) on the development split and test cohort v6, and the
manifest's human boxes. Writes aggregated numbers only (no paths or image ids) to src/data/cascade-stages.json:

- detector alone: every proposal counts as an insect, matched one-to-one to human Bombus and other-insect boxes at the
  project's IoU (0.3), at the proposal floor and at confidence 0.25; and the share of human Bombus boxes a proposal
  covers at the floor, the ceiling on the cascade's recall;
- each ensemble member alone (its four views averaged) and the full ensemble, scored exactly as the pipeline is
  (threshold, post-classifier NMS, one-to-one match), at the frozen threshold and at each member's own threshold
  chosen on development by the pipeline's rule (maximize min(precision, recall), ties by F1 then higher threshold);
- the demo examples, from public/model/cascade_demo.json (scripts/build_cascade_demo.py).

  <cascade>/.venv/bin/python scripts/build_cascade_stages.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASCADE = Path.home() / "Desktop" / "beecam_2026" / "bombus_cascade"
PIPELINE = CASCADE / "configs" / "pipelines" / "r6_20261015.json"
RUNS = {"Development (4,141 images)": ("development", CASCADE / "runs/model_tab/r6_dev"),
        "Held-out test v6 (1,421 images)": ("held-out", CASCADE / "runs/test/archive_v6_corrected_r6_20261015")}
DEMO = ROOT / "public" / "model" / "cascade_demo.json"
OUTPUT = ROOT / "src" / "data" / "cascade-stages.json"
sys.path.insert(0, str(CASCADE))

MEMBER_NOTES = {
    "r6_blur": "Blur augmentation: motion blur or defocus with low light on half the training crops, plus color jitter.",
    "r6_colour_cam": "Color and white-balance jitter, with camera-balanced sampling so no camera dominates training.",
}


def main() -> int:
    from pipeline.common import BOMBUS, MATCH_IOU, Box, current_manifest, event_key, read_boxes, read_manifest, match
    from pipeline.evaluate.evaluate import evaluate

    config = json.loads(PIPELINE.read_text())
    det, cls = config["detector"], config["classifier"]
    members = list(cls["checkpoints"])
    runs = {}
    for label, (kind, folder) in RUNS.items():
        data = json.loads((folder / "probabilities.json").read_text())
        ids = list(data["proposals"])
        rows = read_manifest(current_manifest(), keep=lambda r: r["image_id"] in set(ids))
        runs[label] = (kind, data, {i: rows[i] for i in ids})

    detector_metrics = []
    for label, (kind, data, rows) in runs.items():
        for conf in (det["proposal_floor"], 0.25):
            tp = fp = fn = covered = bombus = 0
            for i, row in rows.items():
                truth = read_boxes(row["label_path"])
                props = [Box(**p) for p in data["proposals"][i] if p["conf"] >= conf]
                t = match([Box(0, b.x, b.y, b.w, b.h, b.conf) for b in props], [Box(0, b.x, b.y, b.w, b.h) for b in truth], MATCH_IOU)
                tp, fp, fn = tp + t, fp + len(props) - t, fn + len(truth) - t
                targets = [b for b in truth if b.cls == BOMBUS]
                covered += match([Box(BOMBUS, b.x, b.y, b.w, b.h, b.conf) for b in props], targets, MATCH_IOU)
                bombus += len(targets)
            detector_metrics.append({"data": label, "kind": kind, "images": len(rows), "matchIou": MATCH_IOU, "conf": conf,
                                     "insect": {"tp": tp, "fp": fp, "fn": fn}, "bombusRecall": {"covered": covered, "boxes": bombus}})

    def items(data, rows, member):
        out = {}
        for i, row in rows.items():
            detail = data["branch_view"][i]
            probs = [sum(d[f"{member}_{v}"] for v in cls["views"]) / len(cls["views"]) for d in detail] if member else data["probabilities"][i]
            out[i] = {"proposals": [Box(**p) for p in data["proposals"][i]], "probabilities": probs,
                      "truth": read_boxes(row["label_path"]), "event": event_key(row), "year": row["year"]}
        return out

    def score(it, threshold, kind):
        g = evaluate(it, threshold, config["post_classifier_nms_iou"], kind, group_by=None)["groups"]["all"]
        return {"tp": g["tp"], "fp": g["fp"], "fn": g["fn"]}

    def own_threshold(it):
        candidates = sorted({round(p, 4) for v in it.values() for p in v["probabilities"] if p >= 0.05})
        best = None
        for t in candidates[::max(1, len(candidates) // 400)]:
            s = score(it, t, "development")
            p = s["tp"] / (s["tp"] + s["fp"]) if s["tp"] + s["fp"] else 0
            r = s["tp"] / (s["tp"] + s["fn"]) if s["tp"] + s["fn"] else 0
            key = (min(p, r), 2 * p * r / (p + r) if p + r else 0, t)
            best = max(best or key, key)
        return best[2]

    dev_label = next(l for l, (k, *_) in runs.items() if k == "development")
    member_metrics = []
    for member in members + [None]:
        name = member or "ensemble"
        own = own_threshold(items(runs[dev_label][1], runs[dev_label][2], member)) if member else config["threshold"]
        for label, (kind, data, rows) in runs.items():
            it = items(data, rows, member)
            member_metrics.append({"member": name, "data": label, "kind": kind, "images": len(rows),
                                   "threshold": round(config["threshold"], 4), **score(it, config["threshold"], kind)})
            if member:
                member_metrics.append({"member": name, "data": label, "kind": kind, "images": len(rows), "threshold": round(own, 4),
                                       "thresholdNote": "member's own threshold, chosen on development", **score(it, own, kind)})

    demo = json.loads(DEMO.read_text()) if DEMO.exists() else {"images": []}
    stages = {
        "pipeline": config["name"], "threshold": round(config["threshold"], 4),
        "detector": {"weights": "det_r4 (YOLO, one class: insect)", "imgsz": det["imgsz"], "proposalFloor": det["proposal_floor"],
                     "nmsIou": det["proposal_nms_iou"], "rawConf": det["raw_conf"]},
        "members": [{"id": m, "label": m.replace("r6_", "").replace("_", " + ").replace("colour + cam", "color, camera-balanced"),
                     "architecture": "ResNet-50 (ImageNet start)", "inputSize": 320, "trainingNote": MEMBER_NOTES.get(m, ""),
                     "views": [f"{90 * v}°" for v in cls["views"]]} for m in members],
        "combine": "Equal mean of the softmax Bombus probabilities of every member at every view (2 members x 4 quarter-turn "
                   "views = 8 scores); a proposal is Bombus when the mean reaches the threshold, then overlapping Bombus boxes "
                   f"are merged (NMS IoU {config['post_classifier_nms_iou']}).",
        "matchRule": f"One-to-one match at IoU >= {MATCH_IOU} against human boxes; TP/FP/FN count boxes, as in the results table.",
        "detectorMetrics": detector_metrics, "memberMetrics": member_metrics,
        "examples": demo.get("images", []),
    }
    OUTPUT.write_text(json.dumps(stages, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: stages[k] for k in ("detectorMetrics", "memberMetrics")}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
