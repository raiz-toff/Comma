import "../src/global.css";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { Text } from "../src/components/ui/text";
import { useColors } from "../src/theme/useColors";
import { ThemeSync } from "../src/theme/ThemeSync";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { DATABASE_NAME, useDatabaseMigrations, useStudio } from "../src/database/client";
import { QueryProvider } from "../providers/QueryProvider";
import { useGPSTracking } from "../hooks/useGPSTracking";
import { useWakeLock } from "../hooks/useWakeLock";
import { useNotificationRouting } from "../hooks/useNotificationRouting";
import { useAutoSync } from "../hooks/useAutoSync";
import { AppErrorBoundary } from "../components/ErrorBoundary";
import { installGlobalErrorHandler } from "../src/lib/installGlobalErrorHandler";
import * as Notifications from "expo-notifications";

installGlobalErrorHandler();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    // Don't replay sound for notifications that arrive while the app is open —
    // the in-app panel already surfaces them visually. OS plays sound normally
    // when the app is backgrounded (this handler is never called then).
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function ShiftBackgroundServices() {
  useGPSTracking();
  useWakeLock();
  useNotificationRouting();
  useAutoSync();
  return null;
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations();
  const C = useColors();
  useStudio();
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ThemeSync />
        <Text variant="headingS" className="mb-2 text-destructive">
          Database Error
        </Text>
        <Text variant="paragraphM" className="text-center">{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ThemeSync />
        <ActivityIndicator size="large" color={C.contentSecondary} />
        <Text variant="paragraphM" className="mt-4">Initializing database...</Text>
      </View>
    );
  }

  const stackContent = (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <AppErrorBoundary>
          <ShiftBackgroundServices />
          <Stack
            screenOptions={{
              headerShown: false,
              // Scene background matches the canvas — prevents a flash of the
              // opposite theme between screens.
              contentStyle: { backgroundColor: C.background },
            }}
          />
        </AppErrorBoundary>
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.background }}>
      <ThemeSync />
      <QueryProvider>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center bg-background">
              <ActivityIndicator size="large" color={C.contentSecondary} />
            </View>
          }
        >
          {Platform.OS === "web" ? (
            stackContent
          ) : (
            <SQLiteProvider
              databaseName={DATABASE_NAME}
              options={{ enableChangeListener: true }}
              useSuspense
            >
              {stackContent}
            </SQLiteProvider>
          )}
        </Suspense>
      </QueryProvider>
      <PortalHost />
    </GestureHandlerRootView>
  );
}
