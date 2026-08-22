import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../lib/logger';
import {
  mergeTryOnHistory,
  parseTryOnHistory,
  vtonHistoryStorageKey,
  type TryOnHistoryEntry,
} from '../lib/vtonHistory';

export const loadTryOnHistory = async (
  userId: string,
): Promise<TryOnHistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(vtonHistoryStorageKey(userId));
    return parseTryOnHistory(raw);
  } catch (error) {
    logger.warn('Sanal deneme geçmişi okunamadı', { error });
    return [];
  }
};

export const appendTryOnHistory = async (
  userId: string,
  entry: TryOnHistoryEntry,
): Promise<TryOnHistoryEntry[]> => {
  const key = vtonHistoryStorageKey(userId);
  const existing = await loadTryOnHistory(userId);
  const { next, evicted } = mergeTryOnHistory(existing, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (error) {
    logger.warn('Sanal deneme geçmişi yazılamadı', { error });
    return [];
  }
  return evicted;
};
