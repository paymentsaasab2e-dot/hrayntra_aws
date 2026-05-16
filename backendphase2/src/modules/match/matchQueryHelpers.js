/**
 * Prisma + MongoDB: `{ createdById: null }` does not match documents where the field is unset.
 * AI pipeline rows are created without `createdById`; query them with `isSet: false`.
 */
export const AI_MATCH_AUTHOR_WHERE = { isSet: false };

/** Manual recruiter-created matches always set `createdById` to a user ObjectId. */
export const MANUAL_MATCH_AUTHOR_WHERE = { isSet: true };
