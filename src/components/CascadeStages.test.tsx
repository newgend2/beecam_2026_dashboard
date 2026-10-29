import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetectorStage, EnsembleStage, formatProbability } from './CascadeStages'
import stages from '../data/cascade-stages.json'

describe('cascade stages', () => {
  it('never rounds a stored score to a flat 0 or 1', () => {
    expect(formatProbability(0.999878)).toBe('0.999878')
    expect(formatProbability(1)).toBe('>0.999999')
    expect(formatProbability(0.9999997)).toBe('>0.999999')
    expect(formatProbability(0)).toBe('<0.000001')
    expect(formatProbability(0.717325)).toBe('0.717')
    expect(formatProbability(0.000164)).toBe('1.6e-4')
  })

  it('scores the YOLO detector on its own', () => {
    render(<DetectorStage />)
    expect(screen.getByRole('heading', { name: 'The YOLO insect detector' })).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(stages.detectorMetrics.length)
    const heldOut = stages.detectorMetrics.find((row) => row.kind === 'held-out' && row.conf === stages.detector.proposalFloor)!
    expect(screen.getByText(`${heldOut.bombusRecall.covered} of ${heldOut.bombusRecall.boxes} (100.0%)`)).toBeInTheDocument()
  })

  it('shows every member score for the chosen example', () => {
    render(<EnsembleStage />)
    const closest = stages.examples.find((example) => example.note)!
    const table = document.querySelector('.ensemble-table') as HTMLTableElement
    expect(within(table).getByText(formatProbability(closest.combined))).toBeInTheDocument()
    const clear = stages.examples.findIndex((example) => example.truth === 'bombus' && !example.note)
    fireEvent.click(screen.getByRole('group', { name: 'Choose an example frame' }).querySelectorAll('button')[clear])
    for (const score of stages.examples[clear].members) {
      expect(within(table).getAllByText(formatProbability(score.p)).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Ensemble (both)')).toBeInTheDocument()
  })
})
