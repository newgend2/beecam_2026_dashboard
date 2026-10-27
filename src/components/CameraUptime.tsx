import uptimeJson from '../data/camera-uptime.json'

interface UptimeCamera {
  cameraId: number
  gridCell: string
  hours: number
  days: number
  firstDate: string
  lastDate: string
  daily: number[]
  fallbackDates: string[]
}

interface UptimeData {
  summary: {
    cameraHours: number
    cameraDays: number
    cameras: number
    dateMin: string
    dateMax: string
    medianHoursPerCameraDay: number
    fallbackCameraDays: number
    fallbackHours: number
  }
  dates: string[]
  daily: Array<{ cameraHours: number; camerasRunning: number }>
  cameras: UptimeCamera[]
  source: string
}

const data = uptimeJson as UptimeData

function hoursColor(hours: number) {
  if (hours <= 0) return '#eef2ee'
  const t = Math.min(1, hours / 14)
  const light = [214, 236, 222]
  const dark = [7, 85, 60]
  return `rgb(${light.map((value, index) => Math.round(value + (dark[index] - value) * t)).join(' ')})`
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

/** Month starts inside the season, for axis ticks. */
const monthTicks = data.dates
  .map((date, index) => ({ date, index }))
  .filter(({ date, index }) => index === 0 || date.endsWith('-01'))

function CumulativeEffort() {
  const width = 900
  const margin = { top: 16, right: 30, bottom: 30, left: 64 }
  const lineHeight = 220
  const barHeight = 90
  const gap = 34
  const height = margin.top + lineHeight + gap + barHeight + margin.bottom
  const plotWidth = width - margin.left - margin.right
  const n = data.dates.length
  const x = (index: number) => margin.left + (index / Math.max(1, n - 1)) * plotWidth
  let running = 0
  const cumulative = data.daily.map((day) => (running += day.cameraHours))
  const total = cumulative[cumulative.length - 1] || 1
  const y = (value: number) => margin.top + lineHeight - (value / total) * lineHeight
  const maxCameras = Math.max(...data.daily.map((day) => day.camerasRunning), 1)
  const barTop = margin.top + lineHeight + gap
  const barY = (value: number) => barTop + barHeight - (value / maxCameras) * barHeight
  const barWidth = Math.max(1, plotWidth / n - 1)
  const step = Math.pow(10, Math.floor(Math.log10(total / 4)))
  const tickStep = Math.ceil(total / 4 / step) * step
  const ticks = [0, tickStep, tickStep * 2, tickStep * 3].filter((tick) => tick < total)

  return (
    <div className="chart-scroll">
      <svg className="cumulative-chart uptime-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="uptime-svg-title uptime-svg-desc">
        <title id="uptime-svg-title">Cumulative camera-hours and cameras running each day</title>
        <desc id="uptime-svg-desc">
          Camera-hours rise from zero to {Math.round(total).toLocaleString()} between {data.summary.dateMin} and {data.summary.dateMax};
          at most {maxCameras} cameras were imaging on one day.
        </desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text x={margin.left - 10} y={y(tick) + 4} textAnchor="end">{tick.toLocaleString()}</text>
          </g>
        ))}
        <line x1={margin.left} x2={width - margin.right} y1={y(total)} y2={y(total)} />
        <text x={margin.left - 10} y={y(total) + 4} textAnchor="end">{Math.round(total).toLocaleString()}</text>
        <polyline className="cumulative-line cumulative-line--frames" points={cumulative.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />
        <text x={margin.left} y={barTop - 10} className="uptime-panel-label">Cameras imaging each day (most: {maxCameras})</text>
        <line x1={margin.left} x2={width - margin.right} y1={barTop + barHeight} y2={barTop + barHeight} />
        {data.daily.map((day, index) => (
          <rect key={data.dates[index]} className="uptime-bar" x={x(index) - barWidth / 2} y={barY(day.camerasRunning)} width={barWidth}
            height={barTop + barHeight - barY(day.camerasRunning)} rx={1}>
            <title>{`${shortDate(data.dates[index])}: ${day.camerasRunning} cameras, ${day.cameraHours.toFixed(0)} camera-hours`}</title>
          </rect>
        ))}
        {monthTicks.map(({ date, index }) => (
          <text key={date} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : 'middle'}>{shortDate(date)}</text>
        ))}
      </svg>
    </div>
  )
}

