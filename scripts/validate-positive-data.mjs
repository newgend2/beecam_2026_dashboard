import { visitRuleErrors } from './visit-rule.mjs'
import { readFile, readdir, stat } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const data = JSON.parse(
  await readFile(new URL('src/data/positive-data.json', root), 'utf8'),
)
const errors = []

if (data.summary.totalFrames !== 6134) errors.push(`Expected 6134 frames; found ${data.summary.totalFrames}`)
if (data.summary.uniqueVisits !== 1397) errors.push(`Expected 1397 visits; found ${data.summary.uniqueVisits}`)
if (data.frames.length !== data.summary.totalFrames) errors.push('Frame summary does not match frame records')
if (data.visits.length !== data.summary.uniqueVisits) errors.push('Visit summary does not match visit records')

const cropNames = new Set(data.frames.map((frame) => frame.cropPath.split('/').at(-1)))
const cropDirectory = new URL('public/positives/crops/', root)
const cropFiles = (await readdir(cropDirectory)).filter((name) => name.endsWith('.webp'))
if (cropNames.size !== 6134 || cropFiles.length !== 6134) {
  errors.push(`Expected 6134 unique crop files; JSON=${cropNames.size}, files=${cropFiles.length}`)
}

for (const frame of data.frames) {
  if (!/^eq-cam\d{2}-\d{8}-v\d{3}$/.test(frame.visitId)) errors.push(`Invalid visit ID ${frame.visitId}`)
  if (!/^[A-L][0-7]$/.test(frame.gridCell)) errors.push(`Invalid grid cell ${frame.gridCell}`)
  if (frame.visitFrameIndex < 1 || frame.visitFrameIndex > frame.visitFrameCount) {
    errors.push(`Invalid visit frame index for ${frame.cropPath}`)
  }
}

const representatives = data.frames.filter((frame) => frame.isRepresentative)
if (representatives.length !== 1397) errors.push(`Expected 1397 representative frames; found ${representatives.length}`)

const cropBoxes = JSON.parse(await readFile(new URL('scripts/crop_boxes.json', root), 'utf8')).crops
const sharpestByVisit = new Map()
for (const frame of data.frames) {
  if (!Number.isFinite(frame.sharpness) || frame.sharpness < 0) errors.push(`Missing sharpness for ${frame.cropPath}`)
  if (!cropBoxes[frame.cropPath]) errors.push(`No crop boxes for ${frame.cropPath}; score_sharpness.py could not rescore it`)
  sharpestByVisit.set(frame.visitId, Math.max(sharpestByVisit.get(frame.visitId) ?? -1, frame.sharpness))
}
for (const frame of representatives) {
  if (frame.sharpness !== sharpestByVisit.get(frame.visitId)) errors.push(`Representative ${frame.cropPath} is not the sharpest frame of its visit`)
}
for (const visit of data.visits) {
  if (visit.sharpness !== sharpestByVisit.get(visit.visitId)) errors.push(`Visit ${visit.visitId} sharpness does not match its sharpest frame`)
}

const taggedCsv = await readFile(new URL('public/downloads/tagged_bee_visits_2026.csv', root), 'utf8')
const taggedRows = taggedCsv.trim().split('\n').slice(1).map((line) => line.split(','))
const expectedTagged = data.visits
  .filter((visit) => visit.arucoTag || visit.tagIds.length)
  .flatMap((visit) => (visit.tagIds.length ? visit.tagIds : ['unreadable']).map((tag) => `${tag}|${visit.visitId}`))
  .sort()
const publishedTagged = taggedRows.map((row) => `${row[0]}|${row[10]}`).sort()
if (expectedTagged.join() !== publishedTagged.join()) {
  errors.push('tagged_bee_visits_2026.csv does not match the tagged visits; run python3 scripts/export_tagged_visits.py')
}

const privateFields = ['source_path', 'image_id', 'event_id', 'camera_period']
for (const filename of ['all_positive_frames_2026.csv', 'unique_visits_2026.csv', 'tagged_bee_visits_2026.csv']) {
  const csv = await readFile(new URL(`public/downloads/${filename}`, root), 'utf8')
  const header = csv.slice(0, csv.indexOf('\n')).split(',')
  for (const field of privateFields) {
    if (header.includes(field)) errors.push(`${filename} exposes private field ${field}`)
  }
}

for (const part of ['may', 'jun', 'jul_aug']) {
  const archive = await stat(new URL(`public/downloads/beecam_positive_crops_2026_${part}.zip`, root))
  if (archive.size === 0) errors.push(`Crop ZIP ${part} is empty`)
  if (archive.size > 100 * 1024 * 1024) errors.push(`Crop ZIP ${part} exceeds GitHub's 100 MB file limit`)
}

errors.push(...visitRuleErrors(data.frames, 'Emerald Queen'))
if (errors.length) {
  console.error(`Positive data validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log(`Validated ${data.frames.length} frames, ${data.visits.length} visits, and ${cropFiles.length} crops.`)
