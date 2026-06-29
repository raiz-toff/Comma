import React from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";

// This app's queries hit a local SQLite DB, not the network, so the default 3× retry just
// delays surfacing a genuine failure. A QueryCache.onError gives one place to observe errors
// (swap console.error for Sentry/Crashlytics later).
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error("[QueryError]", query.queryKey, error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
