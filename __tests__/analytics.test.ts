import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  capAnalyticsQueue,
  flushAnalytics,
  parseAnalyticsQueue,
  resetAnalyticsForTests,
  track,
  trackFeedImpression,
} from '../lib/analytics';
import type { AnalyticsQueueItem } from '../types/analytics';
import { ANALYTICS_QUEUE_CAP } from '../types/analytics';

const mockRpc = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../lib/supabase', () => ({
  getSupabaseClient: (): {
    rpc: typeof mockRpc;
    auth: { getSession: typeof mockGetSession };
  } => ({
    rpc: mockRpc,
    auth: { getSession: mockGetSession },
  }),
}));

const settle = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 40);
  });
};

const sampleItem = (index: number): AnalyticsQueueItem => ({
  event_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  user_id: 'user-1',
  session_id: 'session-1',
  event_type: 'like',
  product_id: `p-${index}`,
  payload: { source: 'feed' },
  created_at: '2026-08-25T00:00:00.000Z',
});

describe('analytics queue', () => {
  beforeEach(async () => {
    mockRpc.mockReset();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });
    await resetAnalyticsForTests();
    await AsyncStorage.clear();
  });

  it('eski kayıtları düşürerek kuyruğu 500 ile sınırlar', () => {
    const items = Array.from({ length: ANALYTICS_QUEUE_CAP + 3 }, (_, index) =>
      sampleItem(index),
    );
    const capped = capAnalyticsQueue(items);
    expect(capped).toHaveLength(ANALYTICS_QUEUE_CAP);
    expect(capped[0]?.product_id).toBe('p-3');
  });

  it('bozuk kuyruk JSON’unu boş diziye çevirir', () => {
    expect(parseAnalyticsQueue('{not-json')).toEqual([]);
    expect(parseAnalyticsQueue('[]')).toEqual([]);
  });

  it('track sonrası ingest_events RPC çağırır', async () => {
    track('like', 'prd-1', { source: 'feed' });
    await settle();
    track('pass', 'prd-2', { source: 'feed' });
    await settle();

    await flushAnalytics();

    expect(mockRpc).toHaveBeenCalled();
    const firstCall = mockRpc.mock.calls[0];
    expect(firstCall?.[0]).toBe('ingest_events');
    const batch = (firstCall?.[1] as { p_batch: AnalyticsQueueItem[] }).p_batch;
    expect(batch.map((item) => item.event_type)).toEqual(
      expect.arrayContaining(['like', 'pass']),
    );
    expect(batch.every((item) => item.user_id === 'user-1')).toBe(true);
  });

  it('aynı ürün impression’ını oturumda bir kez gönderir', async () => {
    trackFeedImpression('prd-imp', 0, 1200);
    trackFeedImpression('prd-imp', 0, 2500);
    await settle();
    await flushAnalytics();

    const firstCall = mockRpc.mock.calls[0];
    const batch = (firstCall?.[1] as { p_batch: AnalyticsQueueItem[] }).p_batch;
    const impressions = batch.filter((item) => item.event_type === 'impression');
    expect(impressions).toHaveLength(1);
    expect(impressions[0]?.payload.dwell_ms).toBe(1200);
    expect(impressions[0]?.payload.feed_mode).toBe('personal');
  });

  it('1 saniyeden kısa dwell impression yazmaz', async () => {
    trackFeedImpression('prd-short', 0, 400);
    await settle();
    await flushAnalytics();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
