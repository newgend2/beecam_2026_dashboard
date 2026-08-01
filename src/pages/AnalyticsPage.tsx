import { buildDailyCumulative, formatCameraLocation, locationSummaries, positiveSummary } from '../data/positives'

const cumulative = buildDailyCumulative()

export function AnalyticsPage() {
  const ranked = [...locationSummaries].sort((a, b) => b.frames - a.frames || a.gridCell.localeCompare(b.gridCell))
  const maximum = Math.max(...ranked.map((location) => location.frames), 1)
  const leading = ranked[0]

  return (
    <main id="main" className="dashboard-shell page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Network analytics</p>
          <h1>When and where bees appeared</h1>
          <p>Frame counts show detection volume; visit counts reduce rapid camera bursts to discrete activity.</p>
        </div>
      </header>

      <section className="analytics-kpis" aria-label="Analytics highlights">
        <article><span>Most active location</span><strong>{leading.gridCell}</strong><small>{leading.frames} frames · {leading.visits} visits</small></article>
        <article><span>Single-frame visits</span><strong>{positiveSummary.singleFrameVisits}</strong><small>{Math.round((positiveSummary.singleFrameVisits / positiveSummary.uniqueVisits) * 100)}% of visits</small></article>
        <article><span>Multi-frame visits</span><strong>{positiveSummary.multiFrameVisits}</strong><small>{Math.round((positiveSummary.multiFrameVisits / positiveSummary.uniqueVisits) * 100)}% of visits</small></article>
      </section>

      <section className="chart-card" aria-labelledby="location-chart-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Location comparison</p><h2 id="location-chart-title">Positive frames by camera location</h2></div>
          <div className="chart-legend"><span><i className="legend-line legend-line--frames" />Frames</span><span>Visit totals shown at right</span></div>
        </div>
        <div className="horizontal-bars">
          {ranked.map((location) => (
            <div className={`bar-row${location.frames === 0 ? ' is-zero' : ''}`} key={location.gridCell}>
              <span className="bar-label">{formatCameraLocation(location)}</span>
              <div className="bar-track"><i style={{ width: `${(location.frames / maximum) * 100}%` }} /></div>
              <strong>{location.frames}</strong>
              <small>{location.visits} visits</small>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-card" aria-labelledby="cumulative-chart-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Season progress</p><h2 id="cumulative-chart-title">Cumulative positive detections</h2></div>
          <div className="chart-legend"><span><i className="legend-line legend-line--frames" />Frames</span><span><i className="legend-line legend-line--visits" />Visits</span></div>
        </div>
        <CumulativeChart />
      </section>
    </main>
  )
}

function CumulativeChart() {
  const width = 900
  const height = 340
  const margin = { top: 20, right: 30, bottom: 48, left: 58 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const x = (index: number) => margin.left + (index / (cumulative.length - 1)) * plotWidth
  const y = (value: number) => margin.top + plotHeight - (value / positiveSummary.totalFrames) * plotHeight
  const framePoints = cumulative.map((point, index) => `${x(index)},${y(point.frames)}`).join(' ')
  const visitPoints = cumulative.map((point, index) => `${x(index)},${y(point.visits)}`).join(' ')
  const tickInterval = Math.max(1, Math.ceil(positiveSummary.totalFrames / 4 / 50) * 50)
  const ticks = [0, tickInterval, tickInterval * 2, tickInterval * 3, positiveSummary.totalFrames]
    .filter((tick, index, values) => tick <= positiveSummary.totalFrames && values.indexOf(tick) === index)

  return (
    <div className="chart-scroll">
      <svg className="cumulative-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="cumulative-svg-title cumulative-svg-description">
        <title id="cumulative-svg-title">Cumulative positive frames and visits over time</title>
        <desc id="cumulative-svg-description">
          Positive frames rise from zero to {positiveSummary.totalFrames} and unique visits rise from zero to {positiveSummary.uniqueVisits} between {positiveSummary.dateMin} and {positiveSummary.dateMax}.
        </desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text x={margin.left - 10} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        <polyline className="cumulative-line cumulative-line--frames" points={framePoints} />
        <polyline className="cumulative-line cumulative-line--visits" points={visitPoints} />
        <text x={margin.left} y={height - 14}>{positiveSummary.dateMin}</text>
        <text x={width - margin.right} y={height - 14} textAnchor="end">{positiveSummary.dateMax}</text>
      </svg>
    </div>
  )
}
