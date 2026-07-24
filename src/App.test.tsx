import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('camera dashboard', () => {
  it('shows all network summary values', () => {
    render(<App />)
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('selects a camera cell with the keyboard', () => {
    render(<App />)
    const h4 = screen.getByRole('button', {
      name: 'H4, Camera 17, defective',
    })
    fireEvent.keyDown(h4, { key: 'Enter' })
    expect(
      screen.getByRole('heading', { name: 'H4 · Camera 17' }),
    ).toBeInTheDocument()
    expect(h4).toHaveAttribute('aria-pressed', 'true')
  })
})
