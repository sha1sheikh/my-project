import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPublishedOrganisations() {
  const all = await getCollection('organisations');
  return all.filter((o) => o.data.status === 'published');
}

export async function getAllOrganisations() {
  return getCollection('organisations');
}

export async function getSourceMap() {
  const sources = await getCollection('sources');
  const map = new Map<string, CollectionEntry<'sources'>['data']>();
  for (const s of sources) map.set(s.data.id, s.data);
  return map;
}

export async function getOrgBySlug(slug: string) {
  const all = await getCollection('organisations');
  return all.find((o) => o.data.slug === slug);
}

export async function getActivitiesForOrg(slug: string) {
  const all = await getCollection('activities');
  return all
    .filter((a) => a.data.org_slug === slug)
    .sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

export async function getFundingForOrg(slug: string) {
  const all = await getCollection('funding');
  return {
    in: all.filter((f) => f.data.recipient_org_slug === slug),
    out: all.filter((f) => f.data.funder_org_slug === slug),
  };
}

export async function getAffiliationsForOrg(slug: string) {
  const all = await getCollection('affiliations');
  return all.filter((a) => a.data.org_a_slug === slug || a.data.org_b_slug === slug);
}

export async function getRepliesForOrg(slug: string) {
  const all = await getCollection('right_of_reply');
  return all.filter((r) => r.data.org_slug === slug && r.data.published);
}

export async function getActivitiesForSector(sectorId: string) {
  const all = await getCollection('activities');
  return all
    .filter((a) => a.data.sector === sectorId)
    .sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

/** Stable, URL-safe id for a counterparty, derived from its name — there is
 * no separate counterparty collection, since a disclosure's counterparty is
 * just a {name, type} pair, not a tracked entity in its own right. */
export function slugifyCounterparty(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getAllDisclosures() {
  const all = await getCollection('disclosures');
  return all.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

export async function getDisclosuresForOrg(slug: string) {
  const all = await getAllDisclosures();
  return all.filter((d) => d.data.organisation === slug);
}

export async function getDisclosuresForCounterparty(counterpartySlug: string) {
  const all = await getAllDisclosures();
  return all.filter((d) => slugifyCounterparty(d.data.counterparty.name) === counterpartySlug);
}