function CameraTimeline() {
  const cell = 7
  const rowHeight = 14
  const labelWidth = 92
  const totalsWidth = 110
  const n = data.dates.length
  const width = labelWidth + n * cell + totalsWidth
  const top = 22
  const height = top + data.cameras.length * rowHeight + 8
  return (
    <div className="chart-scroll">
      <svg className="uptime-timeline" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img"
        aria-label={`Hours each camera was imaging on each day, ${data.cameras.length} cameras from ${data.summary.dateMin} to ${data.summary.dateMax}`}>
        {monthTicks.map(({ date, index }) => (
          <text key={date} x={labelWidth + index * cell} y={12}>{shortDate(date)}</text>
        ))}
        <text x={width - totalsWidth + 8} y={12}>Hours · days</text>
        {data.cameras.map((camera, row) => {
          const y = top + row * rowHeight
          const fallback = new Set(camera.fallbackDates)
          return (
            <g key={camera.cameraId}>
              <text x={0} y={y + 10}>Camera {camera.cameraId} · {camera.gridCell}</text>
              {camera.daily.map((hours, index) => (
                <rect key={index} x={labelWidth + index * cell} y={y} width={cell - 1} height={rowHeight - 2} rx={1.5}
                  fill={hoursColor(hours)} className={fallback.has(data.dates[index]) ? 'uptime-fallback' : undefined}>
                  <title>{`Camera ${camera.cameraId}, ${shortDate(data.dates[index])}: ${hours > 0 ? `${hours.toFixed(1)} h` : 'not imaging'}${fallback.has(data.dates[index]) ? ' (first to last frame; no usable power log)' : ''}`}</title>
                </rect>
              ))}
              <text x={width - totalsWidth + 8} y={y + 10} className="uptime-total">{Math.round(camera.hours).toLocaleString()} h · {camera.days} d</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function CameraUptime() {
  const s = data.summary
  return (
    <>
      <section className="analytics-kpis" aria-label="Imaging effort">
        <article><span>Camera-hours imaging</span><strong>{Math.round(s.cameraHours).toLocaleString()}</strong><small>{s.cameras} cameras · {s.dateMin} to {s.dateMax}</small></article>
        <article><span>Camera-days imaging</span><strong>{s.cameraDays.toLocaleString()}</strong><small>Days on which a camera ran and could save frames</small></article>
        <article><span>Typical day</span><strong>{s.medianHoursPerCameraDay.toFixed(1)} h</strong><small>Median hours per camera-day</small></article>
      </section>

      <section className="chart-card" aria-labelledby="uptime-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Imaging effort</p><h2 id="uptime-title">How long the cameras were running</h2></div>
          <div className="chart-legend">
            <span><i className="legend-line legend-line--frames" />Cumulative camera-hours</span>
            <span><i className="uptime-key uptime-key--bar" />Cameras imaging that day</span>
          </div>
        </div>
        <p className="chart-intro">
          Each camera's power log records when it booted and when it was scheduled to shut down, so the time it spent
          running can be read from its SD cards even on days when nothing triggered it. Time after a card's last saved
          image is left out, because the camera had stopped recording by then (a full card, a camera fault or a flat
          battery), and so is bench time before its first image. Detections are best compared against this effort, since a camera that ran longer had more chances
          to see a bee.
        </p>
        <CumulativeEffort />
      </section>

      <section className="chart-card" aria-labelledby="uptime-camera-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Imaging effort by camera</p><h2 id="uptime-camera-title">Hours imaging, camera by day</h2></div>
          <div className="chart-legend">
            <span><i className="heat-key" />0 to 14 or more hours</span>
            <span><i className="uptime-key uptime-key--fallback" />Estimated from frames</span>
          </div>
        </div>
        <p className="chart-intro">
          One row per camera, one cell per day. A pale gap means no transferred card covers that day, either because
          the camera was not imaging (a card swap, a flat battery or a full card) or because that card is not among the
          transferred archives. On {s.fallbackCameraDays} camera-days the power log was unusable and the span
          from the first to the last saved frame stands in, outlined in gold.
        </p>
        <CameraTimeline />
        <p className="chart-note">{data.source}</p>
      </section>
    </>
  )
}
