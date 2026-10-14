import { useState, useRef, useEffect } from "react";
import "./CustomDropdown.css";

function CustomDropdown({
  icon,
  label,
  value,
  options = [],
  onChange,
  className = "",
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Find active option label
  const activeOption = options.find((opt) => {
    const optVal = typeof opt === "object" ? opt.value : opt;
    return optVal === value;
  });

  const displayLabel = activeOption
    ? typeof activeOption === "object"
      ? activeOption.label
      : activeOption
    : label || value;

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`custom-dropdown-container ${className} ${isOpen ? "open" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="custom-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {icon && <span className="dropdown-leading-icon">{icon}</span>}
        <span className="dropdown-label-text">{displayLabel}</span>
        <span className={`dropdown-chevron-icon ${isOpen ? "rotate" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="custom-dropdown-menu">
          <div className="dropdown-options-list">
            {options.map((opt) => {
              const optVal = typeof opt === "object" ? opt.value : opt;
              const optLabel = typeof opt === "object" ? opt.label : opt;
              const isSelected = optVal === value;

              return (
                <button
                  key={String(optVal)}
                  type="button"
                  className={`dropdown-option-item ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelect(optVal)}
                >
                  <span className="option-text">{optLabel}</span>
                  {isSelected && <span className="option-check-icon">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
