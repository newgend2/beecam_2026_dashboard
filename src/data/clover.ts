import cloverDataJson from './clover-data.json'
import cloverRecallJson from './clover-recall.json'
import cloverSiteJson from './clover-site.json'
import type { PositiveFrame, PositiveSummary, PositiveVisit } from '../types'

interface CloverCamera {
  cameraId: number
  frames: number
  visits: number
  dateMin: string
  dateMax: string
}

interface CloverData {
  summary: PositiveSummary
  cameras: CloverCamera[]
  frames: PositiveFrame[]
  visits: PositiveVisit[]
}

export interface CloverRecallSetting {
  setting: string
  visitsCaught: number
  visits: number
  frameRecall: number
  bombusPrecision: number
  triggersPerBombusFrame: number
}

export interface CloverRecall {
  source: string
  reviewedFrames: number
  populationFrames: number
  settings: CloverRecallSetting[]
  perCamera: Array<{ camera: string; visits: number; int8Caught: number; fullPrecisionCaught: number }>
}

const cloverData = cloverDataJson as CloverData

export const cloverSummary = cloverData.summary
export const cloverCameras = cloverData.cameras
export const cloverFrames = cloverData.frames
export const cloverVisits = cloverData.visits
export const cloverRecall = cloverRecallJson as CloverRecall
export const cloverSite = cloverSiteJson

export const cloverFramesByVisit = new Map<string, PositiveFrame[]>()
for (const frame of cloverFrames) {
  const frames = cloverFramesByVisit.get(frame.visitId) ?? []
  frames.push(frame)
  cloverFramesByVisit.set(frame.visitId, frames)
}
for (const frames of cloverFramesByVisit.values()) frames.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

export function cloverRepresentativeFrame(visit: PositiveVisit): PositiveFrame {
  const frames = cloverFramesByVisit.get(visit.visitId) ?? []
  return frames.find((frame) => frame.isRepresentative) ?? frames[0]
}
