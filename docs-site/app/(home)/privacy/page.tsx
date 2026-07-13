import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { SimpleMarkdown } from '@/lib/simple-md';
import { VaultFlow } from '@/components/doc-visuals';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Comma collects no data about you. What is stored, where, and what leaves your device.',
};

export default function PrivacyPage() {
  const md = readFileSync(path.join(process.cwd(), 'lib/legal/privacy.md'), 'utf8');
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      {/* The visual is composed here, not in docs/privacy.md: the legal pages are
          plain markdown on purpose (rendered by SimpleMarkdown, and linked as raw
          files from the Play Store listing), so they carry no JSX. */}
      <VaultFlow
        accent="emerald"
        nodes={['Phone — SQLite', 'Browser — IndexedDB']}
        hub="Your Google Drive"
        caption="Your records live on your own devices. The only copy that ever leaves is one you choose to put in your own Drive — and Comma has no server to send it to anyway."
      />
      <SimpleMarkdown markdown={md} />
    </main>
  );
}
