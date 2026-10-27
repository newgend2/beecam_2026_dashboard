import { visitGapWords } from '../data/visitRule'
import { useEffect, useMemo, useState } from 'react'
import { DownloadPanel } from '../components/DownloadPanel'
import {
  assetUrl,
  formatCaptureDate,
  landingSlideOrder,
  positiveSummary,
  visitRepresentativeFrame,
} from '../data/positives'
import modelStats from '../data/model-stats.json'
import { projectSites } from '../data/project-sites'
import type { DashboardTab } from '../types'

interface HomePageProps {
  onNavigate: (tab: DashboardTab) => void
}

export function HomePage({ onNavigate }: HomePageProps) {
  const visits = useMemo(() => landingSlideOrder(), [])
  const [slideIndex, setSlideIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const visit = visits[slideIndex]
  const frame = visitRepresentativeFrame(visit)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(
      () => setSlideIndex((current) => (current + 1) % visits.length),
      6000,
    )
    return () => window.clearInterval(timer)
  }, [paused, visits.length])

  const move = (direction: number) => {
    setSlideIndex((current) => (current + direction + visits.length) % visits.length)
  }

  return (
    <main id="main" className="home-page">
      <section className="hero-layout" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Emerald Queen · 2026 field season</p>
          <h1 id="home-title">Bumble bees, frame by frame.</h1>
          <p>
            Explore positive detections and unique visits across a distributed
            network of AI-enabled field cameras.
          </p>
          <div className="hero-stats hero-stats--three" aria-label="Positive detection summary">
            <article>
              <strong>{positiveSummary.totalFrames.toLocaleString()}</strong>
              <span>positive frames</span>
            </article>
            <article>
              <strong>{positiveSummary.uniqueVisits.toLocaleString()}</strong>
              <span>unique visits</span>
            </article>
            <article>
              <strong>{modelStats.imagesRecorded.value.toLocaleString()}</strong>
              <span>frames recorded</span>
            </article>
          </div>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate('gallery')}>
              Explore the gallery
            </button>
            <button type="button" className="secondary-button" onClick={() => onNavigate('map')}>
              View the camera map
            </button>
          </div>
        </div>

        <figure className="slideshow-card">
          <div className="slideshow-image">
            <img className="slideshow-blur" src={assetUrl(frame.cropPath)} alt="" aria-hidden="true" />
            <img
              key={frame.cropPath}
              className="slideshow-primary"
              src={assetUrl(frame.cropPath)}
              alt={`Bumble bee detection from Camera ${frame.cameraId} in grid cell ${frame.gridCell}`}
              width={frame.cropWidth}
              height={frame.cropHeight}
            />
            <span className="visit-badge">Unique visit</span>
          </div>
          <figcaption>
            <div>
              <strong>{frame.gridCell} · Camera {frame.cameraId}</strong>
              <span>{formatCaptureDate(frame.capturedAt)}</span>
            </div>
            <div className="slideshow-controls">
              <button type="button" onClick={() => move(-1)} aria-label="Previous slide">←</button>
              <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}>
                {paused ? '▶' : 'Ⅱ'}
              </button>
              <button type="button" onClick={() => move(1)} aria-label="Next slide">→</button>
            </div>
          </figcaption>
        </figure>
      </section>

      <section className="method-strip" aria-label="Visit definition">
        <span>How visits are counted</span>
        <p>
          Consecutive frames from the same camera and date remain one visit
          until a frame arrives more than {visitGapWords} after the previous one.
        </p>
        <button type="button" onClick={() => onNavigate('analytics')}>Explore the analytics →</button>
      </section>

      <DownloadPanel />

      <section className="project-sites" aria-labelledby="project-sites-title">
        <div>
          <p className="eyebrow">More from BeeCam</p>
          <h2 id="project-sites-title">Related project sites</h2>
        </div>
        <div className="project-site-links">
          {projectSites.map((site) => (
            <a key={site.url} href={site.url} target="_blank" rel="noreferrer">
              <strong>{site.title} <span aria-hidden="true">↗</span></strong>
              <span>{site.description}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
