#!/usr/bin/env tsx
/**
 * Queries 360Giving GrantNav for grants to or from a given organisation name,
 * and outputs draft funding records with the counterparty set.
 *
 * Usage:
 *   tsx scripts/grants.ts recipient "Universities UK"
 *   tsx scripts/grants.ts funder "Wellcome Trust"
 *
 * GrantNav's public search API: https://grantnav.threesixtygiving.org/api/grants.json?q=...
 * Docs: https://grantnav.threesixtygiving.org/
 *
 * Output: draft funding records under /drafts/funding/, for human review —
 * amount_band and financial_year should be checked against the grant, and
 * source_ids must point to a real archived source record before use.
 */
import { writeDraft } from './lib/draft';

function toAmountBand(amount: number): string {
  if (amount < 10_000) return 'under_10k';
  if (amount < 50_000) return '10k_50k';
  if (amount < 100_000) return '50k_100k';
  if (amount < 500_000) return '100k_500k';
  if (amount < 1_000_000) return '500k_1m';
  return 'over_1m';
}

async function main() {
  const [role, orgName] = process.argv.slice(2);
  if (!role || !orgName || !['recipient', 'funder'].includes(role)) {
    console.error('Usage: tsx scripts/grants.ts <recipient|funder> "<organisation name>"');
    process.exit(1);
  }

  const url = `https://grantnav.threesixtygiving.org/api/grants.json?q=${encodeURIComponent(orgName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GrantNav request failed (${res.status})`);
  }
  const body = await res.json();
  const grants: any[] = body.grants ?? [];

  let count = 0;
  for (const grant of grants) {
    const recipientName = grant.recipientOrganization?.[0]?.name;
    const funderName = grant.fundingOrganization?.[0]?.name;
    const matchField = role === 'recipient' ? recipientName : funderName;
    if (!matchField || !matchField.toLowerCase().includes(orgName.toLowerCase())) continue;

    const draft = {
      funder_org_slug: null,
      funder_name: funderName,
      recipient_org_slug: null, // fill in a real slug if the recipient is in the directory, else leave null
      recipient_name: recipientName,
      amount_band: grant.amountAwarded ? toAmountBand(grant.amountAwarded) : 'undisclosed',
      financial_year: (grant.awardDate ?? '').slice(0, 4),
      source_ids: [], // fill in after archiving the grant's source URL
      _grant_id: grant.id,
      _amount_awarded_raw: grant.amountAwarded,
      _title: grant.title,
      _source_url: grant.sourceOrganization?.identifier ?? undefined,
    };

    const file = writeDraft('funding', `grant-${grant.id ?? count}`, draft);
    console.log(`Wrote ${file}`);
    count++;
  }

  console.log(`${count} matching grant(s) found for ${role} "${orgName}".`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
