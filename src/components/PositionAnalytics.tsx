import { visitGapAdjective } from '../data/visitRule'
import { useState } from 'react'
import positionJson from '../data/position-analytics.json'

interface Headline {
  value: number
  ci95: [number, number]
}

interface CameraHeat {
  camera: number | string
  boxes: number
  visits: number
  heat: number[][]
}

interface SiteData {
  boxes: number
  visits: number
  cameras: number
  heat: number[][]
  size: number[]
  rings: number[]
  arrival: { rings: number[]; edgeShare: number }
  headline: Record<'centerShare' | 'edgeShare' | 'meanRadial' | 'medianArea', Headline>
  perCamera: CameraHeat[]
}

interface Rate {
  label?: string
  boxes?: number
  visits?: number
  caught: number
  saved: number
  caughtRate: number | null
  caughtCi95: [number, number] | null
  savedRate: number | null
  savedCi95: [number, number] | null
}

interface PositionData {
  grid: { cols: number; rows: number; sizeLabels: string[]; ringLabels: string[]; ringLimits: number[]; edgeMargin: number }
  emeraldQueen: SiteData
  clover: SiteData & {
    frames: number
    triggerBias: { overall: Rate; rings: Rate[]; size: Rate[]; visitsByArrival: Rate[] }
  }
  sources: { emeraldQueen: string; clover: string }
}

const data = positionJson as unknown as PositionData

