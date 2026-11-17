import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../lib/auth';
import { theme } from '../constants/theme';

// Sign in with the same email and password as the Tracklab website. Viewers
// cannot sign in here (they may not scan), and an account that must set a new
// password does that on the website first; the server's message says so.

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err?.message || 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Image source={require('../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>Tracklab Scan</Text>
          <Text style={styles.sub}>Sign in with your Tracklab account</Text>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button title="Sign in" onPress={submit} loading={busy} />
          <Text style={styles.note}>This sign-in is separate from the website: it won't sign you out on your computer.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xlarge },
  logo: { width: 80, height: 80, borderRadius: 18, alignSelf: 'center', marginBottom: 12 },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xlarge, fontWeight: '900', textAlign: 'center' },
  sub: { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: theme.spacing.xlarge },
  error: { color: theme.colors.danger, marginBottom: theme.spacing.medium, fontWeight: '600' },
  note: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: theme.spacing.small },
});
