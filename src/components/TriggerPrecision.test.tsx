import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TriggerPrecision } from './TriggerPrecision'
import precision from '../data/trigger-precision.json'

describe('trigger precision', () => {
  it('compares the share of saved frames with an insect at both sites', () => {
    render(<TriggerPrecision />)
    const kpis = screen.getByLabelText('Trigger precision')
    expect(within(kpis).getByText('11%')).toBeInTheDocument()
    expect(within(kpis).getByText('52%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How many saved frames held an insect' })).toBeInTheDocument()
    for (const camera of precision.clover.perCamera) {
      expect(screen.getByText(`Camera ${camera.camera}`)).toBeInTheDocument()
    }
  })
})
