export function formatCurrency(amount: number, currency: string, locale = 'ko-KR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}
