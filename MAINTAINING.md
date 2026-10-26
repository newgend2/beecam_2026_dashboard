# Maintaining the dashboard

Technical notes for rebuilding and deploying the BeeCam 2026 dashboard. The project
overview is in [README.md](README.md).

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

It regenerates the browser data, 6,134 crop assets, two privacy-safe CSV files,
and three monthly crop ZIPs (each under GitHub's 100 MB limit). A visit's gallery representative is the sharpest crop in its
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

## Sharpness

Every crop carries a sharpness score (`scripts/sharpness.py`): the variance of the
Laplacian inside each Bombus box of the crop, after the box is converted to grayscale
and shrunk so its long side is at most 64 pixels; the crop takes its sharpest box.
Scoring only the bee, at one scale, keeps the score about the bee. Over a whole crop the
variance mostly rewards sensor grain and the speckled targets, which put blurred
fly-throughs near the top.

The score picks each visit's representative frame, orders the gallery's "Sharpest first"
sort, and limits the Overview slideshow to the sharpest tenth of visits
(`LANDING_SHARPEST_SHARE` in `src/data/positives.ts`). Both refresh scripts score crops as
they make them and record each crop's boxes, in crop coordinates, in
`scripts/crop_boxes.json`. After a change to the scoring, rescore the published crops
without the private manifests:

```bash
npm run score:sharpness
npm test
npm run build
```

## Clover cams tab

The Clover cams (Oregon) tab is built by `scripts/build_clover_assets.py`
(`npm run refresh:clover`). It reads the `bombus_cascade` manifest read-only, keeps the
human-confirmed Bombus frames of site `clover`, and reuses the same crop,
representative-frame and two-second visit rules as the main gallery. Site details live in
`src/data/clover-site.json` and the recall analysis figures in `src/data/clover-recall.json`.
`scripts/export_cascade_positives.py` exports only site `emerald_queen`, so clover frames
never enter the main gallery.
