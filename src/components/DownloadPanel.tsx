import { visitGapAdjective } from '../data/visitRule'
import { assetUrl, positiveSummary, positiveVisits } from '../data/positives'

function zipDetail(filename: string): string {
  return `ZIP · ${(__DOWNLOAD_BYTES__[filename] / 1e6).toFixed(1)} MB`
}

const taggedVisits = positiveVisits.filter((visit) => visit.arucoTag || visit.tagIds.length).length

const downloads = [
  {
    title: 'All positive frames',
    detail: `${positiveSummary.totalFrames.toLocaleString()} rows · CSV`,
    path: 'downloads/all_positive_frames_2026.csv',
  },
  {
    title: 'Unique visits',
    detail: `${positiveSummary.uniqueVisits.toLocaleString()} rows · CSV`,
    path: 'downloads/unique_visits_2026.csv',
  },
  {
    title: 'Tagged bee visits',
    detail: `${taggedVisits} visits · ${positiveSummary.tagIdentities} tag IDs · CSV`,
    path: 'downloads/tagged_bee_visits_2026.csv',
  },
  {
    title: 'Detection crops, May',
    detail: zipDetail('beecam_positive_crops_2026_may.zip'),
    path: 'downloads/beecam_positive_crops_2026_may.zip',
  },
  {
    title: 'Detection crops, June',
    detail: zipDetail('beecam_positive_crops_2026_jun.zip'),
    path: 'downloads/beecam_positive_crops_2026_jun.zip',
  },
  {
    title: 'Detection crops, July–August',
    detail: zipDetail('beecam_positive_crops_2026_jul_aug.zip'),
    path: 'downloads/beecam_positive_crops_2026_jul_aug.zip',
  },
]

export function DownloadPanel() {
  return (
    <section className="download-panel" aria-labelledby="downloads-title">
      <div>
        <p className="eyebrow">Open research data</p>
        <h2 id="downloads-title">Download the positive detections</h2>
        <p>
          Privacy-safe manifests use normalized camera IDs, grid cells, and the{' '}
          {visitGapAdjective} visit definition. Local source paths are excluded. The tagged
          bee table lists each visit by a bee carrying an ArUco or n8tag marker,
          with the ID read by hand or "unreadable".
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
