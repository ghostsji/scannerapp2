import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import { theme } from '../constants/theme';

// Choose a stock location from a searchable list. For a book-out only the
// places that hold the item are offered, with how many are there.

export default function PlacePicker({ visible, locations, places, direction, onPick, onClose }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const here = new Map((places || []).map((p) => [p.locationId, p.quantity]));
    const base = direction === 'OUT' ? locations.filter((l) => here.has(l.id)) : locations;
    const t = q.trim().toLowerCase();
    return base
      .filter((l) => !t || l.code.toLowerCase().includes(t) || (l.name || '').toLowerCase().includes(t))
      .map((l) => ({ ...l, here: here.get(l.id) || 0 }));
  }, [locations, places, direction, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>{direction === 'IN' ? 'Put away at' : 'Taken from'}</Text>
        <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder="Find a place" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="characters" autoCorrect={false} />
        <FlatList
          data={rows}
          keyExtractor={(l) => String(l.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <TouchableOpacity style={styles.row} onPress={() => onPick(null)}>
              <Text style={styles.code}>{direction === 'IN' ? 'Not put away yet' : 'Oldest stock first'}</Text>
              <Text style={styles.name}>{direction === 'IN' ? 'Goes under No location' : 'Stock with no location first, then the oldest places'}</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<Text style={styles.empty}>{direction === 'OUT' ? 'This item is not in any place.' : 'No places match.'}</Text>}
          renderItem={({ item: l }) => (
            <TouchableOpacity style={styles.row} onPress={() => onPick(l)}>
              <Text style={styles.code}>{l.code}{l.here ? `  (${l.here} here)` : ''}</Text>
              {l.name ? <Text style={styles.name}>{l.name}</Text> : null}
            </TouchableOpacity>
          )}
        />
        <View style={styles.footer}><Button title="Close" variant="secondary" onPress={onClose} /></View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.medium },
  title: { color: theme.colors.text, fontSize: theme.fontSize.large, fontWeight: '900', marginBottom: theme.spacing.small },
  search: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.medium, backgroundColor: theme.colors.card, color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: theme.fontSize.medium, marginBottom: theme.spacing.small },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  code: { color: theme.colors.text, fontWeight: 'bold', fontFamily: 'monospace' },
  name: { color: theme.colors.textSecondary, fontSize: theme.fontSize.small, marginTop: 2 },
  empty: { color: theme.colors.textSecondary, paddingVertical: 20, textAlign: 'center' },
  footer: { paddingTop: theme.spacing.small },
});
