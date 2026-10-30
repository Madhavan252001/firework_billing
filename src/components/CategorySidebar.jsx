import React from 'react';
import { Search, X } from 'lucide-react';

export default function CategorySidebar({ selected, onSelect, productCounts, searchQuery, onSearchChange, cartCategories, categories = [] }) {
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredCategories = categories.filter(category =>
    category.name.toLocaleLowerCase().includes(normalizedSearch)
  );

  return (
    <aside className="category-sidebar">
      <div className="category-header">
        <h2>Categories</h2>
      </div>
      <div className="category-search-wrap">
        <div className="category-search-box">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search categories"
            aria-label="Search categories"
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} aria-label="Clear category search"><X size={14} /></button>
          )}
        </div>
      </div>
      <nav className="category-list">
        {filteredCategories.map(cat => {
          const count = productCounts[cat.id] || 0;
          const isActive = selected === cat.id;
          const hasCartItems = cartCategories?.has(cat.id);
          return (
            <button
              key={cat.id}
              className={`category-item ${isActive ? 'active' : ''} ${hasCartItems ? 'has-cart-items' : ''}`}
              onClick={() => onSelect(cat.id)}
              aria-pressed={isActive}
            >
              <span className="category-name">{cat.name}</span>
              <span className="category-count">{count}</span>
            </button>
          );
        })}
        {filteredCategories.length === 0 && <p className="category-search-empty">No categories found</p>}
      </nav>
    </aside>
  );
}
