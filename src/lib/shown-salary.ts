import { getCurrencySymbol } from "@/lib/currency";
import { inferLocationCurrency } from "@/lib/job-trust";
import { hasUsLocationContext } from "@/lib/location-context";
import { foldTokens } from "@/lib/text";
import type { Job } from "@/types/job";

const placeholderSalaryLabel = /^(?:n\/?a|tbd|tba|todo|xxx|competitive|negotiable|doe|depends on experience|not disclosed|not listed|not shown|not available|unavailable|salary not listed|salary not shown|salary not disclosed|placeholder|to be determined|[-–—_.]+)$/i;

const periodSuffix = {
  hour: "/hr",
  month: "/mo",
  week: "/wk",
  day: "/day"
} as const;

type SalaryPeriod = "year" | keyof typeof periodSuffix;

export function hasShownSalary(job: Pick<Job, "location" | "salary">) {
  return formatShownSalary(job) !== undefined;
}

/** A disclosed amount, including a salary whose currency was only assumed. */
export function hasListedSalary(job: Pick<Job, "salary">) {
  const salary = job.salary;
  if (!salary) return false;
  return Math.max(salary.max ?? 0, salary.min ?? 0) > 0;
}

export function formatShownSalary(job: Pick<Job, "location" | "salary">) {
  const salary = job.salary;
  if (!salary || salary.currencySource === "default" || !salaryCurrencyMatchesLocation(job)) return undefined;

  const label = salary.label.trim();
  if (!label || placeholderSalaryLabel.test(label) || !/[1-9]/.test(label)) return undefined;

  const period = readSalaryPeriod(salary);
  const currency = salary.currency.trim().toUpperCase();
  if (!period || !/^[A-Z]{3}$/.test(currency)) return undefined;

  const symbol = getCurrencySymbol(currency);
  if (!symbol) return undefined;

  const low = positiveAmount(salary.min);
  const high = positiveAmount(salary.max);
  if (low === undefined && high === undefined) return undefined;

  const minimum = low ?? high!;
  const maximum = high ?? low!;
  const [start, end] = minimum <= maximum ? [minimum, maximum] : [maximum, minimum];
  const range = start === end
    ? `${symbol}${formatSalaryAmount(start)}`
    : `${symbol}${formatSalaryAmount(start)}\u2013${symbol}${formatSalaryAmount(end)}`;
  const suffix = period === "year" ? "" : periodSuffix[period];
  const code = currency === "USD" ? "" : ` ${currency}`;

  return `${range}${suffix}${code}`;
}

function salaryCurrencyMatchesLocation(job: Pick<Job, "location" | "salary">) {
  const currency = job.salary?.currency.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(currency)) return false;

  const expected = expectedSalaryCurrency(job.location);
  return expected === undefined || expected === currency;
}

function expectedSalaryCurrency(location: string) {
  const folded = foldTokens(location);
  if (!folded) return undefined;
  if (hasUsLocationContext(folded)) return "USD";
  return inferLocationCurrency(location);
}

function readSalaryPeriod(salary: NonNullable<Job["salary"]>): SalaryPeriod | undefined {
  const label = salary.label;
  if (/(?:\/|\bper\s+)h(?:ou)?r\b|\bhourly\b|\ban hour\b/i.test(label)) return "hour";
  if (/(?:\/|\bper\s+)mo(?:nth)?\b|\bmonthly\b/i.test(label)) return "month";
  if (/(?:\/|\bper\s+)w(?:ee)?k\b|\bweekly\b/i.test(label)) return "week";
  if (/(?:\/|\bper\s+)day\b|\bdaily\b/i.test(label)) return "day";
  if (/\b(?:per year|a year|annual(?:ly)?|yearly)\b|\/year\b|\/yr\b/i.test(label)) return "year";

  const amount = Math.max(salary.max ?? 0, salary.min ?? 0);
  if (amount >= 1000) return "year";
  return undefined;
}

function positiveAmount(value: number | undefined) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function formatSalaryAmount(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
