const COOKIE_NAME = 'star_visitor';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

function tokenFrom(request: Request): string | null {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE_NAME + '='));
  const token = cookie?.slice(COOKIE_NAME.length + 1);
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

async function visitorId(token: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return 'browser:' + Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function browserVisitor(request: Request): Promise<string | null> {
  const token = tokenFrom(request);
  return token ? visitorId(token) : null;
}

export async function existingVisitor(request: Request): Promise<string | null> {
  const account = await currentAccount(request);
  return account ? 'account:' + account.id : browserVisitor(request);
}

export async function visitorForList(request: Request): Promise<{id: string; cookie?: string}> {
  const account = await currentAccount(request);
  if (account) return {id: 'account:' + account.id};
  const existing = tokenFrom(request);
  if (existing) return {id: await visitorId(existing)};
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    id: await visitorId(token),
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
  };
}
import {currentAccount} from '@/lib/account';
