import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { SimpleMarkdown } from '@/lib/simple-md';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Comma collects no data about you. What is stored, where, and what leaves your device.',
};

export default function PrivacyPage() {
  const md = readFileSync(path.join(process.cwd(), 'lib/legal/privacy.md'), 'utf8');
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <SimpleMarkdown markdown={md} />
    </main>
  );
}
