import type { PositiveMetric } from '../types'

interface MetricToggleProps {
  value: PositiveMetric
  onChange: (metric: PositiveMetric) => void
}

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="segmented-control" aria-label="Count metric">
      {(['frames', 'visits'] as const).map((metric) => (
        <button
          key={metric}
          type="button"
          className={value === metric ? 'is-active' : ''}
          aria-pressed={value === metric}
          onClick={() => onChange(metric)}
        >
          {metric === 'frames' ? 'Positive frames' : 'Unique visits'}
        </button>
      ))}
    </div>
  )
}
