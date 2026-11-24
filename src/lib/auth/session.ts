/** The dev fixture's stand-in for a signed-in user's saved and viewed jobs. */
export type DevAccountFixture = {
  savedIds: string[];
  viewedIds: string[];
  hideViewed: boolean;
  savedOnly: boolean;
};

/** Where the signed-in user's account data comes from. */
export type AccountSource =
  | { kind: "none" }
  | { kind: "fixture"; userId: string; fixture: DevAccountFixture }
  | { kind: "account"; userId: string };

export type SignInSession = {
  configured: boolean;
  email: string | null;
  account: AccountSource;
};

export const noAccount: AccountSource = { kind: "none" };
