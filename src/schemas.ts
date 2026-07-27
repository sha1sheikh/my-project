import { z } from 'zod';

// Single source of truth for the data model. Used both by Astro's content
// collections (src/content/config.ts) and by the standalone validator
// (scripts/validate.ts), so the two can never silently diverge.

export const legalType = z.enum([
  'charity',
  'company',
  'membership_body',
  'trade_association',
  'think_tank',
  'unincorporated',
  'other',
]);

export const sector = z.enum([
  'higher_education',
  'health',
  'public_affairs',
  'security',
  'media',
  'politics',
  'legal_affairs',
  'government_affairs',
  'community',
]);

export const orgStatus = z.enum(['published', 'under_review', 'right_of_reply_pending']);

export const sourceType = z.enum([
  'statutory_filing',
  'foi_response',
  'grant_register',
  'lobbying_register',
  'parliamentary_record',
  'consultation_response',
  'primary_publication',
  'press_release',
  'press_report',
  'other',
]);

export const activityType = z.enum([
  'funding',
  'lobbying_activity',
  'lobbying_meeting',
  'consultation_response',
  'committee_evidence',
  'parliamentary',
  'institutional_policy',
  'campaign',
  'open_letter',
  'public_submission',
  'other',
]);

export const confidence = z.enum(['documented', 'reported']);

export const relationshipType = z.enum([
  'parent',
  'subsidiary',
  'affiliated_with',
  'member_of',
  'coalition_partner',
  'secretariat_of',
  'shares_registered_address',
]);

export const amountBand = z.enum([
  'under_10k',
  '10k_50k',
  '50k_100k',
  '100k_500k',
  '500k_1m',
  'over_1m',
  'undisclosed',
]);

export const registerType = z.enum([
  'consultant_lobbyist',
  'appg_secretariat',
  'declared_donation',
  'committee_evidence',
  'public_contract',
  'disclosed_meeting',
  'rmfi_declaration',
]);

export const counterpartyType = z.enum([
  'university',
  'government_department',
  'appg',
  'select_committee',
  'funder',
  'other',
]);

export const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'must be a lowercase slug');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');

export const organisationSchema = z
  .object({
    slug,
    legal_name: z.string().min(1),
    other_names: z.array(z.string()).default([]),
    legal_type: legalType,
    companies_house_number: z.string().optional(),
    charity_number: z.string().optional(),
    jurisdiction: z.string().min(1),
    founded: z.string().optional(),
    website: z.string().url().optional(),
    summary: z.string().max(300, 'summary must be 300 characters or fewer').min(1),
    sectors: z.array(sector).min(1),
    geography: z.array(z.string()).min(1),
    status: orgStatus,
  })
  .strict();

export const sourceSchema = z
  .object({
    id: slug,
    type: sourceType,
    publisher: z.string().min(1),
    title: z.string().min(1),
    date: isoDate,
    original_url: z.string().url(),
    archive_url: z.string().url().min(1, 'archive_url is required'),
    retrieved_on: isoDate,
    quote_excerpt: z.string().optional(),
  })
  .strict();

export const activitySchema = z
  .object({
    id: slug,
    org_slug: slug,
    date: isoDate,
    sector,
    activity_type: activityType,
    description: z.string().min(1),
    amount: z.string().optional(),
    counterparty_org_slug: slug.optional(),
    source_ids: z.array(slug).min(1, 'at least one source is required'),
    confidence,
    added: isoDate,
    last_reviewed: isoDate,
  })
  .strict();

export const fundingSchema = z
  .object({
    id: slug,
    funder_org_slug: slug.nullable(),
    funder_name: z.string().min(1),
    recipient_org_slug: slug.nullable(),
    recipient_name: z.string().min(1),
    amount_band: amountBand,
    financial_year: z.string().min(1),
    source_ids: z.array(slug).min(1, 'at least one source is required'),
  })
  .strict();

export const affiliationSchema = z
  .object({
    id: slug,
    org_a_slug: slug,
    org_b_slug: slug,
    relationship_type: relationshipType,
    start: z.string().optional(),
    end: z.string().optional(),
    source_ids: z.array(slug).min(1, 'at least one source is required'),
  })
  .strict();

export const rightOfReplySchema = z
  .object({
    id: slug,
    org_slug: slug,
    received: isoDate,
    respondent_role: z.string().min(1),
    text: z.string().min(1),
    published: z.boolean(),
  })
  .strict();

export const eventSchema = z
  .object({
    slug,
    name: z.string().min(1),
    summary: z.string().max(300).optional(),
    date: z.string().optional(),
    activity_ids: z.array(slug).min(1),
  })
  .strict();

// disclosure: one documented act on one named public register. Deliberately
// has no freeform prose field and no field for a named individual — every
// value is either a controlled enum, a short label, a date, or a URL. See
// scripts/validate.ts FORBIDDEN_KEYS for the second layer of defence against
// a person-shaped field being added here later.
export const disclosureSchema = z
  .object({
    id: slug,
    organisation: slug,
    register_type: registerType,
    date: isoDate,
    date_end: isoDate.optional(),
    counterparty: z
      .object({
        name: z.string().min(1).max(120, 'counterparty.name must be a short label, not prose'),
        type: counterpartyType,
      })
      .strict(),
    source: z
      .object({
        original_url: z.string().url(),
        archive_url: z.string().url().min(1, 'archive_url is required'),
        retrieved_on: isoDate,
      })
      .strict(),
    last_verified: isoDate,
  })
  .strict();

export const correctionSchema = z
  .object({
    id: slug,
    date: isoDate,
    org_slug: slug.optional(),
    action: z.enum(['correction', 'removal', 'reply_added']),
    description: z.string().min(1),
    source_url: z.string().url().optional(),
  })
  .strict();

export const submissionSchema = z
  .object({
    id: slug,
    submitted_at: isoDate,
    org_guess: z.string().min(1),
    claim_text: z.string().min(1),
    source_urls: z.array(z.string().url()).min(1),
    notes: z.string().optional(),
    status: z.enum(['new', 'verifying', 'accepted', 'rejected']),
    reviewer_notes: z.string().optional(),
  })
  .strict();
