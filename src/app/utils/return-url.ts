/**
 * The page to go back to after logging in or registering, from a
 * ?returnUrl= param. Only paths on this site are allowed, so the param
 * can't send anyone to another website.
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return null;
  if (url.startsWith('/login') || url.startsWith('/register')) return null;
  return url;
}
