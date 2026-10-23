import { useState, useCallback } from 'react';

interface UseDragDropOptions<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  getItemId: (item: T) => string | number;
}

export function useDragDrop<T>({ items, onReorder, getItemId }: UseDragDropOptions<T>) {
  const [draggedId, setDraggedId] = useState<string | number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | number | null>(null);

  const onDragStart = useCallback((id: string | number) => {
    setDraggedId(id);
  }, []);

  const onDragOver = useCallback((id: string | number) => {
    if (draggedId !== null && draggedId !== id) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const onDragEnd = useCallback(() => {
    if (draggedId !== null && dragOverId !== null && draggedId !== dragOverId) {
      const fromIndex = items.findIndex((item) => getItemId(item) === draggedId);
      const toIndex = items.findIndex((item) => getItemId(item) === dragOverId);

      if (fromIndex !== -1 && toIndex !== -1) {
        const newItems = [...items];
        const [movedItem] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, movedItem);
        onReorder(newItems);
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, items, onReorder, getItemId]);

  const onDrop = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  return {
    draggedId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
  };
}
