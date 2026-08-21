import * as Haptics from 'expo-haptics';
import { logger } from './logger';

/**
 * Dokunsal geri bildirim yoksa (emülatör, web, izin verilmeyen cihaz) akış
 * kesilmemeli; hata yalnızca geliştirme günlüğüne düşer.
 */
const runHaptic = (action: () => Promise<void>): void => {
  void action().catch((error: unknown) => {
    logger.debug('Dokunsal geri bildirim atlandı', { error });
  });
};

/** Beğen / geç kararı: hafif tık. */
export const hapticSwipeDecision = (): void => {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

/** Satın al: uygulamadan çıkışa hazırlayan daha belirgin tık. */
export const hapticPurchaseIntent = (): void => {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
};

/** Sanal deneme sonucu hazır. */
export const hapticSuccess = (): void => {
  runHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
};
