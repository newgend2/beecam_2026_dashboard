import { useState } from 'react'
import { MetricToggle } from '../components/MetricToggle'
import { PositiveMap } from '../components/PositiveMap'
import {
  formatCameraLocation,
  locationSummaries,
  positiveSummary,
} from '../data/positives'
import type { LocationSummary, PositiveMetric } from '../types'

interface PositiveMapPageProps {
  onBrowseCell: (gridCell: string) => void
}

export function PositiveMapPage({ onBrowseCell }: PositiveMapPageProps) {
  const initial = [...locationSummaries].sort((a, b) => b.frames - a.frames)[0]
  const [metric, setMetric] = useState<PositiveMetric>('frames')
  const [selected, setSelected] = useState<LocationSummary>(initial)

  return (
    <main id="main" className="dashboard-shell page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Spatial overview</p>
          <h1>Positive detections by location</h1>
          <p>
            Compare activity across all 26 camera cells. Cameras 18 and 19 are
            combined at F5 because they occupied the same location.
          </p>
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </header>

      <div className="positive-summary-strip">
        <span><strong>{positiveSummary.totalFrames}</strong> positive frames</span>
        <span><strong>{positiveSummary.uniqueVisits}</strong> unique visits</span>
        <span><strong>{locationSummaries.filter((location) => location.frames > 0).length}</strong> active locations</span>
      </div>

      <div className="content-grid positive-map-layout">
        <section className="map-card" aria-labelledby="positive-map-title">
          <div className="map-card-header">
            <div>
              <p className="eyebrow">Emerald Queen site</p>
              <h2 id="positive-map-title">Camera-grid activity</h2>
            </div>
            <span className="map-scale">Darker cells indicate more {metric}</span>
          </div>
          <PositiveMap
            locations={locationSummaries}
            metric={metric}
            selectedCell={selected.gridCell}
            onSelect={setSelected}
          />
        </section>

        <aside className="location-detail-card">
          <p className="eyebrow">Selected location</p>
          <h2>{formatCameraLocation(selected)}</h2>
          <div className="location-totals">
            <div><strong>{selected.frames}</strong><span>positive frames</span></div>
            <div><strong>{selected.visits}</strong><span>unique visits</span></div>
          </div>
          <p>
            {selected.frames > 0
              ? `${Math.round((selected.frames / positiveSummary.totalFrames) * 100)}% of all positive frames were recorded here.`
              : 'No positive detections from this location are present in the current manifest.'}
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={selected.frames === 0}
            onClick={() => onBrowseCell(selected.gridCell)}
          >
            Open filtered gallery
          </button>
        </aside>
      </div>
    </main>
  )
}
