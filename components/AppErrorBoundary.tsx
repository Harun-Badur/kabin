import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { captureUnhandledError } from '../lib/sentry';
import { colors, radius, spacing } from '../lib/theme';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

// Error Boundary React'te yalnızca class component ile mümkün.
export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureUnhandledError(error, {
      componentStack: info.componentStack ?? undefined,
    });
  }

  handleRestart = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.handleRestart}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Yeniden Başlat</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.inverseText,
    fontSize: 16,
    fontWeight: '700',
  },
});
