#!/usr/bin/env tsx
/**
 * Parses a Registrar of Consultant Lobbyists quarterly return (CSV export)
 * and matches client/lobbyist organisation names, outputting draft activity
 * records of type "lobbying_activity".
 *
 * The Registrar publishes returns as CSV/PDF at
 * https://www.lobbying-register.uk/ — there is no stable JSON API, so this
 * script takes a locally downloaded CSV as input.
 *
 * Expected CSV columns (from the Registrar's published format):
 *   Registrant, Client, Quarter, Communications
 *
 * Usage:
 *   tsx scripts/lobbying-register.ts path/to/quarterly-return.csv "Universities UK"
 *
 * Output: draft activity records under /drafts/activities/, for human
 * review — source_ids must point to a real archived copy of the quarterly
 * return before use.
 */
import { readFileSync } from 'node:fs';
import { writeDraft } from './lib/draft';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

async function main() {
  const [csvPath, orgName] = process.argv.slice(2);
  if (!csvPath || !orgName) {
    console.error('Usage: tsx scripts/lobbying-register.ts <csv_path> "<organisation name>"');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf-8'));
  const matches = rows.filter(
    (r) =>
      (r.Client ?? '').toLowerCase().includes(orgName.toLowerCase()) ||
      (r.Registrant ?? '').toLowerCase().includes(orgName.toLowerCase())
  );

  matches.forEach((row, i) => {
    const draft = {
      org_slug: undefined, // fill in: slug for the Registrant (the lobbying firm)
      counterparty_org_slug: undefined, // fill in: slug for the Client
      date: undefined, // fill in from the quarter's reporting period
      sector: 'higher_education',
      activity_type: 'lobbying_activity',
      description: `Registrant "${row.Registrant}" declared client "${row.Client}" in the Registrar of Consultant Lobbyists return for ${row.Quarter}.`,
      source_ids: [], // fill in after archiving the quarterly return
      confidence: 'documented',
      added: new Date().toISOString().slice(0, 10),
      last_reviewed: new Date().toISOString().slice(0, 10),
      _raw_row: row,
    };
    const file = writeDraft('activities', `lobbying-register-${i}`, draft);
    console.log(`Wrote ${file}`);
  });

  console.log(`${matches.length} matching row(s) found for "${orgName}".`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
