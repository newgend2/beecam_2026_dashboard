import type { CameraRecord } from '../types'

interface StatusSummaryProps {
  cameras: CameraRecord[]
}

export function StatusSummary({ cameras }: StatusSummaryProps) {
  const takenDown = cameras.filter((camera) => camera.status === 'taken-down').length

  return (
    <div className="summary-grid" aria-label="Camera status summary">
      <article className="summary-card summary-card--total">
        <span>Network total</span>
        <strong>{cameras.length}</strong>
        <small>camera units</small>
      </article>
      <article className="summary-card summary-card--taken-down">
        <span>Taken down</span>
        <strong>{takenDown}</strong>
        <small>100% removed from site</small>
      </article>
      <article className="summary-card summary-card--inactive">
        <span>Active units</span>
        <strong>0</strong>
        <small>field season complete</small>
      </article>
    </div>
  )
}
