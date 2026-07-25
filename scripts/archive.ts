#!/usr/bin/env tsx
/**
 * Given a URL, submits it to the Wayback Machine's save API and returns the
 * snapshot URL. Every source in /data/sources MUST have a non-empty
 * archive_url — call this for every source before it is accepted.
 *
 * Usage:
 *   tsx scripts/archive.ts https://example.org/document.pdf
 *
 * Optional: SAVEPAGENOW_ACCESS_KEY / SAVEPAGENOW_SECRET_KEY env vars for an
 * authenticated (higher rate limit) save via the Internet Archive S3-style
 * API. Without them this falls back to the unauthenticated save endpoint,
 * which is rate-limited and may need retries.
 */

const ACCESS_KEY = process.env.SAVEPAGENOW_ACCESS_KEY;
const SECRET_KEY = process.env.SAVEPAGENOW_SECRET_KEY;

async function checkExistingSnapshot(url: string): Promise<string | undefined> {
  const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
  if (!res.ok) return undefined;
  const body = await res.json();
  return body.archived_snapshots?.closest?.url;
}

async function saveNow(url: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (ACCESS_KEY && SECRET_KEY) {
    headers.Authorization = `LOW ${ACCESS_KEY}:${SECRET_KEY}`;
  }
  const res = await fetch(`https://web.archive.org/save/${url}`, { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(`Wayback save request failed (${res.status}) for ${url}`);
  }
  // The save endpoint responds with the snapshot location either as a
  // Content-Location header or embedded in the final redirected URL.
  const contentLocation = res.headers.get('content-location');
  if (contentLocation) {
    return `https://web.archive.org${contentLocation}`;
  }
  return res.url;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: tsx scripts/archive.ts <url>');
    process.exit(1);
  }

  const existing = await checkExistingSnapshot(url);
  if (existing) {
    console.log(`Existing snapshot found: ${existing}`);
    return;
  }

  console.log(`No existing snapshot. Requesting a new one for: ${url}`);
  const snapshot = await saveNow(url);
  console.log(`archive_url: ${snapshot}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
