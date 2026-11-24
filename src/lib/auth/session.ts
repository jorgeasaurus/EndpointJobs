/** The dev fixture's stand-in for a signed-in user's saved and viewed jobs. */
export type DevAccountFixture = {
  savedIds: string[];
  viewedIds: string[];
  hideViewed: boolean;
  savedOnly: boolean;
};

/** Who is signed in, and where their account data comes from. */
export type AccountSource =
  | { kind: "none" }
  | { kind: "fixture"; userId: string; email: string; fixture: DevAccountFixture }
  | { kind: "account"; userId: string; email: string };

export type SignInSession = {
  configured: boolean;
  account: AccountSource;
};

export const noAccount: AccountSource = { kind: "none" };

/** Sign-in buttons show only when auth is configured and nobody is signed in. */
export function canShowSignInOffer({ configured, account }: SignInSession) {
  return configured && account.kind === "none";
}
