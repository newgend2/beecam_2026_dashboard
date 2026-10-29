import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { landingVisitsByCamera, positiveFrames } from './data/positives'

describe('BeeCam dashboard', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#home')
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('opens with the positive-detection overview and public downloads', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Bumble bees, frame by frame.' }),
    ).toBeInTheDocument()
    const summary = screen.getByLabelText('Positive detection summary')
    expect(within(summary).getByText('6,134')).toBeInTheDocument()
    expect(within(summary).getByText('1,397')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All positive frames/ })).toHaveAttribute(
      'href',
      expect.stringContaining('all_positive_frames_2026.csv'),
    )
    expect(screen.getByRole('link', { name: /Unique visits/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Detection crops, May/ })).toBeInTheDocument()
  })

  it('draws the landing slideshow from the camera-balanced pool', () => {
    render(<App />)
    const slide = screen.getByAltText(/^Bumble bee detection from Camera/)
    const poolCrops = landingVisitsByCamera.flat().map(({ representativeCropPath }) => representativeCropPath)
    expect(poolCrops.some((cropPath) => slide.getAttribute('src')?.endsWith(cropPath))).toBe(true)
  })

  it('offers the tagged bee table, sized crop ZIPs and the related project sites', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /Tagged bee visits/ })).toHaveAttribute(
      'href',
      expect.stringContaining('tagged_bee_visits_2026.csv'),
    )
    expect(screen.getByRole('link', { name: /Detection crops, July–August/ })).toHaveTextContent(/ZIP · \d+\.\d MB/)
    for (const name of ['BeeCam assembly', 'Cocoon cam tagged bees']) {
      expect(screen.getAllByRole('link', { name: new RegExp(name) }).length).toBe(2)
    }
    expect(screen.getAllByRole('link', { name: /BeeCam assembly/ })[0]).toHaveAttribute(
      'href',
      'https://newgend2.github.io/beecam-design/',
    )
  })

  it('navigates to the camera-status view and supports keyboard selection', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Camera status' }))

    const summary = screen.getByLabelText('Camera status summary')
    expect(within(summary).getAllByText('26')).toHaveLength(2)
    expect(within(summary).getByText('Taken down')).toBeInTheDocument()
    expect(within(summary).getByText('0')).toBeInTheDocument()

    const h4 = screen.getByRole('button', {
      name: 'H4, Camera 17, taken down',
    })
    fireEvent.keyDown(h4, { key: 'Enter' })
    expect(
      screen.getByRole('heading', { name: 'H4 · Camera 17' }),
    ).toBeInTheDocument()
    expect(h4).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Taken down following completion of the Emerald Queen field season.')).toBeInTheDocument()
  })

  it('opens the gallery with all cameras and frames selected by default', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }))

    expect(screen.getByRole('button', { name: 'All frames' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('combobox', { name: 'Camera location' })).toHaveValue('all')
    expect(screen.getByText('6,134 positive frames')).toBeInTheDocument()
    expect(screen.getByText('Showing 48')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /^Open detection from/ })[0])
    expect(screen.getByRole('dialog', { name: /2026/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download crop' })).toHaveAttribute(
      'href',
      expect.stringMatching(/positives\/crops\/.+\.webp$/),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close image viewer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sorts the gallery sharpest first by default, with capture time on request', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }))

    const sort = screen.getByRole('combobox', { name: 'Sort by' })
    expect(sort).toHaveValue('sharpness')
    expect(screen.getByText(/variance of the Laplacian/)).toBeInTheDocument()

    const sharpest = [...positiveFrames].sort((a, b) => b.sharpness - a.sharpness)[0]
    fireEvent.click(screen.getAllByRole('button', { name: /^Open detection from/ })[0])
    expect(screen.getByRole('link', { name: 'Download crop' })).toHaveAttribute(
      'href',
      expect.stringContaining(sharpest.cropPath),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close image viewer' }))

    fireEvent.change(sort, { target: { value: 'time' } })
    expect(screen.queryByText(/variance of the Laplacian/)).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^Open detection from/ })[0])
    expect(screen.getByRole('link', { name: 'Download crop' })).toHaveAttribute(
      'href',
      expect.stringContaining(positiveFrames[0].cropPath),
    )
  })

  it('supports keyboard map selection and transfers the location to the gallery', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Camera map' }))

    const f3 = screen.getByRole('button', { name: 'F3 · Camera 5, 258 frames' })
    fireEvent.keyDown(f3, { key: ' ' })
    expect(f3).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'F3 · Camera 5' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open filtered gallery' }))
    expect(screen.getByRole('combobox', { name: 'Camera location' })).toHaveValue('F3')
    expect(screen.getByText('258 positive frames')).toBeInTheDocument()
  })

  it('explains the model on its own tab with the demo video and labelled results', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Model training' }))

    expect(screen.getByRole('heading', { name: 'Teaching a model to find Bombus' })).toBeInTheDocument()
    const summary = screen.getByLabelText('Model data summary')
    expect(within(summary).getByText('3,654,917')).toBeInTheDocument()
    expect(within(summary).getByText('6,134')).toBeInTheDocument()
    expect(screen.getByLabelText(/Demonstration of the round 6 cascade/)).toHaveAttribute(
      'src',
      expect.stringContaining('model/cascade_demo.mp4'),
    )
    expect(screen.getAllByText('held-out').length).toBeGreaterThan(0)
    expect(screen.getByText('Emerald Queen · Willow Creek, California')).toBeInTheDocument()
  })
})
