import cameraData from './camera-status.json'
import type { CameraRecord, CellPosition } from '../types'

export const cameras = cameraData as CameraRecord[]

export function gridCellToPosition(gridCell: string): CellPosition {
  const match = /^([A-L])([0-7])$/.exec(gridCell)
  if (!match) {
    throw new Error(`Invalid grid cell: ${gridCell}`)
  }

  const column = match[1].charCodeAt(0) - 'A'.charCodeAt(0)
  const row = Number(match[2])

  return {
    column,
    row,
    x: column * 100,
    y: row * 100,
  }
}

export function formatCheckDate(date: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export const latestCheckDate = cameras.reduce(
  (latest, camera) => (camera.checkedAt > latest ? camera.checkedAt : latest),
  cameras[0].checkedAt,
)
