import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import PressableScale from '../../components/PressableScale';
import { colors, radius, shadows, spacing } from '../../lib/theme';

const TITLE_ICON_SIZE = 28;

export default function StyleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.header}>STİL</Text>
      <View style={styles.card}>
        <Sparkles color={colors.accent} size={TITLE_ICON_SIZE} />
        <Text style={styles.title}>Stilin oluşuyor.</Text>
        <Text style={styles.body}>
          Beğenilerin, geçtiklerin ve denemelerin tarzını anlamamıza yardımcı
          oluyor.
        </Text>
        <PressableScale
          onPress={() => {
            router.push('/');
          }}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel="Keşfetmeye başla"
        >
          <Text style={styles.ctaText}>Keşfetmeye Başla</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: spacing.lg,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    ...shadows.card,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.md,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.inverseText,
    fontSize: 16,
    fontWeight: '800',
  },
});
