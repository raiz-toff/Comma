"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { listBackups, backupToDrive, restoreFromDrive, type DriveBackupFile } from "@/lib/drive";
import { clearTokens } from "@/lib/auth";
import { clearDbFromIDB } from "@/lib/db/persist";
import { resetDbInstance } from "@/lib/db/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import { CloudUpload, CloudDownload, LogOut, RefreshCw, AlertCircle, CheckCircle2, User, Lock, HardDrive } from "lucide-react";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: "hsl(var(--accent))" }}>{icon}</div>
        <p className="text-sm font-bold text-content-primary">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { tokens, isAuthenticated, reset, loadProfile, setDbReady, profile } = useAppStore();
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<DriveBackupFile | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadBackups() {
    if (!isAuthenticated) return;
    setBackupsLoading(true);
    setStatus(null);
    try { setBackups(await listBackups()); }
    catch (e: any) { setStatus({ type: "error", message: e.message }); }
    finally { setBackupsLoading(false); }
  }

  useEffect(() => { loadBackups(); }, [isAuthenticated]);

  async function handleBackup() {
    if (!passphrase || passphrase.length < 6) { setStatus({ type: "error", message: "Password must be at least 6 characters." }); return; }
    setBackingUp(true); setStatus(null);
    try { await backupToDrive(passphrase); setStatus({ type: "success", message: "Backup saved to Google Drive." }); loadBackups(); }
    catch (e: any) { setStatus({ type: "error", message: e.message }); }
    finally { setBackingUp(false); }
  }

  async function handleRestore() {
    if (!selectedBackup || !restorePassphrase) return;
    setRestoring(true); setStatus(null);
    try {
      await restoreFromDrive(selectedBackup.id, restorePassphrase);
      setDbReady(true); await loadProfile();
      setRestoreOpen(false); setSelectedBackup(null); setRestorePassphrase("");
      setStatus({ type: "success", message: "Data restored from backup." });
    }
    catch (e: any) { setStatus({ type: "error", message: e.message }); }
    finally { setRestoring(false); }
  }

  async function handleSignOut() {
    clearTokens(); clearDbFromIDB(); resetDbInstance(); reset();
    router.replace("/connect");
  }

  const primary = "hsl(var(--primary))";

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Status banner */}
      {status && (
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm"
          style={status.type === "success"
            ? { backgroundColor: `${primary}12`, border: `1px solid ${primary}40`, color: primary }
            : { backgroundColor: "hsl(4 100% 70% / 0.1)", border: "1px solid hsl(4 100% 70% / 0.3)", color: "hsl(var(--destructive))" }
          }
        >
          {status.type === "success" ? <CheckCircle2 size={15} strokeWidth={2.5} /> : <AlertCircle size={15} strokeWidth={2.5} />}
          {status.message}
        </div>
      )}

      {/* Profile */}
      {profile && (
        <Section icon={<User size={14} className="text-content-muted" />} title="Profile">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6">
            {profile.displayName && (
              <><span className="text-xs text-content-muted">Name</span><span className="text-sm font-semibold text-content-primary">{String(profile.displayName)}</span></>
            )}
            {profile.country && (
              <><span className="text-xs text-content-muted">Country</span><span className="text-sm font-semibold text-content-primary">{String(profile.country)}</span></>
            )}
            {profile.distanceUnit && (
              <><span className="text-xs text-content-muted">Distance unit</span><span className="text-sm font-semibold text-content-primary">{String(profile.distanceUnit)}</span></>
            )}
          </div>
        </Section>
      )}

      {/* Google Account */}
      <Section icon={<Lock size={14} className="text-content-muted" />} title="Google Account">
        {tokens?.email && (
          <p className="text-sm text-content-secondary mb-4">
            Signed in as <span style={{ color: primary }}>{tokens.email}</span>
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
        >
          <LogOut size={14} /> Sign out &amp; clear local data
        </button>
      </Section>

      {/* Backup */}
      <Section icon={<CloudUpload size={14} className="text-content-muted" />} title="Backup to Drive">
        <p className="text-xs text-content-muted mb-4">Encrypts your data with a password and saves it to Google Drive. The Comma mobile app can also restore from this backup.</p>
        <div className="space-y-3">
          <Input
            label="Backup password"
            type="password"
            placeholder="Min 6 characters"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <button
            onClick={handleBackup}
            disabled={backingUp || passphrase.length < 6}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: primary, color: "hsl(var(--primary-foreground))" }}
          >
            {backingUp ? <Spinner size="sm" /> : <CloudUpload size={14} />} Back up now
          </button>
        </div>
      </Section>

      {/* Restore */}
      <Section icon={<HardDrive size={14} className="text-content-muted" />} title="Restore from Drive">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-content-muted">Select a backup file to restore.</p>
          <button
            onClick={loadBackups}
            disabled={backupsLoading}
            className="p-1.5 rounded-lg transition-colors hover:bg-accent text-content-muted"
          >
            <RefreshCw size={13} className={backupsLoading ? "animate-spin" : ""} />
          </button>
        </div>
        {backupsLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-content-muted text-center py-4">No backups found in Drive.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
            {backups.map((b) => (
              <button
                key={b.id}
                onClick={() => { setSelectedBackup(b); setRestoreOpen(true); }}
                className="w-full text-left rounded-xl px-4 py-3 transition-all hover:opacity-80"
                style={{ backgroundColor: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }}
              >
                <p className="text-sm font-semibold text-content-primary truncate">{b.name}</p>
                <p className="text-xs text-content-muted mt-0.5">{formatDate(b.createdTime)}</p>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Restore confirm dialog */}
      <Dialog open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Restore backup">
        {selectedBackup && (
          <div className="space-y-4">
            <p className="text-xs text-content-muted font-medium truncate">{selectedBackup.name}</p>
            <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.3)", color: "hsl(var(--destructive))" }}>
              This will replace all data currently loaded in your browser with the backup contents.
            </div>
            <Input
              label="Backup password"
              type="password"
              placeholder="Your backup passphrase"
              value={restorePassphrase}
              onChange={(e) => setRestorePassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRestore()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRestoreOpen(false)}>Cancel</Button>
              <Button className="flex-1" loading={restoring} onClick={handleRestore} disabled={restorePassphrase.length < 6}>
                <CloudDownload size={14} /> Restore
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
