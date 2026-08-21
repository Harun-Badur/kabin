// Polyfill'ler router açılmadan önce yüklenmeli: Supabase URL/URLSearchParams
// bekliyor, Gesture Handler ise native tarafı kurmak için erken import istiyor.
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import './lib/sentry';

import 'expo-router/entry';
