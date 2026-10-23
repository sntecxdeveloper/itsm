import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Renders a long list in chunks: the first `step` items straight away, then
 * the next chunk each time the sentinel element scrolls into view. Keeps
 * pages with thousands of rows (services, events, KB articles…) fast to open
 * and scroll, without changing how the list itself is built.
 *
 *   const { visible, sentinelRef, hasMore, total } = useProgressiveList(rows);
 *   {visible.map(...)}
 *   {hasMore && <div ref={sentinelRef} />}
 *
 * The count resets when `resetKey` changes (e.g. a new search or filter), so
 * a narrowed list starts from the top again.
 */
export function useProgressiveList<T>(items: readonly T[], step = 50, resetKey?: unknown) {
  const [count, setCount] = useState(step);
  const [lastKey, setLastKey] = useState(resetKey);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset during render (not in an effect) when the filter/search changes.
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setCount(step);
  }

  const hasMore = count < items.length;

  const sentinelRef = useCallback(
    (node: Element | null) => {
      observerRef.current?.disconnect();
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
        },
        { rootMargin: '400px' },
      );
      observerRef.current.observe(node);
    },
    [hasMore, step],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    visible: hasMore ? items.slice(0, count) : items,
    hasMore,
    total: items.length,
    sentinelRef,
    showAll: () => setCount(items.length),
  };
}
