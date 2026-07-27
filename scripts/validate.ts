#!/usr/bin/env tsx
/**
 * Validates every YAML file in /data against the Zod schemas in src/schemas.ts
 * and enforces the editorial/legal rules from the project spec. Exits with a
 * non-zero status (failing the build/CI) on any error. Run manually with
 * `npm run validate`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import {
  organisationSchema,
  sourceSchema,
  activitySchema,
  fundingSchema,
  affiliationSchema,
  rightOfReplySchema,
  eventSchema,
  correctionSchema,
  submissionSchema,
  disclosureSchema,
} from '../src/schemas';

const DATA_DIR = join(import.meta.dirname, '..', 'data');

// Any of these keys anywhere in a data file is an automatic, unconditional
// build failure. This is a second, independent layer of defence on top of
// z.object(...).strict() — the schemas already have no such fields, so this
// mainly guards against future schema drift and against non-schema files.
const FORBIDDEN_KEYS = [
  'person',
  'persons',
  'people',
  'individual',
  'individuals',
  'officer',
  'officers',
  'trustee',
  'trustees',
  'director_name',
  'named_person',
  'name_of_person',
  'full_name',
  'first_name',
  'last_name',
  'surname',
  'allegation',
  'allegations',
  'offence',
  'offences',
  'offense',
  'offenses',
  'severity',
  'rating',
  'ratings',
  'score',
  'evaluation',
];

interface Issue {
  file: string;
  message: string;
}

const errors: Issue[] = [];
const warnings: Issue[] = [];

function loadYamlFiles(dir: string): { file: string; data: unknown }[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => extname(f) === '.yaml' || extname(f) === '.yml')
    .map((f) => {
      const file = join(dir, f);
      const raw = readFileSync(file, 'utf-8');
      const data = loadYaml(raw);
      return { file, data };
    });
}

function scanForbiddenKeys(file: string, data: unknown, path = ''): void {
  if (data === null || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    data.forEach((item, i) => scanForbiddenKeys(file, item, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    const segments = lower.split('_');
    const isForbidden = FORBIDDEN_KEYS.includes(lower) || segments.some((s) => FORBIDDEN_KEYS.includes(s));
    if (isForbidden) {
      errors.push({
        file,
        message: `forbidden key "${path}${path ? '.' : ''}${key}" is not permitted anywhere in the data model (person/officer/trustee/evaluative fields are banned, including as part of a compound key)`,
      });
    }
    scanForbiddenKeys(file, value, `${path}${path ? '.' : ''}${key}`);
  }
}

// A crude two-word Title Case pattern, used only to flag free-text
// description fields for human review — it does not fail the build, since
// organisation names ("Russell Group", "GuildHE") are themselves often
// title-cased. See src/lib/nameGuard.ts for the shared implementation used
// by the /submit form, where the same heuristic *does* block submission.
const TITLE_CASE_PAIR = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
const ORG_WORD = new Set(
  [
    'University', 'College', 'Group', 'Council', 'Commission', 'Trust',
    'Foundation', 'Association', 'Institute', 'Society', 'Union', 'Committee',
    'Board', 'Panel', 'Department', 'Ministry', 'Office', 'Agency', 'Authority',
    'Company', 'Charity', 'Communications', 'Affairs', 'Public', 'Higher',
    'Education', 'National', 'British', 'Royal', 'United', 'Kingdom', 'London',
    'England', 'Scotland', 'Wales', 'Northern', 'Ireland', 'International',
    'Research', 'Policy', 'Alliance', 'Federation', 'Confederation', 'Chamber',
    'Bureau', 'Centre', 'Center', 'Network', 'Forum', 'Secretariat',
    'Directorate', 'Executive', 'Academy', 'School', 'Faculty', 'Governors',
    'Registrar', 'Parliament', 'Government', 'House', 'Consultancy',
    'Services', 'Solutions', 'Holdings', 'Membership', 'Body', 'Modern',
    'Russell', 'Million', 'Guild',
  ].map((w) => w.toLowerCase())
);

function flagPossibleNames(file: string, text: string, field: string) {
  const matches = [...text.matchAll(TITLE_CASE_PAIR)];
  for (const m of matches) {
    const [a, b] = m[0].split(/\s+/);
    if (!ORG_WORD.has(a.toLowerCase()) && !ORG_WORD.has(b.toLowerCase())) {
      warnings.push({
        file,
        message: `field "${field}" contains a title-case two-word pattern ("${m[0]}") — flagged for human review to confirm it is not a personal name`,
      });
    }
  }
}

function monthsSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function main() {
  const organisations = loadYamlFiles(join(DATA_DIR, 'organisations'));
  const sources = loadYamlFiles(join(DATA_DIR, 'sources'));
  const activities = loadYamlFiles(join(DATA_DIR, 'activities'));
  const funding = loadYamlFiles(join(DATA_DIR, 'funding'));
  const affiliations = loadYamlFiles(join(DATA_DIR, 'affiliations'));
  const rightOfReply = loadYamlFiles(join(DATA_DIR, 'right_of_reply'));
  const events = loadYamlFiles(join(DATA_DIR, 'events'));
  const corrections = loadYamlFiles(join(DATA_DIR, 'corrections'));
  const submissions = loadYamlFiles(join(DATA_DIR, 'submissions'));
  const disclosures = loadYamlFiles(join(DATA_DIR, 'disclosures'));

  const all = [
    ...organisations, ...sources, ...activities, ...funding, ...affiliations,
    ...rightOfReply, ...events, ...corrections, ...submissions, ...disclosures,
  ];
  for (const { file, data } of all) scanForbiddenKeys(file, data);

  const orgSlugs = new Set<string>();
  for (const { file, data } of organisations) {
    const result = organisationSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    orgSlugs.add(result.data.slug);
    flagPossibleNames(file, result.data.summary, 'summary');
  }

  const sourceIds = new Set<string>();
  for (const { file, data } of sources) {
    const result = sourceSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    if (!result.data.archive_url || result.data.archive_url.trim() === '') {
      errors.push({ file, message: 'source has an empty archive_url' });
    }
    sourceIds.add(result.data.id);
  }

  function checkSourceIds(file: string, ids: string[]) {
    if (ids.length < 1) {
      errors.push({ file, message: 'record must cite at least one source' });
    }
    for (const id of ids) {
      if (!sourceIds.has(id)) {
        errors.push({ file, message: `references unknown source_id "${id}"` });
      }
    }
  }

  function checkOrgSlug(file: string, field: string, slug: string | null | undefined) {
    if (slug && !orgSlugs.has(slug)) {
      errors.push({ file, message: `${field} references unknown organisation slug "${slug}"` });
    }
  }

  const activityIds = new Set<string>();
  for (const { file, data } of activities) {
    const result = activitySchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    activityIds.add(result.data.id);
    checkSourceIds(file, result.data.source_ids);
    checkOrgSlug(file, 'org_slug', result.data.org_slug);
    checkOrgSlug(file, 'counterparty_org_slug', result.data.counterparty_org_slug);
    flagPossibleNames(file, result.data.description, 'description');
    if (monthsSince(result.data.last_reviewed) > 12) {
      warnings.push({ file, message: `not reviewed in over 12 months (last_reviewed: ${result.data.last_reviewed})` });
    }
  }

  for (const { file, data } of funding) {
    const result = fundingSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    checkSourceIds(file, result.data.source_ids);
    checkOrgSlug(file, 'funder_org_slug', result.data.funder_org_slug);
    checkOrgSlug(file, 'recipient_org_slug', result.data.recipient_org_slug);
  }

  for (const { file, data } of affiliations) {
    const result = affiliationSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    checkSourceIds(file, result.data.source_ids);
    checkOrgSlug(file, 'org_a_slug', result.data.org_a_slug);
    checkOrgSlug(file, 'org_b_slug', result.data.org_b_slug);
  }

  for (const { file, data } of rightOfReply) {
    const result = rightOfReplySchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    checkOrgSlug(file, 'org_slug', result.data.org_slug);
  }

  for (const { file, data } of events) {
    const result = eventSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    for (const id of result.data.activity_ids) {
      if (!activityIds.has(id)) {
        errors.push({ file, message: `references unknown activity id "${id}"` });
      }
    }
  }

  for (const { file, data } of corrections) {
    const result = correctionSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    checkOrgSlug(file, 'org_slug', result.data.org_slug);
  }

  for (const { file, data } of submissions) {
    const result = submissionSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
    }
  }

  for (const { file, data } of disclosures) {
    const result = disclosureSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, message: `${issue.path.join('.')}: ${issue.message}` });
      }
      continue;
    }
    checkOrgSlug(file, 'organisation', result.data.organisation);
    if (!result.data.source.archive_url || result.data.source.archive_url.trim() === '') {
      errors.push({ file, message: 'disclosure has an empty source.archive_url' });
    }
  }

  // Duplicate id/slug checks across each collection.
  function checkDuplicates(label: string, files: { file: string; data: unknown }[], keyFn: (d: any) => string | undefined) {
    const seen = new Map<string, string>();
    for (const { file, data } of files) {
      const key = keyFn(data as any);
      if (!key) continue;
      if (seen.has(key)) {
        errors.push({ file, message: `duplicate ${label} "${key}" also used in ${seen.get(key)}` });
      } else {
        seen.set(key, file);
      }
    }
  }
  checkDuplicates('organisation slug', organisations, (d) => d?.slug);
  checkDuplicates('source id', sources, (d) => d?.id);
  checkDuplicates('activity id', activities, (d) => d?.id);
  checkDuplicates('disclosure id', disclosures, (d) => d?.id);

  console.log(`Checked ${organisations.length} organisations, ${sources.length} sources, ${activities.length} activities, ${funding.length} funding records, ${affiliations.length} affiliations, ${rightOfReply.length} right-of-reply entries, ${events.length} events, ${corrections.length} corrections, ${submissions.length} queued submissions, ${disclosures.length} disclosures.\n`);

  if (warnings.length > 0) {
    console.warn(`${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  [warn] ${w.file}: ${w.message}`);
    console.warn('');
  }

  if (errors.length > 0) {
    console.error(`${errors.length} error(s):`);
    for (const e of errors) console.error(`  [error] ${e.file}: ${e.message}`);
    console.error('\nValidation failed.');
    process.exit(1);
  }

  console.log('Validation passed.');
}

main();
