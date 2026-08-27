import crypto from 'node:crypto';

export function createGuestAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashGuestAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getGuestAccessToken(request: Request): string {
  const header = request.headers.get('x-tramiteya-access-token')?.trim();
  if (header) return header;
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const cookies = request.headers.get('cookie') || '';
  const cookie = cookies.split(';').map(v => v.trim()).find(v => v.startsWith('tramiteya_guest_access='));
  if (cookie) return decodeURIComponent(cookie.slice('tramiteya_guest_access='.length));
  try { return new URL(request.url).searchParams.get('access_token')?.trim() || ''; } catch { return ''; }
}
