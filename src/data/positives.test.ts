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
    expect(positiveFrames).toHaveLength(809)
    expect(positiveVisits).toHaveLength(410)
    expect(positiveSummary.totalFrames).toBe(809)
    expect(positiveSummary.uniqueVisits).toBe(410)
    expect(positiveSummary.singleFrameVisits + positiveSummary.multiFrameVisits).toBe(410)
  })

  it('assigns every frame to one visit with one representative', () => {
    expect(framesByVisit.size).toBe(positiveVisits.length)
    expect(new Set(positiveFrames.map(({ cropPath }) => cropPath)).size).toBe(809)

    for (const visit of positiveVisits) {
      const frames = framesByVisit.get(visit.visitId) ?? []
      expect(frames).toHaveLength(visit.frameCount)
      expect(frames.filter(({ isRepresentative }) => isRepresentative)).toHaveLength(1)
    }
  })

  it('combines Cameras 18 and 19 at their shared F5 location', () => {
    expect(locationSummaries).toHaveLength(26)
    expect(locationSummaries.reduce((total, location) => total + location.frames, 0)).toBe(809)
    expect(locationSummaries.reduce((total, location) => total + location.visits, 0)).toBe(410)

    const f5 = locationSummaries.find(({ gridCell }) => gridCell === 'F5')
    expect(f5).toEqual({
      gridCell: 'F5',
      cameraIds: [18, 19],
      frames: 56,
      visits: 24,
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
