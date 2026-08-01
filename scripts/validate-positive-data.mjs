import { readFile, readdir, stat } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const data = JSON.parse(
  await readFile(new URL('src/data/positive-data.json', root), 'utf8'),
)
const errors = []

if (data.summary.totalFrames !== 809) errors.push(`Expected 809 frames; found ${data.summary.totalFrames}`)
if (data.summary.uniqueVisits !== 410) errors.push(`Expected 410 visits; found ${data.summary.uniqueVisits}`)
if (data.frames.length !== data.summary.totalFrames) errors.push('Frame summary does not match frame records')
if (data.visits.length !== data.summary.uniqueVisits) errors.push('Visit summary does not match visit records')

const cropNames = new Set(data.frames.map((frame) => frame.cropPath.split('/').at(-1)))
const cropDirectory = new URL('public/positives/crops/', root)
const cropFiles = (await readdir(cropDirectory)).filter((name) => name.endsWith('.webp'))
if (cropNames.size !== 809 || cropFiles.length !== 809) {
  errors.push(`Expected 809 unique crop files; JSON=${cropNames.size}, files=${cropFiles.length}`)
}

for (const frame of data.frames) {
  if (!/^eq-cam\d{2}-\d{8}-v\d{3}$/.test(frame.visitId)) errors.push(`Invalid visit ID ${frame.visitId}`)
  if (!/^[A-L][0-7]$/.test(frame.gridCell)) errors.push(`Invalid grid cell ${frame.gridCell}`)
  if (frame.visitFrameIndex < 1 || frame.visitFrameIndex > frame.visitFrameCount) {
    errors.push(`Invalid visit frame index for ${frame.cropPath}`)
  }
}

const representatives = data.frames.filter((frame) => frame.isRepresentative)
if (representatives.length !== 410) errors.push(`Expected 410 representative frames; found ${representatives.length}`)

const privateFields = ['source_path', 'image_id', 'event_id', 'camera_period']
for (const filename of ['all_positive_frames_2026.csv', 'unique_visits_2026.csv']) {
  const csv = await readFile(new URL(`public/downloads/${filename}`, root), 'utf8')
  const header = csv.slice(0, csv.indexOf('\n')).split(',')
  for (const field of privateFields) {
    if (header.includes(field)) errors.push(`${filename} exposes private field ${field}`)
  }
}

const archive = await stat(new URL('public/downloads/beecam_positive_crops_2026.zip', root))
if (archive.size === 0) errors.push('Crop ZIP is empty')

if (errors.length) {
  console.error(`Positive data validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log(`Validated ${data.frames.length} frames, ${data.visits.length} visits, and ${cropFiles.length} crops.`)
