import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "../src/components/ui/text";
import { COLORS } from "../src/theme/colors";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary.
 *
 * Without this, an uncaught render error anywhere in the tree unmounts the ENTIRE app to a
 * blank screen with no recovery. This catches the error, shows a fallback with a "Try again"
 * action, and logs it. To forward crashes to a reporting service later, add the call inside
 * componentDidCatch (e.g. Sentry.captureException(error)).
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: COLORS.background,
          }}
        >
          <Text variant="headingS" style={{ marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text variant="paragraphM" style={{ textAlign: "center", marginBottom: 20 }}>
            The app hit an unexpected error. You can try again.
          </Text>
          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
          >
            <Text variant="labelM" style={{ color: COLORS.background }}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
