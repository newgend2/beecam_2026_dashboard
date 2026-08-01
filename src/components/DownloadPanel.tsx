import { assetUrl } from '../data/positives'

const downloads = [
  {
    title: 'All positive frames',
    detail: '809 rows · CSV',
    path: 'downloads/all_positive_frames_2026.csv',
  },
  {
    title: 'Unique visits',
    detail: '410 rows · CSV',
    path: 'downloads/unique_visits_2026.csv',
  },
  {
    title: 'Detection crop archive',
    detail: '809 crops · ZIP · 22.8 MB',
    path: 'downloads/beecam_positive_crops_2026.zip',
  },
]

export function DownloadPanel() {
  return (
    <section className="download-panel" aria-labelledby="downloads-title">
      <div>
        <p className="eyebrow">Open research data</p>
        <h2 id="downloads-title">Download the positive detections</h2>
        <p>
          Privacy-safe manifests use normalized camera IDs, grid cells, and the
          two-second visit definition. Local source paths are excluded.
        </p>
      </div>
      <div className="download-links">
        {downloads.map((download) => (
          <a key={download.path} href={assetUrl(download.path)} download>
            <span aria-hidden="true">↓</span>
            <span>
              <strong>{download.title}</strong>
              <small>{download.detail}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
