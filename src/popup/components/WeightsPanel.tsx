import type { ScoringWeights } from '../../utils/scoring'

interface WeightsPanelProps {
  weights: ScoringWeights
  onChange: (weights: ScoringWeights) => void
  disabled?: boolean
}

const WEIGHT_CONFIG: { key: keyof ScoringWeights; label: string; max: number }[] = [
  { key: 'likes', label: 'Likes', max: 10 },
  { key: 'replies', label: 'Replies', max: 10 },
  { key: 'reposts', label: 'Reposts', max: 10 },
  { key: 'mentions', label: 'Mentions', max: 10 },
  { key: 'quotes', label: 'Quotes', max: 10 },
]

export function WeightsPanel({ weights, onChange, disabled }: WeightsPanelProps) {
  const handleChange = (key: keyof ScoringWeights, value: number) => {
    onChange({ ...weights, [key]: value })
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">Scoring Weights</div>
      {WEIGHT_CONFIG.map(({ key, label, max }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{label}</span>
            <span className="font-mono">{weights[key]}</span>
          </div>
          <input
            type="range"
            min="0"
            max={max}
            value={weights[key]}
            onChange={(e) => handleChange(key, parseInt(e.target.value, 10))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
          />
        </div>
      ))}
    </div>
  )
}
