import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const precision = JSON.parse(await readFile(new URL('src/data/trigger-precision.json', root), 'utf8'))
const errors = []

if (/\/media\/|\/mnt\/|\/home\/|\.zip|\.csv/.test(JSON.stringify(precision))) errors.push('Trigger precision contains a source path')

const inside = (share, name) => {
  const [low, high] = share.ci95
  if (!(low <= share.value && share.value <= high)) errors.push(`${name}: ${share.value} lies outside its interval ${low}–${high}`)
}
const ca = precision.california
for (const key of ['anyInsect', 'anyInsectUpper', 'bombus']) inside(ca[key], `California ${key}`)
if (ca.anyInsectUpper.value < ca.anyInsect.value) errors.push('California upper value is below the main estimate')
if (ca.perCohort.reduce((sum, cohort) => sum + cohort.n, 0) !== ca.reviewedFrames) errors.push('California cohort sizes do not add up to the reviewed frames')

// clover shares are plain proportions of the sampled trigger frames
const clover = precision.clover
for (const group of ['allTriggers', 'saved']) {
  const g = clover[group]
  for (const key of ['anyInsect', 'bombus', 'otherOnly', 'noInsect']) {
    inside(g[key], `Clover ${group} ${key}`)
    if (Math.abs(g[key].value - g[key].count / g.n) > 0.0006) errors.push(`Clover ${group} ${key} ${g[key].value} != ${g[key].count}/${g.n}`)
  }
  if (g.anyInsect.count + g.noInsect.count !== g.n) errors.push(`Clover ${group}: insect and no-insect frames do not add up`)
  if (g.bombus.count + g.otherOnly.count !== g.anyInsect.count) errors.push(`Clover ${group}: Bombus and other-insect frames do not add up`)
}
if (clover.allTriggers.n + clover.badImages !== clover.triggers) errors.push('Clover triggers do not match usable plus bad frames')
const cameras = clover.perCamera
const sum = (key) => cameras.reduce((total, camera) => total + camera[key], 0)
if (sum('triggers') !== clover.triggers) errors.push('Clover per-camera triggers do not add up')
if (sum('insect') !== clover.allTriggers.anyInsect.count) errors.push('Clover per-camera insect frames do not add up')
if (sum('saved') !== clover.saved.n) errors.push('Clover per-camera saved frames do not add up')
for (const camera of cameras) inside({ value: camera.insectShare, ci95: camera.insectCi95 }, `Clover Camera ${camera.camera}`)

if (errors.length) {
  console.error(`Trigger precision validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Validated trigger precision: California ${ca.reviewedFrames} reviewed frames, clover ${clover.triggers} trigger frames.`)
