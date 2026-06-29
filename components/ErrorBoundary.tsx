import React from "react";
import { View, Text, Pressable } from "react-native";

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
            backgroundColor: "#12110f",
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#a1a1aa", textAlign: "center", marginBottom: 20 }}>
            The app hit an unexpected error. You can try again.
          </Text>
          <Pressable
            onPress={this.reset}
            style={{
              backgroundColor: "#10b981",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#000000", fontWeight: "700" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
