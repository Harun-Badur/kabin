import {
  DEFAULT_FEED_MODE,
  type FeedMode,
} from '../types/recommendation';

let lastRecommendationId: string | null = null;
let lastFeedMode: FeedMode = DEFAULT_FEED_MODE;

export const setLastRecommendationId = (id: string | null): void => {
  lastRecommendationId = id;
};

export const getLastRecommendationId = (): string | null => lastRecommendationId;

export const setLastFeedMode = (mode: FeedMode): void => {
  lastFeedMode = mode;
};

export const getLastFeedMode = (): FeedMode => lastFeedMode;
