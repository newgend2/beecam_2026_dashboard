import { useState } from 'react'
import { CameraDetails } from './components/CameraDetails'
import { CameraMap } from './components/CameraMap'
import { StatusSummary } from './components/StatusSummary'
import { cameras, formatCheckDate, latestCheckDate } from './data/cameras'
import type { CameraRecord } from './types'

function App() {
  const [selectedCamera, setSelectedCamera] = useState<CameraRecord>(cameras[0])

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#main" aria-label="BeeCam 2026 dashboard home">
            <span className="brand-mark" aria-hidden="true">
              B
            </span>
            <span>
              <strong>BeeCam 2026</strong>
              <small>Emerald Queen research network</small>
            </span>
          </a>
          <div className="season-badge">
            <span className="live-dot" aria-hidden="true" />
            Field season 2026
          </div>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Dashboard sections">
        <div className="tab-inner" role="tablist">
          <button
            id="camera-status-tab"
            className="tab-button"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="camera-status-panel"
          >
            Camera status
          </button>
          <span className="future-note">More analysis modules coming soon</span>
        </div>
      </nav>

      <main id="main" className="dashboard-shell">
        <section
          id="camera-status-panel"
          role="tabpanel"
          aria-labelledby="camera-status-tab"
        >
          <div className="page-intro">
            <div>
              <p className="eyebrow">Network overview</p>
              <h1>Camera grid status</h1>
              <p>
                Live field condition at a glance across the upper and lower
                bumble bee monitoring grids.
              </p>
            </div>
            <p className="updated-at">
              Data current to{' '}
              <time dateTime={latestCheckDate}>
                {formatCheckDate(latestCheckDate)}
              </time>
            </p>
          </div>

          <StatusSummary cameras={cameras} />

          <div className="content-grid">
            <section className="map-card" aria-labelledby="map-title">
              <div className="map-card-header">
                <div>
                  <p className="eyebrow">Emerald Queen site</p>
                  <h2 id="map-title">Deployment map</h2>
                </div>
                <div className="legend" aria-label="Map legend">
                  <span><i className="legend-dot legend-dot--nominal" />Nominal</span>
                  <span><i className="legend-dot legend-dot--defective" />Defective</span>
                </div>
              </div>
              <CameraMap
                cameras={cameras}
                selectedCell={selectedCamera.gridCell}
                onSelect={setSelectedCamera}
              />
            </section>

            <div className="side-column">
              <CameraDetails camera={selectedCamera} />
              <aside className="grid-key">
                <p className="eyebrow">Deployment layout</p>
                <h2>Two monitoring grids</h2>
                <div>
                  <span>Lower grid</span>
                  <strong>F3–J6 · 20 cameras</strong>
                </div>
                <div>
                  <span>Upper grid</span>
                  <strong>C1–E2 · 6 cameras</strong>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <p>BeeCam 2026 · Bumble bee monitoring research</p>
      </footer>
    </>
  )
}

export default App
