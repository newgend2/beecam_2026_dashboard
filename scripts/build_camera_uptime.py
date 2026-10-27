#!/usr/bin/env python3
"""Measure how long each Emerald Queen camera was running (imaging effort) from its SD-card archives.

Every card ZIP carries the Witty Pi power log (logs/wittyPi.log). Each "System starts up because ..." line opens a
powered session, which ends at the first of: an explicit shutdown line, the scheduled shutdown the log announced,
or the next boot. A card counts only from its first to its last saved image (earlier boots are bench setup; after
the last image it had stopped: storage full, camera fault, power lost, or collected), a card that saved no image
counts nothing, and images dated outside the deployment range in the card's name (lab read-backs or another
site) are dropped and listed. Sessions logged with a reset clock (years
other than 2026) are dropped. Overlapping cards of one camera are merged, and the time is split by local date.
A camera-day with saved frames but no usable log session falls back to the span from its first to last frame,
and is marked so. Cameras outside the grid mapping (e.g. cam24) are left out.

Reads the ZIPs read-only (names and the log member only): the Expansion copies and, for May to mid June, the
NAS transfer folder. Writes aggregated, path-free numbers to src/data/camera-uptime.json.

  python3 scripts/build_camera_uptime.py
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_positive_assets import DEFAULT_MAPPING, load_camera_mapping  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src" / "data" / "camera-uptime.json"
SOURCES = {
    "Expansion emerald_queen": Path("/media/nate/Expansion/beecam_data_2026/emerald_queen"),
    "Expansion held_out": Path("/media/nate/Expansion/beecam_data_2026/held_out"),
    "Expansion california_cams": Path("/media/nate/Expansion/beecam_data_2026/california_cams"),
    "NAS May-June transfer": Path("/mnt/nas/beecam_data_volume2/beecam_data_2026/emerald_queen_transfer_june22"),
}
CARD = re.compile(r"^cam-?(\d+)_")
IMAGE = re.compile(r"cam-?(\d+)_(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)-(\d\d)-(\d+)\.jpe?g$", re.I)
SCHEDULE_WINDOW = timedelta(minutes=15)  # the Witty Pi daemon arms the schedule within a minute of boot
IMAGE_GAP = timedelta(hours=1)  # without an armed schedule, a longer gap between saved images counts as off
RANGE = re.compile(r"_(\d{4}-\d\d-\d\d)_(\d{4}-\d\d-\d\d)(?:_|\.zip)")  # card name: first and last deployment date
LOG = re.compile(r"^[\[<](\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)[\]>] (.*)$")


def parse_time(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S")


def card_evidence(path: Path) -> tuple[int | None, list[datetime], list[tuple[datetime, str]]]:
    """Camera (from the image names), saved-image times and timestamped Witty Pi log lines of one card."""
    with zipfile.ZipFile(path) as archive:
        images, cameras = [], set()
        for info in archive.infolist():
            match = IMAGE.search(info.filename)
            if match and info.file_size > 0 and "/images/" in "/" + info.filename:
                camera, day, h, m, s, ms = match.groups()
                cameras.add(int(camera))
                images.append(datetime.fromisoformat(f"{day}T{h}:{m}:{s}") + timedelta(milliseconds=int(ms[:3].ljust(3, "0"))))
        lines = []
        if "logs/wittyPi.log" in archive.namelist():
            for raw in archive.read("logs/wittyPi.log").decode("utf-8", "replace").splitlines():
                match = LOG.match(raw)
                if match:
                    lines.append((parse_time(match.group(1)), match.group(2)))
    if len(cameras) > 1:
        raise SystemExit(f"{path.name} holds images of several cameras: {sorted(cameras)}")
    return (cameras.pop() if cameras else None), sorted(images), lines


def card_sessions(images: list[datetime], lines: list[tuple[datetime, str]]) -> list[tuple[datetime, datetime]]:
    """Powered sessions of one card. A boot's scheduled shutdown counts only if the log announced it within
    SCHEDULE_WINDOW of the boot. A boot without one (clock reset, or a card pulled for service) counts only the
    stretches its saved images cover, with any gap longer than IMAGE_GAP treated as off."""
    boots = []  # [start, scheduled shutdown, explicit shutdown]
    for t, text in lines:
        if text.startswith("System starts up because"):
            boots.append([t, None, None])
        elif boots and text.startswith("Schedule next shutdown at:") and t - boots[-1][0] <= SCHEDULE_WINDOW:
            scheduled = parse_time(text.split(":", 1)[1].strip())
            if scheduled > boots[-1][0]:
                boots[-1][1] = scheduled
        elif boots and (text.startswith("Shutting down system because") or text.startswith("Halting all processes")):
            boots[-1][2] = boots[-1][2] or t
    if not images:  # a card that saved nothing was not imaging, whatever its power log says
        return []
    first_image, last_image = images[0], images[-1]
    sessions = []
    for index, (start, scheduled, explicit) in enumerate(boots):
        if start.year != 2026:
            continue
        nxt = next((b[0] for b in boots[index + 1:] if b[0].year == 2026 and b[0] > start), None)
        stop = min((t for t in (explicit, nxt) if t and t > start), default=None)
        if scheduled is None:  # no schedule armed: count only stretches covered by saved images
            seen = [start] + [t for t in images if start <= t and (stop is None or t < stop)]
            run_start = seen[0]
            for previous, current in zip(seen, seen[1:]):
                if current - previous > IMAGE_GAP:
                    if previous > run_start:
                        sessions.append((run_start, previous))
                    run_start = current
            if seen[-1] > run_start:
                sessions.append((run_start, seen[-1]))
            continue
        end = min(t for t in (scheduled, stop) if t)
        if end > start:
            sessions.append((start, end))
    # a card was imaging in the field only from its first to its last saved image: earlier boots are setup on the
    # bench, and after the last image the card had stopped (storage full, camera fault, or collected)
    return [(max(a, first_image), min(b, last_image)) for a, b in sessions if a < last_image and b > first_image]


def merge(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    out: list[list[datetime]] = []
    for start, end in sorted(intervals):
        if out and start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return [(a, b) for a, b in out]


def split_by_day(intervals: list[tuple[datetime, datetime]]) -> dict[date, float]:
    hours: dict[date, float] = defaultdict(float)
    for start, end in intervals:
        cursor = start
        while cursor < end:
            midnight = datetime.combine(cursor.date() + timedelta(days=1), datetime.min.time())
            stop = min(end, midnight)
            hours[cursor.date()] += (stop - cursor).total_seconds() / 3600
            cursor = stop
    return hours


def main() -> int:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    mapping = load_camera_mapping(DEFAULT_MAPPING)
    sessions, images, cards, skipped = defaultdict(list), defaultdict(list), defaultdict(int), defaultdict(int)
    excluded: dict[tuple[int, str], int] = defaultdict(int)
    for source, folder in SOURCES.items():
        for path in sorted(folder.glob("*.zip")):
            named = CARD.match(path.name)
            found, card_images, lines = card_evidence(path)
            camera = int(named.group(1)) if named else found
            if found is not None and found != camera:
                raise SystemExit(f"{path.name}: name says camera {camera}, images say {found}")
            if camera not in mapping:
                skipped[f"cam{camera}"] += 1
                continue
            window = RANGE.search(path.name)
            if window:  # the card's deployment dates; anything outside them is a lab read-back or another site
                first, last = (date.fromisoformat(d) for d in window.groups())
                outside = [t for t in card_images if not first <= t.date() <= last]
                for t in outside:
                    excluded[(camera, t.date().isoformat())] += 1
                card_images = [t for t in card_images if first <= t.date() <= last]
            sessions[camera] += card_sessions(card_images, lines)
            images[camera] += card_images
            cards[source] += 1
            print(f"{source}: {path.name} {len(card_images)} images, {len(lines)} log lines", file=sys.stderr)

    per_camera: dict[int, dict[date, float]] = {}
    fallback: dict[int, set[date]] = defaultdict(set)
    for camera in sorted(set(sessions) | set(images)):
        hours = split_by_day(merge(sessions[camera]))
        by_day = defaultdict(list)
        for t in images[camera]:
            if t.year == 2026:
                by_day[t.date()].append(t)
        for day, times in by_day.items():
            if hours.get(day, 0) <= 0:
                hours[day] = max((max(times) - min(times)).total_seconds() / 3600, 1 / 60)
                fallback[camera].add(day)
        per_camera[camera] = {d: h for d, h in hours.items() if h > 0}

    days = sorted({d for h in per_camera.values() for d in h})
    dates = [days[0] + timedelta(days=i) for i in range((days[-1] - days[0]).days + 1)]
    all_hours = [h for camera in per_camera.values() for h in camera.values()]
    data = {
        "summary": {
            "cameraHours": round(sum(all_hours), 1),
            "cameraDays": len(all_hours),
            "cameras": len(per_camera),
            "dateMin": dates[0].isoformat(),
            "dateMax": dates[-1].isoformat(),
            "medianHoursPerCameraDay": round(statistics.median(all_hours), 2),
            "fallbackCameraDays": sum(len(v) for v in fallback.values()),
            "fallbackHours": round(sum(per_camera[c][d] for c, ds in fallback.items() for d in ds), 1),
            "cards": dict(cards),
            "excludedCameras": dict(skipped),
            "excludedFrames": [{"cameraId": c, "date": d, "frames": n, "reason": "outside the card's deployment dates"}
                               for (c, d), n in sorted(excluded.items())],
        },
        "dates": [d.isoformat() for d in dates],
        "daily": [{"cameraHours": round(sum(round(c.get(d, 0), 2) for c in per_camera.values()), 2),
                   "camerasRunning": sum(1 for c in per_camera.values() if c.get(d, 0) > 0)} for d in dates],
        "cameras": [{"cameraId": camera, "gridCell": mapping[camera],
                     "hours": round(sum(h.values()), 1), "days": len(h),
                     "firstDate": min(h).isoformat(), "lastDate": max(h).isoformat(),
                     "daily": [round(h.get(d, 0), 2) for d in dates],
                     "fallbackDates": sorted(d.isoformat() for d in fallback[camera])}
                    for camera, h in sorted(per_camera.items())],
        "source": ("Witty Pi power logs on every 2026 Emerald Queen SD card (" + ", ".join(f"{n} {k}" for k, n in cards.items())
                   + " cards): a session runs from each logged boot to the first of the explicit shutdown, the scheduled "
                   "shutdown or the next boot, and a card counts only from its first to its last saved image. "
                   "Camera-days with saved frames but no usable log session count the span from first to last frame. "
                   "Cards lost with an SD card case (about July 9 to 23) could not be included."),
    }
    OUTPUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(data["summary"], indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
