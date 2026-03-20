'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  placeholder?: string;
  options?: DropdownOption[];
  className?: string;
  style?: React.CSSProperties;
}

export default function Dropdown({ placeholder = "Select...", options = [], className = "", style }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option: DropdownOption) => {
    setSelectedValue(option.value);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        buttonRef.current &&
        menuRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <>
      <div className={`relative ${className}`} ref={buttonRef} style={style}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
        >
          <span className={selectedValue ? "text-gray-900" : "text-[#9095A1]"}>
            {selectedValue ? options.find(opt => opt.value === selectedValue)?.label : placeholder}
          </span>
          <svg
            className={`w-5 h-5 text-[#9095A1] transition-transform shrink-0 ${isOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-9999 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            minWidth: '200px'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${selectedValue === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}







