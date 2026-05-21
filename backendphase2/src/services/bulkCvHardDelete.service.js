import { permanentDeleteCandidateById } from './candidatePermanentDelete.service.js';

/** @deprecated Prefer permanentDeleteCandidateById — kept for bulk CV replace flow. */
export async function hardDeleteCandidateById(candidateId) {
  return permanentDeleteCandidateById(candidateId);
}
