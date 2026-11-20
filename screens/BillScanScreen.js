import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, RefreshControl, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Button from '../components/Button';
import Input from '../components/Input';
import { api, newClientRef } from '../lib/api';
import { theme } from '../constants/theme';

// Scan a bill: photograph a supplier's invoice page by page and send it to
// Tracklab, where it waits under Purchases > Bills > From the scanner and is
// read for its supplier, VAT number, invoice number, dates and lines. Nothing
// becomes a bill until someone creates it on the website. Needs signal: the
// pages are sent at once (up to 8, each made small first).

const MAX_PAGES = 8;

/** A page, made small enough to send (longest side 1800 px, JPEG), as a data URL. */
async function shrinkPage(asset) {
  const wide = (asset.width || 0) >= (asset.height || 0);
  const big = Math.max(asset.width || 0, asset.height || 0) > 1800;
  const r = await ImageManipulator.manipulateAsync(asset.uri, big ? [{ resize: wide ? { width: 1800 } : { height: 1800 } }] : [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return { uri: r.uri, dataUrl: `data:image/jpeg;base64,${r.base64}` };
}

const when = (v) => {
  const d = new Date(v || '');
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const STATUS = {
  INBOX: { text: 'Waiting on the website', color: theme.colors.primary },
  USED: { text: 'Bill made', color: theme.colors.success },
  DISCARDED: { text: 'Discarded', color: theme.colors.danger },
};

export default function BillScanScreen({ navigation }) {
  const [pages, setPages] = useState([]); // [{ uri, dataUrl }]
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mine, setMine] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const clientRef = useRef(newClientRef());

  const loadMine = useCallback(async () => {
    try { const r = await api('/api/bill-scans?status=ALL&mine=1'); setMine((r.items || []).slice(0, 20)); } catch { /* no signal: keep what is shown */ }
  }, []);
  useEffect(() => {
    loadMine();
    const t = setInterval(() => { if (AppState.currentState === 'active') loadMine(); }, 10000);
    return () => clearInterval(t);
  }, [loadMine]);

  const add = async (fromLibrary) => {
    setError(null); setNotice(null);
    if (pages.length >= MAX_PAGES) { setError(`A bill can have up to ${MAX_PAGES} pages.`); return; }
    const perm = fromLibrary ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError(fromLibrary ? 'Allow Tracklab Scan to see your photos in the phone\'s settings.' : 'Allow Tracklab Scan to use the camera in the phone\'s settings.'); return; }
    const opts = { mediaTypes: ['images'], quality: 1, exif: false, ...(fromLibrary ? { allowsMultipleSelection: true, selectionLimit: MAX_PAGES - pages.length } : {}) };
    const res = fromLibrary ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const next = [];
      for (const a of res.assets.slice(0, MAX_PAGES - pages.length)) next.push(await shrinkPage(a));
      setPages((p) => [...p, ...next]);
    } catch { setError('Could not read that photo. Try again.'); } finally { setBusy(false); }
  };

  const send = async () => {
    if (!pages.length) return;
    setBusy(true); setError(null);
    try {
      await api('/api/bill-scans', { method: 'POST', body: { pages: pages.map((p) => p.dataUrl), note: note.trim(), clientRef: clientRef.current, capturedAt: new Date().toISOString() } });
      setNotice(`Sent (${pages.length} page${pages.length === 1 ? '' : 's'}). It's being read, and waits under Purchases > Bills on the website.`);
      setPages([]); setNote(''); clientRef.current = newClientRef();
      loadMine();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const refresh = async () => { setRefreshing(true); await loadMine(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headBtn} accessibilityLabel="Back"><Text style={styles.headBtnText}>‹ Back</Text></TouchableOpacity>
            <View style={styles.flex}>
              <Text style={styles.h1}>Scan a bill</Text>
              <Text style={styles.small}>Photograph each page of the supplier's invoice</Text>
            </View>
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          {pages.length ? (
            <>
              <Text style={styles.label}>PAGES ({pages.length})</Text>
              <View style={styles.grid}>
                {pages.map((p, i) => (
                  <View key={p.uri} style={styles.page}>
                    <Image source={{ uri: p.uri }} style={styles.pageImg} />
                    <Text style={styles.pageNo}>{i + 1}</Text>
                    <TouchableOpacity style={styles.pageDel} onPress={() => setPages((ps) => ps.filter((_, j) => j !== i))} accessibilityLabel={`Remove page ${i + 1}`}><Text style={styles.pageDelText}>✕</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Button title={pages.length ? '📷  Photograph the next page' : '📷  Photograph the bill'} onPress={() => add(false)} loading={busy} disabled={pages.length >= MAX_PAGES} />
          <Button title="Choose photos already taken" variant="outline" onPress={() => add(true)} disabled={busy || pages.length >= MAX_PAGES} />
          <Text style={[styles.small, styles.center, styles.gapBottom]}>Flat, well lit, the whole page in view.</Text>

          {pages.length ? (
            <>
              <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. delivery for PO-2026-0031" />
              <Button title={`Send ${pages.length} page${pages.length === 1 ? '' : 's'}`} onPress={send} loading={busy} />
              <Text style={[styles.small, styles.center]}>The pages are read on the website and wait there; a bill is only made when someone creates it.</Text>
            </>
          ) : null}

          <Text style={styles.h2}>Bills I've sent</Text>
          {!mine.length ? <Text style={styles.small}>None yet.</Text> : null}
          {mine.map((m) => {
            const s = STATUS[m.status] || STATUS.INBOX;
            const o = m.ocr;
            return (
              <View key={m.id} style={styles.row}>
                {m.thumb ? <Image source={{ uri: m.thumb }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={styles.flex}>
                  <Text style={styles.bold} numberOfLines={1}>{o?.supplier || (m.read?.status === 'WAITING' ? 'Reading…' : 'Bill')}{o?.invoiceNumber ? <Text style={styles.small}>  {o.invoiceNumber}</Text> : null}</Text>
                  <Text style={styles.small} numberOfLines={1}>{[o?.total != null ? `${o.currency || 'ZAR'} ${Number(o.total).toFixed(2)}` : null, `${m.pageCount} page${m.pageCount === 1 ? '' : 's'}`, when(m.capturedAt || m.createdAt), m.note].filter(Boolean).join(' · ')}</Text>
                  <Text style={[styles.chip, { color: s.color, borderColor: s.color }]}>{m.status === 'USED' && m.billNumber ? `Bill ${m.billNumber}` : s.text}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  body: { padding: theme.spacing.medium, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.spacing.medium },
  h1: { color: theme.colors.text, fontSize: theme.fontSize.large, fontWeight: '900' },
  h2: { color: theme.colors.text, fontSize: theme.fontSize.medium, fontWeight: '900', marginTop: theme.spacing.large, marginBottom: theme.spacing.small },
  headBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  headBtnText: { color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 13 },
  notice: { color: theme.colors.success, backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  error: { color: theme.colors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  label: { color: theme.colors.textSecondary, fontSize: theme.fontSize.small, fontWeight: 'bold', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.medium },
  page: { width: '31%', aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  pageImg: { width: '100%', height: '100%' },
  pageNo: { position: 'absolute', left: 4, top: 4, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 6, fontWeight: 'bold', fontSize: 12, overflow: 'hidden' },
  pageDel: { position: 'absolute', right: 4, top: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pageDelText: { color: theme.colors.danger, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 10, marginBottom: 8 },
  thumb: { width: 44, height: 56, borderRadius: 8, backgroundColor: theme.colors.cardHigh },
  bold: { color: theme.colors.text, fontWeight: 'bold' },
  small: { color: theme.colors.textSecondary, fontSize: 12 },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: 'bold', marginTop: 6, overflow: 'hidden' },
  center: { textAlign: 'center' },
  gapBottom: { marginBottom: theme.spacing.medium },
});
