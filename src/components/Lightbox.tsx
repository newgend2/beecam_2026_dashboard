import { useEffect, useRef, useState } from 'react'
import { assetUrl, formatCaptureDate } from '../data/positives'
import type { PositiveFrame } from '../types'

interface LightboxProps {
  frames: PositiveFrame[]
  initialIndex: number
  onClose: () => void
}

export function Lightbox({ frames, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const closeButton = useRef<HTMLButtonElement>(null)
  const frame = frames[index]

  const previous = () => setIndex((current) => (current - 1 + frames.length) % frames.length)
  const next = () => setIndex((current) => (current + 1) % frames.length)

  useEffect(() => {
    closeButton.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && frames.length > 1) previous()
      if (event.key === 'ArrowRight' && frames.length > 1) next()
    }
    document.addEventListener('keydown', handleKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.classList.remove('modal-open')
    }
  }, [frames.length, onClose])

  return (
    <div className="lightbox-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title">
        <div className="lightbox-toolbar">
          <div>
            <p className="eyebrow">{frame.gridCell} · Camera {frame.cameraId}</p>
            <h2 id="lightbox-title">{formatCaptureDate(frame.capturedAt)}</h2>
          </div>
          <button ref={closeButton} type="button" className="icon-button" onClick={onClose} aria-label="Close image viewer">×</button>
        </div>
        <div className="lightbox-image-stage">
          <img
            src={assetUrl(frame.cropPath)}
            alt={`Positive bumble bee detection from Camera ${frame.cameraId} in ${frame.gridCell}`}
            width={frame.cropWidth}
            height={frame.cropHeight}
          />
        </div>
        <div className="lightbox-footer">
          <div>
            <strong>{frame.visitId}</strong>
            <span>Frame {frame.visitFrameIndex} of {frame.visitFrameCount} in visit</span>
          </div>
          <div className="lightbox-actions">
            <a href={assetUrl(frame.cropPath)} download>Download crop</a>
            {frames.length > 1 && (
              <>
                <button type="button" onClick={previous} aria-label="Previous image">←</button>
                <span>{index + 1} / {frames.length}</span>
                <button type="button" onClick={next} aria-label="Next image">→</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
