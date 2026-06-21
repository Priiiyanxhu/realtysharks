/**
 * Utility functions for formatting data to the Indian Real Estate Market context.
 */

export function formatToIndianMarket(
  value: number | string | null | undefined,
  unit?: 'sq.ft' | 'sq.yd',
  isDate?: boolean
): string {
  // Check for null, undefined, or invalid number
  if (value === null || value === undefined) {
    return "Price on Request";
  }

  // Handle Date Formatting
  if (isDate) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return "Price on Request";
    }
    
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  }

  // Parse to number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Error Handling: if not a valid number
  if (isNaN(numValue)) {
    return "Price on Request";
  }

  // Area Formatting
  if (unit) {
    // Format with commas in Indian style for area
    const formattedArea = new Intl.NumberFormat('en-IN').format(numValue);
    return `${formattedArea} ${unit}`;
  }

  // Currency Formatting (Indian Numbering System)
  if (numValue >= 10000000) {
    // Crore (1,00,00,000)
    const crValue = numValue / 10000000;
    // Format to 2 decimal places if needed, but remove trailing zeros
    return `${crValue.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  } else if (numValue >= 100000) {
    // Lakh (1,00,000)
    const lakhValue = numValue / 100000;
    return `${lakhValue.toFixed(2).replace(/\.?0+$/, '')} Lakh`;
  } else if (numValue >= 1000) {
    // Thousands
    const kValue = numValue / 1000;
    return `${kValue.toFixed(2).replace(/\.?0+$/, '')} K`;
  } else {
    return new Intl.NumberFormat('en-IN').format(numValue);
  }
}
