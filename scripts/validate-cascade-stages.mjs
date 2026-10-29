import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const stages = await read('src/data/cascade-stages.json')
const modelStats = await read('src/data/model-stats.json')
const errors = []

if (/\/media\/|\/mnt\/|\/home\/|\.zip|\.csv/.test(JSON.stringify(stages))) errors.push('Cascade stages contain a source path')

// every row on the same data must count the same human boxes, whatever the cutoff or classifier
const positives = new Map()
const sameBoxes = (key, count, name) => {
  if (!positives.has(key)) positives.set(key, count)
  else if (positives.get(key) !== count) errors.push(`${name}: ${count} human boxes, expected ${positives.get(key)}`)
}
const insectBoxes = new Map()
for (const row of stages.detectorMetrics) {
  const name = `Detector ${row.kind} at ${row.conf}`
  const boxes = row.insect.tp + row.insect.fn
  if (insectBoxes.has(row.kind) && insectBoxes.get(row.kind) !== boxes) errors.push(`${name}: ${boxes} insect boxes, expected ${insectBoxes.get(row.kind)}`)
  insectBoxes.set(row.kind, boxes)
  if (row.bombusRecall.covered > row.bombusRecall.boxes) errors.push(`${name}: covers more Bombus than exist`)
  sameBoxes(row.kind, row.bombusRecall.boxes, name)
}
if (!stages.detectorMetrics.some((row) => row.conf === stages.detector.proposalFloor)) errors.push('No detector row at the cascade proposal floor')
for (const row of stages.memberMetrics) sameBoxes(row.kind, row.tp + row.fn, `${row.member} ${row.kind} at ${row.threshold}`)

const heldOut = modelStats.results.find((row) => row.kind === 'held-out')
const ensemble = stages.memberMetrics.find((row) => row.member === 'ensemble' && row.kind === 'held-out')
if (!ensemble || ['tp', 'fp', 'fn'].some((key) => ensemble[key] !== heldOut[key])) errors.push('Ensemble held-out counts differ from the results table')

// each example's mean must be the mean of its eight stored scores, and agree with its decision
const views = stages.members[0].views
for (const example of stages.examples) {
  const name = `Example ${example.camera} ${example.date}`
  if (example.members.length !== stages.members.length * views.length) errors.push(`${name}: ${example.members.length} scores`)
  const mean = example.members.reduce((total, score) => total + score.p, 0) / example.members.length
  if (Math.abs(mean - example.combined) > 5e-6) errors.push(`${name}: mean ${mean.toFixed(6)} != combined ${example.combined}`)
  const decision = example.combined >= stages.threshold ? 'bombus' : 'other_insect'
  if (decision !== example.decision) errors.push(`${name}: decision ${example.decision} does not follow from ${example.combined}`)
  if (example.members.some((score) => score.p < 0 || score.p > 1)) errors.push(`${name}: probability outside 0–1`)
}

if (errors.length) {
  console.error(`Cascade stage validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Cascade stages valid: ${stages.detectorMetrics.length} detector rows, ${stages.memberMetrics.length} classifier rows, ${stages.examples.length} examples.`)
