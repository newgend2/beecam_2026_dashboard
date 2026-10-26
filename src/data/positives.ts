import positiveDataJson from './positive-data.json'
import { cameras } from './cameras'
import type {
  GallerySort,
  LocationSummary,
  PositiveFrame,
  PositiveSummary,
  PositiveVisit,
} from '../types'

interface PositiveData {
  summary: PositiveSummary
  frames: PositiveFrame[]
  visits: PositiveVisit[]
}

const positiveData = positiveDataJson as PositiveData

export const positiveSummary = positiveData.summary
export const positiveFrames = positiveData.frames
export const positiveVisits = positiveData.visits

export const framesByVisit = new Map<string, PositiveFrame[]>()
for (const frame of positiveFrames) {
  const frames = framesByVisit.get(frame.visitId) ?? []
  frames.push(frame)
  framesByVisit.set(frame.visitId, frames)
}
for (const frames of framesByVisit.values()) {
  frames.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
}

const locationMap = new Map<string, LocationSummary>()
for (const camera of cameras) {
  locationMap.set(camera.gridCell, {
    gridCell: camera.gridCell,
    cameraIds: [camera.cameraId],
    frames: 0,
    visits: 0,
  })
}
for (const frame of positiveFrames) {
  const location = locationMap.get(frame.gridCell)
  if (!location) continue
  location.frames += 1
  if (!location.cameraIds.includes(frame.cameraId)) location.cameraIds.push(frame.cameraId)
}
for (const visit of positiveVisits) {
  const location = locationMap.get(visit.gridCell)
  if (location) location.visits += 1
}
for (const location of locationMap.values()) location.cameraIds.sort((a, b) => a - b)

export const locationSummaries = [...locationMap.values()].sort((a, b) =>
  a.gridCell.localeCompare(b.gridCell),
)

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

export function formatCameraLocation(location: Pick<LocationSummary, 'gridCell' | 'cameraIds'>): string {
  const cameraLabel =
    location.cameraIds.length === 1
      ? `Camera ${location.cameraIds[0]}`
      : `Cameras ${location.cameraIds.join(' & ')}`
  return `${location.gridCell} · ${cameraLabel}`
}

export function formatCaptureDate(capturedAt: string): string {
  const date = new Date(capturedAt)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function buildDailyCumulative() {
  const framesByDate = new Map<string, number>()
  const visitsByDate = new Map<string, number>()
  for (const frame of positiveFrames) {
    framesByDate.set(frame.date, (framesByDate.get(frame.date) ?? 0) + 1)
  }
  for (const visit of positiveVisits) {
    visitsByDate.set(visit.date, (visitsByDate.get(visit.date) ?? 0) + 1)
  }

  const start = new Date(`${positiveSummary.dateMin}T00:00:00Z`)
  const end = new Date(`${positiveSummary.dateMax}T00:00:00Z`)
  const points = []
  let cumulativeFrames = 0
  let cumulativeVisits = 0
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const date = current.toISOString().slice(0, 10)
    cumulativeFrames += framesByDate.get(date) ?? 0
    cumulativeVisits += visitsByDate.get(date) ?? 0
    points.push({ date, frames: cumulativeFrames, visits: cumulativeVisits })
  }
  return points
}

export function visitRepresentativeFrame(visit: PositiveVisit): PositiveFrame {
  const frames = framesByVisit.get(visit.visitId) ?? []
  return frames.find((frame) => frame.isRepresentative) ?? frames[0]
}

/** Gallery order: capture time as published, or sharpest first. */
export function sortForGallery<T extends { sharpness: number }>(items: T[], sort: GallerySort): T[] {
  return sort === 'sharpness' ? [...items].sort((a, b) => b.sharpness - a.sharpness) : items
}

/** Most visits the landing-page slideshow takes from any one camera. */
export const LANDING_VISITS_PER_CAMERA = 6

/**
 * The landing-page slideshow's pool, grouped by camera: each camera-day's sharpest visit, if it is at
 * least as sharp as the median visit, keeping each camera's sharpest few. A busy camera-day such as
 * Camera 1 on Jul 7 then shows one bee, not dozens.
 */
export const landingVisitsByCamera: PositiveVisit[][] = (() => {
  const sharpnesses = positiveVisits.map(({ sharpness }) => sharpness).sort((a, b) => a - b)
  const median = sharpnesses[Math.floor(sharpnesses.length / 2)]
  const bestByCameraDay = new Map<string, PositiveVisit>()
  for (const visit of positiveVisits) {
    if (visit.sharpness < median) continue
    const key = `${visit.cameraId}|${visit.date}`
    const best = bestByCameraDay.get(key)
    if (!best || visit.sharpness > best.sharpness) bestByCameraDay.set(key, visit)
  }
  const byCamera = new Map<number, PositiveVisit[]>()
  for (const visit of sortForGallery([...bestByCameraDay.values()], 'sharpness')) {
    const visits = byCamera.get(visit.cameraId) ?? []
    if (visits.length < LANDING_VISITS_PER_CAMERA) visits.push(visit)
    byCamera.set(visit.cameraId, visits)
  }
  return [...byCamera.values()]
})()

function shuffle<T>(values: T[], random: () => number): T[] {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

/**
 * Slideshow order: rounds that each show one visit from every camera still holding some, cameras in
 * random order, so the same camera never appears twice in a row.
 */
export function landingSlideOrder(random: () => number = Math.random): PositiveVisit[] {
  const queues = landingVisitsByCamera.map((visits) => shuffle(visits, random))
  const order: PositiveVisit[] = []
  while (queues.some((queue) => queue.length)) {
    const round = shuffle(queues.filter((queue) => queue.length), random)
    if (round.length > 1 && round[0][0].cameraId === order.at(-1)?.cameraId) {
      ;[round[0], round[1]] = [round[1], round[0]]
    }
    for (const queue of round) order.push(queue.shift() as PositiveVisit)
  }
  return order
}

/** "aruco:305" -> "ArUco 305", "n8tag:39" -> "n8tag 39"; anything else (e.g. unreadable) is shown as read. */
export function formatTagId(tagId: string): string {
  const [kind, value] = tagId.split(':')
  if (value === undefined) return tagId
  return `${kind === 'aruco' ? 'ArUco' : kind} ${value}`
}

/** Tag IDs read on the dashboard's bees, with how many visits carry each. */
export const tagIdOptions = (() => {
  const counts = new Map<string, number>()
  for (const visit of positiveVisits) for (const tag of visit.tagIds) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([tag]) => tag.includes(':'))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([tag, visits]) => ({ tag, visits }))
})()
