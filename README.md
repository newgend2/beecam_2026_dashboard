# BeeCam 2026 data dashboard

Static research dashboard for the Emerald Queen BeeCam camera network. The
GitHub Pages site includes:

- a randomized slideshow of unique-visit crops;
- a 26-cell spatial activity map;
- frame and unique-visit gallery modes with location and date filters;
- location and cumulative activity analytics;
- a model-training tab describing the two-stage Bombus cascade, with a demo video and
  development and held-out results;
- final taken-down status for the two camera grids; and
- curated CSV manifests and a ZIP archive of the published crops.

## Local development

```bash
npm install
npm run dev
```

Before every deployment:

```bash
npm test
npm run build
```

Pushes to `main` run the GitHub Pages deployment workflow. Vite uses relative
asset URLs so the build works at the repository subpath and after hash-route
reloads.

## Refreshing positive detections

Positives are the human-confirmed 2026 Bombus frames in the `bombus_cascade` project on
slugger. Export them (read-only against that project) into the private source manifest
`positives_manifests/bombus_positive_timeline_2026.csv`, then rebuild:

```bash
python3 scripts/export_cascade_positives.py
npm run refresh:positives
npm test
npm run build
```

The refresh script requires Python 3 and ImageMagick's `convert` command. It
normalizes `camN` and `cam-N` to Camera N, groups frames into a new visit when
the gap from the prior frame on that camera and date is at least two seconds,
and combines historical Camera 18 with Camera 19 at F5. For each source frame,
it makes one native-pixel WebP crop around the union of its detection boxes,
with a 200-pixel border clamped to the source image.

It regenerates the browser data, 1,715 crop assets, two privacy-safe CSV files,
and the crop ZIP. A visit's gallery representative is the sharpest crop in its
temporal group, with proximity to the group's midpoint used to break ties.

Archive-cohort frames carry whole-second timestamps, so frames that share a second get
`_2`, `_3`, … crop-name suffixes.

## Model demo video

`public/model/cascade_demo.mp4` is rendered by `scripts/build_cascade_demo.py` from the
frozen `bombus_cascade` pipeline named in that script, on CPU so it never competes with GPU
training. The frames are listed in `scripts/cascade_demo_ids.txt`. Run it with the cascade
project's interpreter:

```bash
CUDA_VISIBLE_DEVICES= ~/Desktop/beecam_2026/bombus_cascade/.venv/bin/python \
  scripts/build_cascade_demo.py --ids scripts/cascade_demo_ids.txt
```

The model tab's other figures live in `src/data/model-stats.json`, each with its source.

## Data boundaries

The authoritative camera-to-cell mapping is
`sensor_grid_status/cam_cellnums.txt`. Public current-state records live in
`src/data/camera-status.json`.

The source detection manifest and historical camera field log are ignored by
Git because they contain absolute paths or free-form notes. The public
manifests exclude `source_path`, `image_id`, `event_id`, and `camera_period`,
and add normalized camera IDs, grid cells, and visit fields instead.
