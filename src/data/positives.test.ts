import { describe, expect, it } from 'vitest'
import {
  buildDailyCumulative,
  framesByVisit,
  locationSummaries,
  positiveFrames,
  positiveSummary,
  positiveVisits,
} from './positives'

describe('normalized positive detections', () => {
  it('contains the expected frame and visit totals', () => {
    expect(positiveFrames).toHaveLength(5527)
    expect(positiveVisits).toHaveLength(1451)
    expect(positiveSummary.totalFrames).toBe(5527)
    expect(positiveSummary.uniqueVisits).toBe(1451)
    expect(positiveSummary.singleFrameVisits + positiveSummary.multiFrameVisits).toBe(1451)
  })

  it('assigns every frame to one visit with one representative', () => {
    expect(framesByVisit.size).toBe(positiveVisits.length)
    expect(new Set(positiveFrames.map(({ cropPath }) => cropPath)).size).toBe(5527)

    for (const visit of positiveVisits) {
      const frames = framesByVisit.get(visit.visitId) ?? []
      expect(frames).toHaveLength(visit.frameCount)
      expect(frames.filter(({ isRepresentative }) => isRepresentative)).toHaveLength(1)
    }
  })

  it('combines Cameras 18 and 19 at their shared F5 location', () => {
    expect(locationSummaries).toHaveLength(26)
    expect(locationSummaries.reduce((total, location) => total + location.frames, 0)).toBe(5527)
    expect(locationSummaries.reduce((total, location) => total + location.visits, 0)).toBe(1451)

    const f5 = locationSummaries.find(({ gridCell }) => gridCell === 'F5')
    expect(f5).toEqual({
      gridCell: 'F5',
      cameraIds: [18, 19],
      frames: 234,
      visits: 75,
    })
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
