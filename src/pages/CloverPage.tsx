import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from '../components/Lightbox'
import { SharpnessNote, SortSelect } from '../components/SortSelect'
import {
  cloverCameras,
  cloverFrames,
  cloverFramesByVisit,
  cloverRecall,
  cloverRepresentativeFrame,
  cloverSite,
  cloverSummary,
  cloverVisits,
} from '../data/clover'
import { GalleryCard } from './GalleryPage'
import { assetUrl, sortForGallery } from '../data/positives'
import type { GallerySort, PositiveFrame } from '../types'

type GalleryMode = 'frames' | 'visits'

interface LightboxState {
  frames: PositiveFrame[]
  index: number
}

const PAGE_SIZE = 48

function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function CloverPage() {
  const [mode, setMode] = useState<GalleryMode>('frames')
  const [cameraId, setCameraId] = useState<string>('all')
  const [sort, setSort] = useState<GallerySort>('sharpness')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  useEffect(() => setVisibleCount(PAGE_SIZE), [mode, cameraId, sort])

  const filteredFrames = useMemo(
    () => sortForGallery(cloverFrames.filter((frame) => cameraId === 'all' || frame.cameraId === Number(cameraId)), sort),
    [cameraId, sort],
  )
  const filteredVisits = useMemo(
    () => sortForGallery(cloverVisits.filter((visit) => cameraId === 'all' || visit.cameraId === Number(cameraId)), sort),
    [cameraId, sort],
  )
  const total = mode === 'frames' ? filteredFrames.length : filteredVisits.length
  const camera = cloverRecall.settings[0]
  const cameraStale = cloverRecall.settings[1]
  const fullPrecision = cloverRecall.settings[2]

  const openFrame = (frame: PositiveFrame) => {
    setLightbox({ frames: filteredFrames, index: filteredFrames.findIndex((candidate) => candidate.cropPath === frame.cropPath) })
  }
  const openVisit = (visitId: string) => {
    const frames = cloverFramesByVisit.get(visitId) ?? []
    const representative = frames.findIndex((frame) => frame.isRepresentative)
    setLightbox({ frames, index: representative >= 0 ? representative : 0 })
  }

  return (
    <main id="main" className="dashboard-shell page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Clover cams · Oregon</p>
          <h1>{cloverSite.name}</h1>
          <p>
            {cloverSite.layout}, at {cloverSite.coordinates} ({cloverSite.latitude}, {cloverSite.longitude}).{' '}
            {cloverSite.captureMode}. A separate site from the Emerald Queen cameras.
          </p>
        </div>
      </header>

      <section className="analytics-kpis model-kpis" aria-label="Clover cams summary">
        <article>
          <span>Confirmed Bombus frames</span>
          <strong>{cloverSummary.totalFrames.toLocaleString()}</strong>
          <small>{cloverSummary.dateMin} to {cloverSummary.dateMax}</small>
        </article>
        <article>
          <span>Unique visits</span>
          <strong>{cloverSummary.uniqueVisits.toLocaleString()}</strong>
          <small>{cloverSummary.singleFrameVisits} single-frame · {cloverSummary.multiFrameVisits} multi-frame</small>
        </article>
        <article>
          <span>Timelapse frames recorded</span>
          <strong>{cloverRecall.populationFrames.toLocaleString()}</strong>
          <small>{cloverRecall.reviewedFrames.toLocaleString()} reviewed by hand</small>
        </article>
      </section>

      <section className="chart-card" aria-labelledby="clover-cameras-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Cameras</p><h2 id="clover-cameras-title">Recording dates</h2></div>
        </div>
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Camera</th>
                <th scope="col">Recorded</th>
                <th scope="col">Timelapse frames</th>
                <th scope="col">Bombus frames</th>
                <th scope="col">Visits</th>
              </tr>
            </thead>
            <tbody>
              {cloverSite.recording.map((row) => {
                const counts = cloverCameras.find((item) => item.cameraId === row.cameraId)
                return (
                  <tr key={row.cameraId}>
                    <th scope="row">Camera {row.cameraId}</th>
                    <td>{row.first ? `${row.first} to ${row.last}` : 'No frames'}{row.note ? ` (${row.note})` : ''}</td>
                    <td>{row.frames.toLocaleString()}</td>
                    <td>{counts?.frames ?? 0}</td>
                    <td>{counts?.visits ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="demo-caption">{cloverSite.reviewNote}</p>
      </section>

      <section className="chart-card" aria-labelledby="clover-recall-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Recall analysis</p><h2 id="clover-recall-title">Would the camera's own model have saved these bees?</h2></div>
        </div>
        <p className="demo-caption">
          These cameras ran in timelapse mode, so every frame was kept. We replayed the field insect model
          (YOLOv8n, the int8 IMX500 export at threshold 0.25, as the cameras run it in detection mode) on all{' '}
          {cloverRecall.populationFrames.toLocaleString()} frames and compared it with the human-confirmed bees.
          It caught {camera.visitsCaught} of {camera.visits} Bombus visits ({percent(camera.visitsCaught / camera.visits)}),
          with frame recall {camera.frameRecall.toFixed(3)}, but only {percent(camera.bombusPrecision, 1)} of the frames
          it would have saved held a Bombus: about {Math.round(camera.triggersPerBombusFrame)} saved frames per Bombus frame,
          {' '}{Math.round(cameraStale.triggersPerBombusFrame)} after the camera's 7-second stale filter. The full-precision
          model at 0.43 caught {fullPrecision.visitsCaught} of {fullPrecision.visits}.
        </p>
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Visits caught</th>
                <th scope="col">Frame recall</th>
                <th scope="col">Saved frames holding a Bombus</th>
                <th scope="col">Saved frames per Bombus frame</th>
              </tr>
            </thead>
            <tbody>
              {cloverRecall.settings.map((row) => (
                <tr key={row.setting}>
                  <th scope="row">{row.setting}</th>
                  <td>{row.visitsCaught} / {row.visits} ({percent(row.visitsCaught / row.visits)})</td>
                  <td>{row.frameRecall.toFixed(3)}</td>
                  <td>{percent(row.bombusPrecision, 1)}</td>
                  <td>{row.triggersPerBombusFrame.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Camera</th>
                <th scope="col">Bombus visits</th>
                <th scope="col">Caught by the camera model (int8, 0.25)</th>
                <th scope="col">Caught by the full-precision model (0.43)</th>
              </tr>
            </thead>
            <tbody>
              {cloverRecall.perCamera.map((row) => (
                <tr key={row.camera}>
                  <th scope="row">Camera {row.camera.replace(/\D/g, '')}</th>
                  <td>{row.visits}</td>
                  <td>{row.int8Caught} ({percent(row.int8Caught / row.visits)})</td>
                  <td>{row.fullPrecisionCaught} ({percent(row.fullPrecisionCaught / row.visits)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="demo-caption">
          <li>Recall is a ceiling: bees that neither this model nor our Bombus model flagged were never reviewed.</li>
          <li>The timelapse saved one frame per second; in detection mode the camera checks about five per second, so it may catch more visits.</li>
          <li>The camera model's export has a built-in 0.25 score cutoff, so lowering the threshold on the camera cannot recover the missed bees, which were mostly fast, blurred fly-throughs.</li>
          <li>For this analysis, visits count the long Camera 1 stay on 2026-08-27 as one visit and split others at 10-second gaps; the gallery below uses the dashboard's 2-second rule.</li>
        </ul>
      </section>

      <section className="gallery-filters gallery-filters--clover" aria-label="Clover gallery filters">
        <label>
          Clover camera
          <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
            <option value="all">All clover cameras</option>
            {cloverCameras.map((item) => (
              <option key={item.cameraId} value={item.cameraId}>Camera {item.cameraId} ({item.frames} frames)</option>
            ))}
          </select>
        </label>
        <SortSelect value={sort} onChange={setSort} />
        <div className="segmented-control" aria-label="Clover gallery display mode">
          {(['frames', 'visits'] as const).map((value) => (
            <button key={value} type="button" className={mode === value ? 'is-active' : ''} aria-pressed={mode === value} onClick={() => setMode(value)}>
              {value === 'frames' ? 'All frames' : 'Unique visits'}
            </button>
          ))}
        </div>
      </section>

      <div className="gallery-result-line" aria-live="polite">
        <strong>{total.toLocaleString()} {mode === 'frames' ? 'positive frames' : 'unique visits'}</strong>
        <span>Showing {Math.min(visibleCount, total).toLocaleString()}</span>
      </div>
      {sort === 'sharpness' && <SharpnessNote />}

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
          : filteredVisits.slice(0, visibleCount).map((visit) => (
              <GalleryCard
                key={visit.visitId}
                frame={cloverRepresentativeFrame(visit)}
                badge={`${visit.frameCount} ${visit.frameCount === 1 ? 'frame' : 'frames'}`}
                onOpen={() => openVisit(visit.visitId)}
              />
            ))}
      </div>

      {visibleCount < total && (
        <div className="load-more-wrap">
          <button type="button" className="secondary-button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load 48 more
          </button>
        </div>
      )}

      <section className="source-notes">
        <p>
          Downloads:{' '}
          <a href={assetUrl('downloads/clover_all_positive_frames_2026.csv')}>all clover frames (CSV)</a> ·{' '}
          <a href={assetUrl('downloads/clover_unique_visits_2026.csv')}>unique clover visits (CSV)</a>
        </p>
      </section>

      {lightbox && <Lightbox frames={lightbox.frames} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </main>
  )
}
