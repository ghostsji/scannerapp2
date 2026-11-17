import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './lib/auth';
import SignInScreen from './screens/SignInScreen';
import StockScreen from './screens/StockScreen';
import PickScreen from './screens/PickScreen';
import { theme } from './constants/theme';

// Tracklab Scan. Signed out: the sign-in screen. Signed in: Book in / out
// (the main screen) and Pick photo. Every scan shows on the Tracklab website
// under Sales > Scanner, where stock moves wait for approval.

const Stack = createStackNavigator();
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: theme.colors.primary, background: theme.colors.background, card: theme.colors.card, text: theme.colors.text, border: theme.colors.border },
};

function Screens() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background }}><ActivityIndicator color={theme.colors.primary} /></View>;
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Stock" component={StockScreen} />
          <Stack.Screen name="Pick" component={PickScreen} />
        </>
      ) : (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <Screens />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
