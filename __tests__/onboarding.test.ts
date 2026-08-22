import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
} from '../lib/onboarding';

describe('onboarding flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('ilk açılışta tamamlanmamış sayılır', async () => {
    await expect(hasCompletedOnboarding()).resolves.toBe(false);
  });

  it('kabin.onboarding.v1 yazılınca tamamlanmış olur', async () => {
    await markOnboardingComplete();
    await expect(hasCompletedOnboarding()).resolves.toBe(true);
    await expect(AsyncStorage.getItem('kabin.onboarding.v1')).resolves.toBe(
      'seen',
    );
  });
});
