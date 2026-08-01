import type { KeyboardEvent } from 'react'
import { gridCellToPosition } from '../data/cameras'
import { formatCameraLocation } from '../data/positives'
import type { LocationSummary, PositiveMetric } from '../types'

interface PositiveMapProps {
  locations: LocationSummary[]
  metric: PositiveMetric
  selectedCell: string
  onSelect: (location: LocationSummary) => void
}

export function PositiveMap({ locations, metric, selectedCell, onSelect }: PositiveMapProps) {
  const maximum = Math.max(...locations.map((location) => location[metric]), 1)

  function handleKey(event: KeyboardEvent<SVGGElement>, location: LocationSummary) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(location)
    }
  }

  return (
    <div className="map-frame">
      <div className="map-scroll">
        <div className="map-canvas">
          <img
            src={`${import.meta.env.BASE_URL}assets/emerald-queen-grid.jpg`}
            alt="Aerial map of the Emerald Queen research site divided into cells A0 through L7."
          />
          <svg
            className="map-overlay positive-map-overlay"
            viewBox="0 0 1200 800"
            preserveAspectRatio="none"
            aria-label={`Positive ${metric} by camera location`}
          >
            {locations.map((location) => {
              const position = gridCellToPosition(location.gridCell)
              const count = location[metric]
              const selected = selectedCell === location.gridCell
              const intensity = count === 0 ? 0.18 : 0.42 + (count / maximum) * 0.45
              return (
                <g
                  key={location.gridCell}
                  className={`positive-map-cell${selected ? ' is-selected' : ''}${count === 0 ? ' is-empty' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${formatCameraLocation(location)}, ${count} ${metric}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(location)}
                  onKeyDown={(event) => handleKey(event, location)}
                >
                  <rect
                    x={position.x + 3}
                    y={position.y + 3}
                    width="94"
                    height="94"
                    rx="6"
                    style={{ fillOpacity: intensity }}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text className="cell-label" x={position.x + 50} y={position.y + 38} textAnchor="middle">
                    {location.gridCell}
                  </text>
                  <text className="positive-count" x={position.x + 50} y={position.y + 69} textAnchor="middle">
                    {count}
                  </text>
                  <text className="status-label" x={position.x + 50} y={position.y + 85} textAnchor="middle">
                    {metric === 'frames' ? 'FRAMES' : 'VISITS'}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      <p className="map-help">Select a deployed cell to inspect its totals and open the filtered gallery.</p>
    </div>
  )
}
