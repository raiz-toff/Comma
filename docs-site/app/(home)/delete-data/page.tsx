import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { SimpleMarkdown } from '@/lib/simple-md';

export const metadata: Metadata = {
  title: 'Data Deletion Request',
  description: 'How to delete every piece of data Comma has stored, on-device and in your Google Drive.',
};

export default function DeleteDataPage() {
  const md = readFileSync(path.join(process.cwd(), 'lib/legal/delete-data.md'), 'utf8');
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <SimpleMarkdown markdown={md} />
    </main>
  );
}
