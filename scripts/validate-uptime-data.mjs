import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const uptime = await read('src/data/camera-uptime.json')
const positives = await read('src/data/positive-data.json')
const errors = []

if (/\/media\/|\/mnt\/|\/home\/|\.zip/.test(JSON.stringify(uptime))) errors.push('Camera uptime contains a source path')
const n = uptime.dates.length
if (uptime.daily.length !== n) errors.push('Daily totals do not cover every date')
let hours = 0
let days = 0
for (const camera of uptime.cameras) {
  if (camera.daily.length !== n) errors.push(`Camera ${camera.cameraId} has ${camera.daily.length} days, expected ${n}`)
  if (camera.daily.some((h) => h < 0 || h > 24.01)) errors.push(`Camera ${camera.cameraId} has a day outside 0-24 h`)
  hours += camera.daily.reduce((sum, h) => sum + h, 0)
  days += camera.daily.filter((h) => h > 0).length
}
if (Math.abs(hours - uptime.summary.cameraHours) > 1) errors.push(`Camera hours ${hours} != summary ${uptime.summary.cameraHours}`)
if (days !== uptime.summary.cameraDays) errors.push(`Camera-days ${days} != summary ${uptime.summary.cameraDays}`)
uptime.daily.forEach((day, index) => {
  const sum = uptime.cameras.reduce((total, camera) => total + camera.daily[index], 0)
  if (Math.abs(sum - day.cameraHours) > 0.05) errors.push(`${uptime.dates[index]}: daily total ${day.cameraHours} != ${sum}`)
})
// every day with a confirmed Bombus frame must fall on a day that camera was imaging
const index = new Map(uptime.dates.map((date, i) => [date, i]))
const byCamera = new Map(uptime.cameras.map((camera) => [camera.cameraId, camera]))
for (const frame of positives.frames) {
  const camera = byCamera.get(frame.cameraId)
  if (!camera || !(camera.daily[index.get(frame.date)] > 0)) {
    errors.push(`Bombus frame on Camera ${frame.cameraId} ${frame.date} falls on a day without imaging time`)
    break
  }
}

if (errors.length) {
  console.error(`Camera uptime validation failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`Validated camera uptime: ${uptime.cameras.length} cameras, ${days} camera-days, ${Math.round(hours)} camera-hours.`)
