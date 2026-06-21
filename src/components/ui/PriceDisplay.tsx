import React from 'react';

// Format the amount to Indian Currency formatting (e.g., ₹ 1,50,000)
export const formatIndianCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

interface PriceDisplayProps {
  amount: number;
  className?: string;
}

export function PriceDisplay({ amount, className = '' }: PriceDisplayProps) {
  return (
    <span className={`font-mono text-[#D4AF37] font-bold tracking-tight ${className}`}>
      {formatIndianCurrency(amount)}
    </span>
  );
}
