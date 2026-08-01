import positiveDataJson from './positive-data.json'
import { cameras } from './cameras'
import type {
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
