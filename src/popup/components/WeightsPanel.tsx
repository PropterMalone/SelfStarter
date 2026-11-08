// pattern: Imperative Shell
import type { ScoringWeights } from '../../utils/scoring'

interface WeightsPanelProps {
  weights: ScoringWeights
  onChange: (weights: ScoringWeights) => void
  disabled?: boolean
}
const WEIGHT_CONFIG: { key: keyof ScoringWeights; label: string }[] = [
  { key: 'likes', label: 'Likes' },
  { key: 'replies', label: 'Replies' },
  { key: 'reposts', label: 'Reposts' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'quotes', label: 'Quotes' },
]
export function WeightsPanel({ weights, onChange, disabled }: WeightsPanelProps) {
  return (
    <details className="weights-panel" open>
      <summary>Weights</summary>
      <div className="weights-content">
        {WEIGHT_CONFIG.map(({ key, label }) => (
          <div key={key} className="weight-control">
            <label htmlFor={`weight-${key}`}>{label}</label>
            <output htmlFor={`weight-${key}`}>×{weights[key]}</output>
            <input
              id={`weight-${key}`}
              type="range"
              min="0"
              max="10"
              value={weights[key]}
              onChange={(event) => onChange({ ...weights, [key]: Number(event.target.value) })}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </details>
  )
}
