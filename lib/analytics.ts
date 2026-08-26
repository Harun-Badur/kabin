import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { logger } from './logger';
import { getSupabaseClient } from './supabase';
import type {
  AnalyticsEventType,
  AnalyticsPayload,
  AnalyticsQueueItem,
} from '../types/analytics';
import {
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_FLUSH_SIZE,
  ANALYTICS_QUEUE_CAP,
  ANALYTICS_QUEUE_KEY,
  IMPRESSION_MIN_DWELL_MS,
  LEGACY_RECOMMENDATION_ID,
} from '../types/analytics';
import { getLastFeedMode, getLastRecommendationId } from './recsFeedState';

export {
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_FLUSH_SIZE,
  ANALYTICS_QUEUE_CAP,
  ANALYTICS_QUEUE_KEY,
  IMPRESSION_MIN_DWELL_MS,
  LEGACY_RECOMMENDATION_ID,
};

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

export const createUuid = (): string => {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const byte6 = bytes[6] ?? 0;
  const byte8 = bytes[8] ?? 0;
  bytes[6] = (byte6 & 0x0f) | 0x40;
  bytes[8] = (byte8 & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

const SESSION_ID = createUuid();
const queuedOrSentIds = new Set<string>();
const impressionKeys = new Set<string>();

let queue: AnalyticsQueueItem[] = [];
let queueHydrated = false;
let hydratePromise: Promise<void> | null = null;
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let backoffMs = INITIAL_BACKOFF_MS;
let initialized = false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isEventType = (value: unknown): value is AnalyticsEventType =>
  value === 'like' ||
  value === 'pass' ||
  value === 'impression' ||
  value === 'try_on_start' ||
  value === 'try_on_success' ||
  value === 'try_on_failure' ||
  value === 'store_click' ||
  value === 'dolap_add' ||
  value === 'dolap_remove' ||
  value === 'search' ||
  value === 'filter' ||
  value === 'back' ||
  value === 'share' ||
  value === 'feed_fallback';

const isPayloadValue = (
  value: unknown,
): value is string | number | boolean | null =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const isPayload = (value: unknown): value is AnalyticsPayload => {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(isPayloadValue);
};

const isQueueItem = (value: unknown): value is AnalyticsQueueItem => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.event_id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.session_id === 'string' &&
    isEventType(value.event_type) &&
    (typeof value.product_id === 'string' || value.product_id === null) &&
    isPayload(value.payload) &&
    typeof value.created_at === 'string'
  );
};

export const getAnalyticsSessionId = (): string => SESSION_ID;

export const capAnalyticsQueue = (
  items: AnalyticsQueueItem[],
): AnalyticsQueueItem[] => {
  if (items.length <= ANALYTICS_QUEUE_CAP) {
    return items;
  }
  return items.slice(items.length - ANALYTICS_QUEUE_CAP);
};

export const parseAnalyticsQueue = (raw: string | null): AnalyticsQueueItem[] => {
  if (raw === null || raw.trim().length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isQueueItem);
  } catch {
    return [];
  }
};

const persistQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    logger.debug('Analytics kuyruk yazılamadı', { error });
  }
};

const hydrateQueue = async (): Promise<void> => {
  if (queueHydrated) {
    return;
  }
  if (hydratePromise) {
    await hydratePromise;
    return;
  }

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
      const stored = capAnalyticsQueue(parseAnalyticsQueue(raw));
      queue = stored;
      for (const item of stored) {
        queuedOrSentIds.add(item.event_id);
      }
    } catch (error) {
      logger.debug('Analytics kuyruk okunamadı', { error });
      queue = [];
    } finally {
      queueHydrated = true;
    }
  })();

  await hydratePromise;
};

const readUserId = async (): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      logger.debug('Analytics oturum okunamadı', { detail: error.message });
      return null;
    }
    return data.session?.user.id ?? null;
  } catch (error) {
    logger.debug('Analytics oturum okunamadı', { error });
    return null;
  }
};

