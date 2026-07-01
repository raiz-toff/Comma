"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleOAuthCallback } from "@/lib/auth";
import { useAppStore } from "@/store/useAppStore";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setTokens = useAppStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");

    if (err) {
      setError("Google sign-in was cancelled or denied.");
      return;
    }
    if (!code || !state) {
      setError("Invalid callback — missing code or state.");
      return;
    }

    handleOAuthCallback(code, state)
      .then((tokens) => {
        setTokens(tokens);
        router.replace("/connect");
      })
      .catch((e: Error) => setError(e.message));
  }, [params, router, setTokens]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive font-semibold">{error}</p>
        <button onClick={() => router.replace("/connect")} className="text-sm text-primary underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
      <Spinner size="lg" />
      <p className="text-sm text-content-muted">Signing you in…</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Spinner size="lg" /></div>}>
      <CallbackContent />
    </Suspense>
  );
}
