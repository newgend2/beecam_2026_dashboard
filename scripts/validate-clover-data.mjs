import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const data = JSON.parse(await readFile(new URL('src/data/clover-data.json', root), 'utf8'))
const recall = JSON.parse(await readFile(new URL('src/data/clover-recall.json', root), 'utf8'))
const errors = []

if (data.frames.length !== data.summary.totalFrames) errors.push('Clover frame summary does not match frame records')
if (data.visits.length !== data.summary.uniqueVisits) errors.push('Clover visit summary does not match visit records')
const cropNames = new Set(data.frames.map((frame) => frame.cropPath.split('/').at(-1)))
const cropFiles = (await readdir(new URL('public/clover/crops/', root))).filter((name) => name.endsWith('.webp'))
if (cropNames.size !== data.frames.length || cropFiles.length !== data.frames.length) {
  errors.push(`Expected ${data.frames.length} clover crops; JSON=${cropNames.size}, files=${cropFiles.length}`)
}
for (const frame of data.frames) {
  if (!/^clover-cam\d{2}-\d{8}-v\d{3}$/.test(frame.visitId)) errors.push(`Invalid clover visit ID ${frame.visitId}`)
  if (!frame.cropPath.startsWith('clover/crops/')) errors.push(`Clover crop outside clover/crops: ${frame.cropPath}`)
}
const representatives = data.frames.filter((frame) => frame.isRepresentative).length
if (representatives !== data.visits.length) errors.push(`Expected ${data.visits.length} representatives; found ${representatives}`)
if (!recall.settings?.length || !recall.perCamera?.length) errors.push('Clover recall summary is empty')

const privateFields = ['source_path', 'image_id', 'event_id', 'camera_period']
for (const filename of ['clover_all_positive_frames_2026.csv', 'clover_unique_visits_2026.csv']) {
  const csv = await readFile(new URL(`public/downloads/${filename}`, root), 'utf8')
  const header = csv.slice(0, csv.indexOf('\n')).split(',')
  for (const field of privateFields) if (header.includes(field)) errors.push(`${filename} exposes private field ${field}`)
}

if (errors.length) {
  console.error(`Clover data validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Clover data OK: ${data.frames.length} frames, ${data.visits.length} visits`)
