import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from '../components/Lightbox'
import {
  assetUrl,
  formatCameraLocation,
  formatCaptureDate,
  framesByVisit,
  locationSummaries,
  positiveFrames,
  positiveSummary,
  positiveVisits,
  visitRepresentativeFrame,
} from '../data/positives'
import type { PositiveFrame } from '../types'

type GalleryMode = 'frames' | 'visits'

interface GalleryPageProps {
  initialCell?: string
  onFilterConsumed?: () => void
}

interface LightboxState {
  frames: PositiveFrame[]
  index: number
}

const PAGE_SIZE = 48

export function GalleryPage({ initialCell, onFilterConsumed }: GalleryPageProps) {
  const [mode, setMode] = useState<GalleryMode>('frames')
  const [gridCell, setGridCell] = useState(initialCell ?? 'all')
  const [dateFrom, setDateFrom] = useState(positiveSummary.dateMin)
  const [dateTo, setDateTo] = useState(positiveSummary.dateMax)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  useEffect(() => {
    if (initialCell) {
      setGridCell(initialCell)
      onFilterConsumed?.()
    }
  }, [initialCell, onFilterConsumed])

  useEffect(() => setVisibleCount(PAGE_SIZE), [mode, gridCell, dateFrom, dateTo])

  const filteredFrames = useMemo(
    () => positiveFrames.filter((frame) =>
      (gridCell === 'all' || frame.gridCell === gridCell) &&
      frame.date >= dateFrom && frame.date <= dateTo,
    ),
    [gridCell, dateFrom, dateTo],
  )
  const filteredVisits = useMemo(
    () => positiveVisits.filter((visit) =>
      (gridCell === 'all' || visit.gridCell === gridCell) &&
      visit.date >= dateFrom && visit.date <= dateTo,
    ),
    [gridCell, dateFrom, dateTo],
  )

  const total = mode === 'frames' ? filteredFrames.length : filteredVisits.length
  const resetFilters = () => {
    setGridCell('all')
    setDateFrom(positiveSummary.dateMin)
    setDateTo(positiveSummary.dateMax)
  }

  const openFrame = (frame: PositiveFrame) => {
    const index = filteredFrames.findIndex((candidate) => candidate.cropPath === frame.cropPath)
    setLightbox({ frames: filteredFrames, index })
  }
  const openVisit = (visitId: string) => {
    const frames = framesByVisit.get(visitId) ?? []
    const representative = frames.findIndex((frame) => frame.isRepresentative)
    setLightbox({ frames, index: representative >= 0 ? representative : 0 })
  }

  return (
    <main id="main" className="dashboard-shell page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Detection archive</p>
          <h1>Positive image gallery</h1>
          <p>Browse every detection crop or condense temporally clustered frames into unique visits.</p>
        </div>
        <div className="segmented-control" aria-label="Gallery display mode">
          {(['frames', 'visits'] as const).map((value) => (
            <button key={value} type="button" className={mode === value ? 'is-active' : ''} aria-pressed={mode === value} onClick={() => setMode(value)}>
              {value === 'frames' ? 'All frames' : 'Unique visits'}
            </button>
          ))}
        </div>
      </header>

      <section className="gallery-filters" aria-label="Gallery filters">
        <label>
          Camera location
          <select value={gridCell} onChange={(event) => setGridCell(event.target.value)}>
            <option value="all">All cameras and grid cells</option>
            {locationSummaries.map((location) => (
              <option key={location.gridCell} value={location.gridCell}>
                {formatCameraLocation(location)} ({location.frames} frames)
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" min={positiveSummary.dateMin} max={dateTo} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" min={dateFrom} max={positiveSummary.dateMax} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button type="button" className="filter-reset" onClick={resetFilters}>Reset filters</button>
      </section>

      <div className="gallery-result-line" aria-live="polite">
        <strong>{total.toLocaleString()} {mode === 'frames' ? 'positive frames' : 'unique visits'}</strong>
        <span>Showing {Math.min(visibleCount, total).toLocaleString()}</span>
      </div>

      {total === 0 ? (
        <section className="empty-state">
          <h2>No detections match these filters</h2>
          <p>Try a different camera location or a broader date range.</p>
          <button type="button" className="secondary-button" onClick={resetFilters}>Show all detections</button>
        </section>
      ) : (
        <div className="gallery-grid">
          {mode === 'frames'
            ? filteredFrames.slice(0, visibleCount).map((frame) => (
                <GalleryCard
                  key={frame.cropPath}
                  frame={frame}
                  badge={frame.visitFrameCount > 1 ? `${frame.visitFrameIndex}/${frame.visitFrameCount} in visit` : 'Single-frame visit'}
                  onOpen={() => openFrame(frame)}
                />
              ))
            : filteredVisits.slice(0, visibleCount).map((visit) => {
                const frame = visitRepresentativeFrame(visit)
                return (
                  <GalleryCard
                    key={visit.visitId}
                    frame={frame}
                    badge={`${visit.frameCount} ${visit.frameCount === 1 ? 'frame' : 'frames'}`}
                    onOpen={() => openVisit(visit.visitId)}
                  />
                )
              })}
        </div>
      )}

      {visibleCount < total && (
        <div className="load-more-wrap">
          <button type="button" className="secondary-button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load 48 more
          </button>
        </div>
      )}

      {lightbox && (
        <Lightbox frames={lightbox.frames} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </main>
  )
}

interface GalleryCardProps {
  frame: PositiveFrame
  badge: string
  onOpen: () => void
}

function GalleryCard({ frame, badge, onOpen }: GalleryCardProps) {
  return (
    <article className="gallery-card">
      <button type="button" className="gallery-image-button" onClick={onOpen} aria-label={`Open detection from ${frame.gridCell}, Camera ${frame.cameraId}, ${formatCaptureDate(frame.capturedAt)}`}>
        <img
          src={assetUrl(frame.cropPath)}
          alt=""
          loading="lazy"
          width={frame.cropWidth}
          height={frame.cropHeight}
        />
        <span>View full crop</span>
      </button>
      <div className="gallery-card-copy">
        <div><strong>{frame.gridCell} · Camera {frame.cameraId}</strong><small>{formatCaptureDate(frame.capturedAt)}</small></div>
        <span className="frame-badge">{badge}</span>
      </div>
    </article>
  )
}
