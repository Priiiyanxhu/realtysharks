import React from 'react';
import { formatToIndianMarket } from '@/utils/formatters';

interface DataInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  success?: boolean;
  formatType?: 'currency' | 'area';
}

export function DataInput({ error, success, formatType, className = '', ...props }: DataInputProps) {
  let stateClasses = "border-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50";
  
  if (error) {
    stateClasses = "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50";
  } else if (success) {
    stateClasses = "border-[#D4AF37] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50";
  }

  // Calculate formatted value if formatType is set and value exists
  let formattedValue = "";
  if (formatType && props.value) {
    const valStr = props.value.toString();
    const parsed = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) {
      const formatted = formatToIndianMarket(parsed, formatType === 'area' ? 'sq.ft' : undefined);
      if (formatted !== "Price on Request") {
        formattedValue = formatted;
      }
    }
  }

  return (
    <div className="relative w-full flex items-center">
      <input
        className={`w-full bg-[#1A202C] text-white rounded-full px-4 py-3 border transition-all duration-300 outline-none ${stateClasses} ${formatType && formattedValue ? 'pr-28' : ''} ${className}`}
        {...props}
      />
      {formatType && formattedValue && (
        <div className="absolute right-4 pointer-events-none text-[#D4AF37] font-mono font-medium text-sm bg-[#1A202C]/80 px-2 rounded backdrop-blur-sm">
          {formattedValue}
        </div>
      )}
    </div>
  );
}
