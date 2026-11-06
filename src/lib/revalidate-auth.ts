import { timingSafeEqual } from "node:crypto";

export function isRevalidateAuthorized(authorization: string | null, secret: string | undefined) {
  const expectedSecret = secret?.trim();
  if (!expectedSecret || !authorization) return false;

  const actual = Buffer.from(authorization.trim());
  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
