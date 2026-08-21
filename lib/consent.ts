import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const VTON_CONSENT_KEY = 'kabin.consent.vton.v1';
const CONSENT_GRANTED_VALUE = 'granted';

export const hasVtonConsent = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(VTON_CONSENT_KEY);
    return stored === CONSENT_GRANTED_VALUE;
  } catch (error) {
    logger.warn('Rıza durumu okunamadı; rıza ekranı gösterilecek.', { error });
    return false;
  }
};

export const grantVtonConsent = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(VTON_CONSENT_KEY, CONSENT_GRANTED_VALUE);
  } catch (error) {
    logger.warn('Rıza kaydedilemedi; bir sonraki açılışta tekrar sorulacak.', {
      error,
    });
  }
};
