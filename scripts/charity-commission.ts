#!/usr/bin/env tsx
/**
 * Fetches a charity's register entry, income/expenditure and grant-making
 * activity from the Charity Commission for England & Wales register API.
 *
 * Deliberately does NOT fetch trustee data. This register carries no
 * individual-level data of any kind.
 *
 * Usage:
 *   CHARITY_COMMISSION_API_KEY=xxx tsx scripts/charity-commission.ts 123456
 *
 * Requires a subscription key from https://register-of-charities.charitycommission.gov.uk/register/api
 * (Ocp-Apim-Subscription-Key header).
 *
 * Output: a draft organisation fragment under /drafts/, for human review.
 */
import { writeDraft } from './lib/draft';

const API_KEY = process.env.CHARITY_COMMISSION_API_KEY;
const BASE = 'https://api.charitycommission.gov.uk/register/api';

async function get(path: string) {
  if (!API_KEY) {
    throw new Error('Set CHARITY_COMMISSION_API_KEY in the environment.');
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Ocp-Apim-Subscription-Key': API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Charity Commission request failed (${res.status}): ${path}`);
  }
  return res.json();
}

async function main() {
  const charityNumber = process.argv[2];
  if (!charityNumber) {
    console.error('Usage: tsx scripts/charity-commission.ts <charity_number>');
    process.exit(1);
  }

  const charity = await get(`/allcharitydetails/${charityNumber}/0`);
  const financial = await get(`/charityfinancialhistory/${charityNumber}`).catch(() => undefined);

  const orgDraft = {
    slug: undefined,
    legal_name: charity.charity_name,
    other_names: [],
    legal_type: 'charity',
    companies_house_number: undefined,
    charity_number: String(charityNumber),
    jurisdiction: 'England and Wales',
    founded: charity.date_of_registration,
    website: charity.web ?? undefined,
    summary: undefined,
    sectors: [],
    geography: [],
    status: 'under_review',
    _source_note: `Charity Commission register entry, activities: ${charity.charity_activities ?? 'n/a'}`,
    _financial_history: financial ?? 'not fetched',
  };

  const file = writeDraft('organisations', `charity-${charityNumber}`, orgDraft);
  console.log(`Wrote ${file}`);
  console.log('Next: run scripts/archive.ts against the register URL to get an archive_url, then create a proper source + organisation record in /data.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
