const currencySymbols = new Map<string, string>();

export function getCurrencySymbol(currency: string) {
  const code = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) return currency;

  const cached = currencySymbols.get(code);
  if (cached) return cached;

  const symbol = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol"
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;

  currencySymbols.set(code, symbol);
  return symbol;
}
