import { useState, useEffect } from 'react';

/**
 * useDebounce Hook
 * 
 * Requirement:
 * "Search must not fire a request on every keystroke."
 * Delays updating the debounced value until after the specified delay has elapsed
 * since the last time the value was changed.
 */
export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
