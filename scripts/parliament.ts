#!/usr/bin/env tsx
/**
 * Looks up committee written evidence submitted by an organisation, via the
 * UK Parliament Committees API, and scaffolds an APPG register entry draft
 * (the APPG register itself has no stable JSON API — see the note below).
 *
 * Usage:
 *   tsx scripts/parliament.ts evidence "Universities UK"
 *   tsx scripts/parliament.ts appg "Universities UK" "APPG on Students"
 *
 * Committees API docs: https://committees-api.parliament.uk/swagger/ui/index
 *
 * Output: draft activity records under /drafts/activities/, for human
 * review — source_ids must point to a real archived copy of the evidence
 * submission or register page before use.
 */
import { writeDraft } from './lib/draft';

async function fetchWrittenEvidence(orgName: string) {
  const url = `https://committees-api.parliament.uk/api/Evidence/WrittenEvidence?SearchTerm=${encodeURIComponent(orgName)}&take=25`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Committees API request failed (${res.status}). Check current endpoint shape at https://committees-api.parliament.uk/swagger/ui/index`);
  }
  return res.json();
}

async function main() {
  const [mode, orgName, appgName] = process.argv.slice(2);

  if (mode === 'evidence') {
    if (!orgName) {
      console.error('Usage: tsx scripts/parliament.ts evidence "<organisation name>"');
      process.exit(1);
    }
    const body = await fetchWrittenEvidence(orgName);
    const items: any[] = body.items ?? body.Items ?? [];
    items.forEach((item, i) => {
      const draft = {
        org_slug: undefined, // fill in
        date: item.date ?? item.publicationDate ?? undefined,
        sector: 'higher_education',
        activity_type: 'committee_evidence',
        description: `Submitted written evidence to ${item.committeeName ?? item.inquiryName ?? 'a parliamentary committee'}.`,
        source_ids: [], // fill in after archiving the evidence document
        confidence: 'documented',
        added: new Date().toISOString().slice(0, 10),
        last_reviewed: new Date().toISOString().slice(0, 10),
        _raw: item,
      };
      const file = writeDraft('activities', `written-evidence-${i}`, draft);
      console.log(`Wrote ${file}`);
    });
    console.log(`${items.length} written evidence item(s) found for "${orgName}".`);
    return;
  }

  if (mode === 'appg') {
    if (!orgName || !appgName) {
      console.error('Usage: tsx scripts/parliament.ts appg "<organisation name>" "<APPG name>"');
      process.exit(1);
    }
    console.log(
      'The APPG register (https://publicappgregister.parliament.uk/) has no stable JSON API. ' +
        'Locate the APPG entry manually, then fill in this draft by hand.'
    );
    const draft = {
      org_slug: undefined,
      date: undefined,
      sector: 'higher_education',
      activity_type: 'parliamentary',
      description: `Listed as secretariat or benefit-in-kind provider to ${appgName} in the APPG register.`,
      source_ids: [],
      confidence: 'documented',
      added: new Date().toISOString().slice(0, 10),
      last_reviewed: new Date().toISOString().slice(0, 10),
    };
    const file = writeDraft('activities', `appg-${appgName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, draft);
    console.log(`Wrote template ${file}`);
    return;
  }

  console.error('Usage: tsx scripts/parliament.ts <evidence|appg> ...');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
