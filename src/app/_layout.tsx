import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PixelifySans_400Regular, PixelifySans_500Medium, PixelifySans_600SemiBold, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { C } from '../theme';
import { useSaves } from '../store/saves';
import { useLang } from '../i18n';
import { useEditor } from '../store/editor';
import { useRadio } from '../audio';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PixelifySans_400Regular, PixelifySans_500Medium, PixelifySans_600SemiBold, PixelifySans_700Bold, VT323_400Regular });
  const load = useSaves((s) => s.load);
  useEffect(() => { load(); useLang.getState().load(); useRadio.getState().load(); useEditor.getState().loadOptions(); }, [load]);
  const ready = fontsLoaded || !!fontError;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.wood }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.wood }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="planner/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="catalog" />
          <Stack.Screen name="about" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
