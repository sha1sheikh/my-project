#!/usr/bin/env tsx
/**
 * Fetches a company profile and filing history from Companies House.
 *
 * Uses ONLY the company profile and filing-history endpoints. Deliberately
 * does NOT call /officers, /persons-with-significant-control, or
 * /appointments — this register carries no individual-level data, and those
 * endpoints return named people.
 *
 * Usage:
 *   COMPANIES_HOUSE_API_KEY=xxx tsx scripts/companies-house.ts 01234567
 *
 * Get a free API key at https://developer.company-information.service.gov.uk/
 *
 * Output: a draft organisation fragment and a draft source record (the
 * filing history entry list) under /drafts/, for human review.
 */
import { writeDraft } from './lib/draft';

const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const BASE = 'https://api.company-information.service.gov.uk';

async function get(path: string) {
  if (!API_KEY) {
    throw new Error('Set COMPANIES_HOUSE_API_KEY in the environment.');
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}` },
  });
  if (!res.ok) {
    throw new Error(`Companies House request failed (${res.status}): ${path}`);
  }
  return res.json();
}

async function main() {
  const companyNumber = process.argv[2];
  if (!companyNumber) {
    console.error('Usage: tsx scripts/companies-house.ts <company_number>');
    process.exit(1);
  }

  const profile = await get(`/company/${companyNumber}`);
  const filingHistory = await get(`/company/${companyNumber}/filing-history`);

  const orgDraft = {
    slug: undefined, // fill in: a short lowercase-hyphen slug
    legal_name: profile.company_name,
    other_names: [],
    legal_type: 'company',
    companies_house_number: companyNumber,
    charity_number: undefined,
    jurisdiction: profile.jurisdiction ?? 'United Kingdom',
    founded: profile.date_of_creation,
    website: undefined,
    summary: undefined, // fill in: neutral, factual, <=300 chars
    sectors: [],
    geography: [],
    status: 'under_review',
    _source_note: `Companies House company profile, status: ${profile.company_status}`,
  };

  const filings = (filingHistory.items ?? []).slice(0, 20).map((item: any) => ({
    date: item.date,
    type: item.type,
    description: item.description,
    category: item.category,
  }));

  const file1 = writeDraft('organisations', companyNumber, orgDraft);
  const file2 = writeDraft('activities', `${companyNumber}-filing-history`, {
    _note: 'Raw filing history for reference — turn individual filings into activity records with real source_ids once archived.',
    filings,
  });

  console.log(`Wrote ${file1}`);
  console.log(`Wrote ${file2}`);
  console.log('Next: run scripts/archive.ts against the Companies House profile URL to get an archive_url, then create a proper source + organisation record in /data.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
