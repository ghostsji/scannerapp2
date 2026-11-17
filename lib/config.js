import Constants from 'expo-constants';

// Where Tracklab IM lives. Set EXPO_PUBLIC_API_URL to point a build at
// another server; otherwise app.json's extra.apiUrl is used.
export const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'https://tracklab-im.fly.dev'
).replace(/\/+$/, '');
