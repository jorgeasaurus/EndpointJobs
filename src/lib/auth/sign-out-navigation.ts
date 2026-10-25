export const SIGN_OUT_PATH = "/auth/sign-out";

export function signOutRedirectUrl(requestUrl: string): URL {
  return new URL("/", new URL(requestUrl).origin);
}
