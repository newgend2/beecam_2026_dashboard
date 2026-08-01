import { readFile } from 'node:fs/promises'

const dataUrl = new URL('../src/data/camera-status.json', import.meta.url)
const assignmentsUrl = new URL(
  '../sensor_grid_status/cam_cellnums.txt',
  import.meta.url,
)

const records = JSON.parse(await readFile(dataUrl, 'utf8'))
const assignmentText = await readFile(assignmentsUrl, 'utf8')

const assignments = new Map(
  assignmentText
    .split(/\r?\n/)
    .map((line) => /^([A-L][0-7])\s*-\s*(\d+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => [match[1], Number(match[2])]),
)

const expectedCells = [
  ...['C', 'D', 'E'].flatMap((column) => [1, 2].map((row) => `${column}${row}`)),
  ...['F', 'G', 'H', 'I', 'J'].flatMap((column) =>
    [3, 4, 5, 6].map((row) => `${column}${row}`),
  ),
]

const errors = []
const cells = new Set()
const cameraIds = new Set()

if (records.length !== 26) errors.push(`Expected 26 records; found ${records.length}`)
if (assignments.size !== 26) {
  errors.push(`Expected 26 authoritative assignments; found ${assignments.size}`)
}

for (const record of records) {
  const {
    gridId,
    gridCell,
    cameraId,
    status,
    checkedAt,
    note,
  } = record

  if (!expectedCells.includes(gridCell)) errors.push(`Unexpected cell ${gridCell}`)
  if (cells.has(gridCell)) errors.push(`Duplicate cell ${gridCell}`)
  if (cameraIds.has(cameraId)) errors.push(`Duplicate camera ${cameraId}`)
  if (assignments.get(gridCell) !== cameraId) {
    errors.push(
      `${gridCell} must use camera ${assignments.get(gridCell)}; found ${cameraId}`,
    )
  }
  if (status !== 'taken-down') {
    errors.push(`Invalid status for ${gridCell}: ${status}`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) {
    errors.push(`Invalid date for ${gridCell}: ${checkedAt}`)
  }
  if (!['upper', 'lower'].includes(gridId)) {
    errors.push(`Invalid grid for ${gridCell}: ${gridId}`)
  }
  if (typeof note !== 'string' || !note.trim()) {
    errors.push(`Missing public note for ${gridCell}`)
  }
  cells.add(gridCell)
  cameraIds.add(cameraId)
}

for (const cell of expectedCells) {
  if (!cells.has(cell)) errors.push(`Missing expected cell ${cell}`)
}

if (errors.length) {
  console.error(`Camera data validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log(
  `Validated ${records.length} cameras across ${expectedCells.length} expected cells.`,
)
