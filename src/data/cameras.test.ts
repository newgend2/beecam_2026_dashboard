import { describe, expect, it } from 'vitest'
import { cameras, gridCellToPosition } from './cameras'

describe('gridCellToPosition', () => {
  it.each([
    ['A0', { column: 0, row: 0, x: 0, y: 0 }],
    ['F3', { column: 5, row: 3, x: 500, y: 300 }],
    ['L7', { column: 11, row: 7, x: 1100, y: 700 }],
  ])('maps %s to normalized map coordinates', (cell, expected) => {
    expect(gridCellToPosition(cell)).toEqual(expected)
  })

  it('rejects invalid map cells', () => {
    expect(() => gridCellToPosition('M4')).toThrow('Invalid grid cell')
  })
})

describe('camera records', () => {
  it('contains all 26 uniquely assigned cameras', () => {
    expect(cameras).toHaveLength(26)
    expect(new Set(cameras.map(({ gridCell }) => gridCell)).size).toBe(26)
    expect(new Set(cameras.map(({ cameraId }) => cameraId)).size).toBe(26)
  })

  it('contains only binary public statuses', () => {
    expect(
      cameras.every(({ status }) =>
        ['nominal', 'defective'].includes(status),
      ),
    ).toBe(true)
  })
})
