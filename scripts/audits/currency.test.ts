import assert from "node:assert/strict";
import test from "node:test";
import { getCurrencySymbol } from "../../src/lib/currency";

test("salary currency symbols preserve country qualifiers", () => {
  for (const [currency, symbol] of [
    ["USD", "$"], ["EUR", "€"], ["GBP", "£"],
    ["CAD", "CA$"], ["AUD", "A$"], ["JPY", "¥"]
  ]) {
    assert.equal(getCurrencySymbol(currency), symbol);
    assert.equal(getCurrencySymbol(currency), symbol);
  }
});

test("currency codes normalize and unsupported input remains readable", () => {
  assert.equal(getCurrencySymbol(" eur "), "€");
  assert.equal(getCurrencySymbol("ZZZ"), "ZZZ");
  assert.equal(getCurrencySymbol("unknown"), "unknown");
  assert.equal(getCurrencySymbol(""), "");
});

test("repeated normalized currencies reuse the cached symbol", (t) => {
  const formatter = t.mock.method(Intl, "NumberFormat");
  getCurrencySymbol("CHF");
  getCurrencySymbol(" chf ");
  getCurrencySymbol("CHF");
  assert.equal(formatter.mock.callCount(), 1);
});
