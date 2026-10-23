import { useState, useCallback } from 'react';

export function useMultiSelect<T extends { id: string | number }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const toggle = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((id: string | number) => {
    setSelectedIds((prev) => new Set(prev).add(id));
  }, []);

  const deselect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string | number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const selectedItems = useCallback(
    (items: T[]) => {
      return items.filter((item) => selectedIds.has(item.id));
    },
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    select,
    deselect,
    selectAll,
    deselectAll,
    isSelected,
    selectedItems,
    hasSelection: selectedIds.size > 0,
  };
}
