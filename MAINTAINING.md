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
the gap from the prior frame on that camera and date is more than five seconds
(`gapSeconds` in `src/data/visit-rule.json`, read by every builder through
`starts_new_visit` in `build_positive_assets.py` and by the UI through `src/data/visitRule.ts`),
and combines historical Camera 18 with Camera 19 at F5. For each source frame,
it makes one native-pixel WebP crop around the union of its detection boxes,
with a 200-pixel border clamped to the source image.

It regenerates the browser data, 6,134 crop assets, three privacy-safe CSV files
(all frames, unique visits, and tagged-bee visits from `scripts/export_tagged_visits.py`),
and three monthly crop ZIPs (each under GitHub's 100 MB limit). The download panel reads each
file's size at build time (`vite.config.ts`), so sizes never need editing by hand. A visit's gallery representative is the sharpest crop in its
temporal group, with proximity to the group's midpoint used to break ties.

Archive-cohort frames carry whole-second timestamps, so frames that share a second get
`_2`, `_3`, … crop-name suffixes.

## Model demo video

`public/model/cascade_demo.mp4` is rendered by `scripts/build_cascade_demo.py` from the
frozen `bombus_cascade` pipeline named in that script (round 6). The frames are listed in
`scripts/cascade_demo_ids.txt`. Run it with the cascade project's interpreter; rendering is on the CPU:

```bash
cd ~/Desktop/beecam_2026/bombus_cascade && .venv/bin/python ../data_dashboard/scripts/build_cascade_demo.py \
  --ids ../data_dashboard/scripts/cascade_demo_ids.txt --from-run runs/test/archive_v6_corrected_r6_20261015
.venv/bin/python ../data_dashboard/scripts/build_cascade_stages.py
```

The demo shows round 6 (`r6_20261015`) on held-out test cohort v6 frames the cascade got right, drawn at random
(seed 20261028), plus the closest correct call. `--from-run` takes every proposal and member x view score from the
frozen evaluation run, so the video matches the reported metrics; without it the cascade reruns on the CPU.
`build_cascade_stages.py` writes `src/data/cascade-stages.json`: the detector alone, each ensemble member alone
and the ensemble, on development and test v6, plus the demo examples.

The model tab's other figures live in `src/data/model-stats.json`, each with its source.
The frames-recorded total there (also on the Overview) is an exact count of the transferred
2026 Emerald Queen frames inside the raw ZIPs on slugger, de-duplicated by camera, date and
timestamp; recount it if more cards are transferred.

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

The score picks each visit's representative frame and orders the gallery's default
"Sharpest first" sort. The Overview slideshow takes each camera-day's sharpest visit, if it
is at least as sharp as the median visit, keeps up to six per camera
(`LANDING_VISITS_PER_CAMERA` in `src/data/positives.ts`), and plays them in rounds of one
visit per camera so no single busy camera or day dominates. Both refresh scripts score crops as
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
representative-frame and five-second visit rules as the main gallery. Site details live in
`src/data/clover-site.json` and the recall analysis figures in `src/data/clover-recall.json`.
`scripts/export_cascade_positives.py` exports only site `emerald_queen`, so clover frames
never enter the main gallery.

## Position in the frame (Analytics tab)

`src/data/position-analytics.json` holds only aggregated, normalised numbers. Rebuild it after a
positives or clover refresh:

```bash
# on slugger, read-only against bombus_cascade
(cd ~/Desktop/beecam_2026/bombus_cascade && .venv/bin/python scripts/export_clover_box_positions.py)
python3 scripts/export_cascade_positives.py   # if not already current
python3 scripts/build_position_analytics.py
```

Emerald Queen boxes come from the private positives manifest, with each visit weighted once. Clover
boxes and the trigger test come from the reviewed timelapse cohort (int8 field model at 0.25, the
camera's stale filter replayed), with visits by the same 5 s rule. `scripts/validate-position-data.mjs` checks the
totals against positive-data.json, clover-data.json and model-stats.json. The ring boundaries (`RINGS` in the
builder, published as `grid.ringLimits`) drive both the ring diagram and the dashed outlines on the heat maps.

## Trigger precision (Analytics tab)

`src/data/trigger-precision.json` compares the share of trigger-saved frames that hold any insect, and a Bombus,
at Emerald Queen and at the clover site. The Emerald Queen figures are weighted estimates from the random test
cohorts v2–v6 (v1 was reviewed for Bombus only; `bombus_cascade` scripts/analyze_eq_saved_frame_insects.py, results in
runs/eq_saved_frame_insects/results.json on slugger). The clover figures come from a random review of 286 int8
trigger frames (scripts/build_trigger_precision_plan.py and scripts/analyze_trigger_precision.py, results under
runs/timelapse_eval_2026/review_plan/tp_trigger/). The file is written by hand from
those results. `scripts/validate-precision-data.mjs` checks that the counts and intervals agree.

## Changing the visit rule

Edit `gapSeconds` in `src/data/visit-rule.json`, then regroup the published frames without rebuilding
the crops or ZIPs, and rebuild the position analytics:

```bash
python3 scripts/regroup_visits.py
python3 scripts/build_position_analytics.py
```

`regroup_visits.py` reruns the builders' own grouping and writers on the published JSON, so it
reproduces a full rebuild exactly. After a tag-only change in the cascade manifest, run
`python3 scripts/export_cascade_positives.py && python3 scripts/regroup_visits.py --refresh-tags`
to update frame tags without new crops. The validators check that every visit obeys the rule. The clover
recall analysis reads its visit numbers from the bombus_cascade evaluation (`gap5_edge_as_one` in
`eval_r1_final_v3`), which has to be rerun for a different gap.
