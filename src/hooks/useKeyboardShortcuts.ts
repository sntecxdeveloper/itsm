import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(customShortcuts?: ShortcutMap) {
  const navigate = useNavigate();

  useEffect(() => {
    const defaultShortcuts: ShortcutMap = {
      // Navigation shortcuts
      'g d': () => navigate('/dashboard'),
      'g i': () => navigate('/issues'),
      'g v': () => navigate('/devices'),
      'g r': () => navigate('/remediation'),
      'g k': () => navigate('/knowledge'),
      'g t': () => navigate('/tickets'),
      'g s': () => navigate('/security'),

      // Search focus (single key)
      '/': () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },

      // Escape to close modals/search
      'Escape': () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput && document.activeElement === searchInput) {
          searchInput.blur();
        }
        // Close any open modals
        document.dispatchEvent(new CustomEvent('close-modals'));
      },
    };

    const shortcuts = { ...defaultShortcuts, ...customShortcuts };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape even in inputs
        if (e.key === 'Escape') {
          shortcuts['Escape']?.();
        }
        return;
      }

      const key = e.key.toLowerCase();
      shortcuts[key]?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, customShortcuts]);
}
