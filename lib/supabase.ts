/**
 * The friends' server (Supabase), spoken to with plain fetch: an anonymous account made on this device
 * (no email, no password), and the REST API behind row-level security. The key below is the project's
 * publishable key: it only opens what the database rules allow a member to see.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const URL = 'https://gsfirtbwijqrgxxihfdd.supabase.co';
const KEY = 'sb_publishable_R-_WG__Ym3h_GT96ZH1nng_pKotjSjy';
const SESSION_KEY = 'palais-mental/friends-session';
const PAGE = 1000;
/** A stalled connection gives up after this long rather than holding a refresh on its spinner. */
const TIMEOUT = 20_000;

interface Session {
  access: string;
  refresh: string;
  /** When the access token stops working (ms). */
  expiresAt: number;
  userId: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    /** The database's own message ("favorites_full"…), when it gave one. */
    public code: string,
  ) {
    super(`${status} ${code}`);
  }
}

function timed(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

let session: Session | null | undefined;
let refreshing: Promise<Session> | undefined;

async function load() {
  if (session !== undefined) return session;
  const raw = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
  session = raw ? (JSON.parse(raw) as Session) : null;
  return session;
}

/**
 * Written at once, not lazily: refresh tokens are single-use, and this account has no other way back in.
 */
async function save(next: Session | null) {
  session = next;
  if (next) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

async function auth(path: string, body: unknown): Promise<Session> {
  const r = await timed(`${URL}/auth/v1/${path}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json: TokenResponse & { error_code?: string; msg?: string } = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token || !json.refresh_token || !json.user?.id) throw new ApiError(r.status, json.error_code ?? json.msg ?? 'auth');
  const next = { access: json.access_token, refresh: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, userId: json.user.id };
  await save(next);
  return next;
}

function refresh(current: Session) {
  return (refreshing ??= auth('token?grant_type=refresh_token', { refresh_token: current.refresh })
    .catch(async (err) => {
      // The server no longer knows this session: nothing to keep. Offline or a hiccup: keep it for next time.
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403)) await save(null);
      throw err;
    })
    .finally(() => {
      refreshing = undefined;
    }));
}

/** This device's account id, once it has one. */
export async function currentUser() {
  return (await load())?.userId;
}

/** This device's account, made on first use. */
export async function signIn() {
  const current = await load();
  return (current ?? (await auth('signup', {}))).userId;
}

/** Drop this device's account (the server no longer has it): the next sign-in makes a new one. */
export const forgetSession = () => save(null);

async function token() {
  const current = await load();
  if (!current) throw new ApiError(401, 'signed_out');
  return (current.expiresAt - Date.now() < 60_000 ? await refresh(current) : current).access;
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  prefer?: string;
  range?: [number, number];
}

async function send(path: string, opts: Options, access: string) {
  return timed(`${URL}/rest/v1/${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${access}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
      ...(opts.range ? { 'Range-Unit': 'items', Range: `${opts.range[0]}-${opts.range[1]}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** One REST call as this device's account. Throws ApiError with the database's message. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let r = await send(path, opts, await token());
  if (r.status === 401 && session) r = await send(path, opts, (await refresh(session)).access);
  if (!r.ok) {
    const json: { message?: string; code?: string } = await r.json().catch(() => ({}));
    throw new ApiError(r.status, json.message ?? json.code ?? 'error');
  }
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const rpc = <T = unknown>(fn: string, args: Record<string, unknown> = {}) => api<T>(`rpc/${fn}`, { method: 'POST', body: args });

/** Every row of a query, page by page (the API hands out a thousand at a time). */
export async function all<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await api<T[]>(path, { range: [from, from + PAGE - 1] });
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
