import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const position = await read('src/data/position-analytics.json')
const positives = await read('src/data/positive-data.json')
const clover = await read('src/data/clover-data.json')
const stats = await read('src/data/model-stats.json')
const errors = []
const text = JSON.stringify(position)

if (/\/media\/|\/home\/|\.jpg/.test(text)) errors.push('Position analytics contains a source path')
const eq = position.emeraldQueen
if (eq.visits !== positives.summary.uniqueVisits) errors.push(`Emerald Queen visits ${eq.visits} != positive-data ${positives.summary.uniqueVisits}`)
if (eq.boxes !== stats.confirmedBombus.boxes) errors.push(`Emerald Queen boxes ${eq.boxes} != model-stats ${stats.confirmedBombus.boxes}`)
if (position.clover.visits !== clover.summary.uniqueVisits) errors.push(`Clover visits ${position.clover.visits} != clover-data ${clover.summary.uniqueVisits} (both use the 2 s rule)`)
if (position.clover.frames !== clover.summary.totalFrames) errors.push(`Clover frames ${position.clover.frames} != clover-data ${clover.summary.totalFrames}`)
for (const [name, site] of [['emeraldQueen', eq], ['clover', position.clover]]) {
  for (const key of ['heat', 'size', 'rings']) {
    const total = [site[key]].flat(2).reduce((sum, value) => sum + value, 0)
    if (Math.abs(total - 1) > 0.002) errors.push(`${name}.${key} sums to ${total}, not 1`)
  }
  const cameraVisits = site.perCamera.reduce((sum, camera) => sum + camera.visits, 0)
  if (cameraVisits !== site.visits) errors.push(`${name} per-camera visits ${cameraVisits} != ${site.visits}`)
}
const bias = position.clover.triggerBias
if (bias.overall.boxes !== position.clover.boxes) errors.push('Trigger bias does not cover every clover box')
if (bias.rings.reduce((sum, row) => sum + row.boxes, 0) !== bias.overall.boxes) errors.push('Trigger bias rings do not add up')

if (errors.length) {
  console.error(`Position data validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Validated position analytics: ${eq.boxes} Emerald Queen boxes in ${eq.visits} visits, ${position.clover.boxes} clover boxes.`)
