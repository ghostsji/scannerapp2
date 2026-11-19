import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl, AppState, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import CodeScanner from '../components/CodeScanner';
import { api } from '../lib/api';
import { matchLine, placeFor, lineNotes, sameCode } from '../lib/bomPick';
import { theme } from '../constants/theme';

// Scan BOM items: the phone's half of "Book Out Entire BOM" on the Tracklab
// website. The desktop starts a BOM pick; here the person picking sees every
// open one, opens it, and scans each item where the list says it is kept. A
// line goes green (on the desktop too) once what was scanned covers it. An
// item kept on reels is taken a whole reel at a time. The book-out itself is
// approved on the desktop after a final check. Needs a signal: nothing here
// is queued offline, since the desktop is watching it live.

const lineColour = (s) => (s === 'done' ? theme.colors.success : s === 'part' ? theme.colors.out : theme.colors.textSecondary);

export default function BomPickScreen({ navigation, route }) {
  const [list, setList] = useState(null);
  const [pick, setPick] = useState(null);
  const [taking, setTaking] = useState(null); // { line, place, qty }
  const [camera, setCamera] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { text, bad }
  const [refreshing, setRefreshing] = useState(false);
  const takingRef = useRef(null);
  takingRef.current = taking;

  const loadList = useCallback(async () => {
    try { const r = await api('/api/bom-picks?status=OPEN'); setList(r.items || []); } catch (e) { setList((l) => l || []); if (e?.status !== 401) setMsg({ text: e.message, bad: true }); }
  }, []);
  const reloadPick = useCallback(async (id) => {
    try { setPick(await api(`/api/bom-picks/${id}`)); } catch { /* keep what is shown */ }
  }, []);

  const open = useCallback(async (id) => {
    setBusy(true); setMsg(null);
    try { setPick(await api(`/api/bom-picks/${id}/open`, { method: 'POST', body: {} })); } catch (e) { setMsg({ text: e.message, bad: true }); } finally { setBusy(false); }
  }, []);

  // Opened from the banner on the main screen with a pick already chosen.
  useEffect(() => { if (route?.params?.id) open(route.params.id); }, [route?.params?.id, open]);

  // Listening: new BOMs from the desktop, and the open one changing there (cancelled, booked out).
  useEffect(() => {
    const tick = () => {
      if (AppState.currentState !== 'active') return;
      if (pick) { if (!takingRef.current) reloadPick(pick.id); } else loadList();
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [pick?.id, loadList, reloadPick]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => { setRefreshing(true); if (pick) await reloadPick(pick.id); else await loadList(); setRefreshing(false); };

  const choose = (line, labelPlace, labelLot) => {
    const place = placeFor(line, labelPlace, labelLot);
    setTaking({ line, place, qty: place && !line.reel ? String(Math.min(line.need - line.picked, place.available)) : '' });
    setMsg(null);
  };

  const lookUp = async (code) => {
    if (!String(code).trim() || !pick) return;
    setBusy(true); setMsg(null);
    try {
      const found = await api(`/api/stock-moves/find?code=${encodeURIComponent(code)}`);
      const line = matchLine(pick.lines, (found.items || []).map((i) => i.partNumber));
      if (!line) {
        setMsg({ text: found.items?.length ? `Wrong part: ${found.items[0].partNumber} is not on this BOM.` : found.location ? `${found.location.code} is a location. Scan the item.` : 'Not found in Tracklab. Check the code.', bad: true });
        return;
      }
      if (line.state === 'done') { setMsg({ text: `${line.code} is already picked (${line.picked} of ${line.need}).` }); return; }
      choose(line, found.label?.place, found.label?.lot);
      setTyped('');
    } catch (e) { setMsg({ text: e.message, bad: true }); } finally { setBusy(false); }
  };

  const take = async () => {
    if (!pick || !taking?.place) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/bom-picks/${pick.id}/scans`, {
        method: 'POST', body: { lineId: taking.line.id, binId: taking.place.binId, ...(taking.line.reel ? {} : { qty: Number(taking.qty) }) },
      });
      setPick(r.pick);
      const l = r.pick.lines.find((x) => x.id === taking.line.id);
      setMsg({ text: `${taking.line.code}: ${r.scan.wholeReel ? `whole reel, ${r.scan.qty}` : r.scan.qty} picked.${l && l.state === 'done' ? ' Line done.' : l ? ` ${l.need - l.picked} more needed.` : ''}${r.pick.complete ? ' Every line is picked: the final check is on the desktop.' : ''}` });
      setTaking(null);
    } catch (e) { setMsg({ text: e.message, bad: true }); } finally { setBusy(false); }
  };

  const undo = (scan, line) => {
    Alert.alert('Undo this scan?', `${scan.qty} × ${line.code} from ${scan.locationCode || 'no location'}. The line goes back to needing it.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: async () => { try { setPick(await api(`/api/bom-picks/${pick.id}/scans/${scan.id}/undo`, { method: 'POST', body: {} })); } catch (e) { setMsg({ text: e.message, bad: true }); } } },
    ]);
  };

  const back = () => {
    if (taking) { setTaking(null); return; }
    if (pick) { setPick(null); setMsg(null); return; }
    navigation.goBack();
  };

  // ---- one line of the pick
  const lineCard = (l) => {
    const notes = lineNotes(l, pick.lines);
    const places = l.places.filter((p) => p.available > 0);
    return (
      <View key={l.id} style={[styles.line, l.state === 'done' && styles.lineDone, l.state === 'part' && styles.linePart]}>
        <TouchableOpacity disabled={l.state === 'done' || pick.status !== 'OPEN'} onPress={() => choose(l)} accessibilityRole="button" accessibilityLabel={`${l.code}, ${l.picked} of ${l.need} picked`}>
          <View style={styles.rowBetween}>
            <Text style={[styles.dot, { color: lineColour(l.state) }]}>{l.state === 'done' ? '✓' : '●'}</Text>
            <Text style={[styles.code, styles.flex]} numberOfLines={1}>{l.code}</Text>
            <Text style={styles.mono}>{l.picked}<Text style={styles.small}>/{l.need}</Text></Text>
          </View>
          <Text style={[styles.small, styles.indent]} numberOfLines={1}>
            {l.item?.name || 'Not an item in Tracklab'}{l.reel ? ' · on reels: whole reel' : ''}{!sameCode(l.bomCode, l.code) ? ` · for ${l.bomCode}` : ''}
          </Text>
          {l.state !== 'done' ? (
            <Text style={[styles.places, styles.indent]}>
              {places.length ? places.map((p) => `📍 ${p.locationCode || 'No location'}${p.lot ? ` lot ${p.lot}` : ''}  ${p.available}`).join('    ') : <Text style={styles.bad}>None left in stock</Text>}
            </Text>
          ) : null}
          {notes.map((n) => <Text key={n} style={[styles.note, styles.indent]}>{n}</Text>)}
        </TouchableOpacity>
        {l.scans.map((s) => (
          <View key={s.id} style={[styles.rowBetween, styles.indent, styles.scanRow]}>
            <Text style={[styles.small, styles.flex]}>✓ {s.wholeReel ? 'Whole reel ' : ''}{s.qty} from {s.locationCode || 'no location'}{s.lot ? ` lot ${s.lot}` : ''} · {s.by}</Text>
            {pick.status === 'OPEN' ? <TouchableOpacity onPress={() => undo(s, l)} style={styles.undo} accessibilityLabel={`Undo ${s.qty} of ${l.code}`}><Text style={styles.undoText}>Undo</Text></TouchableOpacity> : null}
          </View>
        ))}
      </View>
    );
  };

  const todo = pick ? pick.lines.filter((l) => l.state !== 'done') : [];
  const done = pick ? pick.lines.filter((l) => l.state === 'done') : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}>
          <View style={styles.header}>
            <TouchableOpacity onPress={back} style={styles.headBtn} accessibilityLabel="Back"><Text style={styles.headBtnText}>‹ Back</Text></TouchableOpacity>
            <View style={styles.flex}>
              <Text style={styles.h1} numberOfLines={1}>{pick ? `${pick.projectName || `Project ${pick.projectId}`} × ${pick.buildQty}` : 'Scan BOM items'}</Text>
              {pick ? <Text style={styles.small}>{pick.done} of {pick.total} items picked</Text> : null}
            </View>
          </View>
          {pick ? <View style={styles.bar}><View style={[styles.barFill, { width: `${pick.total ? (pick.done / pick.total) * 100 : 0}%` }]} /></View> : null}

          {msg ? <Text style={msg.bad ? styles.error : styles.notice} accessibilityRole={msg.bad ? 'alert' : 'text'}>{msg.text}</Text> : null}

          {!pick ? (
            <>
              {!list ? <ActivityIndicator color={theme.colors.primary} style={styles.gap} /> : null}
              {list && !list.length ? <Text style={styles.text}>No BOM is waiting to be picked. On the website, press Book Out Entire BOM in BOM Manager; it shows up here within a few seconds.</Text> : null}
              {(list || []).map((p) => (
                <TouchableOpacity key={p.id} style={styles.choice} disabled={busy} onPress={() => open(p.id)} accessibilityRole="button">
                  <Text style={styles.code}>{p.projectName || `Project ${p.projectId}`} × {p.buildQty}</Text>
                  <Text style={styles.small}>{p.done} of {p.lines} items picked · started by {p.createdBy || 'someone'}{p.picker ? ` · ${p.picker} scanning` : ''}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              {pick.status !== 'OPEN' ? <Text style={styles.notice}>{pick.status === 'BOOKED' ? `Booked out on the website by ${pick.decidedBy || 'someone'}.` : 'This BOM pick was cancelled on the website.'}</Text> : null}
              {pick.status === 'OPEN' && pick.complete ? <Text style={styles.notice}>Every item is picked. The final check and book-out are approved on the website.</Text> : null}

              {taking ? (
                <View style={styles.confirm} accessibilityLabel="Confirm the pick">
                  <View style={styles.rowBetween}>
                    <View style={styles.flex}>
                      <Text style={[styles.code, styles.big]}>{taking.line.code}</Text>
                      <Text style={styles.text}>{taking.line.item?.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setTaking(null)} accessibilityLabel="Cancel this pick" style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                  </View>
                  <Text style={[styles.small, styles.gap]}>BOM needs {taking.line.need}{taking.line.picked ? `, ${taking.line.picked} picked` : ''}: <Text style={styles.bold}>{taking.line.need - taking.line.picked} more</Text></Text>
                  {lineNotes(taking.line, pick.lines).map((n) => <Text key={n} style={styles.note}>{n}</Text>)}
                  <Text style={[styles.label, styles.gap]}>TAKEN FROM</Text>
                  {taking.line.places.filter((p) => p.available > 0).map((p) => {
                    const on = taking.place && taking.place.binId === p.binId;
                    return (
                      <TouchableOpacity key={String(p.binId)} style={[styles.place, on && styles.placeOn]} accessibilityRole="radio" accessibilityState={{ selected: !!on }}
                        onPress={() => setTaking((t) => t && ({ ...t, place: p, qty: t.line.reel ? '' : String(Math.min(t.line.need - t.line.picked, p.available)) }))}>
                        <Text style={[styles.bold, styles.flex]}>📍 {p.locationCode || 'No location'}{p.lot ? <Text style={styles.small}>  lot {p.lot}</Text> : null}</Text>
                        <Text style={styles.mono}>{p.available}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {taking.place ? (taking.line.reel ? (
                    <Text style={styles.reel}>Whole reel: <Text style={styles.bold}>{taking.place.available}</Text>{taking.place.available > taking.line.need - taking.line.picked ? <Text style={styles.small}>  (the BOM needs {taking.line.need - taking.line.picked}; the rest goes with the kit)</Text> : null}</Text>
                  ) : (
                    <View style={styles.gap}>
                      <Text style={styles.label}>QUANTITY</Text>
                      <TextInput style={[styles.field, styles.qty]} value={taking.qty} onChangeText={(v) => setTaking((t) => t && ({ ...t, qty: v.replace(/[^\d]/g, '') }))} keyboardType="number-pad" accessibilityLabel="Quantity" />
                      {Number(taking.qty) > taking.line.need - taking.line.picked ? <Text style={styles.bad}>More than the {taking.line.need - taking.line.picked} the BOM still needs.</Text> : null}
                    </View>
                  )) : null}
                  <Button
                    title={!taking.place ? 'Choose where it was taken from' : taking.line.reel ? `Pick the whole reel (${taking.place.available})` : `Pick ${taking.qty || 0}`}
                    color={theme.colors.in} style={styles.gap} loading={busy}
                    disabled={!taking.place || (!taking.line.reel && !(Number(taking.qty) > 0))}
                    onPress={take}
                  />
                </View>
              ) : pick.status === 'OPEN' && !pick.complete ? (
                <>
                  <Button title="📷  Scan the next item" onPress={() => { setMsg(null); setCamera(true); }} disabled={busy} />
                  <View style={[styles.row, styles.gapBottom]}>
                    <TextInput style={[styles.field, styles.flex]} value={typed} onChangeText={setTyped} placeholder="Or type a stock code" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => lookUp(typed)} accessibilityLabel="Stock code to pick" />
                    <TouchableOpacity style={styles.findBtn} onPress={() => lookUp(typed)} disabled={busy || !typed.trim()}><Text style={styles.findText}>Find</Text></TouchableOpacity>
                  </View>
                </>
              ) : null}

              {todo.length ? <Text style={styles.label}>TO PICK ({todo.length})</Text> : null}
              {todo.map(lineCard)}
              {done.length ? <Text style={[styles.label, styles.gap]}>PICKED ({done.length})</Text> : null}
              {done.map(lineCard)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CodeScanner
        visible={camera}
        hint={pick ? `Pick for ${pick.projectName || 'the BOM'}` : 'Point at the label'}
        onClose={() => setCamera(false)}
        onCode={(code) => { setCamera(false); lookUp(code); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  body: { padding: theme.spacing.medium, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.spacing.small },
  h1: { color: theme.colors.text, fontSize: theme.fontSize.large, fontWeight: '900' },
  headBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  headBtnText: { color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 13 },
  bar: { height: 6, borderRadius: 3, backgroundColor: theme.colors.cardHigh, overflow: 'hidden', marginBottom: theme.spacing.medium },
  barFill: { height: 6, backgroundColor: theme.colors.in },
  notice: { color: theme.colors.success, backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  error: { color: theme.colors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  choice: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.medium, padding: 14, marginBottom: 8 },
  line: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.medium, padding: 12, marginBottom: 8 },
  lineDone: { borderColor: 'rgba(74,222,128,0.4)', backgroundColor: 'rgba(74,222,128,0.08)' },
  linePart: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.06)' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 16, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  indent: { marginLeft: 24 },
  code: { color: theme.colors.primary, fontWeight: 'bold', fontFamily: 'monospace' },
  mono: { color: theme.colors.text, fontWeight: 'bold', fontFamily: 'monospace' },
  big: { fontSize: theme.fontSize.large, fontWeight: '900' },
  text: { color: theme.colors.text },
  bold: { color: theme.colors.text, fontWeight: 'bold' },
  small: { color: theme.colors.textSecondary, fontSize: 12 },
  places: { color: theme.colors.text, fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  note: { color: theme.colors.out, fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  bad: { color: theme.colors.danger, fontSize: 12, fontWeight: 'bold' },
  scanRow: { marginTop: 6 },
  undo: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  undoText: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 12 },
  confirm: { borderWidth: 1, borderColor: 'rgba(247,145,43,0.5)', backgroundColor: 'rgba(247,145,43,0.06)', borderRadius: theme.borderRadius.large, padding: theme.spacing.medium, marginBottom: theme.spacing.medium },
  closeBtn: { padding: 6 },
  closeText: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
  label: { color: theme.colors.textSecondary, fontSize: theme.fontSize.small, fontWeight: 'bold', marginBottom: 6 },
  place: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.medium, padding: 12, marginBottom: 6 },
  placeOn: { borderColor: theme.colors.primary, backgroundColor: 'rgba(247,145,43,0.12)' },
  reel: { color: theme.colors.text, backgroundColor: theme.colors.cardHigh, borderRadius: theme.borderRadius.medium, padding: 12, marginTop: 6, overflow: 'hidden' },
  field: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, backgroundColor: theme.colors.background, color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: theme.fontSize.medium },
  qty: { fontSize: 22, fontFamily: 'monospace', textAlign: 'center' },
  findBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, paddingHorizontal: 16, paddingVertical: 13 },
  findText: { color: theme.colors.text, fontWeight: 'bold' },
  gap: { marginTop: 8 },
  gapBottom: { marginBottom: theme.spacing.medium },
});
