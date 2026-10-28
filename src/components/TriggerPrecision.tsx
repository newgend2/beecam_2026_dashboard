import precisionJson from '../data/trigger-precision.json'

interface Share {
  value: number
  ci95: [number, number]
  count?: number
}

interface CloverCamera {
  camera: number
  triggers: number
  insect: number
  bombus: number
  insectShare: number
  insectCi95: [number, number]
}

const data = precisionJson as unknown as {
  california: {
    reviewedFrames: number
    savedFramesRepresented: number
    anyInsect: Share
    anyInsectUpper: Share
    bombus: Share
    perCohort: Array<{ cohort: string; anyInsect: number; n: number }>
  }
  clover: {
    candidates: number
    draws: number
    triggers: number
    allTriggers: { n: number; anyInsect: Share; bombus: Share }
    saved: { n: number; anyInsect: Share; bombus: Share }
    boxLevel: Record<'allTriggers' | 'saved', { value: number; boxes: number }>
    perCamera: CloverCamera[]
  }
  methods: { california: string; clover: string }
}

// the small offset keeps values such as 0.0745 from rounding down through floating-point error
const percent = (value: number, digits = 0) => `${(value * 100 + 1e-9).toFixed(digits)}%`
const interval = ([low, high]: [number, number], digits = 0) => `${percent(low, digits)}–${percent(high, digits)}`

interface Row {
  label: string
  share: Share
  detail: string
  site: 'eq' | 'clover'
}

function ShareRows({ rows, digits = 0 }: { rows: Row[]; digits?: number }) {
  return (
    <div className="rate-rows precision-rows">
      {rows.map((row) => (
        <div className="rate-row" key={row.label}>
          <span className="bar-label"><i className={`site-dot site-dot--${row.site}`} aria-hidden="true" />{row.label}</span>
          <div className="rate-track" title={`${percent(row.share.value, digits)} (95% interval ${interval(row.share.ci95, digits)}), ${row.detail}`}>
            <span className="rate-ci" style={{ left: `${row.share.ci95[0] * 100}%`, width: `${(row.share.ci95[1] - row.share.ci95[0]) * 100}%` }} />
            <span className={`rate-dot rate-dot--${row.site}`} style={{ left: `${row.share.value * 100}%` }} />
          </div>
          <span className="rate-value"><b>{percent(row.share.value, digits)}</b><small>{row.detail}</small></span>
        </div>
      ))}
    </div>
  )
}

