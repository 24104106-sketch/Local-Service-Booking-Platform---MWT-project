import { forwardRef, useRef, useImperativeHandle } from "react";

/**
 * Reusable search box. Wraps forwardRef + useImperativeHandle so a parent
 * holding a ref to this component can call inputRef.current.focus() or
 * .clear() without needing to know this is a plain <input> underneath —
 * the DOM node itself is never exposed, only the two actions that make
 * sense to call from outside.
 *
 * Usage:
 *   const searchRef = useRef(null);
 *   <SearchInput ref={searchRef} value={query} onChange={setQuery} placeholder="Search..." />
 *   searchRef.current.focus();
 */
const SearchInput = forwardRef(function SearchInput({ value, onChange, placeholder, disabled, style }, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => onChange(""),
  }));

  return (
    <input
      ref={inputRef}
      className="search-box"
      style={style}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
});

export default SearchInput;
