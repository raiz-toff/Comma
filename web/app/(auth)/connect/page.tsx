"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { startGoogleAuth, getTokens } from "@/lib/auth";
import { listBackups, restoreFromDrive, type DriveBackupFile } from "@/lib/drive";
import { getDb } from "@/lib/db/index";
import { seedDemoData } from "@/lib/db/seed-demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import { CloudDownload, LogIn, HardDrive, AlertCircle, CheckCircle2, Play } from "lucide-react";

type Step = "sign-in" | "load-backups" | "select-backup" | "enter-passphrase" | "restoring" | "done";

export default function ConnectPage() {
  const router = useRouter();
  const { tokens, isAuthenticated, hasLocalData, setTokens, setDbReady, setHasLocalData, setDemo, loadProfile } = useAppStore();
  const [step, setStep] = useState<Step>(isAuthenticated ? "load-backups" : "sign-in");

  // Already have local data — no need to restore again
  useEffect(() => {
    if (hasLocalData) router.replace("/dashboard");
  }, [hasLocalData, router]);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<DriveBackupFile | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync auth state from localStorage on mount (post-callback redirect)
  useEffect(() => {
    const stored = getTokens();
    if (stored && !isAuthenticated) setTokens(stored);
  }, [isAuthenticated, setTokens]);

  useEffect(() => {
    if (isAuthenticated && step === "sign-in") setStep("load-backups");
  }, [isAuthenticated, step]);

  useEffect(() => {
    if (step !== "load-backups") return;
    setLoading(true);
    setError(null);
    listBackups()
      .then((list) => {
        setBackups(list);
        setStep("select-backup");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [step]);

  async function handleRestore() {
    if (!selectedBackup || !passphrase) return;
    setStep("restoring");
    setError(null);
    try {
      await restoreFromDrive(selectedBackup.id, passphrase);
      await getDb();
      setDbReady(true);
      setHasLocalData(true);
      await loadProfile();
      setStep("done");
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (e: Error | any) {
      setError(e.message ?? "Restore failed.");
      setStep("select-backup");
    }
  }

  async function handleSkip() {
    // Use web app with empty DB (no data yet)
    await getDb();
    setDbReady(true);
    router.replace("/dashboard");
  }

  async function handleDemo() {
    setLoading(true);
    setError(null);
    try {
      await seedDemoData();
      setDbReady(true);
      setHasLocalData(true);
      setDemo(true);
      await loadProfile();
      router.replace("/dashboard");
    } catch (e: Error | any) {
      setError(e?.message ?? "Could not load the demo.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo-with-text.png" alt="Comma" width={180} height={180} className="mx-auto mb-2" />
          <p className="text-sm text-content-muted">Web Dashboard — Load your data from Google Drive</p>
        </div>

        {/* Step: Sign In */}
        {step === "sign-in" && (
          <div className="rounded-xl border border-line-subtle bg-surface-02 p-6">
            <div className="flex items-center gap-3 mb-5">
              <LogIn size={20} className="text-primary" />
              <div>
                <p className="font-semibold text-content-primary text-sm">Step 1</p>
                <p className="text-xs text-content-muted">Sign in with Google to access your Drive backups</p>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={() => startGoogleAuth()}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            {/* Portfolio / first-look path — explore realistic data without signing in */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line-subtle" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-content-disabled">or</span>
              <div className="h-px flex-1 bg-line-subtle" />
            </div>
            <Button variant="ghost" className="w-full" size="lg" onClick={handleDemo} disabled={loading}>
              {loading ? <Spinner size="sm" /> : <Play size={16} />}
              Explore the demo — no sign-in
            </Button>
            <p className="mt-2 text-center text-[11px] text-content-disabled">
              Loads two weeks of sample shifts, expenses &amp; goals. Nothing leaves your browser.
            </p>
          </div>
        )}

        {/* Step: Loading backups */}
        {step === "load-backups" && (
          <div className="rounded-xl border border-line-subtle bg-surface-02 p-6 flex items-center gap-3">
            <Spinner />
            <p className="text-sm text-content-secondary">Fetching your Drive backups…</p>
          </div>
        )}

        {/* Step: Select backup */}
        {step === "select-backup" && (
          <div className="rounded-xl border border-line-subtle bg-surface-02 p-6">
            <div className="flex items-center gap-3 mb-5">
              <HardDrive size={20} className="text-primary" />
              <div>
                <p className="font-semibold text-content-primary text-sm">Step 2 — Choose a backup</p>
                <p className="text-xs text-content-muted">
                  {tokens?.email && <span className="text-primary">{tokens.email} · </span>}
                  {backups.length} backup{backups.length !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-content-muted">No backups found.</p>
                <p className="text-xs text-content-disabled mt-1">Create a backup from the mobile app first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-4">
                {backups.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBackup(b); setStep("enter-passphrase"); }}
                    className="w-full text-left rounded-md border border-line-subtle bg-surface-03 hover:border-primary/50 hover:bg-surface-04 transition-colors px-4 py-3"
                  >
                    <p className="text-sm font-medium text-content-primary truncate">{b.name}</p>
                    <p className="text-xs text-content-muted mt-0.5">{formatDate(b.createdTime)}</p>
                  </button>
                ))}
              </div>
            )}

            <button onClick={handleSkip} className="w-full text-center text-xs text-content-muted hover:text-content-secondary underline mt-2">
              Skip — start with an empty workspace
            </button>
          </div>
        )}

        {/* Step: Enter passphrase */}
        {step === "enter-passphrase" && selectedBackup && (
          <div className="rounded-xl border border-line-subtle bg-surface-02 p-6">
            <div className="flex items-center gap-3 mb-5">
              <CloudDownload size={20} className="text-primary" />
              <div>
                <p className="font-semibold text-content-primary text-sm">Step 3 — Enter backup password</p>
                <p className="text-xs text-content-muted truncate">{selectedBackup.name}</p>
              </div>
            </div>
            <Input
              label="Backup password"
              type="password"
              placeholder="Your backup passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRestore()}
              autoFocus
            />
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
                <AlertCircle size={14} className="text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setStep("select-backup"); setError(null); }}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleRestore} disabled={passphrase.length < 6}>
                Load Data
              </Button>
            </div>
          </div>
        )}

        {/* Step: Restoring */}
        {step === "restoring" && (
          <div className="rounded-xl border border-line-subtle bg-surface-02 p-6 flex items-center gap-3">
            <Spinner />
            <div>
              <p className="text-sm font-medium text-content-primary">Restoring your data…</p>
              <p className="text-xs text-content-muted">This may take a moment</p>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-6 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-primary" />
            <div>
              <p className="text-sm font-medium text-content-primary">Data loaded successfully!</p>
              <p className="text-xs text-content-muted">Redirecting to dashboard…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
