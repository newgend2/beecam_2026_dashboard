import { describe, expect, it } from 'vitest'
import {
  buildDailyCumulative,
  framesByVisit,
  locationSummaries,
  positiveFrames,
  positiveSummary,
  positiveVisits,
  sharpestVisits,
} from './positives'

describe('normalized positive detections', () => {
  it('contains the expected frame and visit totals', () => {
    expect(positiveFrames).toHaveLength(6134)
    expect(positiveVisits).toHaveLength(1614)
    expect(positiveSummary.totalFrames).toBe(6134)
    expect(positiveSummary.uniqueVisits).toBe(1614)
    expect(positiveSummary.singleFrameVisits + positiveSummary.multiFrameVisits).toBe(1614)
  })

  it('assigns every frame to one visit with one representative', () => {
    expect(framesByVisit.size).toBe(positiveVisits.length)
    expect(new Set(positiveFrames.map(({ cropPath }) => cropPath)).size).toBe(6134)

    for (const visit of positiveVisits) {
      const frames = framesByVisit.get(visit.visitId) ?? []
      expect(frames).toHaveLength(visit.frameCount)
      expect(frames.filter(({ isRepresentative }) => isRepresentative)).toHaveLength(1)
    }
  })

  it('combines Cameras 18 and 19 at their shared F5 location', () => {
    expect(locationSummaries).toHaveLength(26)
    expect(locationSummaries.reduce((total, location) => total + location.frames, 0)).toBe(6134)
    expect(locationSummaries.reduce((total, location) => total + location.visits, 0)).toBe(1614)

    const f5 = locationSummaries.find(({ gridCell }) => gridCell === 'F5')
    expect(f5).toEqual({
      gridCell: 'F5',
      cameraIds: [18, 19],
      frames: 255,
      visits: 83,
    })
  })

  it("makes each visit's representative its sharpest frame", () => {
    for (const visit of positiveVisits) {
      const frames = framesByVisit.get(visit.visitId) ?? []
      const sharpest = Math.max(...frames.map(({ sharpness }) => sharpness))
      const representative = frames.find(({ isRepresentative }) => isRepresentative)
      expect(representative?.sharpness).toBe(sharpest)
      expect(visit.sharpness).toBe(sharpest)
      expect(visit.representativeCropPath).toBe(representative?.cropPath)
    }
  })

  it('feeds the landing slideshow only the sharpest tenth of visits', () => {
    expect(sharpestVisits).toHaveLength(Math.round(positiveVisits.length / 10))
    const cutoff = Math.min(...sharpestVisits.map(({ sharpness }) => sharpness))
    const chosen = new Set(sharpestVisits.map(({ visitId }) => visitId))
    for (const visit of positiveVisits) {
      if (!chosen.has(visit.visitId)) expect(visit.sharpness).toBeLessThanOrEqual(cutoff)
    }
  })

  it('builds cumulative series ending at the published totals', () => {
    const cumulative = buildDailyCumulative()
    expect(cumulative[0]?.date).toBe(positiveSummary.dateMin)
    expect(cumulative.at(-1)).toEqual({
      date: positiveSummary.dateMax,
      frames: positiveSummary.totalFrames,
      visits: positiveSummary.uniqueVisits,
    })
  })
})
