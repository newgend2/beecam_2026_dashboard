import modelStats from '../data/model-stats.json'
import { assetUrl, positiveSummary } from '../data/positives'

interface ResultRow {
  label: string
  kind: string
  data: string
  images: number
  tp: number
  fp: number
  fn: number
}

const steps = [
  {
    title: 'A camera network with on-device detection',
    body: 'We placed 26 BeeCams across the Emerald Queen property. Each camera ran a custom-trained YOLO model that saved a frame whenever it detected an insect.',
  },
  {
    title: 'A permissive trigger',
    body: `The on-camera model proved very permissive: wind-blown debris triggered many false detections. The 2026 season produced ${(modelStats.imagesRecorded.value / 1e6).toFixed(1)} million saved frames, far more than anyone can review, so we needed a model that finds only Bombus.`,
  },
  {
    title: 'Why full-image Bombus detection fell short',
    body: 'Our first attempts trained a detector to find Bombus directly in the full frame. An insect fills only a small part of each image, so the model had to learn the fine differences between Bombus and other insects while being crowded out by background.',
  },
  {
    title: 'A two-stage cascade',
    body: 'Stage 1 is a full-image YOLO detector with a single, broad class: any insect. That task is much easier than singling out Bombus. Stage 2 cuts each proposal from the native-resolution frame and passes the crop to a ResNet classifier trained on crops, which decides Bombus or other insect.',
  },
  {
    title: 'Ongoing refinement',
    body: 'The remaining errors are mostly blurry, fast-moving insects. The current round adds blur augmentation and more hard examples so the classifier can handle them.',
  },
]

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

export function ModelPage() {
  const results = modelStats.results as ResultRow[]

  return (
    <main id="main" className="dashboard-shell page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Model development</p>
          <h1>Teaching a model to find Bombus</h1>
          <p>
            How we went from millions of camera-trap frames to confirmed bumble bee
            detections with a two-stage insect detector and crop classifier.
          </p>
        </div>
      </header>

      <section className="analytics-kpis model-kpis" aria-label="Model data summary">
        <article>
          <span>Images recorded</span>
          <strong>{modelStats.imagesRecorded.value.toLocaleString()}</strong>
          <small>2026 season · {modelStats.imagesRecorded.cameraDays.toLocaleString()} camera-days</small>
        </article>
        <article>
          <span>Human-reviewed images</span>
          <strong>{modelStats.humanReviewed.value.toLocaleString()}</strong>
          <small>{modelStats.humanReviewed.annotated.toLocaleString()} with insects · {modelStats.humanReviewed.background.toLocaleString()} background</small>
        </article>
        <article>
          <span>Confirmed Bombus frames</span>
          <strong>{positiveSummary.totalFrames.toLocaleString()}</strong>
          <small>{modelStats.confirmedBombus.boxes.toLocaleString()} bees boxed by hand</small>
        </article>
        <article>
          <span>Unique visits</span>
          <strong>{positiveSummary.uniqueVisits.toLocaleString()}</strong>
          <small>Frames grouped by the two-second rule</small>
        </article>
      </section>

      <section className="chart-card" aria-labelledby="method-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Methodology</p><h2 id="method-title">Why a two-stage model</h2></div>
        </div>
        <ol className="method-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="chart-card" aria-labelledby="demo-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Demonstration</p><h2 id="demo-title">The cascade, step by step</h2></div>
        </div>
        <div className="demo-video">
          <video
            src={assetUrl('model/cascade_demo.mp4')}
            poster={assetUrl('model/cascade_demo_poster.webp')}
            controls
            autoPlay
            loop
            muted
            playsInline
            aria-label="Demonstration of the two-stage model on four Bombus and four other-insect frames"
          />
        </div>
        <p className="demo-caption">
          Eight sharp 2026 frames, four with Bombus and four with other insects, run through the frozen
          round 4 pipeline. The detector proposes each insect in the full frame, the proposal is cut
          at native resolution, and the classifier's Bombus probability is compared with the frozen
          threshold. These examples were chosen for clarity and are not an accuracy measure; see the
          results below.
        </p>
      </section>

      <section className="chart-card" aria-labelledby="results-title">
        <div className="chart-heading">
          <div><p className="eyebrow">Results</p><h2 id="results-title">How well it works</h2></div>
        </div>
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Pipeline</th>
                <th scope="col">Evaluation data</th>
                <th scope="col">Images</th>
                <th scope="col">TP / FP / FN</th>
                <th scope="col">Precision</th>
                <th scope="col">Recall</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={`${row.label}-${row.data}`}>
                  <th scope="row">{row.label}</th>
                  <td><span className={`result-kind result-kind--${row.kind}`}>{row.kind}</span> {row.data}</td>
                  <td>{row.images.toLocaleString()}</td>
                  <td>{row.tp} / {row.fp} / {row.fn}</td>
                  <td>{percent(row.tp / (row.tp + row.fp))}</td>
                  <td>{percent(row.tp / (row.tp + row.fn))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="demo-caption">
          Development days are used to choose models and thresholds. Held-out cohorts are camera-days
          no model had seen; each was scored once with a frozen pipeline and then retired. Most of the
          round 4 false alarms on cohort v4 were blurry insects that reviewers confirmed were not Bombus.
          Our target is above 98% precision and recall on held-out data.
        </p>
      </section>

      <section className="source-notes" aria-label="Data sources">
        <p className="eyebrow">Where these numbers come from</p>
        <ul>
          <li><strong>Images recorded.</strong> {modelStats.imagesRecorded.source}</li>
          <li><strong>Human-reviewed images.</strong> {modelStats.humanReviewed.source}</li>
          <li><strong>Confirmed Bombus frames and visits.</strong> {modelStats.confirmedBombus.source}</li>
          <li><strong>Results.</strong> {modelStats.resultsSource}</li>
        </ul>
      </section>
    </main>
  )
}
