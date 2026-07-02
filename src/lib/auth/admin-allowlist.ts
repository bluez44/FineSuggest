export function isAllowlistedAdmin(email: string, allowlist: string): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const entries = allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.includes(normalizedEmail);
}
