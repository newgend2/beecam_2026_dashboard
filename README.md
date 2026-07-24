# BeeCam 2026 data dashboard

Static research dashboard for the Emerald Queen BeeCam camera network.

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

The authoritative camera-to-cell mapping is
`sensor_grid_status/cam_cellnums.txt`. Public current-state records live in
`src/data/camera-status.json`; the historical field log is retained as source
material locally but is excluded from both the public repository and production
bundle because it contains free-form field notes.
# beecam_2026_dashboard
