"""How sharp the bee in a crop is: variance of the Laplacian inside its Bombus box.

Each Bombus box (in crop coordinates) is cut from the crop, converted to grayscale, shrunk so its long
side is at most SCALE_PIXELS, and convolved with the 3x3 Laplacian; the box scores the variance of that
response on a 0-255 scale, and the crop scores its sharpest box. Scoring only the bee, at one scale for
every bee, keeps the score about the bee's own detail. Over a whole crop the variance mostly rewards
sensor grain and the speckled targets, so blurred fly-throughs on a grainy background ranked high.

Only ImageMagick is needed, like the rest of the asset scripts.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CROP_BOXES = ROOT / "scripts" / "crop_boxes.json"
SCALE_PIXELS = 64

Box = tuple[int, int, int, int]


def boxes_in_crop(boxes: list[list[int]], bounds: tuple[int, int, int, int]) -> list[Box]:
    """The detection boxes, moved into the coordinates of the crop cut at `bounds`."""
    x_min, y_min = bounds[0], bounds[1]
    return [(box[0] - x_min, box[1] - y_min, box[2] - x_min, box[3] - y_min) for box in boxes]


def read_pgm(data: bytes) -> tuple[int, int, bytes]:
    """Width, height and 8-bit pixels of a binary PGM, as ImageMagick writes it."""
    fields: list[bytes] = []
    position = 0
    while len(fields) < 4:
        while data[position:position + 1].isspace():
            position += 1
        start = position
        while not data[position:position + 1].isspace():
            position += 1
        fields.append(data[start:position])
    if fields[0] != b"P5" or int(fields[3]) != 255:
        raise ValueError("Expected an 8-bit binary PGM")
    width, height = int(fields[1]), int(fields[2])
    pixels = data[position + 1:position + 1 + width * height]
    if len(pixels) != width * height:
        raise ValueError("Truncated PGM")
    return width, height, pixels


def laplacian_variance(width: int, height: int, pixels: bytes) -> float:
    """Variance of the 4-neighbour Laplacian over the interior pixels."""
    if width < 3 or height < 3:
        return 0.0
    total = total_squares = 0
    for y in range(1, height - 1):
        row, above, below = y * width, (y - 1) * width, (y + 1) * width
        for x in range(1, width - 1):
            value = pixels[above + x] + pixels[below + x] + pixels[row + x - 1] + pixels[row + x + 1] - 4 * pixels[row + x]
            total += value
            total_squares += value * value
    count = (width - 2) * (height - 2)
    mean = total / count
    return total_squares / count - mean * mean


def box_sharpness(crop: Path, box: Box) -> float:
    x0, y0, x1, y1 = box
    result = subprocess.run(
        [
            "convert",
            str(crop),
            "-crop",
            f"{x1 - x0}x{y1 - y0}+{x0}+{y0}",
            "+repage",
            "-colorspace",
            "Gray",
            "-filter",
            "Box",
            "-resize",
            f"{SCALE_PIXELS}x{SCALE_PIXELS}>",
            "-depth",
            "8",
            "pgm:-",
        ],
        check=True,
        capture_output=True,
    )
    return laplacian_variance(*read_pgm(result.stdout))


def bee_sharpness(crop: Path, boxes: list[Box]) -> float:
    """Sharpness of the sharpest Bombus box in the crop."""
    return round(max(box_sharpness(crop, box) for box in boxes), 1)


def representative_index(sharpness: list[float]) -> int:
    """The sharpest frame of a visit; ties go to the frame nearest the middle of the visit."""
    midpoint = (len(sharpness) - 1) / 2
    return max(range(len(sharpness)), key=lambda index: (sharpness[index], -abs(index - midpoint)))


def update_crop_boxes(prefix: str, boxes: dict[str, list], path: Path = CROP_BOXES) -> None:
    """Replace the entries under `prefix` (e.g. 'positives/crops/') with `boxes`, keeping the others.

    Each entry is [crop_width, crop_height, [[x0, y0, x1, y1], ...]] with the crop's Bombus boxes in
    crop coordinates; score_sharpness.py rescores from this file.
    """
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"padding": 200, "crops": {}}
    crops = {key: value for key, value in data["crops"].items() if not key.startswith(prefix)}
    crops.update(boxes)
    data["crops"] = dict(sorted(crops.items()))
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
