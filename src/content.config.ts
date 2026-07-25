import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
} from './schemas';

// Data lives in /data at the repo root (not src/content) so it reads as a
// plain, source-controlled dataset independent of the site generator. Schemas
// are defined once in src/schemas.ts and shared with scripts/validate.ts.

const organisations = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/organisations' }),
  schema: organisationSchema,
});

const sources = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/sources' }),
  schema: sourceSchema,
});

const activities = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/activities' }),
  schema: activitySchema,
});

const funding = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/funding' }),
  schema: fundingSchema,
});

const affiliations = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/affiliations' }),
  schema: affiliationSchema,
});

const rightOfReply = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/right_of_reply' }),
  schema: rightOfReplySchema,
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/events' }),
  schema: eventSchema,
});

const corrections = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/corrections' }),
  schema: correctionSchema,
});

const submissions = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'data/submissions' }),
  schema: submissionSchema,
});

export const collections = {
  organisations,
  sources,
  activities,
  funding,
  affiliations,
  right_of_reply: rightOfReply,
  events,
  corrections,
  submissions,
};
