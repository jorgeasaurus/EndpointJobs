export function getCurrencySymbol(currency: string) {
  const code = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) return currency;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol"
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
}
