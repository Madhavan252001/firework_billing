import React, { useEffect, useRef } from 'react';

export default function CategoryChips({ selected, onSelect, productCounts, cartCategories, categories = [] }) {
  const chipsRef = useRef(null);

  useEffect(() => {
    const activeChip = chipsRef.current?.querySelector(`[data-category-id="${selected}"]`);
    if (!activeChip) return undefined;

    const frame = window.requestAnimationFrame(() => {
      activeChip.focus({ preventScroll: true });
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      activeChip.classList.remove('chip-focus-pulse');
      void activeChip.offsetWidth;
      activeChip.classList.add('chip-focus-pulse');
    });
    const pulseTimer = window.setTimeout(() => activeChip.classList.remove('chip-focus-pulse'), 700);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pulseTimer);
    };
  }, [selected]);

  return (
    <div className="category-chips" ref={chipsRef}>
      {categories.map(cat => {
        const count = productCounts[cat.id] || 0;
        const isActive = selected === cat.id;
        const hasCartItems = cartCategories?.has(cat.id);
        return (
          <button
            key={cat.id}
            data-category-id={cat.id}
            className={`chip ${isActive ? 'active' : ''} ${hasCartItems ? 'has-cart-items' : ''}`}
            onClick={() => onSelect(cat.id)}
            aria-pressed={isActive}
          >
            <span>{cat.name}</span>
            {count > 0 && <span className="chip-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
