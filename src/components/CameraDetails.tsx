import { formatCheckDate } from '../data/cameras'
import type { CameraRecord } from '../types'

interface CameraDetailsProps {
  camera: CameraRecord
}

export function CameraDetails({ camera }: CameraDetailsProps) {
  return (
    <aside className="details-card" aria-live="polite">
      <div className="details-heading">
        <div>
          <p className="eyebrow">{camera.gridId} grid</p>
          <h2>
            {camera.gridCell} · Camera {camera.cameraId}
          </h2>
        </div>
        <span className={`status-pill status-pill--${camera.status}`}>
          <span aria-hidden="true">—</span>
          Taken down
        </span>
      </div>
      <dl className="details-list">
        <div>
          <dt>Last field check</dt>
          <dd>{formatCheckDate(camera.checkedAt)}</dd>
        </div>
        <div>
          <dt>Field status</dt>
          <dd>{camera.note}</dd>
        </div>
      </dl>
    </aside>
  )
}