const sendBatch = async (batch: AnalyticsQueueItem[]): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) {
    logger.debug('Analytics flush atlandı: supabase yok');
    return false;
  }

  const { error } = await client.rpc('ingest_events', { p_batch: batch });
  if (error) {
    logger.debug('Analytics ingest başarısız', { detail: error.message });
    return false;
  }
  return true;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const flushAnalytics = async (): Promise<void> => {
  if (flushing) {
    return;
  }
  flushing = true;

  try {
    await hydrateQueue();

    while (queue.length > 0) {
      const batch = queue.slice(0, ANALYTICS_FLUSH_SIZE);
      const batchIds = new Set(batch.map((item) => item.event_id));
      const ok = await sendBatch(batch);

      if (!ok) {
        await wait(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        return;
      }

      backoffMs = INITIAL_BACKOFF_MS;
      queue = queue.filter((item) => !batchIds.has(item.event_id));
      await persistQueue();
    }
  } catch (error) {
    logger.debug('Analytics flush beklenmeyen hata', { error });
  } finally {
    flushing = false;
  }
};

const enqueueItem = async (item: AnalyticsQueueItem): Promise<void> => {
  await hydrateQueue();

  if (queuedOrSentIds.has(item.event_id)) {
    return;
  }
  queuedOrSentIds.add(item.event_id);

  queue = capAnalyticsQueue([...queue, item]);
  await persistQueue();

  if (queue.length >= ANALYTICS_FLUSH_SIZE) {
    void flushAnalytics();
  }
};

export const track = (
  type: AnalyticsEventType,
  productId?: string | null,
  payload: AnalyticsPayload = {},
): void => {
  void (async () => {
    try {
      const userId = await readUserId();
      if (!userId) {
        logger.debug('Analytics atlandı: oturum yok', { type });
        return;
      }

      const item: AnalyticsQueueItem = {
        event_id: createUuid(),
        user_id: userId,
        session_id: SESSION_ID,
        event_type: type,
        product_id: productId?.trim() ? productId.trim() : null,
        payload,
        created_at: new Date().toISOString(),
      };
      await enqueueItem(item);
    } catch (error) {
      logger.debug('Analytics track başarısız', { error });
    }
  })();
};

export const trackFeedImpression = (
  productId: string,
  position: number,
  dwellMs: number,
): void => {
  if (dwellMs < IMPRESSION_MIN_DWELL_MS) {
    return;
  }

  const recommendationId =
    getLastRecommendationId() ?? LEGACY_RECOMMENDATION_ID;
  const feedMode = getLastFeedMode();
  const key = `${recommendationId}:${SESSION_ID}:${productId}:${feedMode}`;
  if (impressionKeys.has(key)) {
    return;
  }
  impressionKeys.add(key);

  track('impression', productId, {
    position,
    dwell_ms: Math.round(dwellMs),
    recommendation_id: recommendationId,
    feed_mode: feedMode,
  });
};

const handleAppState = (status: AppStateStatus): void => {
  if (status === 'background' || status === 'inactive') {
    void flushAnalytics();
  }
};

export const initAnalytics = (): void => {
  if (initialized) {
    return;
  }
  initialized = true;
  void hydrateQueue();

  if (flushTimer === null) {
    flushTimer = setInterval(() => {
      void flushAnalytics();
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  }

  if (appStateSubscription === null) {
    appStateSubscription = AppState.addEventListener('change', handleAppState);
  }
};

export const clearAnalyticsQueue = async (): Promise<void> => {
  queue = [];
  queuedOrSentIds.clear();
  impressionKeys.clear();
  queueHydrated = true;
  try {
    await AsyncStorage.removeItem(ANALYTICS_QUEUE_KEY);
  } catch (error) {
    logger.debug('Analytics kuyruk silinemedi', { error });
  }
};

export const resetAnalyticsForTests = async (): Promise<void> => {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  appStateSubscription?.remove();
  appStateSubscription = null;
  initialized = false;
  flushing = false;
  queueHydrated = false;
  hydratePromise = null;
  queue = [];
  backoffMs = INITIAL_BACKOFF_MS;
  queuedOrSentIds.clear();
  impressionKeys.clear();
  await AsyncStorage.removeItem(ANALYTICS_QUEUE_KEY);
};
