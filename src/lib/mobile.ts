// Mobile numbers are stored as 10 digits, for example 9876543210.

/**
 * "98765 43210", "+91 98765-43210" or "09876543210" -> "9876543210".
 * null when the text is not an Indian mobile number (10 digits, starting with 6, 7, 8 or 9).
 */
export function normalizeMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const MOBILE_ERROR = "Enter a valid 10-digit mobile number";
