import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const SWIPE_HINT_KEY = 'kabin.onboarding.swipeHint.v4';
const ONBOARDING_KEY = 'kabin.onboarding.v1';
const SEEN_VALUE = 'seen';

export const hasSeenSwipeHint = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(SWIPE_HINT_KEY);
    return stored === SEEN_VALUE;
  } catch (error) {
    // Okunamıyorsa ipucunu bir kez daha göstermek, hiç göstermemekten iyidir.
    logger.warn('Kaydırma ipucu durumu okunamadı', { error });
    return false;
  }
};

export const markSwipeHintSeen = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(SWIPE_HINT_KEY, SEEN_VALUE);
  } catch (error) {
    logger.warn('Kaydırma ipucu kaydedilemedi', { error });
  }
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
    return stored === SEEN_VALUE;
  } catch (error) {
    logger.warn('Onboarding durumu okunamadı', { error });
    return false;
  }
};

export const markOnboardingComplete = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, SEEN_VALUE);
  } catch (error) {
    logger.warn('Onboarding kaydedilemedi', { error });
  }
};
