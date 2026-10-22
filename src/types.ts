export type CameraStatus = 'taken-down'

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
  arucoTag: boolean
  tagId: string | null
  /** Variance of the Laplacian inside the bee's box (scripts/sharpness.py); higher is sharper. */
  sharpness: number
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
  arucoTag: boolean
  tagIds: string[]
  /** Sharpness of the representative frame, the visit's sharpest. */
  sharpness: number
}

export interface PositiveSummary {
  totalFrames: number
  uniqueVisits: number
  singleFrameVisits: number
  multiFrameVisits: number
  dateMin: string
  dateMax: string
  arucoFrames: number
  arucoVisits: number
  tagIdentities: number
}

export interface LocationSummary {
  gridCell: string
  cameraIds: number[]
  frames: number
  visits: number
}

export type DashboardTab = 'home' | 'map' | 'gallery' | 'analytics' | 'model' | 'status' | 'clover'
export type PositiveMetric = 'frames' | 'visits'
export type GallerySort = 'time' | 'sharpness'
