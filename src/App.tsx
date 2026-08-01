import { useCallback, useEffect, useState } from 'react'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CameraStatusPage } from './pages/CameraStatusPage'
import { GalleryPage } from './pages/GalleryPage'
import { HomePage } from './pages/HomePage'
import { PositiveMapPage } from './pages/PositiveMapPage'
import type { DashboardTab } from './types'

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'home', label: 'Overview' },
  { id: 'map', label: 'Camera map' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'status', label: 'Camera status' },
]

function tabFromHash(): DashboardTab {
  const hash = window.location.hash.replace('#', '')
  return tabs.some((tab) => tab.id === hash) ? (hash as DashboardTab) : 'home'
}

function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromHash)
  const [galleryCell, setGalleryCell] = useState<string>()

  useEffect(() => {
    const handleHashChange = () => setActiveTab(tabFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

  const navigate = useCallback((tab: DashboardTab) => {
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${tab}`)
  }, [])

  const browseCell = (gridCell: string) => {
    setGalleryCell(gridCell)
    navigate('gallery')
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" type="button" onClick={() => navigate('home')} aria-label="BeeCam 2026 dashboard home">
            <span className="brand-mark" aria-hidden="true">B</span>
            <span><strong>BeeCam 2026</strong><small>Emerald Queen research network</small></span>
          </button>
          <div className="season-badge"><span className="season-dot" aria-hidden="true" />Field season complete</div>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Dashboard sections">
        <div className="tab-inner">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              className={`tab-button${activeTab === tab.id ? ' is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                navigate(tab.id)
              }}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </nav>

      {activeTab === 'home' && <HomePage onNavigate={navigate} />}
      {activeTab === 'map' && <PositiveMapPage onBrowseCell={browseCell} />}
      {activeTab === 'gallery' && (
        <GalleryPage initialCell={galleryCell} onFilterConsumed={() => setGalleryCell(undefined)} />
      )}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'status' && <CameraStatusPage />}

      <footer>
        <p>BeeCam 2026 · Bumble bee monitoring research</p>
        <span>Emerald Queen · British Columbia</span>
      </footer>
    </>
  )
}

export default App
