// Best-effort heuristic to catch personal names slipping into free text.
// Not a source of truth: real enforcement is the human moderation queue and
// the schema, which has no field for a person's name anywhere in the model.

const ORG_WORDS = new Set(
  [
    'University', 'College', 'Group', 'Ltd', 'Limited', 'Council', 'Commission',
    'Trust', 'Foundation', 'Association', 'Institute', 'Society', 'Union',
    'Committee', 'Board', 'Panel', 'Department', 'Ministry', 'Office', 'Agency',
    'Authority', 'Company', 'Charity', 'Consultants', 'Partners', 'Communications',
    'Affairs', 'Public', 'Higher', 'Education', 'National', 'British', 'Royal',
    'United', 'Kingdom', 'London', 'England', 'Scotland', 'Wales', 'Northern',
    'Ireland', 'International', 'Research', 'Policy', 'Alliance', 'Federation',
    'Confederation', 'Chamber', 'Bureau', 'Centre', 'Center', 'Network', 'Forum',
    'Secretariat', 'Directorate', 'Executive', 'Academy', 'School', 'Faculty',
    'Governors', 'Registrar', 'Vice', 'Chancellor', 'Parliament', 'Government',
    'House', 'Committee', 'Consultancy', 'Services', 'Solutions', 'Holdings',
    'Membership', 'Body', 'Modern', 'Russell', 'Million', 'Guild',
  ].map((w) => w.toLowerCase())
);

const TITLE_CASE_PAIR = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;

/** Returns true if the text contains what looks like a personal first+last name. */
export function containsLikelyPersonName(text: string): boolean {
  const matches = [...text.matchAll(TITLE_CASE_PAIR)];
  return matches.some(([, a, b]) => !ORG_WORDS.has(a.toLowerCase()) && !ORG_WORDS.has(b.toLowerCase()));
}

export function findLikelyPersonNames(text: string): string[] {
  const matches = [...text.matchAll(TITLE_CASE_PAIR)];
  return matches
    .filter(([, a, b]) => !ORG_WORDS.has(a.toLowerCase()) && !ORG_WORDS.has(b.toLowerCase()))
    .map(([full]) => full);
}
