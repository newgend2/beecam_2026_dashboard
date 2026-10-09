#!/usr/bin/env python3
"""Render the two-stage cascade demo video from a frozen bombus_cascade pipeline.

Runs the frozen detector and classifier on CPU (so it never competes with GPU
training), reading the cascade project and the raw images without writing to
either. For each image the video shows the full frame with the YOLO insect
proposal, zooms into the native-resolution crop, then shows the exact 320 px
classifier input with its Bombus probability against the frozen threshold.

  <cascade>/.venv/bin/python scripts/build_cascade_demo.py --ids demo_ids.txt
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASCADE = Path.home() / "Desktop" / "beecam_2026" / "bombus_cascade"
PIPELINE = CASCADE / "configs" / "pipelines" / "r4_20261009.json"
WORK = ROOT / "demo_work"
OUTPUT = ROOT / "public" / "model"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SIZE = (1280, 720)
FPS = 24
DISPLAY_CONF = 0.25  # proposals drawn in the video; the classifier scores every proposal

INK, PAPER, MUTED, LINE = (23, 56, 45), (255, 254, 248), (100, 117, 110), (216, 222, 213)
GOLD, GREEN, SLATE = (225, 170, 40), (22, 134, 96), (90, 110, 130)

sys.path.insert(0, str(CASCADE))


def run_cascade(ids: list[str], config: dict) -> dict:
    from pipeline.cascade import resolve, verify_pipeline
    from pipeline.classifier.score import score
    from pipeline.common import current_manifest, read_manifest, read_boxes, suppress, Box
    from pipeline.detector.propose import load_proposals, predict

    verify_pipeline(config)
    wanted = set(ids)
    rows = read_manifest(current_manifest(), keep=lambda r: r["image_id"] in wanted)
    paths = {i: rows[i]["source_path"] for i in ids}
    det = config["detector"]
    settings = {k: det[k] for k in ("imgsz", "raw_conf", "nms_iou", "rect", "batch")} | {"half": False}
    out = WORK / "cascade_cpu"
    predict(resolve(det["weights"]), [(i, paths[i]) for i in ids], out, settings, device="cpu")
    proposals = load_proposals(out, ids, det["proposal_floor"], det["proposal_nms_iou"])
    cls = config["classifier"]
    result = score(proposals, paths, {n: resolve(c["path"]) for n, c in cls["checkpoints"].items()},
                   views=tuple(cls["views"]), batch=8, workers=0, device="cpu")
    items = {}
    for i in ids:
        probs = result["probabilities"][i]
        scored = [Box(b.cls, b.x, b.y, b.w, b.h, p) for b, p in zip(proposals[i], probs)]
        kept = suppress([b for b in scored if b.conf >= config["threshold"]], config["post_classifier_nms_iou"])
        truth = read_boxes(rows[i]["label_path"])
        items[i] = {
            "path": paths[i], "camera": rows[i]["camera"], "date": rows[i]["date"], "split": rows[i]["split"],
            "truth": [b.as_dict() for b in truth],
            "proposals": [b.as_dict() | {"p_bombus": p} for b, p in zip(proposals[i], probs)],
            "bombus_detections": [b.as_dict() for b in kept],
        }
    return items


def font(size: int, bold: bool = False):
    from PIL import ImageFont
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def window(image, box, size):
    """Resample a float box (it may extend past the frame) to size; outside the frame is paper."""
    from PIL import Image
    return image.transform(size, Image.Transform.EXTENT, box, Image.Resampling.BILINEAR, fillcolor=PAPER)


def render(items: dict, ids: list[str], config: dict, frames_dir: Path) -> int:
    from PIL import Image, ImageDraw
    from pipeline.common import crop, crop_rectangle, open_rgb, Box

    threshold = config["threshold"]
    view = (24, 84, 24 + 744, 84 + 558)  # 4:3 stage for the 4056x3040 frames
    panel_x = 800
    count = 0

    def save(image):
        nonlocal count
        image.save(frames_dir / f"{count:05d}.png")
        count += 1

    def base(step: int, title: str, subtitle: str):
        canvas = Image.new("RGB", SIZE, PAPER)
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, 0, SIZE[0], 68), fill=INK)
        d.text((24, 18), "BeeCam two-stage cascade", font=font(26, True), fill=PAPER)
        for k, label in enumerate(("1  YOLO insect detector", "2  ResNet Bombus classifier")):
            x = 610 + k * 316
            active = step == k + 1
            d.rounded_rectangle((x, 16, x + 300 + 30 * k, 52), 18, fill=GOLD if active else (46, 82, 70))
            d.text((x + 16, 24), label, font=font(17, True), fill=INK if active else (200, 214, 206))
        d.text((24, 656), title, font=font(20, True), fill=INK)
        d.text((24, 686), subtitle, font=font(15), fill=MUTED)
        return canvas, d

    # Title card
    for _ in range(int(FPS * 2.5)):
        canvas = Image.new("RGB", SIZE, INK)
        d = ImageDraw.Draw(canvas)
        d.text((80, 250), "Finding Bombus in camera-trap frames", font=font(44, True), fill=PAPER)
        d.text((80, 320), "Stage 1  A full-image YOLO model proposes every insect.", font=font(24), fill=(200, 214, 206))
        d.text((80, 360), "Stage 2  A ResNet classifier scores each native-resolution crop as Bombus or other insect.",
               font=font(20), fill=(200, 214, 206))
        d.text((80, 440), f"Frozen pipeline {config['name']} · Emerald Queen, Willow Creek CA · 2026",
               font=font(18), fill=GOLD)
        save(canvas)

    for n, image_id in enumerate(ids, 1):
        item = items[image_id]
        image = open_rgb(item["path"])
        W, H = image.size
        scale = min((view[2] - view[0]) / W, (view[3] - view[1]) / H)
        full = image.resize((round(W * scale), round(H * scale)))
        shown = [p for p in item["proposals"] if p["conf"] >= DISPLAY_CONF] or \
            sorted(item["proposals"], key=lambda p: -p["conf"])[:1]
        focus = max(shown, key=lambda p: p["p_bombus"])
        fbox = Box(focus["cls"], focus["x"], focus["y"], focus["w"], focus["h"])
        rect = crop_rectangle(fbox, W, H, 1.25)
        crop_image, _ = crop(image, fbox)
        p = focus["p_bombus"]
        is_bombus = bool(item["bombus_detections"])
        where = f"Camera {item['camera'].replace('cam', '')} · {item['date']} · image {n} of {len(ids)}"

        def to_view(xy):
            return (view[0] + xy[0] * scale, view[1] + xy[1] * scale)

        # Stage 1: frame, then proposals draw in.
        frames = int(FPS * 1.6)
        for f in range(frames):
            canvas, d = base(1, "Stage 1: the detector looks at the whole frame", where)
            canvas.paste(full, (view[0], view[1]))
            t = ease((f - FPS * 0.4) / (FPS * 0.5))
            if t > 0:
                for q in shown:
                    x1, y1 = to_view(((q["x"] - q["w"] / 2) * W, (q["y"] - q["h"] / 2) * H))
                    x2, y2 = to_view(((q["x"] + q["w"] / 2) * W, (q["y"] + q["h"] / 2) * H))
                    pad = (1 - t) * 30
                    d.rectangle((x1 - pad, y1 - pad, x2 + pad, y2 + pad), outline=GREEN, width=4)
                    if t >= 1:
                        label = f"insect {q['conf']:.2f}"
                        d.rectangle((x1, y1 - 26, x1 + 14 + 9 * len(label), y1), fill=GREEN)
                        d.text((x1 + 7, y1 - 23), label, font=font(16, True), fill=PAPER)
            d.text((panel_x, 110), "Insect proposals", font=font(24, True), fill=INK)
            d.text((panel_x, 146), "One class: any insect.", font=font(17), fill=MUTED)
            d.text((panel_x, 172), f"{len(item['proposals'])} proposal{'' if len(item['proposals']) == 1 else 's'} scored,", font=font(17), fill=MUTED)
            d.text((panel_x, 198), f"{len(shown)} drawn (confidence ≥ {DISPLAY_CONF}).", font=font(17), fill=MUTED)
            save(canvas)

        # Zoom into the native-resolution context crop.
        frames = int(FPS * 1.0)
        start = (0, 0, W, H)
        for f in range(frames + int(FPS * 0.3)):
            t = ease(f / frames)
            r = lerp(start, rect, t)
            aspect = (view[2] - view[0]) / (view[3] - view[1])
            rw, rh = r[2] - r[0], r[3] - r[1]
            if rw / rh > aspect:
                rh = rw / aspect
            else:
                rw = rh * aspect
            cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
            box = (cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2)
            region = window(image, box, (view[2] - view[0], view[3] - view[1]))
            canvas, d = base(1, "Cutting the proposal at native resolution", where)
            canvas.paste(region, (view[0], view[1]))
            sx = (view[2] - view[0]) / (box[2] - box[0])
            d.rectangle((view[0] + (rect[0] - box[0]) * sx, view[1] + (rect[1] - box[1]) * sx,
                         view[0] + (rect[2] - box[0]) * sx, view[1] + (rect[3] - box[1]) * sx), outline=GREEN, width=4)
            d.text((panel_x, 110), "Native crop", font=font(24, True), fill=INK)
            d.text((panel_x, 146), f"{rect[2] - rect[0]} × {rect[3] - rect[1]} px from the", font=font(17), fill=MUTED)
            d.text((panel_x, 172), f"{W} × {H} frame, 1.25× context.", font=font(17), fill=MUTED)
            save(canvas)

        # Stage 2: classifier input and probability.
        zoomed = window(image, box, (view[2] - view[0], view[3] - view[1]))
        frames = int(FPS * 2.2)
        verdict_colour = GOLD if is_bombus else SLATE
        for f in range(frames + int(FPS * 1.0)):
            canvas, d = base(2, "Stage 2: the classifier decides", where)
            canvas.paste(zoomed, (view[0], view[1]))
            canvas.paste(crop_image, (panel_x, 96))
            d.rectangle((panel_x - 1, 95, panel_x + 320, 416), outline=LINE, width=2)
            d.text((panel_x, 424), "320 px classifier input (pad to square)", font=font(14), fill=MUTED)
            t = ease((f - FPS * 0.3) / (FPS * 1.2))
            bar = (panel_x, 470, panel_x + 384, 500)
            d.text((panel_x, 446), "P(Bombus)", font=font(17, True), fill=INK)
            d.rounded_rectangle(bar, 8, fill=(232, 236, 228))
            if t > 0:
                d.rounded_rectangle((bar[0], bar[1], bar[0] + max(16, (bar[2] - bar[0]) * p * t), bar[3]), 8,
                                    fill=verdict_colour)
            tx = bar[0] + (bar[2] - bar[0]) * threshold
            d.line((tx, bar[1] - 6, tx, bar[3] + 6), fill=INK, width=3)
            d.text((tx - 40, bar[3] + 8), f"threshold {threshold:.2f}", font=font(13), fill=MUTED)
            d.text((bar[2] - 56, 446), f"{p * t:.2f}", font=font(17, True), fill=INK)
            if f >= FPS * 1.6:
                label = "Bombus" if is_bombus else "Other insect"
                d.rounded_rectangle((panel_x, 560, panel_x + 384, 630), 14, fill=verdict_colour)
                d.text((panel_x + 22, 576), label, font=font(32, True), fill=INK if is_bombus else PAPER)
            save(canvas)
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ids", type=Path, required=True, help="one image_id per line, in video order")
    parser.add_argument("--pipeline", type=Path, default=PIPELINE)
    parser.add_argument("--score-only", action="store_true", help="run the cascade and stop before rendering")
    args = parser.parse_args()
    ids = [line.split()[0] for line in args.ids.read_text().splitlines() if line.strip()]
    config = json.loads(args.pipeline.read_text())
    WORK.mkdir(exist_ok=True)
    results_path = WORK / "cascade_results.json"
    items = json.loads(results_path.read_text()) if results_path.exists() else {}
    missing = [i for i in ids if i not in items]
    if missing:
        items.update(run_cascade(missing, config))
        results_path.write_text(json.dumps(items, indent=1))
    for i in ids:
        best = max((p["p_bombus"] for p in items[i]["proposals"]), default=0)
        truth = "bombus" if any(b["cls"] == 0 for b in items[i]["truth"]) else "other"
        print(f"{i[:8]} truth={truth:6s} proposals={len(items[i]['proposals']):3d} "
              f"max_p={best:.3f} bombus_detections={len(items[i]['bombus_detections'])}")
    if args.score_only:
        return 0

    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        frames = render(items, ids, config, Path(tmp))
        encode = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{tmp}/%05d.png"]
        subprocess.run(encode + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow",
                                 "-movflags", "+faststart", str(OUTPUT / "cascade_demo.mp4")], check=True)
        shutil.copy(f"{tmp}/{int(FPS * 2.5) + int(FPS * 4.8):05d}.png", WORK / "poster.png")
    subprocess.run(["convert", str(WORK / "poster.png"), "-quality", "82", str(OUTPUT / "cascade_demo_poster.webp")],
                   check=True)
    summary = {"pipeline": config["name"], "pipeline_sha256": __import__("hashlib").sha256(args.pipeline.read_bytes()).hexdigest(),
               "device": "cpu (detector half=False)", "frames": frames, "fps": FPS,
               "images": [{"camera": items[i]["camera"], "date": items[i]["date"], "split": items[i]["split"],
                           "truth": "bombus" if any(b["cls"] == 0 for b in items[i]["truth"]) else "other_insect",
                           "decision": "bombus" if items[i]["bombus_detections"] else "other_insect",
                           "p_bombus": max((p["p_bombus"] for p in items[i]["proposals"]), default=0)} for i in ids]}
    (OUTPUT / "cascade_demo.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({k: v for k, v in summary.items() if k != "images"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