export function TriggerPrecision() {
  const ca = data.california
  const clover = data.clover
  const cohortValues = ca.perCohort.map((cohort) => cohort.anyInsect)
  const busiest = [...clover.perCamera].sort((a, b) => b.triggers - a.triggers)[0]

  const insectRows: Row[] = [
    { label: 'Emerald Queen, saved', share: ca.anyInsect, detail: `${ca.reviewedFrames.toLocaleString()} reviewed`, site: 'eq' },
    { label: 'Clover, saved', share: clover.saved.anyInsect, detail: `${clover.saved.anyInsect.count} of ${clover.saved.n}`, site: 'clover' },
    { label: 'Clover, all triggers', share: clover.allTriggers.anyInsect, detail: `${clover.allTriggers.anyInsect.count} of ${clover.allTriggers.n}`, site: 'clover' },
  ]
  const bombusRows: Row[] = [
    { label: 'Emerald Queen, saved', share: ca.bombus, detail: `${ca.reviewedFrames.toLocaleString()} reviewed`, site: 'eq' },
    { label: 'Clover, saved', share: clover.saved.bombus, detail: `${clover.saved.bombus.count} of ${clover.saved.n}`, site: 'clover' },
    { label: 'Clover, all triggers', share: clover.allTriggers.bombus, detail: `${clover.allTriggers.bombus.count} of ${clover.allTriggers.n}`, site: 'clover' },
  ]
  const cameraRows: Row[] = clover.perCamera.map((camera) => ({
    label: `Camera ${camera.camera}`,
    share: { value: camera.insectShare, ci95: camera.insectCi95 },
    detail: `${camera.insect} of ${camera.triggers}`,
    site: 'clover',
  }))

  return (
    <>
      <section className="analytics-kpis" aria-label="Trigger precision">
        <article>
          <span>Emerald Queen saved frames with an insect</span>
          <strong>{percent(ca.anyInsect.value)}</strong>
          <small>About 1 in {Math.round(1 / ca.anyInsect.value)} · 95% interval {interval(ca.anyInsect.ci95, 1)}</small>
        </article>
        <article>
          <span>Clover saved frames with an insect</span>
          <strong>{percent(clover.saved.anyInsect.value)}</strong>
          <small>About 1 in {Math.round(1 / clover.saved.anyInsect.value)} · 95% interval {interval(clover.saved.anyInsect.ci95)}</small>
        </article>
        <article>
          <span>Saved frames with a Bombus</span>
          <strong>{percent(ca.bombus.value, 1)} vs {percent(clover.saved.bombus.value)}</strong>
          <small>Emerald Queen vs clover</small>
        </article>
      </section>

      <section className="chart-card" aria-labelledby="precision-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Trigger precision</p><h2 id="precision-title">How many saved frames held an insect</h2></div>
          <div className="chart-legend">
            <span><i className="site-dot site-dot--eq" />Emerald Queen</span>
            <span><i className="site-dot site-dot--clover" />Clover</span>
            <span><i className="rate-key rate-key--ci" />95% interval</span>
          </div>
        </div>
        <p className="chart-intro">
          Every camera ran the same on-board insect model at the same setting (the int8 field model at a score of 0.25,
          with the seven-second stale filter), and saved a frame whenever it fired. Precision is the share of those frames
          that really hold an insect, whether a bumble bee or any other. It is a different question from the one above,
          which asked how many of the bees that passed the camera got caught. At the clover site about every second saved
          frame holds an insect, but at Emerald Queen only about one in nine does. The model is the same, so the gap comes
          from the scene. The clover cameras look into dense, insect-rich flowers, while the Emerald Queen cameras were set
          off far more often by wind-blown plants, debris and changing light, with fewer insects passing through.
        </p>
        <div className="paired-grid paired-grid--two">
          <div>
            <h3>Frames with any insect</h3>
            <ShareRows rows={insectRows} />
            <h3>Frames with a Bombus</h3>
            <ShareRows rows={bombusRows} digits={1} />
          </div>
          <div>
            <h3>Clover trigger frames with an insect, by camera</h3>
            <ShareRows rows={cameraRows} />
            <p className="chart-note precision-camera-note">
              Precision varies even within one site. Camera {busiest.camera} fired on{' '}
              {busiest.triggers} of the {clover.triggers} sampled triggers, about {percent(busiest.triggers / clover.triggers)} of
              the total, and most of its triggers were empty, while Cameras 1 and 4 found an insect in about two of every three.
            </p>
          </div>
        </div>
        <p className="chart-note">
          "Saved" counts the frames the camera kept after its stale filter, and "all triggers" also counts the frames the
          filter would have dropped. Emerald Queen: {ca.reviewedFrames.toLocaleString()} human-reviewed frames from random test
          samples, weighted back to the {ca.savedFramesRepresented.toLocaleString()} saved frames they stand for. The five
          samples, each from a different set of random camera-days, range from {percent(Math.min(...cohortValues), 1)} to{' '}
          {percent(Math.max(...cohortValues), 1)}, and counting
          the few insects the reviews may have missed raises the share to at most {percent(ca.anyInsectUpper.value, 1)}.{' '}
          {data.methods.california} Clover: {data.methods.clover} Checked box by box rather than frame by frame, the trigger's own
          boxes land on an insect {percent(clover.boxLevel.saved.value)} of the time on saved frames
          ({clover.boxLevel.saved.boxes} boxes) and {percent(clover.boxLevel.allTriggers.value)} on all triggers
          ({clover.boxLevel.allTriggers.boxes} boxes).
        </p>
      </section>
    </>
  )
}
