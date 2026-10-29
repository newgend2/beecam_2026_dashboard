import { useState } from 'react'
import stagesJson from '../data/cascade-stages.json'
import modelStats from '../data/model-stats.json'

interface Counts {
  tp: number
  fp: number
  fn: number
}

interface DetectorRow {
  data: string
  kind: string
  images: number
  matchIou: number
  conf: number
  insect: Counts
  bombusRecall: { covered: number; boxes: number }
}

interface MemberRow extends Counts {
  member: string
  data: string
  kind: string
  images: number
  threshold: number
  thresholdNote?: string
}

interface Member {
  id: string
  label: string
  architecture: string
  inputSize: number
  trainingNote: string
  views: string[]
}

interface Example {
  camera: string
  date: string
  truth: string
  decision: string
  combined: number
  note: string | null
  members: Array<{ member: string; view: string; p: number }>
}

const data = stagesJson as unknown as {
  pipeline: string
  threshold: number
  detector: { weights: string; imgsz: number; proposalFloor: number; nmsIou: number }
  members: Member[]
  combine: string
  matchRule: string
  detectorMetrics: DetectorRow[]
  memberMetrics: MemberRow[]
  examples: Example[]
}

export const stagesSource = `scripts/build_cascade_stages.py, run on slugger against the cached outputs of the frozen ${data.pipeline} evaluations in bombus_cascade. The detector is scored against every human insect box, Bombus or other, and each classifier alone on the same proposals as the full cascade. Development is rescored on the current labels.`

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const precision = (row: Counts) => row.tp / (row.tp + row.fp)
const recall = (row: Counts) => row.tp / (row.tp + row.fn)

/** Scores are stored to six decimals, so 0 and 1 mean "beyond the sixth decimal", never exactly 0% or 100%. */
export function formatProbability(p: number) {
  if (p >= 1) return '>0.999999'
  if (p <= 0) return '<0.000001'
  if (p >= 0.999) {
    const text = p.toFixed(6)
    return text === '1.000000' ? '>0.999999' : text
  }
  if (p >= 0.001) return p.toFixed(3)
  return p.toExponential(1)
}

const cameraLabel = (camera: string) => `Camera ${Number(camera.replace(/\D/g, ''))}`
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
const memberLabel = (id: string) => (id === 'ensemble' ? 'Ensemble (both)' : `ResNet-50, ${data.members.find((m) => m.id === id)?.label ?? id}`)

