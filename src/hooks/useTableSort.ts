import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc' | null;

interface UseTableSortOptions<T> {
  data: T[];
  defaultSortKey?: keyof T;
  defaultDirection?: SortDirection;
}

export function useTableSort<T extends Record<string, any>>({
  data,
  defaultSortKey,
  defaultDirection = 'asc',
}: UseTableSortOptions<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((prev) => {
        if (prev === 'asc') return 'desc';
        if (prev === 'desc') return null;
        return 'asc';
      });
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal - bVal;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [data, sortKey, sortDirection]);

  return {
    sortedData,
    sortKey,
    sortDirection,
    toggleSort,
  };
}
