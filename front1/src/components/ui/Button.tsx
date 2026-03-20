'use client';

import { ReactNode } from 'react';

interface ButtonProps {
  text?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export default function Button({ text, onClick, className = "", children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors text-gray-700 ${className}`}
    >
      {children || text}
    </button>
  );
}







