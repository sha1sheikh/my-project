import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';

const DRAFTS_DIR = join(import.meta.dirname, '..', '..', 'drafts');

/**
 * Writes ingested data as a draft YAML file under /drafts/<collection>/.
 * Scripts must never write into /data directly — a human reviews the draft,
 * fills any gaps the source API couldn't answer, and only then moves the
 * file into /data by hand (or via a reviewed PR).
 */
export function writeDraft(collection: string, id: string, data: unknown): string {
  const dir = join(DRAFTS_DIR, collection);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${id}.yaml`);
  const header = `# DRAFT — generated ${new Date().toISOString()}\n# Review against the source document before moving this into /data/${collection}/.\n# Do not commit this file to /data unverified.\n\n`;
  writeFileSync(file, header + dump(data, { noRefs: true, sortKeys: false }));
  return file;
}
