import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { subscribeQueue, flushQueue, discard } from '../lib/queue';
import { theme } from '../constants/theme';

// Shows scans still on the phone (no signal when they were made), with
// "Send now", and any the server refused, with its reason and Discard.

const describe = (e) => (e.kind === 'stock'
  ? `${e.payload.direction === 'IN' ? 'In' : 'Out'} ${e.payload.quantity} × ${e.payload.partNumber}`
  : `Pick photo · ${e.payload.pickNote}`);

export default function QueueBar() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeQueue(setItems), []);
  if (!items.length) return null;

  const waiting = items.filter((e) => !e.failed);
  const failed = items.filter((e) => e.failed);
  const send = async () => { setBusy(true); try { await flushQueue({ retryFailed: false }); } finally { setBusy(false); } };
  const drop = (e) => Alert.alert('Discard this scan?', `${describe(e)}\nIt was never saved in Tracklab.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: () => discard(e.clientRef) },
  ]);

  return (
    <View style={styles.box}>
      {waiting.length ? (
        <View style={styles.line}>
          <Text style={styles.text}>{waiting.length} scan{waiting.length === 1 ? '' : 's'} waiting for signal</Text>
          <TouchableOpacity onPress={send} disabled={busy} style={styles.btn}><Text style={styles.btnText}>{busy ? 'Sending…' : 'Send now'}</Text></TouchableOpacity>
        </View>
      ) : null}
      {failed.map((e) => (
        <View key={e.clientRef} style={styles.failed}>
          <View style={styles.flex}>
            <Text style={styles.text}>{describe(e)}</Text>
            <Text style={styles.reason}>{e.failed}</Text>
          </View>
          <TouchableOpacity onPress={() => drop(e)} style={styles.btn}><Text style={[styles.btnText, { color: theme.colors.danger }]}>Discard</Text></TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: theme.colors.out, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: theme.borderRadius.medium, padding: 12, marginBottom: theme.spacing.medium },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  flex: { flex: 1 },
  text: { color: theme.colors.text, fontWeight: '600' },
  reason: { color: theme.colors.danger, fontSize: 12, marginTop: 2 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  btnText: { color: theme.colors.text, fontWeight: 'bold', fontSize: 13 },
});
