import type { GallerySort } from '../types'

interface SortSelectProps {
  value: GallerySort
  onChange: (value: GallerySort) => void
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label>
      Sort by
      <select value={value} onChange={(event) => onChange(event.target.value as GallerySort)}>
        <option value="sharpness">Sharpest first</option>
        <option value="time">Capture time</option>
      </select>
    </label>
  )
}

export function SharpnessNote() {
  return (
    <p className="gallery-sort-note">
      Sharpness is the variance of the Laplacian inside each bee's box, so crisp bees come first and
      motion-blurred fly-throughs last.
    </p>
  )
}
