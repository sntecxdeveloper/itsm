import React from 'react';

export interface TimeRange {
  label: string;
  value: string;
  hours: number;
}

export const TIME_RANGES: TimeRange[] = [
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', hours: 168 },
  { label: '30D', value: '30d', hours: 720 },
];

interface TimeRangeSelectorProps {
  selected: string;
  onChange: (range: TimeRange) => void;
  className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
  className = '',
}) => {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 bg-white p-0.5 ${className}`}>
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === range.value
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Calculate the start date based on a time range value.
 */
export function getStartDate(rangeValue: string): Date {
  const range = TIME_RANGES.find((r) => r.value === rangeValue);
  const hours = range?.hours ?? 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export default TimeRangeSelector;
