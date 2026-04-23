export type AuthSessionLike = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

export function normalizeUserId(
  userId: string | null | undefined,
  fallback = "anonymous",
) {
  return userId?.trim() || fallback;
}

export function resolveSessionUserId(session: AuthSessionLike) {
  return normalizeUserId(
    session?.user?.email ?? session?.user?.name,
    "unknown-user",
  );
}
