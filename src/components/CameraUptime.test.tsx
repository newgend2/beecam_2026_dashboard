import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CameraUptime } from './CameraUptime'
import uptime from '../data/camera-uptime.json'

describe('camera uptime', () => {
  it('shows the imaging-effort totals, the cumulative chart and one timeline row per camera', () => {
    render(<CameraUptime />)
    const kpis = screen.getByLabelText('Imaging effort')
    expect(within(kpis).getByText(Math.round(uptime.summary.cameraHours).toLocaleString())).toBeInTheDocument()
    expect(within(kpis).getByText(uptime.summary.cameraDays.toLocaleString())).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How long the cameras were running' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Cumulative camera-hours/ })).toBeInTheDocument()
    const timeline = screen.getByRole('img', { name: /Hours each camera was imaging/ })
    expect(within(timeline).getAllByText(/^Camera \d+ · [A-L]\d$/)).toHaveLength(uptime.cameras.length)
  })

  it('keeps totals consistent with the per-camera days', () => {
    const hours = uptime.cameras.reduce((sum, camera) => sum + camera.daily.reduce((a, b) => a + b, 0), 0)
    expect(hours).toBeCloseTo(uptime.summary.cameraHours, 0)
    expect(uptime.summary.dateMax <= '2026-08-06').toBe(true)
  })
})
