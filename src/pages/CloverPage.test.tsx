import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { cloverFrames, cloverRecall, cloverSummary, cloverVisits } from '../data/clover'

describe('Clover cams tab', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#home')
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
  })

  it('keeps clover frames out of the Emerald Queen totals', () => {
    expect(cloverSummary.totalFrames).toBe(241)
    expect(cloverFrames).toHaveLength(241)
    expect(cloverVisits).toHaveLength(cloverSummary.uniqueVisits)
    expect(new Set(cloverFrames.map((frame) => frame.cameraId))).toEqual(new Set([1, 4, 11, 23]))
    for (const frame of cloverFrames) {
      expect(frame.cropPath.startsWith('clover/crops/')).toBe(true)
      expect(frame.visitId).toMatch(/^clover-cam\d{2}-\d{8}-v\d{3}$/)
    }
  })

  it('shows the Oregon site, the recall analysis and the frame/visit gallery', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Clover cams (Oregon)' }))

    expect(screen.getByRole('heading', { name: 'Clover field near Philomath, Oregon' })).toBeInTheDocument()
    expect(screen.getByText(/44°31'38.3"N 123°18'20.2"W/)).toBeInTheDocument()
    expect(screen.getByText('Clover field · near Philomath, Oregon')).toBeInTheDocument()
    expect(screen.queryByText('Emerald Queen · Willow Creek, California')).not.toBeInTheDocument()

    const summary = screen.getByLabelText('Clover cams summary')
    expect(within(summary).getByText('241')).toBeInTheDocument()

    const int8 = cloverRecall.settings[0]
    expect(int8.visitsCaught).toBe(60)
    expect(int8.visits).toBe(73)
    expect(screen.getByRole('heading', { name: /Would the camera's own model have saved these bees/ })).toBeInTheDocument()

    expect(screen.getByText('241 positive frames')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Unique visits' }))
    expect(screen.getByText(`${cloverSummary.uniqueVisits} unique visits`)).toBeInTheDocument()
  })

  it('sorts the clover gallery sharpest first by default', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Clover cams (Oregon)' }))
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('sharpness')

    const sharpest = [...cloverFrames].sort((a, b) => b.sharpness - a.sharpness)[0]
    fireEvent.click(screen.getAllByRole('button', { name: /^Open detection from/ })[0])
    expect(screen.getByRole('link', { name: 'Download crop' })).toHaveAttribute(
      'href',
      expect.stringContaining(sharpest.cropPath),
    )
  })
})
