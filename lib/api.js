// Every call to Tracklab IM goes through here. The contract is
// SCANNER_APP_API.md in the Tracklab repo.
//
// The token from POST /api/mobile/login is kept in the phone's secure
// store (the keychain / keystore), never in AsyncStorage. On the web build
// there is no secure store, so it falls back to the browser's localStorage.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'tracklab_token';
const USER_KEY = 'tracklab_user';
const onWeb = Platform.OS === 'web';

const store = {
  async get(key) {
    try { return onWeb ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async set(key, value) {
    try { if (onWeb) globalThis.localStorage?.setItem(key, value); else await SecureStore.setItemAsync(key, value); } catch { /* signed in until the app closes */ }
  },
  async remove(key) {
    try { if (onWeb) globalThis.localStorage?.removeItem(key); else await SecureStore.deleteItemAsync(key); } catch { /* nothing kept */ }
  },
};

let token = null;
let onSignedOut = () => {};

/** Called when any request answers 401: the token is dead, show the sign-in screen. */
export const setSignedOutHandler = (fn) => { onSignedOut = fn; };
export const getToken = () => token;
export const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});
export const imageSource = (path) => ({ uri: API_URL + path, headers: authHeaders() });

export async function loadSession() {
  token = await store.get(TOKEN_KEY);
  let user = null;
  try { user = JSON.parse((await store.get(USER_KEY)) || 'null'); } catch { user = null; }
  return token && user ? { token, user } : null;
}

export async function saveSession(newToken, user) {
  token = newToken;
  await store.set(TOKEN_KEY, newToken);
  await store.set(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  token = null;
  await store.remove(TOKEN_KEY);
  await store.remove(USER_KEY);
}

/** An error from the server (status set), or a failed connection (network: true). */
export class ApiError extends Error {
  constructor(message, { status = 0, network = false } = {}) {
    super(message);
    this.status = status;
    this.network = network;
  }
}

/**
 * path: "/api/…". body: a plain object (sent as JSON) or a FormData (sent
 * as multipart; the Content-Type is left for fetch to set, with its boundary).
 */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { ...authHeaders() };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  } catch {
    throw new ApiError('No connection. Check the signal and try again.', { network: true });
  }
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && path !== '/api/mobile/login') {
    await clearSession();
    onSignedOut();
    throw new ApiError('Please sign in again.', { status: 401 });
  }
  if (!res.ok) throw new ApiError(data?.error || `Something went wrong (${res.status}).`, { status: res.status });
  return data;
}

/** One id per scan, sent with it, so a retry is never saved twice. */
export const newClientRef = () => `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
