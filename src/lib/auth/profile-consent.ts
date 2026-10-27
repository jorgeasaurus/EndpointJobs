const UNIQUE_VIOLATION = "23505";

export type ProfileConsent = {
  id: string;
  email: string;
  privacyVersion: string;
};

/**
 * First sign-in inserts the accepted privacy version. A later sign-in may
 * refresh the email, and it must not record a newer policy version the user
 * has not accepted.
 */
export async function saveProfileOnSignIn(input: {
  profile: ProfileConsent;
  insertProfile: (profile: ProfileConsent) => Promise<{ error: { code?: string } | null }>;
  updateEmail: (id: string, email: string) => Promise<{ error: unknown }>;
}): Promise<{ error: unknown }> {
  const inserted = await input.insertProfile(input.profile);
  if (!inserted.error) return { error: null };
  if (inserted.error.code !== UNIQUE_VIOLATION) return { error: inserted.error };
  return input.updateEmail(input.profile.id, input.profile.email);
}
