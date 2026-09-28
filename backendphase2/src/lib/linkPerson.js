/**
 * Attach a stable personId to this tenant CRM (one human, one row).
 * Injected deps so tests do not need Mongo.
 */
export async function linkPersonToTenant(
  { personId, jobId } = {},
  { findExisting, findPurged, fetchCommon, materialize } = {},
) {
  const pid = String(personId || '').trim();
  if (!pid) {
    const err = new Error('personId is required');
    err.statusCode = 400;
    throw err;
  }

  const jobIds = String(jobId || '').trim() ? [String(jobId).trim()] : [];

  if (typeof findPurged === 'function') {
    const purged = await findPurged(pid);
    if (purged) {
      const err = new Error('This person cannot be re-added');
      err.statusCode = 409;
      err.code = 'PERSON_PURGED';
      throw err;
    }
  }

  const existing = typeof findExisting === 'function' ? await findExisting(pid) : null;
  if (existing?.id) {
    if (jobIds.length && typeof materialize === 'function') {
      await materialize({
        ...existing,
        personId: pid,
        assignedJobs: jobIds,
      });
    }
    return { candidateId: existing.id, created: false, attached: true };
  }

  const common = typeof fetchCommon === 'function' ? await fetchCommon(pid) : null;
  if (!common) {
    const err = new Error('Person not found');
    err.statusCode = 404;
    throw err;
  }

  if (typeof materialize !== 'function') {
    const err = new Error('Unable to attach person');
    err.statusCode = 500;
    throw err;
  }

  const row = await materialize({
    ...common,
    personId: pid,
    assignedJobs: jobIds.length ? jobIds : Array.isArray(common.assignedJobs) ? common.assignedJobs : [],
  });

  return { candidateId: row?.id || common.id, created: true, attached: true };
}
