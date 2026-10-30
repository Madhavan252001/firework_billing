import React, { useId, useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { loadCustomers } from '../utils/customerStore';

export default function CustomerAutocomplete({ field, value, onChange, onSelect, inputProps = {}, className = '' }) {
  const listboxId = useId();
  const [customers, setCustomers] = useState(() => loadCustomers());
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    return customers
      .filter(customer => !query || String(customer[field] || '').toLocaleLowerCase().includes(query))
      .slice(0, 6);
  }, [customers, field, value]);

  const showSuggestions = open && suggestions.length > 0;

  const openSuggestions = () => {
    setCustomers(loadCustomers());
    setOpen(true);
    setActiveIndex(-1);
  };

  const chooseCustomer = customer => {
    onSelect(customer);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = event => {
    if (!showSuggestions && event.key === 'ArrowDown') {
      openSuggestions();
      return;
    }
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      chooseCustomer(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`customer-autocomplete ${className}`}>
      <input
        {...inputProps}
        value={value}
        autoComplete="off"
        onFocus={openSuggestions}
        onChange={event => {
          onChange(event.target.value);
          setCustomers(loadCustomers());
          setOpen(true);
          setActiveIndex(-1);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
      />
      {showSuggestions && (
        <div id={listboxId} className="customer-suggestions" role="listbox">
          <div className="customer-suggestion-title"><Search size={12} /> Existing customers</div>
          {suggestions.map((customer, index) => (
            <button
              key={customer.mobile}
              type="button"
              className={`customer-suggestion ${activeIndex === index ? 'active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => chooseCustomer(customer)}
              role="option"
              aria-selected={activeIndex === index}
            >
              <span><UserRound size={14} /></span>
              <strong>{customer.name}</strong>
              <small>{customer.mobile}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