const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`
const interval = (ci: [number, number] | null) => (ci ? `${percent(ci[0])}–${percent(ci[1])}` : '')

/** "cam-1" and "cam11" (clover) read as "Camera 1" and "Camera 11", as on the Clover cams tab. */
function cameraLabel(camera: number | string) {
  return `Camera ${typeof camera === 'number' ? camera : Number(camera.replace(/\D/g, ''))}`
}

/** A box belongs to a ring by its center's distance to the nearest frame edge, as a share of that side. */
const [outerLimit, middleLimit] = data.grid.ringLimits
const ringArea = [1 - (1 - 2 * outerLimit) ** 2, (1 - 2 * outerLimit) ** 2 - (1 - 2 * middleLimit) ** 2, (1 - 2 * middleLimit) ** 2]
const ringRules = [
  `The box center lies within ${percent(outerLimit)} of the nearest edge of the frame.`,
  `Between ${percent(outerLimit)} and ${percent(middleLimit)} from the nearest edge.`,
  `More than ${percent(middleLimit)} from every edge, the middle half of the frame across and down.`,
]

function RingOutlines({ width, height }: { width: number; height: number }) {
  return (
    <g className="ring-outline" aria-hidden="true">
      {[outerLimit, middleLimit].map((limit) => (
        <rect key={limit} x={limit * width} y={limit * height} width={(1 - 2 * limit) * width} height={(1 - 2 * limit) * height} />
      ))}
    </g>
  )
}

/** The frame drawn to scale, with the three rings the comparisons below use. */
function RingKey() {
  const width = 400
  const height = 300
  const bands = [0, outerLimit, middleLimit]
  return (
    <div className="ring-key">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="The camera frame divided into an outer ring, a middle ring and a center">
        {bands.map((limit, index) => (
          <rect key={limit} className={`ring-fill ring-fill--${index}`} x={limit * width} y={limit * height}
            width={(1 - 2 * limit) * width} height={(1 - 2 * limit) * height} />
        ))}
        <text x={width / 2} y={(outerLimit * height) / 2 + 4} textAnchor="middle">{data.grid.ringLabels[0]}</text>
        <text x={width / 2} y={((outerLimit + middleLimit) * height) / 2 + 4} textAnchor="middle">{data.grid.ringLabels[1]}</text>
        <text x={width / 2} y={height / 2 + 5} textAnchor="middle" className="ring-key-center">{data.grid.ringLabels[2]}</text>
        <text x={(outerLimit * width) / 2} y={height / 2 + 4} textAnchor="middle" className="ring-key-distance">&lt;{percent(outerLimit)}</text>
        <text x={((outerLimit + middleLimit) * width) / 2} y={height / 2 + 4} textAnchor="middle" className="ring-key-distance">
          {percent(outerLimit, 0).replace('%', '')}–{percent(middleLimit)}
        </text>
      </svg>
      <div>
        <dl>
          {data.grid.ringLabels.map((label, index) => (
            <div key={label}>
              <dt><i className={`ring-swatch ring-swatch--${index}`} aria-hidden="true" />{label}</dt>
              <dd>{ringRules[index]} {percent(ringArea[index])} of the frame.</dd>
            </div>
          ))}
        </dl>
        <p>
          Bees scattered evenly over the frame would split {ringArea.map((area) => percent(area).replace('%', '')).join(' / ')} percent
          across the rings, so a ring that holds more visits than its share of the frame is one bees favored.
        </p>
      </div>
    </div>
  )
}

/** Green ramp, light to dark, for the share of visits in a cell. */
function heatColor(share: number, max: number) {
  if (share <= 0) return '#eef2ee'
  const t = Math.min(1, share / max)
  const light = [214, 236, 222]
  const dark = [7, 85, 60]
  const mix = light.map((value, index) => Math.round(value + (dark[index] - value) * Math.sqrt(t)))
  return `rgb(${mix.join(' ')})`
}

interface HeatPanelProps {
  title: string
  note: string
  site: SiteData
  scaleMax: number
  camera: string
  onCamera: (value: string) => void
}

function HeatPanel({ title, note, site, scaleMax, camera, onCamera }: HeatPanelProps) {
  const selected = site.perCamera.find((item) => String(item.camera) === camera)
  const heat = selected ? selected.heat : site.heat
  const visits = selected ? selected.visits : site.visits
  const { cols, rows } = data.grid
  const max = selected ? Math.max(...heat.flat(), 0.0001) : scaleMax
  return (
    <figure className="position-heat">
      <figcaption>
        <strong>{title}</strong>
        <label>
          <span className="visually-hidden">{title} camera</span>
          <select value={camera} onChange={(event) => onCamera(event.target.value)}>
            <option value="all">All cameras ({site.visits.toLocaleString()} visits)</option>
            {site.perCamera.map((item) => (
              <option key={String(item.camera)} value={String(item.camera)}>
                {cameraLabel(item.camera)} ({item.visits} {item.visits === 1 ? 'visit' : 'visits'})
              </option>
            ))}
          </select>
        </label>
      </figcaption>
      <svg viewBox={`0 0 ${cols * 40} ${rows * 40}`} role="img" aria-label={`${title}: share of ${visits} visits in each part of the frame`}>
        {heat.map((row, r) =>
          row.map((share, c) => (
            <rect key={`${r}-${c}`} x={c * 40 + 1} y={r * 40 + 1} width={38} height={38} rx={3} fill={heatColor(share, max)}>
              <title>{`${percent(share, 1)} of visits · row ${r + 1} of ${rows}, column ${c + 1} of ${cols}`}</title>
            </rect>
          )),
        )}
        <RingOutlines width={cols * 40} height={rows * 40} />
      </svg>
      <small>{note}{selected ? ' Colors are scaled to this camera.' : ''}</small>
    </figure>
  )
}

/** A ring's color swatch, so rows by ring read against the frame diagram. */
const ringSwatch = (index: number) => <i className={`ring-swatch ring-swatch--${index}`} aria-hidden="true" />

function PairedBars({ labels, a, b, rings = false }: { labels: string[]; a: number[]; b: number[]; rings?: boolean }) {
  const max = Math.max(...a, ...b, 0.0001)
  return (
    <div className="paired-bars">
      {labels.map((label, index) => (
        <div className="paired-row" key={label}>
          <span className="bar-label">{rings && ringSwatch(index)}{label}</span>
          <div className="paired-tracks">
            <div className="bar-track" title={`Emerald Queen ${percent(a[index], 1)}`}><i style={{ width: `${(a[index] / max) * 100}%` }} /></div>
            <div className="bar-track bar-track--clover" title={`Clover ${percent(b[index], 1)}`}><i style={{ width: `${(b[index] / max) * 100}%` }} /></div>
          </div>
          <span className="paired-values"><b>{percent(a[index])}</b><b>{percent(b[index])}</b></span>
        </div>
      ))}
    </div>
  )
}

function RateRows({ rows, field, unit, rings = false }: { rows: Rate[]; field: 'caught' | 'saved'; unit: string; rings?: boolean }) {
  return (
    <div className="rate-rows">
      {rows.map((row, index) => {
        const rate = field === 'caught' ? row.caughtRate : row.savedRate
        const ci = field === 'caught' ? row.caughtCi95 : row.savedCi95
        const n = row.boxes ?? row.visits ?? 0
        const k = field === 'caught' ? row.caught : row.saved
        return (
          <div className="rate-row" key={row.label}>
            <span className="bar-label">{rings && ringSwatch(index)}{row.label}</span>
            <div className="rate-track" title={rate === null ? 'No bees' : `${percent(rate)} (95% interval ${interval(ci)}), ${k} of ${n} ${unit}`}>
              {ci && <span className="rate-ci" style={{ left: `${ci[0] * 100}%`, width: `${(ci[1] - ci[0]) * 100}%` }} />}
              {rate !== null && <span className="rate-dot" style={{ left: `${rate * 100}%` }} />}
            </div>
            <span className="rate-value"><b>{rate === null ? '–' : percent(rate)}</b><small>{k}/{n}</small></span>
          </div>
        )
      })}
    </div>
  )
}

export function PositionAnalytics() {
  const [eqCamera, setEqCamera] = useState('all')
  const [cloverCamera, setCloverCamera] = useState('all')
  const eq = data.emeraldQueen
  const clover = data.clover
  const bias = clover.triggerBias
  const scaleMax = Math.max(...eq.heat.flat(), ...clover.heat.flat())
  const edgeMargin = percent(data.grid.edgeMargin)
  const big = bias.size.slice(3)
  const bigCaught = big.reduce((total, row) => total + row.caught, 0)
  const bigBoxes = big.reduce((total, row) => total + (row.boxes ?? 0), 0)

  return (
    <>
      <section className="chart-card" aria-labelledby="position-heat-title">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Position in the frame</p>
            <h2 id="position-heat-title">Where bees appear in the camera view</h2>
          </div>
          <div className="chart-legend">
            <span><i className="heat-key" />Darker cells hold a larger share of visits</span>
            <span><i className="ring-outline-key" />Dashed lines mark the rings</span>
          </div>
        </div>
        <p className="chart-intro">
          Each map divides the full 4056 × 3040 frame into an 8 × 6 grid and places every human-confirmed Bombus box by its
          center. Visits follow the dashboard's {visitGapAdjective} rule at both sites, and every visit counts once, so a bee that lingered for fifty frames weighs the same as one that flew straight
          through. Emerald Queen frames were saved only when the camera's on-board insect model fired, while the four clover
          cameras in Oregon saved a timelapse frame on a fixed schedule whether or not a bee was there.
        </p>
        <div className="position-heat-pair">
          <HeatPanel
            title="Emerald Queen (triggered)"
            note={`${eq.visits.toLocaleString()} visits on ${eq.cameras} cameras. Each camera faces its own target.`}
            site={eq}
            scaleMax={scaleMax}
            camera={eqCamera}
            onCamera={setEqCamera}
          />
          <HeatPanel
            title="Clover cams (timelapse)"
            note={`${clover.visits} visits in ${clover.frames} reviewed frames on ${clover.cameras} cameras.`}
            site={clover}
            scaleMax={scaleMax}
            camera={cloverCamera}
            onCamera={setCloverCamera}
          />
        </div>
      </section>

      <section className="analytics-kpis" aria-label="Position comparison">
        <article>
          <span>Visits at the frame edge</span>
          <strong>{percent(eq.headline.edgeShare.value)} vs {percent(clover.headline.edgeShare.value)}</strong>
          <small>Emerald Queen vs clover, box within {edgeMargin} of the border · 95% intervals {interval(eq.headline.edgeShare.ci95)} and {interval(clover.headline.edgeShare.ci95)}</small>
        </article>
        <article>
          <span>Distance from the frame center</span>
          <strong>{eq.headline.meanRadial.value.toFixed(2)} vs {clover.headline.meanRadial.value.toFixed(2)}</strong>
          <small>Mean, 0 at the center and 1 at a corner · intervals {eq.headline.meanRadial.ci95.map((v) => v.toFixed(2)).join('–')} and {clover.headline.meanRadial.ci95.map((v) => v.toFixed(2)).join('–')}</small>
        </article>
        <article>
          <span>Median bee size</span>
          <strong>{percent(eq.headline.medianArea.value, 2)} vs {percent(clover.headline.medianArea.value, 2)}</strong>
          <small>Box area as a share of the frame, Emerald Queen vs clover</small>
        </article>
      </section>

      <section className="chart-card" aria-labelledby="position-compare-title">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Emerald Queen vs clover</p>
            <h2 id="position-compare-title">Rings of the frame, arrival points and bee size</h2>
          </div>
          <div className="chart-legend">
            <span><i className="legend-line legend-line--frames" />Emerald Queen</span>
            <span><i className="legend-line legend-line--visits" />Clover</span>
          </div>
        </div>
        <p className="chart-intro">
          Each bee is placed in a ring by where the center of its box falls, as the diagram shows, and the same rings are
          drawn as dashed lines on the maps above. Arrival is the first frame of each visit. Clover bees sit far more often
          in the outer ring and arrive there too, and they are more often either very small or very large, because the
          clover cameras look across an open patch of flowers while each Emerald Queen camera looks at a nearby target. A
          difference here is therefore partly a difference of scene, not only of detection.
        </p>
        <RingKey />
        <div className="paired-grid">
          <div>
            <h3>All frames of each visit</h3>
            <PairedBars labels={data.grid.ringLabels} a={eq.rings} b={clover.rings} rings />
          </div>
          <div>
            <h3>Arrival frame of each visit</h3>
            <PairedBars labels={data.grid.ringLabels} a={eq.arrival.rings} b={clover.arrival.rings} rings />
          </div>
          <div>
            <h3>Bee size, box area as a share of the frame</h3>
            <PairedBars labels={data.grid.sizeLabels} a={eq.size} b={clover.size} />
          </div>
        </div>
      </section>

      <section className="chart-card" aria-labelledby="position-bias-title">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Detection bias test</p>
            <h2 id="position-bias-title">Would the camera trigger have caught the clover bees?</h2>
          </div>
          <div className="chart-legend">
            <span><i className="rate-key rate-key--dot" />Share caught</span>
            <span><i className="rate-key rate-key--ci" />95% Wilson interval</span>
          </div>
        </div>
        <p className="chart-intro">
          Because the clover frames were never filtered by a trigger, they show what the Emerald Queen cameras could have
          missed. For each confirmed clover bee we asked whether the deployed trigger (the int8 field model at a score of
          0.25) put a box on it, and whether the camera would have saved the frame once its stale filter drops detections
          that have stood still for more than seven seconds. The trigger found {bias.overall.caught} of{' '}
          {bias.overall.boxes} bees ({percent(bias.overall.caughtRate ?? 0)}), and its hit rate barely changes between the
          outer ring, the middle ring and the center, so it shows no blind spot at the frame edges. It does miss large bees
          close to the lens, catching only {bigCaught} of {bigBoxes} boxes that cover 1% of the frame or more. The stale
          filter matters more than position. Bees that settle near the edge of a clover camera's view are often still for
          a long time, so many of their frames would not have been saved, and visits that began in the outer ring were
          recorded less often than those that began nearer the center.
        </p>
        <div className="paired-grid paired-grid--two">
          <div>
            <h3>Bees the trigger detected, by ring</h3>
            <RateRows rows={bias.rings} field="caught" unit="bees" rings />
            <h3>Bees the trigger detected, by size</h3>
            <RateRows rows={bias.size} field="caught" unit="bees" />
          </div>
          <div>
            <h3>Frames the camera would have saved, by ring</h3>
            <RateRows rows={bias.rings} field="saved" unit="bees" rings />
            <h3>Visits with at least one saved frame, by arrival ring</h3>
            <RateRows rows={bias.visitsByArrival} field="saved" unit="visits" rings />
          </div>
        </div>
        <p className="chart-note">
          Read these with care. The clover set is small ({clover.frames} frames, {clover.visits} visits, and Camera 1
          alone holds {clover.perCamera.find((item) => item.camera === 'cam-1')?.visits ?? 0} of them), so the intervals are
          wide. The clover truth also came from model candidates plus human review, with random samples to find bees the
          models missed, so a bee that every model overlooked would be absent here as well. The trigger was matched to a bee
          when its box overlapped the human box (IoU at least 0.3) or its center fell inside it.
        </p>
      </section>
    </>
  )
}
