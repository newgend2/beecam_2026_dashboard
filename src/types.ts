export type CameraStatus = 'nominal' | 'defective'

export interface CameraRecord {
  gridId: 'upper' | 'lower'
  gridCell: string
  cameraId: number
  status: CameraStatus
  checkedAt: string
  note: string
}

export interface CellPosition {
  column: number
  row: number
  x: number
  y: number
}

export interface PositiveFrame {
  cameraId: number
  gridCell: string
  date: string
  capturedAt: string
  visitId: string
  visitFrameIndex: number
  visitFrameCount: number
  cropPath: string
  cropWidth: number
  cropHeight: number
  isRepresentative: boolean
}

export interface PositiveVisit {
  visitId: string
  cameraId: number
  gridCell: string
  date: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  frameCount: number
  representativeCropPath: string
  representativeCapturedAt: string
}

export interface PositiveSummary {
  totalFrames: number
  uniqueVisits: number
  singleFrameVisits: number
  multiFrameVisits: number
  dateMin: string
  dateMax: string
}

export interface LocationSummary {
  gridCell: string
  cameraIds: number[]
  frames: number
  visits: number
}

export type DashboardTab = 'home' | 'map' | 'gallery' | 'analytics' | 'status'
export type PositiveMetric = 'frames' | 'visits'
