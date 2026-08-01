import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
    expect(within(summary).getByText('809')).toBeInTheDocument()
    expect(within(summary).getByText('410')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All positive frames/ })).toHaveAttribute(
      'href',
      expect.stringContaining('all_positive_frames_2026.csv'),
    )
    expect(screen.getByRole('link', { name: /Unique visits/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Detection crop archive/ })).toBeInTheDocument()
  })

  it('navigates to the camera-status view and supports keyboard selection', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Camera status' }))

    const summary = screen.getByLabelText('Camera status summary')
    expect(within(summary).getByText('26')).toBeInTheDocument()
    expect(within(summary).getByText('22')).toBeInTheDocument()
    expect(within(summary).getByText('4')).toBeInTheDocument()

    const h4 = screen.getByRole('button', {
      name: 'H4, Camera 17, defective',
    })
    fireEvent.keyDown(h4, { key: 'Enter' })
    expect(
      screen.getByRole('heading', { name: 'H4 · Camera 17' }),
    ).toBeInTheDocument()
    expect(h4).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the gallery with all cameras and frames selected by default', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Gallery' }))

    expect(screen.getByRole('button', { name: 'All frames' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('combobox', { name: 'Camera location' })).toHaveValue('all')
    expect(screen.getByText('809 positive frames')).toBeInTheDocument()
    expect(screen.getByText('Showing 48')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /^Open detection from/ })[0])
    expect(screen.getByRole('dialog', { name: /May/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download crop' })).toHaveAttribute(
      'href',
      expect.stringMatching(/positives\/crops\/.+\.webp$/),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close image viewer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('supports keyboard map selection and transfers the location to the gallery', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Camera map' }))

    const f3 = screen.getByRole('button', { name: 'F3 · Camera 5, 34 frames' })
    fireEvent.keyDown(f3, { key: ' ' })
    expect(f3).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'F3 · Camera 5' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open filtered gallery' }))
    expect(screen.getByRole('combobox', { name: 'Camera location' })).toHaveValue('F3')
    expect(screen.getByText('34 positive frames')).toBeInTheDocument()
  })
})
