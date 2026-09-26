/** Normalize an Indian mobile number to country-code + number, without "+" or spaces. */
export function normalizeMobileNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}
