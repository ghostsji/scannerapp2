import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, AppState, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Input from '../components/Input';
import CodeScanner from '../components/CodeScanner';
import PlacePicker from '../components/PlacePicker';
import QueueBar from '../components/QueueBar';
import { api, newClientRef } from '../lib/api';
import { SCANS_PAGE, mergeScans, nearEnd } from '../lib/scans';
import { enqueue, flushQueue } from '../lib/queue';
import { useAuth } from '../lib/auth';
import { theme } from '../constants/theme';

// The main job: book a reel or item in or out. Scan its label (or type the
// code) -> check the item -> quantity, place, reference -> Send for approval.
// Nothing changes stock here: the scan waits on the website (Sales > Scanner)
// until someone approves it. With no signal the scan is kept on the phone and
// sent later (lib/queue.js). Same steps as Tracklab's own /scan page.

const EMPTY = { quantity: '', location: null, lot: '', dateCode: '', reference: '', note: '' };
const EMPTY_DRAFT = { partNumber: '', name: '', makerPartNumber: '', description: '' };

const when = (v) => {
  const d = new Date(v || '');
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export const whereLine = (item) => {
  const parts = (item.places || []).map((p) => `${p.code} ${p.quantity}`);
  if (item.noLocation > 0) parts.push(`no location ${item.noLocation}`);
  return parts.join(' · ') || 'None in stock';
};
const STATUS = {
  PENDING: { text: 'Waiting for approval', color: theme.colors.primary },
  APPROVED: { text: 'Approved', color: theme.colors.success },
  REJECTED: { text: 'Rejected', color: theme.colors.danger },
};

export default function StockScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [direction, setDirection] = useState('IN');
  const [camera, setCamera] = useState(null); // 'item' | 'place'
  const [picker, setPicker] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [choices, setChoices] = useState(null);
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [locations, setLocations] = useState([]);
  const [mine, setMine] = useState([]);
  // My scans: the newest page is re-read every 15 s; older pages load as the list is scrolled.
  const [mineTotal, setMineTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef(null);
  // BOMs the website sent to be scanned (Book Out Entire BOM): announced at the top.
  const [bomsWaiting, setBomsWaiting] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const clientRef = useRef(newClientRef());
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  // A book-in label that isn't in Tracklab: add it as a new item, or link it to an existing one.
  // Both happen only when the scan is approved on the website.
  const [unknown, setUnknown] = useState(null); // { code, barcodes, label }
  const [mode, setMode] = useState(null); // null | 'new' | 'link'
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [newItem, setNewItem] = useState(null);
  const setD = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const loadMine = useCallback(async () => {
    try {
      const r = await api(`/api/stock-moves?mine=1&pageSize=${SCANS_PAGE}`);
      setMine((prev) => mergeScans(prev, r.items || [])); setMineTotal(r.total || 0);
    } catch { /* no signal: keep what is shown */ }
    try { const b = await api('/api/bom-picks?status=OPEN'); setBomsWaiting(b.items || []); } catch { /* try again on the next tick */ }
  }, []);
  // The next page of older scans. New scans arriving meanwhile only shift rows already
  // loaded onto the next page, and those are merged by id, so nothing is skipped or doubled.
  const loadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true; setLoadingMore(true);
    try {
      const page = Math.floor(mine.length / SCANS_PAGE) + 1;
      const r = await api(`/api/stock-moves?mine=1&pageSize=${SCANS_PAGE}&page=${page}`);
      setMine((prev) => mergeScans(prev, r.items || [])); setMineTotal(r.total || 0);
    } catch { /* no signal: the button stays to try again */ } finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, [mine.length]);
  const hasMore = mine.length < mineTotal;
  const onScroll = (e) => {
    const n = e.nativeEvent;
    if (hasMore && nearEnd(n)) loadMore();
    const far = n.contentOffset.y > 900;
    if (far !== showTop) setShowTop(far);
  };
  const loadLocations = useCallback(async () => {
    try { const r = await api('/api/stock-locations'); setLocations((r.locations || []).filter((l) => l.active)); } catch { /* try again on refresh */ }
  }, []);

  useEffect(() => {
    loadLocations(); loadMine(); flushQueue().then((n) => { if (n) loadMine(); });
    // Every 15 s while the app is in front: scans turn Approved / Rejected, and queued ones go out.
    const tick = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      loadMine();
      flushQueue().then((n) => { if (n) loadMine(); });
    }, 15000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { loadMine(); flushQueue().then((n) => { if (n) loadMine(); }); } });
    return () => { clearInterval(tick); sub.remove(); };
  }, [loadMine, loadLocations]);

  const refresh = async () => { setRefreshing(true); await Promise.all([loadMine(), loadLocations(), flushQueue()]); setRefreshing(false); };

  const reset = () => {
    setItem(null); setChoices(null); setTyped(''); setError(null); setForm(EMPTY);
    setUnknown(null); setMode(null); setDraft(EMPTY_DRAFT); setNewItem(null);
    clientRef.current = newClientRef();
  };

  const choose = (it, found) => {
    setItem(it); setChoices(null);
    // Many items have a location named after their own stock code: offer it for a book-in.
    const own = locations.find((l) => l.code.toUpperCase() === it.partNumber.toUpperCase());
    // When linking an unknown label, what it said (quantity, lot) comes from that first scan.
    const label = found?.label || unknown?.label || null;
    setForm((f) => ({
      ...f,
      location: f.location || (direction === 'IN' && own ? own : null),
      quantity: label?.quantity ? String(label.quantity) : f.quantity,
      lot: label?.lot || f.lot,
      dateCode: label?.dateCode || f.dateCode,
    }));
  };

  const startNew = () => {
    setMode('new'); setError(null);
    // A supplier label's first part number is the maker's: offer it for the new item.
    setDraft((d) => ({ ...d, makerPartNumber: d.makerPartNumber || (unknown?.label?.partNumbers?.[0] || '') }));
  };

  // The new item's stock code is checked (not used yet), then it is booked in like any other.
  const continueNew = async () => {
    const code = draft.partNumber.trim().toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9][A-Z0-9._/-]{1,59}$/.test(code)) { setError('Give it a stock code: 2 to 60 letters, digits, dashes, dots or slashes.'); return; }
    if (!draft.name.trim()) { setError('Give the new item a name.'); return; }
    setBusy(true); setError(null);
    try {
      const found = await api(`/api/stock-moves/find?code=${encodeURIComponent(code)}`);
      const same = found.matchedBy === 'stock code' ? found.items[0] : null;
      if (same) { setError(`${same.partNumber} is already an item (${same.name}). Choose another stock code, or link the label to it instead.`); return; }
      const ni = { partNumber: code, name: draft.name.trim(), makerPartNumber: draft.makerPartNumber.trim() || null, description: draft.description.trim() || null };
      setNewItem(ni);
      choose({ partNumber: code, name: ni.name, description: ni.description, makerPartNumber: ni.makerPartNumber, stock: 0, places: [], noLocation: 0 });
    } catch (err) {
      setError(err?.network ? 'No connection, so the stock code can\'t be checked. Try again when there is signal.' : err?.message);
    } finally { setBusy(false); }
  };

  const lookUp = async (code, forPlace = false) => {
    if (!String(code || '').trim()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const found = await api(`/api/stock-moves/find?code=${encodeURIComponent(code)}`);
      if (forPlace || (item && found.location && !found.items.length)) {
        if (found.location) setForm((f) => ({ ...f, location: found.location }));
        else setError('That is not a stock location label.');
        return;
      }
      if (unknown) {
        // Looking for the existing item to link the unknown label to.
        if (found.items.length === 1) choose(found.items[0]);
        else if (found.items.length > 1) setChoices(found.items);
        else setError('No item matches that. Try another code or name, or add it as a new item.');
        return;
      }
      if (found.items.length === 1) choose(found.items[0], found);
      else if (found.items.length > 1) setChoices(found.items);
      else if (found.location) setError(`${found.location.code} is a location. Scan the item first, then its place.`);
      else if (direction === 'IN' && found.barcodes?.length) { setUnknown({ code: String(code), barcodes: found.barcodes, label: found.label }); setTyped(''); }
      else setError(direction === 'OUT' ? 'Not found in Tracklab, so there is nothing to book out. Check the code.' : 'Not found in Tracklab. Check the code.');
    } catch (err) {
      setError(err?.network ? 'No connection, so the code can\'t be looked up. Try again when there is signal.' : err?.message);
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!item) return;
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) { setError('Enter a whole quantity of 1 or more.'); return; }
    const payload = {
      direction, partNumber: item.partNumber, quantity,
      locationId: form.location ? form.location.id : null,
      lot: direction === 'IN' ? form.lot.trim() : '', dateCode: direction === 'IN' ? form.dateCode.trim() : '',
      reference: form.reference.trim(), note: form.note.trim(),
      capturedAt: new Date().toISOString(),
      // An unknown label: the item to create, or the label to remember on the chosen item.
      ...(newItem ? { newItem } : {}),
      ...(unknown ? { code: unknown.code, saveBarcode: !newItem } : {}),
    };
    const what = `${direction === 'IN' ? 'book in' : 'book out'} ${quantity} × ${item.partNumber}${newItem ? ' (new item)' : unknown ? ' (barcode linked)' : ''}`;
    setBusy(true); setError(null);
    try {
      await api('/api/stock-moves', { method: 'POST', body: { ...payload, clientRef: clientRef.current } });
      setNotice(`Sent for approval: ${what}.`);
      reset(); loadMine();
    } catch (err) {
      if (err?.network) {
        await enqueue({ kind: 'stock', clientRef: clientRef.current, payload });
        setNotice(`No signal. Kept on the phone and sent when there is: ${what}.`);
        reset();
      } else if (err?.status !== 401) setError(err?.message || 'Could not send it.');
    } finally { setBusy(false); }
  };

  const cancel = (m) => Alert.alert('Cancel this scan?', `${m.direction === 'IN' ? 'In' : 'Out'} ${m.quantity} × ${m.partNumber}`, [
    { text: 'Keep it', style: 'cancel' },
    {
      text: 'Cancel scan', style: 'destructive', onPress: async () => {
        try {
          const r = await api('/api/stock-moves/decide', { method: 'POST', body: { ids: [m.id], decision: 'REJECT', reason: 'Cancelled on the phone' } });
          if (r.results?.[0] && !r.results[0].ok) setError(r.results[0].error || 'Could not cancel it.');
        } catch (err) { if (err?.status !== 401) setError(err?.message); }
        loadMine();
      },
    },
  ]);

  const askSignOut = () => Alert.alert('Sign out?', 'Scans waiting for signal stay on the phone and are sent after the next sign-in.', [
    { text: 'Stay signed in', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: signOut },
  ]);

  const dirBtn = (d, text) => {
    const on = direction === d;
    return (
      <TouchableOpacity style={[styles.dir, on && { backgroundColor: d === 'IN' ? theme.colors.in : theme.colors.out }]} onPress={() => { if (d !== direction && (unknown || newItem)) reset(); setDirection(d); setError(null); setForm((f) => ({ ...f, location: null })); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
        <Text style={[styles.dirText, on && { color: d === 'IN' ? '#fff' : '#000' }]}>{text}</Text>
      </TouchableOpacity>
    );
  };
  const pending = mine.filter((m) => m.status === 'PENDING').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={200}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.h1}>Tracklab Scan</Text>
              <Text style={styles.small}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('BomPick')} style={styles.headBtn}><Text style={styles.headBtnText}>BOM</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('BillScan')} style={styles.headBtn}><Text style={styles.headBtnText}>Bill</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Pick')} style={styles.headBtn}><Text style={styles.headBtnText}>Pick photo</Text></TouchableOpacity>
            <TouchableOpacity onPress={askSignOut} style={styles.headBtn}><Text style={styles.headBtnText}>Sign out</Text></TouchableOpacity>
          </View>

          <QueueBar />

          {bomsWaiting.length && !item && !unknown && !choices ? (
            <TouchableOpacity style={styles.bomBanner} onPress={() => navigation.navigate('BomPick', bomsWaiting.length === 1 ? { id: bomsWaiting[0].id } : undefined)} accessibilityRole="button">
              <View style={styles.flex}>
                <Text style={styles.bold}>{bomsWaiting.length === 1 ? 'A BOM is waiting to be scanned' : `${bomsWaiting.length} BOMs are waiting to be scanned`}</Text>
                <Text style={styles.small} numberOfLines={1}>{bomsWaiting.map((b) => `${b.projectName || `Project ${b.projectId}`} × ${b.buildQty} (${b.done}/${b.lines})`).join(' · ')}</Text>
              </View>
              <Text style={styles.bomBannerGo}>SCAN BOM ITEMS ›</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.switch} accessibilityLabel="Book in or out">
            {dirBtn('IN', 'Book in')}
            {dirBtn('OUT', 'Book out')}
          </View>

          {notice ? <Text style={styles.notice} accessibilityRole="text">{notice}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          {unknown && !item && !choices ? (
            <View style={styles.card} accessibilityLabel="Not in Tracklab">
              <View style={styles.headRow}>
                <Text style={[styles.bold, styles.flex]}>Not in Tracklab yet</Text>
                <TouchableOpacity onPress={reset} accessibilityLabel="Start again" style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
              </View>
              <Text style={styles.label}>SCANNED</Text>
              <View style={[styles.wrap, styles.gapBottom]}>
                {unknown.barcodes.map((b) => <Text key={b} style={styles.tag}>{b}</Text>)}
                {unknown.label?.quantity ? <Text style={[styles.tag, styles.tagDim]}>Qty {unknown.label.quantity}</Text> : null}
              </View>

              {!mode ? (
                <>
                  <TouchableOpacity style={styles.option} onPress={startNew} accessibilityRole="button">
                    <Text style={[styles.optionIcon, { backgroundColor: theme.colors.in, color: '#fff' }]}>+</Text>
                    <View style={styles.flex}>
                      <Text style={styles.bold}>Add as a new item</Text>
                      <Text style={styles.small}>Give it a stock code and name, then book it in</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.option} onPress={() => { setMode('link'); setError(null); }} accessibilityRole="button">
                    <Text style={[styles.optionIcon, { backgroundColor: theme.colors.cardHigh, color: theme.colors.primary, fontSize: 20 }]}>🔗</Text>
                    <View style={styles.flex}>
                      <Text style={styles.bold}>Link to an existing item</Text>
                      <Text style={styles.small}>It's in Tracklab under another code: this label will find it next time</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.small, styles.center]}>Nothing is added until someone approves the scan on the website.</Text>
                </>
              ) : null}

              {mode === 'new' ? (
                <>
                  <Input label="New stock code" value={draft.partNumber} onChangeText={setD('partNumber')} placeholder="e.g. CAP-099" autoCapitalize="characters" autoCorrect={false} autoFocus />
                  <Input label="Name" value={draft.name} onChangeText={setD('name')} placeholder="e.g. 10uF 0603 X5R 16V" />
                  <Input label="Maker part number (optional)" value={draft.makerPartNumber} onChangeText={setD('makerPartNumber')} autoCapitalize="characters" autoCorrect={false} />
                  <Input label="Description (optional)" value={draft.description} onChangeText={setD('description')} />
                  <Button title="Continue to quantity" onPress={continueNew} loading={busy} color={theme.colors.in} />
                  <Button title="Back" variant="outline" onPress={() => { setMode(null); setError(null); }} />
                </>
              ) : null}

              {mode === 'link' ? (
                <>
                  <Text style={[styles.text, styles.gapSmall]}>Find the item this label belongs to:</Text>
                  <View style={[styles.row, styles.gapSmall]}>
                    <TextInput style={[styles.field, styles.flex]} value={typed} onChangeText={setTyped} placeholder="Stock code, name or part number" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => lookUp(typed)} autoFocus accessibilityLabel="Find the existing item" />
                    <TouchableOpacity style={styles.findBtn} onPress={() => lookUp(typed)} disabled={busy || !typed.trim()}><Text style={styles.findText}>{busy ? '…' : 'Find'}</Text></TouchableOpacity>
                  </View>
                  <Button title="Scan its Tracklab label" variant="secondary" onPress={() => setCamera('item')} />
                  <Button title="Back" variant="outline" onPress={() => { setMode(null); setError(null); }} />
                </>
              ) : null}
            </View>
          ) : null}

          {!item && !choices && !unknown ? (
            <View style={styles.card}>
              <Button title="Scan a label" onPress={() => { setError(null); setNotice(null); setCamera('item'); }} disabled={busy} />
              <View style={styles.row}>
                <TextInput style={[styles.field, styles.flex]} value={typed} onChangeText={setTyped} placeholder="or type a stock code or part number" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => lookUp(typed)} />
                <TouchableOpacity style={styles.findBtn} onPress={() => lookUp(typed)} disabled={busy || !typed.trim()}><Text style={styles.findText}>{busy ? '…' : 'Find'}</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}

          {choices ? (
            <View style={styles.card}>
              <Text style={styles.bold}>Which item is it?</Text>
              {choices.map((c) => (
                <TouchableOpacity key={c.partNumber} style={styles.choice} onPress={() => choose(c)}>
                  <Text style={styles.code}>{c.partNumber}</Text>
                  <Text style={styles.text}>{c.name}</Text>
                  <Text style={styles.small}>In stock {c.stock}{c.makerPartNumber ? ` · ${c.makerPartNumber}` : ''}</Text>
                </TouchableOpacity>
              ))}
              <Button title="Back" variant="outline" onPress={() => (unknown ? setChoices(null) : reset())} />
            </View>
          ) : null}

          {item ? (
            <View style={styles.card}>
              <Text style={[styles.code, styles.big]}>{item.partNumber}</Text>
              <Text style={styles.bold}>{item.name}</Text>
              {item.makerPartNumber ? <Text style={styles.small}>{item.makerPartNumber}</Text> : null}
              {newItem ? <Text style={[styles.banner, styles.bannerNew]}>New item: it is added to Tracklab when this scan is approved.</Text> : null}
              {unknown && !newItem ? <Text style={[styles.banner, styles.bannerLink]}>When approved, the label {unknown.barcodes.join(', ')} is saved on this item, so the next scan finds it.</Text> : null}
              <Text style={[styles.text, styles.gap]}>In stock: <Text style={styles.bold}>{item.stock}</Text></Text>
              <Text style={[styles.small, styles.gapBottom]}>{whereLine(item)}</Text>

              <Input label={`Quantity to book ${direction === 'IN' ? 'in' : 'out'}`} value={form.quantity} onChangeText={(v) => set('quantity')(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styles.qty} />

              <Text style={styles.label}>{direction === 'IN' ? 'Put away at (optional)' : 'Taken from (optional)'}</Text>
              <View style={[styles.row, styles.gapBottom]}>
                <TouchableOpacity style={[styles.field, styles.flex]} onPress={() => setPicker(true)}>
                  <Text style={form.location ? styles.text : styles.small}>{form.location ? `${form.location.code}${form.location.name ? ` · ${form.location.name}` : ''}` : (direction === 'IN' ? 'Not put away yet' : 'Oldest stock first')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.findBtn} onPress={() => setCamera('place')}><Text style={styles.findText}>Scan</Text></TouchableOpacity>
              </View>

              {direction === 'IN' ? (
                <View style={styles.row}>
                  <View style={styles.flex}><Input label="Lot (optional)" value={form.lot} onChangeText={set('lot')} autoCapitalize="characters" /></View>
                  <View style={styles.flex}><Input label="Date code (optional)" value={form.dateCode} onChangeText={set('dateCode')} /></View>
                </View>
              ) : null}
              <Input label="Reference (optional)" value={form.reference} onChangeText={set('reference')} placeholder="PO, job or order number" autoCapitalize="characters" />
              <Input label="Note (optional)" value={form.note} onChangeText={set('note')} />

              <Button title={`Send for approval: ${direction === 'IN' ? 'book in' : 'book out'}`} onPress={send} loading={busy} color={direction === 'IN' ? theme.colors.in : theme.colors.out} />
              <Button title="Cancel" variant="outline" onPress={reset} disabled={busy} />
              <Text style={[styles.small, styles.center]}>Stock changes once someone approves this on the website.</Text>
            </View>
          ) : null}

          <Text style={styles.h2}>My scans{pending ? ` · ${pending} waiting` : ''}{mineTotal ? <Text style={styles.small}>{`   ${mine.length < mineTotal ? `${mine.length} of ${mineTotal}` : `${mineTotal} in all`}`}</Text> : null}</Text>
          {mine.length === 0 ? <Text style={styles.small}>Nothing scanned yet.</Text> : null}
          {mine.map((m) => {
            const s = STATUS[m.status] || STATUS.PENDING;
            return (
              <View key={m.id} style={styles.scan}>
                <View style={styles.flex}>
                  <Text style={styles.bold}>
                    <Text style={{ color: m.direction === 'IN' ? theme.colors.success : theme.colors.out }}>{m.direction === 'IN' ? '+' : '−'}{m.quantity}</Text>
                    <Text style={styles.code}> {m.partNumber}</Text>
                  </Text>
                  <Text style={styles.small} numberOfLines={1}>{[m.location?.code, m.reference, when(m.capturedAt || m.createdAt)].filter(Boolean).join(' · ')}</Text>
                  <View style={styles.wrap}>
                    <Text style={[styles.chip, { color: s.color, borderColor: s.color }]}>{s.text}</Text>
                    {m.newItem ? <Text style={[styles.chip, { color: theme.colors.success, borderColor: theme.colors.success }]}>New item</Text> : null}
                    {!m.newItem && m.linkCodes?.length ? <Text style={[styles.chip, { color: theme.colors.primary, borderColor: theme.colors.primary }]}>Barcode</Text> : null}
                  </View>
                  {m.status === 'REJECTED' && m.rejectReason ? <Text style={styles.reason}>{m.rejectReason}</Text> : null}
                  {m.status === 'APPROVED' && m.stockAfter != null ? <Text style={styles.small}>Stock after: {m.stockAfter}{m.decidedBy ? ` · ${m.decidedBy}` : ''}</Text> : null}
                </View>
                {m.status === 'PENDING' ? (
                  <TouchableOpacity onPress={() => cancel(m)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                ) : null}
              </View>
            );
          })}
          {hasMore ? (
            <Button title={loadingMore ? 'Loading older scans…' : `Show older scans (${mineTotal - mine.length} more)`} variant="outline" onPress={loadMore} loading={loadingMore} />
          ) : mine.length > SCANS_PAGE ? <Text style={[styles.small, styles.center]}>That's all your scans.</Text> : null}
        </ScrollView>
        {showTop ? (
          <TouchableOpacity style={styles.top} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} accessibilityRole="button" accessibilityLabel="Back to top">
            <Text style={styles.topText}>↑ Top</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAvoidingView>

      <CodeScanner
        visible={!!camera}
        hint={camera === 'place' ? 'Scan the rack or shelf label' : 'Scan the reel or item label'}
        onClose={() => setCamera(null)}
        onCode={(code) => { const forPlace = camera === 'place'; setCamera(null); lookUp(code, forPlace); }}
      />
      <PlacePicker
        visible={picker}
        locations={locations}
        places={item?.places}
        direction={direction}
        onClose={() => setPicker(false)}
        onPick={(l) => { setForm((f) => ({ ...f, location: l })); setPicker(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  body: { padding: theme.spacing.medium, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.medium },
  h1: { color: theme.colors.text, fontSize: theme.fontSize.large, fontWeight: '900' },
  h2: { color: theme.colors.text, fontSize: theme.fontSize.medium, fontWeight: '900', marginTop: theme.spacing.large, marginBottom: theme.spacing.small },
  headBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  headBtnText: { color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 12 },
  switch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: theme.borderRadius.large, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.medium },
  dir: { flex: 1, paddingVertical: 13, borderRadius: theme.borderRadius.medium, alignItems: 'center' },
  dirText: { color: theme.colors.textSecondary, fontWeight: '900', fontSize: theme.fontSize.medium },
  notice: { color: theme.colors.success, backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  error: { color: theme.colors.danger, backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, fontWeight: '600', marginBottom: theme.spacing.medium },
  card: { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.large, padding: theme.spacing.medium },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, backgroundColor: theme.colors.background, color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: theme.fontSize.medium, justifyContent: 'center' },
  findBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, paddingHorizontal: 16, paddingVertical: 13 },
  findText: { color: theme.colors.text, fontWeight: 'bold' },
  choice: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, padding: 12, marginTop: 8, marginBottom: 4 },
  code: { color: theme.colors.primary, fontWeight: 'bold', fontFamily: 'monospace' },
  big: { fontSize: theme.fontSize.large, fontWeight: '900' },
  text: { color: theme.colors.text },
  bold: { color: theme.colors.text, fontWeight: 'bold' },
  small: { color: theme.colors.textSecondary, fontSize: 12 },
  label: { color: theme.colors.textSecondary, fontSize: theme.fontSize.small, fontWeight: 'bold', marginBottom: 5 },
  qty: { fontSize: 22, fontFamily: 'monospace' },
  gap: { marginTop: 8 },
  gapBottom: { marginBottom: theme.spacing.medium },
  center: { textAlign: 'center' },
  scan: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 12, marginBottom: 8 },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: 'bold', marginTop: 6, overflow: 'hidden' },
  reason: { color: theme.colors.danger, fontSize: 12, marginTop: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.medium },
  closeBtn: { padding: 6 },
  closeText: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: theme.colors.text, backgroundColor: theme.colors.cardHigh, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  tagDim: { color: theme.colors.textSecondary, fontFamily: undefined, fontWeight: 'normal' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.large, padding: 14, marginBottom: 10, backgroundColor: theme.colors.background },
  optionIcon: { width: 44, height: 44, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', lineHeight: 44, fontSize: 22, fontWeight: 'bold', overflow: 'hidden' },
  gapSmall: { marginBottom: theme.spacing.small },
  banner: { borderWidth: 1, borderRadius: theme.borderRadius.medium, padding: 10, fontSize: 12, fontWeight: '600', marginTop: 10, overflow: 'hidden' },
  bannerNew: { color: theme.colors.success, borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.08)' },
  bannerLink: { color: theme.colors.primary, borderColor: 'rgba(247,145,43,0.3)', backgroundColor: 'rgba(247,145,43,0.08)' },
  cancel: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelText: { color: theme.colors.danger, fontWeight: 'bold', fontSize: 12 },
  bomBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: 'rgba(247,145,43,0.1)', borderRadius: theme.borderRadius.large, padding: 14, marginBottom: theme.spacing.medium },
  bomBannerGo: { color: theme.colors.primary, fontWeight: '900', fontSize: 12 },
  top: { position: 'absolute', right: 16, bottom: 24, backgroundColor: theme.colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  topText: { color: theme.colors.onPrimary, fontWeight: '900' },
});
