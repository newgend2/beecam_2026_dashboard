import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PositionAnalytics } from './PositionAnalytics'
import position from '../data/position-analytics.json'

describe('position analytics', () => {
  it('shows both heat maps, the comparison and the trigger bias test', () => {
    render(<PositionAnalytics />)
    expect(screen.getByRole('heading', { name: 'Where bees appear in the camera view' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Emerald Queen \(triggered\): share of 1614 visits/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Clover cams \(timelapse\): share of 100 visits/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Would the camera trigger have caught the clover bees?' })).toBeInTheDocument()
    expect(screen.getAllByText(`${position.clover.triggerBias.overall.caught} of ${position.clover.triggerBias.overall.boxes}`, { exact: false }).length).toBeGreaterThan(0)
  })

  it('switches the Emerald Queen map to a single camera', () => {
    render(<PositionAnalytics />)
    fireEvent.change(screen.getByLabelText('Emerald Queen (triggered) camera'), { target: { value: '22' } })
    const visits = position.emeraldQueen.perCamera.find((camera) => camera.camera === 22)!.visits
    expect(screen.getByRole('img', { name: new RegExp(`Emerald Queen \\(triggered\\): share of ${visits} visits`) })).toBeInTheDocument()
  })

  it('weights every visit once, so each map sums to one', () => {
    for (const site of [position.emeraldQueen, position.clover]) {
      expect(site.heat.flat().reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 2)
    }
  })
})
