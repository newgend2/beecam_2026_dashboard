import type { KeyboardEvent } from 'react'
import { gridCellToPosition } from '../data/cameras'
import type { CameraRecord } from '../types'

interface CameraMapProps {
  cameras: CameraRecord[]
  selectedCell: string
  onSelect: (camera: CameraRecord) => void
}

function handleKeySelect(
  event: KeyboardEvent<SVGGElement>,
  camera: CameraRecord,
  onSelect: (camera: CameraRecord) => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSelect(camera)
  }
}

export function CameraMap({
  cameras,
  selectedCell,
  onSelect,
}: CameraMapProps) {
  return (
    <div className="map-frame">
      <div className="map-scroll">
        <div className="map-canvas">
          <img
            src={`${import.meta.env.BASE_URL}assets/emerald-queen-grid.jpg`}
            alt="Aerial map of the Emerald Queen research site divided into cells A0 through L7."
          />
          <svg
            className="map-overlay"
            viewBox="0 0 1200 800"
            preserveAspectRatio="none"
            aria-label="Interactive BeeCam deployment map"
          >
            {cameras.map((camera) => {
              const position = gridCellToPosition(camera.gridCell)
              const selected = selectedCell === camera.gridCell

              return (
                <g
                  key={camera.gridCell}
                  className={`camera-cell camera-cell--${camera.status}${selected ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${camera.gridCell}, Camera ${camera.cameraId}, taken down`}
                  aria-pressed={selected}
                  onClick={() => onSelect(camera)}
                  onKeyDown={(event) => handleKeySelect(event, camera, onSelect)}
                >
                  <rect
                    x={position.x + 3}
                    y={position.y + 3}
                    width="94"
                    height="94"
                    rx="6"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={position.x + 85}
                    cy={position.y + 17}
                    r="6"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    className="cell-label"
                    x={position.x + 50}
                    y={position.y + 42}
                    textAnchor="middle"
                  >
                    {camera.gridCell}
                  </text>
                  <text
                    className="camera-label"
                    x={position.x + 50}
                    y={position.y + 66}
                    textAnchor="middle"
                  >
                    Cam {camera.cameraId}
                  </text>
                  <text
                    className="status-label"
                    x={position.x + 50}
                    y={position.y + 84}
                    textAnchor="middle"
                  >
                    TAKEN DOWN
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      <p className="map-help">
        Select a highlighted grid cell to inspect its final field-season status.
      </p>
    </div>
  )
}