export function DetectorStage() {
  const floor = data.detector.proposalFloor
  const heldOut = data.detectorMetrics.find((row) => row.kind === 'held-out' && row.conf === floor) ?? data.detectorMetrics[0]
  return (
    <section className="chart-card" aria-labelledby="detector-stage-title">
      <div className="chart-heading">
        <div><p className="eyebrow">Stage 1 on its own</p><h2 id="detector-stage-title">The YOLO insect detector</h2></div>
      </div>
      <p className="chart-intro">
        The first stage is a YOLO detector with a single class, insect, trained in round 4 and run on the full frame at{' '}
        {data.detector.imgsz} px.
        It has one job, finding every insect, so the cascade keeps every proposal it scores {floor} or more and lets the
        classifier throw out the rest. Here it is scored on its own, against every insect a person boxed, Bombus or not.
        Bombus covered is the share of hand-boxed bumble bees with a proposal on them, which caps what the whole cascade
        can find. On the held-out frames at the cascade setting it finds {percent(recall(heldOut.insect))} of all insects
        and {heldOut.bombusRecall.covered} of {heldOut.bombusRecall.boxes} bumble bees, at a precision of{' '}
        {percent(precision(heldOut.insect))}.
      </p>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Evaluation data</th>
              <th scope="col">Score cutoff</th>
              <th scope="col">Insects TP / FP / FN</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">Bombus covered</th>
            </tr>
          </thead>
          <tbody>
            {data.detectorMetrics.map((row) => (
              <tr key={`${row.data}-${row.conf}`}>
                <th scope="row"><span className={`result-kind result-kind--${row.kind}`}>{row.kind}</span> {row.data}</th>
                <td>{row.conf}{row.conf === floor ? ' (cascade setting)' : ''}</td>
                <td>{row.insect.tp.toLocaleString()} / {row.insect.fp.toLocaleString()} / {row.insect.fn}</td>
                <td>{percent(precision(row.insect))}</td>
                <td>{percent(recall(row.insect))}</td>
                <td>{row.bombusRecall.covered} of {row.bombusRecall.boxes} ({percent(row.bombusRecall.covered / row.bombusRecall.boxes)})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="demo-caption">
        The low precision at the cascade setting is deliberate: extra proposals cost only classifier time, while a missed
        bee is lost for good. At a conventional cutoff of 0.25 the detector is far more precise but starts to miss
        insects. Precision here is a floor, because reviewers did not always box every non-Bombus insect, so some
        proposals counted as false are real insects. A proposal is a true positive when it overlaps a human box it has not
        already been matched to by an IoU of at least {data.detectorMetrics[0].matchIou}, and every count is a box, as in
        the results table above.
      </p>
    </section>
  )
}

function ScoreStrip({ example }: { example: Example }) {
  const at = (p: number) => ({ left: `${p * 100}%` })
  return (
    <div className="ensemble-strip" role="img"
      aria-label={`Bombus probability from each member at each rotation, and their mean ${formatProbability(example.combined)} against the threshold ${data.threshold}`}>
      <div className="ensemble-plot">
        <span className="ensemble-threshold" style={at(data.threshold)}><b>threshold {data.threshold}</b></span>
        {data.members.map((member, index) => (
          <div className="ensemble-strip-row" key={member.id}>
            <span className="ensemble-row-label">{member.label}</span>
            <div className="ensemble-track">
              {example.members.filter((score) => score.member === member.id).map((score) => (
                <span key={score.view} className={`ensemble-dot ensemble-dot--${index === 0 ? 'a' : 'b'}`} style={at(score.p)}
                  title={`${score.view}: ${formatProbability(score.p)}`} />
              ))}
            </div>
          </div>
        ))}
        <div className="ensemble-strip-row">
          <span className="ensemble-row-label">Mean of 8</span>
          <div className="ensemble-track">
            <span className={`ensemble-mean ensemble-mean--${example.decision === 'bombus' ? 'bombus' : 'other'}`}
              style={at(example.combined)} title={`Mean ${formatProbability(example.combined)}`} />
          </div>
        </div>
      </div>
      <div className="ensemble-axis" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => <span key={tick} style={at(tick)}>{tick}</span>)}
      </div>
    </div>
  )
}

export function EnsembleStage() {
  const [selected, setSelected] = useState(() => Math.max(0, data.examples.findIndex((example) => example.note)))
  const example = data.examples[selected]
  const views = data.members[0].views
  const heldOut = data.memberMetrics.filter((row) => row.kind === 'held-out' && Math.abs(row.threshold - data.threshold) < 1e-9)
  const development = data.memberMetrics.filter((row) => row.kind === 'development' && Math.abs(row.threshold - data.threshold) < 1e-9)
  const own = data.memberMetrics.filter((row) => row.thresholdNote && row.kind === 'held-out')
  const ensembleDev = development.find((row) => row.member === 'ensemble')
  const selection = (modelStats.results as Array<Counts & { kind: string }>).find((row) => row.kind === 'development')

  return (
    <section className="chart-card" aria-labelledby="ensemble-stage-title">
      <div className="chart-heading">
        <div><p className="eyebrow">Stage 2 on its own</p><h2 id="ensemble-stage-title">The ResNet ensemble</h2></div>
        <div className="chart-legend">
          <span><i className="ensemble-key ensemble-key--a" />{data.members[0].label}</span>
          <span><i className="ensemble-key ensemble-key--b" />{data.members[1].label}</span>
          <span><i className="ensemble-key ensemble-key--mean" />Mean</span>
        </div>
      </div>
      <p className="chart-intro">
        Each proposal is cut from the full-resolution frame with a little context, padded to a square and resized to{' '}
        {data.members[0].inputSize} px. Two ResNet-50 classifiers, trained the same way but with different augmentation,
        each score the crop four times, once per quarter turn. The eight Bombus probabilities are averaged, and the
        proposal counts as a Bombus when the mean reaches {data.threshold}.
      </p>

      <ol className="ensemble-flow" aria-label="How the ensemble scores one crop">
        <li><strong>Crop</strong><span>{data.members[0].inputSize} px, from the native frame</span></li>
        <li><strong>4 rotations</strong><span>{views.join(', ')}</span></li>
        <li><strong>2 ResNet-50s</strong><span>{data.members.map((member) => member.label).join(' and ')}</span></li>
        <li><strong>8 scores</strong><span>Bombus probability each</span></li>
        <li><strong>Mean ≥ {data.threshold}</strong><span>Bombus, otherwise other insect</span></li>
      </ol>

      <div className="ensemble-members">
        {data.members.map((member, index) => (
          <article key={member.id}>
            <h3><i className={`ensemble-key ensemble-key--${index === 0 ? 'a' : 'b'}`} />{member.architecture}, {member.label}</h3>
            <p>{member.trainingNote}</p>
          </article>
        ))}
      </div>

      <h3 className="ensemble-subhead">Real scores for the frames in the video</h3>
      <div className="ensemble-picker" role="group" aria-label="Choose an example frame">
        {data.examples.map((item, index) => (
          <button key={`${item.camera}-${item.date}-${index}`} type="button" aria-pressed={index === selected}
            className={index === selected ? 'is-active' : undefined} onClick={() => setSelected(index)}>
            {item.note ? 'Closest call · ' : ''}{item.truth === 'bombus' ? 'Bombus' : 'Other insect'} · {cameraLabel(item.camera)} · {shortDate(item.date)}
          </button>
        ))}
      </div>
      <div className="ensemble-example">
        <ScoreStrip example={example} />
        <div className="results-table-wrap">
          <table className="results-table ensemble-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                {views.map((view) => <th scope="col" key={view}>{view}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <th scope="row">{member.label}</th>
                  {views.map((view) => {
                    const score = example.members.find((item) => item.member === member.id && item.view === view)
                    return <td key={view}>{score ? formatProbability(score.p) : '–'}</td>
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Mean of 8</th>
                <td colSpan={views.length}>
                  <strong>{formatProbability(example.combined)}</strong> →{' '}
                  {example.decision === 'bombus' ? 'Bombus' : 'other insect'} (human label: {example.truth === 'bombus' ? 'Bombus' : 'other insect'})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="demo-caption">
        {example.note
          ? `The closest call among the frames the cascade got right. Single scores range from ${formatProbability(Math.min(...example.members.map((score) => score.p)))} to ${formatProbability(Math.max(...example.members.map((score) => score.p)))} depending on member and rotation, and their mean clears the threshold by only ${(example.combined - data.threshold).toFixed(4)}.`
          : 'Clear frames give eight near-identical scores. The rotations and the second member matter most for the hard frames, where single scores scatter.'}{' '}
        These are the stored scores from the frozen held-out evaluation, to six decimals.
      </p>

      <h3 className="ensemble-subhead">Each member alone and together, at the shared threshold</h3>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Classifier</th>
              <th scope="col">Held-out TP / FP / FN</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">Development TP / FP / FN</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
            </tr>
          </thead>
          <tbody>
            {heldOut.map((row) => {
              const dev = development.find((item) => item.member === row.member)
              return (
                <tr key={row.member} className={row.member === 'ensemble' ? 'is-total' : undefined}>
                  <th scope="row">{memberLabel(row.member)}</th>
                  <td>{row.tp} / {row.fp} / {row.fn}</td>
                  <td>{percent(precision(row))}</td>
                  <td>{percent(recall(row))}</td>
                  <td>{dev ? `${dev.tp} / ${dev.fp} / ${dev.fn}` : '–'}</td>
                  <td>{dev ? percent(precision(dev)) : '–'}</td>
                  <td>{dev ? percent(recall(dev)) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="demo-caption">
        Held-out is test cohort v6 ({heldOut[0]?.images.toLocaleString()} frames), and development is the{' '}
        {development[0]?.images.toLocaleString()}-frame development set rescored on the current labels
        {selection && ensembleDev && (selection.tp !== ensembleDev.tp || selection.fp !== ensembleDev.fp || selection.fn !== ensembleDev.fn)
          ? ` (the ensemble counted ${selection.tp} / ${selection.fp} / ${selection.fn} there when round 6 was chosen, as in the results above)`
          : ''}. Each member alone
        raises more false alarms, and averaging the two mainly removes them. Given its own threshold chosen on
        development, each member still does no better on held-out frames ({own.map((row) => `${memberLabel(row.member).replace('ResNet-50, ', '')} at ${row.threshold} scores ${row.tp} / ${row.fp} / ${row.fn}`).join(', and ')}).
        After the vote, Bombus boxes that overlap are merged into one.
      </p>
    </section>
  )
}
