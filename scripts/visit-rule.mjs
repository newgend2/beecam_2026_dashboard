import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
export const { gapSeconds } = JSON.parse(await readFile(new URL('src/data/visit-rule.json', root), 'utf8'))

/** Errors for any visit that breaks the rule: gaps inside a visit at most gapSeconds, between consecutive visits of a camera-day more. */
export function visitRuleErrors(frames, label) {
  const errors = []
  const groups = new Map()
  for (const frame of frames) {
    const key = `${frame.cameraId}|${frame.date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(frame)
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    for (let index = 1; index < group.length; index += 1) {
      const gap = (Date.parse(group[index].capturedAt) - Date.parse(group[index - 1].capturedAt)) / 1000
      const sameVisit = group[index].visitId === group[index - 1].visitId
      if (sameVisit && gap > gapSeconds) errors.push(`${label}: ${group[index].visitId} has a ${gap} s gap inside it`)
      if (!sameVisit && gap <= gapSeconds) errors.push(`${label}: ${group[index - 1].visitId} and ${group[index].visitId} are only ${gap} s apart`)
    }
  }
  return errors
}
