import { useState } from 'react'
import { CameraDetails } from '../components/CameraDetails'
import { CameraMap } from '../components/CameraMap'
import { StatusSummary } from '../components/StatusSummary'
import { cameras } from '../data/cameras'
import type { CameraRecord } from '../types'

export function CameraStatusPage() {
  const [selectedCamera, setSelectedCamera] = useState<CameraRecord>(cameras[0])

  return (
    <main id="main" className="dashboard-shell page-stack">
      <section aria-labelledby="camera-status-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Network operations</p>
            <h1 id="camera-status-title">Camera grid status</h1>
            <p>Final deployment state across the upper and lower monitoring grids.</p>
          </div>
          <p className="updated-at">2026 field season complete</p>
        </div>

        <StatusSummary cameras={cameras} />
        <div className="content-grid">
          <section className="map-card" aria-labelledby="status-map-title">
            <div className="map-card-header">
              <div><p className="eyebrow">Emerald Queen site</p><h2 id="status-map-title">Deployment map</h2></div>
              <div className="legend" aria-label="Map legend">
                <span><i className="legend-dot legend-dot--taken-down" />Taken down</span>
              </div>
            </div>
            <CameraMap cameras={cameras} selectedCell={selectedCamera.gridCell} onSelect={setSelectedCamera} />
          </section>
          <div className="side-column">
            <CameraDetails camera={selectedCamera} />
            <aside className="grid-key">
              <p className="eyebrow">Deployment layout</p><h2>Two monitoring grids</h2>
              <div><span>Lower grid</span><strong>F3–J6 · 20 cameras</strong></div>
              <div><span>Upper grid</span><strong>C1–E2 · 6 cameras</strong></div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
