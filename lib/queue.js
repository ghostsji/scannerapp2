// Scans that could not be sent yet. A dropped warehouse connection must not
// lose work: a scan that fails to send for lack of signal is kept here (on
// the phone, in AsyncStorage) and sent later, when the app comes back to
// the front, every 30 seconds while it is open, or when the user presses
// "Send now".
//
// Two kinds:
//   stock  a book-in / book-out            -> POST /api/stock-moves (JSON)
//   pick   a photo of picked stock         -> POST /api/scans (multipart)
// Every entry carries a clientRef; the server gives back the scan already
// saved when it sees one twice, so resending can never save a duplicate.
//
// An answer of 400, 403, 404, 409 or 413 will never succeed on a retry: the
// entry is marked failed with the server's message, for the user to discard.
// A 401 stops the run (sign in again; the queue is kept).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { api, getToken } from './api';

const KEY = 'tracklab_queue_v1';
const listeners = new Set();
let cache = null;
let running = false;

async function read() {
  if (cache) return cache;
  try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { cache = []; }
  return cache;
}
async function write(items) {
  cache = items;
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn(items));
}

export const getQueue = () => read();
export function subscribeQueue(fn) {
  listeners.add(fn);
  read().then(fn);
  return () => listeners.delete(fn);
}

/** Copies a picked photo into the app's own folder, so it is still there when the queue is sent. */
export async function keepFile(uri, name) {
  if (Platform.OS === 'web' || !uri || !FileSystem.documentDirectory) return uri;
  const dir = `${FileSystem.documentDirectory}queue/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const to = `${dir}${name}`;
  await FileSystem.copyAsync({ from: uri, to });
  return to;
}
const dropFiles = async (entry) => {
  if (Platform.OS === 'web') return;
  for (const uri of [entry.imageUri, entry.thumbUri]) {
    if (uri && FileSystem.documentDirectory && uri.startsWith(FileSystem.documentDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
};

export async function enqueue(entry) {
  const items = await read();
  await write([...items, { ...entry, queuedAt: new Date().toISOString(), failed: null }]);
}

export async function discard(clientRef) {
  const items = await read();
  const entry = items.find((e) => e.clientRef === clientRef);
  if (entry) await dropFiles(entry);
  await write(items.filter((e) => e.clientRef !== clientRef));
}

/** Sends one entry. Throws ApiError (network: true when there was no connection). */
export async function sendEntry(entry) {
  if (entry.kind === 'stock') return api('/api/stock-moves', { method: 'POST', body: { ...entry.payload, clientRef: entry.clientRef } });
  const form = new FormData();
  for (const [k, v] of Object.entries(entry.payload)) if (v !== null && v !== undefined && v !== '') form.append(k, String(v));
  form.append('clientRef', entry.clientRef);
  if (Platform.OS === 'web') {
    form.append('image', await (await fetch(entry.imageUri)).blob(), 'photo.jpg');
    if (entry.thumbUri) form.append('thumbnail', await (await fetch(entry.thumbUri)).blob(), 'thumb.jpg');
  } else {
    form.append('image', { uri: entry.imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    if (entry.thumbUri) form.append('thumbnail', { uri: entry.thumbUri, name: 'thumb.jpg', type: 'image/jpeg' });
  }
  return api('/api/scans', { method: 'POST', body: form });
}

/** Sends everything waiting, oldest first. Returns how many were sent. */
export async function flushQueue({ retryFailed = false } = {}) {
  if (running || !getToken()) return 0;
  running = true;
  let sent = 0;
  try {
    const snapshot = await read();
    for (const entry of snapshot) {
      if (entry.failed && !retryFailed) continue;
      try {
        await sendEntry(entry);
        sent += 1;
        await dropFiles(entry);
        await write((await read()).filter((e) => e.clientRef !== entry.clientRef));
      } catch (err) {
        if (err?.network || err?.status === 401) break; // no signal, or signed out: try again later
        if (err?.status >= 500) continue; // the server's trouble: leave it for the next run
        await write((await read()).map((e) => (e.clientRef === entry.clientRef ? { ...e, failed: err?.message || 'Could not be sent.' } : e)));
      }
    }
  } finally {
    running = false;
  }
  return sent;
}
