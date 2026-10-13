import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { completedPlanningSession, reviewHistory, shouldRequestReview } from './reviewPolicy';

const KEY = 'sdp:review-history:v1';
let pending = false;
let requesting = false;
export function cancelPendingReview() { pending = false; }

/** Called only after saving and intentionally leaving a productive editor session. */
export async function recordPlanningSession(edits: number, durationMs: number) {
  try {
    const previous = reviewHistory(JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null'));
    const next = completedPlanningSession(previous, edits, durationMs, Date.now());
    if (next === previous) return;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    pending = true;
  } catch { /* Reviews must never interfere with saving or navigation. */ }
}

/** Home calls this after navigation settles; any new touch or navigation cancels it. */
export async function requestPendingReview(canPresent: () => boolean) {
  if (!pending || requesting || !canPresent()) return;
  requesting = true;
  try {
    const history = reviewHistory(JSON.parse(await AsyncStorage.getItem(KEY) ?? 'null'));
    const version = Constants.expoConfig?.version ?? '1.0.0';
    if (__DEV__ || !shouldRequestReview(history, version, Date.now()) || !await StoreReview.isAvailableAsync()) return;
    if (!pending || !canPresent()) return;
    // Persist the attempt first: Apple may silently suppress the prompt.
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...history, lastRequestedAt: Date.now(), lastRequestedVersion: version }));
    if (pending && canPresent()) await StoreReview.requestReview();
  } catch { /* No store redirects or error dialogs when reviews are unavailable. */ }
  finally { pending = false; requesting = false; }
}
