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
