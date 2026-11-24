/** The dev fixture's stand-in for a signed-in user's saved and viewed jobs. */
export type DevAccountFixture = {
  savedIds: string[];
  viewedIds: string[];
  hideViewed: boolean;
  savedOnly: boolean;
};

export type SignInSession = {
  configured: boolean;
  email: string | null;
  userId?: string | null;
  /** Set only by the dev auth fixture; account hooks then use it instead of Supabase. */
  fixtureAccount?: DevAccountFixture;
};
