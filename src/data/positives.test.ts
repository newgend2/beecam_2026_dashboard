import { describe, expect, it } from 'vitest'
import {
  buildDailyCumulative,
  framesByVisit,
  LANDING_VISITS_PER_CAMERA,
  landingSlideOrder,
  landingVisitsByCamera,
  locationSummaries,
  positiveFrames,
  positiveSummary,
  positiveVisits,
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

  it('feeds the landing slideshow sharp visits spread across cameras and days', () => {
    const pool = landingVisitsByCamera.flat()
    const sharpnesses = positiveVisits.map(({ sharpness }) => sharpness).sort((a, b) => a - b)
    const median = sharpnesses[Math.floor(sharpnesses.length / 2)]
    expect(pool.every(({ sharpness }) => sharpness >= median)).toBe(true)
    expect(new Set(pool.map(({ cameraId, date }) => `${cameraId}|${date}`)).size).toBe(pool.length)

    const camerasAboveMedian = new Set(positiveVisits.filter(({ sharpness }) => sharpness >= median).map(({ cameraId }) => cameraId))
    expect(landingVisitsByCamera).toHaveLength(camerasAboveMedian.size)
    for (const visits of landingVisitsByCamera) {
      expect(visits.length).toBeLessThanOrEqual(LANDING_VISITS_PER_CAMERA)
      expect(new Set(visits.map(({ cameraId }) => cameraId)).size).toBe(1)
    }
  })

  it('never shows the same camera twice in a row in the slideshow', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let run = 0; run < 20; run += 1) {
      const order = landingSlideOrder(random)
      expect(order).toHaveLength(landingVisitsByCamera.flat().length)
      expect(new Set(order.map(({ visitId }) => visitId)).size).toBe(order.length)
      for (let index = 1; index < order.length; index += 1) {
        expect(order[index].cameraId).not.toBe(order[index - 1].cameraId)
      }
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
