import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Button from '../components/Button';
import Input from '../components/Input';
import QueueBar from '../components/QueueBar';
import { api, imageSource, newClientRef } from '../lib/api';
import { enqueue, keepFile, sendEntry } from '../lib/queue';
import { useAuth } from '../lib/auth';
import { theme } from '../constants/theme';

// A photo of picked stock against a pick note. The pick note is a sales
// order (SO-…) or delivery / collection note (DN-… / CN-…) number; Tracklab
// links the photo to it and it shows on the website under Sales > Scanner >
// Pick scans and on that order. Photos are made small before sending
// (longest side 1600 px, JPEG): a few hundred KB on a warehouse connection.

const EMPTY = { pickNote: '', description: '', quantity: '', clientName: '', clientCode: '' };

async function shrink(asset) {
  const wide = (asset.width || 0) >= (asset.height || 0);
  const big = Math.max(asset.width || 0, asset.height || 0) > 1600;
  const photo = await ImageManipulator.manipulateAsync(asset.uri, big ? [{ resize: wide ? { width: 1600 } : { height: 1600 } }] : [], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const thumb = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 320 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return { imageUri: photo.uri, thumbUri: thumb.uri };
}

export default function PickScreen({ navigation }) {
  const { user } = useAuth();
  const [photo, setPhoto] = useState(null); // { imageUri, thumbUri, takenAt }
  const [form, setForm] = useState(EMPTY);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [recent, setRecent] = useState([]);
  const clientRef = useRef(newClientRef());
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const loadRecent = useCallback(async () => {
    if (!user?.email) return;
    try { const r = await api(`/api/scans?user=${encodeURIComponent(user.email)}&pageSize=10`); setRecent(r.items || []); } catch { /* no signal */ }
  }, [user?.email]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  // Say which order the pick note is, while it is typed. A hint, never a gate.
  useEffect(() => {
    const note = form.pickNote.trim();
    if (note.length < 4) { setMatch(null); return undefined; }
    const t = setTimeout(async () => {
      try { setMatch(await api(`/api/scans/lookup?pickNote=${encodeURIComponent(note)}`)); } catch { setMatch(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [form.pickNote]);

  const take = async (fromLibrary) => {
    setError(null); setNotice(null);
    const perm = fromLibrary ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError(fromLibrary ? 'Allow Tracklab Scan to see your photos in the phone\'s settings.' : 'Allow Tracklab Scan to use the camera in the phone\'s settings.'); return; }
    const opts = { mediaTypes: ['images'], quality: 1, exif: false };
    const res = fromLibrary ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try { setPhoto({ ...(await shrink(res.assets[0])), takenAt: new Date().toISOString() }); } catch { setError('Could not read that photo. Try another.'); } finally { setBusy(false); }
  };

  const send = async () => {
    if (!photo) { setError('Take a photo first.'); return; }
    if (!form.pickNote.trim() || !form.description.trim()) { setError('Enter the pick note and what was picked.'); return; }
    if (!(Number(String(form.quantity).replace(',', '.')) > 0)) { setError('Enter a quantity above 0.'); return; }
    const payload = {
      pickNote: form.pickNote.trim(), description: form.description.trim(), quantity: String(form.quantity).replace(',', '.'),
      clientName: form.clientName.trim(), clientCode: form.clientCode.trim(), capturedAt: photo.takenAt,
    };
    const entry = { kind: 'pick', clientRef: clientRef.current, payload, imageUri: photo.imageUri, thumbUri: photo.thumbUri };
    setBusy(true); setError(null);
    try {
      const saved = await sendEntry(entry);
      setNotice(`Saved against ${saved.pickNote || payload.pickNote}.`);
      setPhoto(null); setForm((f) => ({ ...EMPTY, pickNote: f.pickNote, clientName: f.clientName, clientCode: f.clientCode }));
      clientRef.current = newClientRef();
      loadRecent();
    } catch (err) {
      if (err?.network) {
        // Keep the photo in the app's own folder so it is still there when the queue is sent.
        const imageUri = await keepFile(photo.imageUri, `${clientRef.current}.jpg`);
        const thumbUri = await keepFile(photo.thumbUri, `${clientRef.current}-t.jpg`);
        await enqueue({ ...entry, imageUri, thumbUri });
        setNotice('No signal. The photo is kept on the phone and sent when there is.');
        setPhoto(null); setForm((f) => ({ ...EMPTY, pickNote: f.pickNote, clientName: f.clientName, clientCode: f.clientCode }));
        clientRef.current = newClientRef();
      } else if (err?.status !== 401) setError(err?.message || 'Could not send it.');
    } finally { setBusy(false); }
  };

  const matchText = !match ? null : match.matched
    ? [match.clientOrder ? `Sales order ${match.clientOrder.number}` : null, match.dispatchNote ? `${match.dispatchNote.type === 'COLLECTION' ? 'Collection' : 'Delivery'} note ${match.dispatchNote.number}` : null, match.client?.name].filter(Boolean).join(' · ')
    : 'Not a Tracklab number. It will be saved as typed.';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headBtn}><Text style={styles.headBtnText}>‹ Book in / out</Text></TouchableOpacity>
            <Text style={styles.h1}>Pick photo</Text>
          </View>

          <QueueBar />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          <View style={styles.card}>
            {photo ? (
              <TouchableOpacity onPress={() => take(false)} accessibilityLabel="Take the photo again">
                <Image source={{ uri: photo.imageUri }} style={styles.photo} resizeMode="cover" />
                <Text style={[styles.small, styles.center]}>Tap the photo to take it again</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <View style={styles.flex}><Button title="Take photo" onPress={() => take(false)} loading={busy && !photo} /></View>
                <View style={styles.flex}><Button title="Choose photo" variant="secondary" onPress={() => take(true)} disabled={busy} /></View>
              </View>
            )}

            <Input label="Pick note" value={form.pickNote} onChangeText={set('pickNote')} placeholder="SO-2026-0004 or DN-…" autoCapitalize="characters" autoCorrect={false} />
            {matchText ? <Text style={[styles.hint, match?.matched ? styles.ok : null]}>{matchText}</Text> : null}
            <Input label="What was picked" value={form.description} onChangeText={set('description')} placeholder="Item description or stock code" />
            <Input label="Quantity" value={form.quantity} onChangeText={(v) => set('quantity')(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" />
            {!match?.client ? (
              <View style={styles.row}>
                <View style={styles.flex}><Input label="Client (optional)" value={form.clientName} onChangeText={set('clientName')} /></View>
                <View style={styles.flex}><Input label="Client code (optional)" value={form.clientCode} onChangeText={set('clientCode')} autoCapitalize="characters" /></View>
              </View>
            ) : null}
            <Button title="Save pick photo" onPress={send} loading={busy && !!photo} disabled={!photo} />
          </View>

          <Text style={styles.h2}>My pick photos</Text>
          {recent.length === 0 ? <Text style={styles.small}>None yet.</Text> : null}
          {recent.map((s) => (
            <View key={s.id} style={styles.scan}>
              <Image source={imageSource(s.thumbUrl)} style={styles.thumb} />
              <View style={styles.flex}>
                <Text style={styles.code}>{s.pickNote}</Text>
                <Text style={styles.text} numberOfLines={1}>{s.quantity} × {s.description}</Text>
                <Text style={styles.small} numberOfLines={1}>{[s.client?.name || s.clientName, new Date(s.capturedAt || s.createdAt).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  body: { padding: theme.spacing.medium, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.medium },
  h1: { color: theme.colors.text, fontSize: theme.fontSize.large, fontWeight: '900' },
  h2: { color: theme.colors.text, fontSize: theme.fontSize.medium, fontWeight: '900', marginTop: theme.spacing.large, marginBottom: theme.spacing.small },
  headBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  headBtnText: { color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 12 },
  notice: { color: theme.colors.success, backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  error: { color: theme.colors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  card: { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.large, padding: theme.spacing.medium },
  row: { flexDirection: 'row', gap: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.borderRadius.medium, backgroundColor: '#000', marginBottom: 4 },
  hint: { color: theme.colors.textSecondary, fontSize: 12, marginTop: -8, marginBottom: theme.spacing.medium },
  ok: { color: theme.colors.success },
  code: { color: theme.colors.primary, fontWeight: 'bold', fontFamily: 'monospace' },
  text: { color: theme.colors.text },
  small: { color: theme.colors.textSecondary, fontSize: 12 },
  center: { textAlign: 'center', marginBottom: theme.spacing.medium },
  scan: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 10, marginBottom: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#000' },
});
