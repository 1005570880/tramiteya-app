import crypto from 'node:crypto';

export function createGuestAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashGuestAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getGuestAccessToken(request: Request): string {
  const explicit = request.headers.get('x-tramiteya-access-token')?.trim() || request.headers.get('x-guest-access-token')?.trim();
  if (explicit) return explicit;
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const cookies = request.headers.get('cookie') || '';
  const cookie = cookies.split(';').map(v => v.trim()).find(v => v.startsWith('tramiteya_guest_access='));
  if (cookie) return decodeURIComponent(cookie.slice('tramiteya_guest_access='.length));
  try { return new URL(request.url).searchParams.get('access_token')?.trim() || ''; } catch { return ''; }
}
