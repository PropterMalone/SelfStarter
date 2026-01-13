import { useState } from 'react'
import type { TimePeriod } from '../../types'

interface HandleInputProps {
  onAnalyze: (handle: string, period: TimePeriod) => void
  isLoading: boolean
  handle: string // Required - must be logged in
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
]

export function HandleInput({ onAnalyze, isLoading, handle }: HandleInputProps) {
  const [period, setPeriod] = useState<TimePeriod>('30d')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (handle) {
      onAnalyze(handle, period)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Analyzing interactions for
        </label>
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
          @{handle}
        </div>
      </div>
      <div>
        <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
          Time Period
        </label>
        <select
          id="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as TimePeriod)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          {TIME_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Analyzing...' : 'Analyze My Interactions'}
      </button>
    </form>
  )
}
