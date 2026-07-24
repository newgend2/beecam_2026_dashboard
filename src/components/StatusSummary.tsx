import type { CameraRecord } from '../types'

interface StatusSummaryProps {
  cameras: CameraRecord[]
}

export function StatusSummary({ cameras }: StatusSummaryProps) {
  const nominal = cameras.filter((camera) => camera.status === 'nominal').length
  const defective = cameras.length - nominal

  return (
    <div className="summary-grid" aria-label="Camera status summary">
      <article className="summary-card summary-card--total">
        <span>Network</span>
        <strong>{cameras.length}</strong>
        <small>deployed cameras</small>
      </article>
      <article className="summary-card summary-card--nominal">
        <span>Nominal</span>
        <strong>{nominal}</strong>
        <small>{Math.round((nominal / cameras.length) * 100)}% operational</small>
      </article>
      <article className="summary-card summary-card--defective">
        <span>Defective</span>
        <strong>{defective}</strong>
        <small>require attention</small>
      </article>
    </div>
  )
}
