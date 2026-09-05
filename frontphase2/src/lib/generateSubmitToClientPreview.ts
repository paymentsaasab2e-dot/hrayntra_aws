import {
  apiGetCandidate,
  apiGetClient,
  apiGetJob,
  apiSubmitMatch,
  apiUpdateCandidate,
  type BackendCandidate,
  type BackendClient,
  type BackendJob,
} from './api';
import { resolveSubmitJobIdFromBackend } from './candidateSubmitToClient';
import { clientToSubmitForm } from './submitToClientClientForm';
import {
  buildClientPresentationExtraData,
  resolveSubmitToClientEditForm,
} from './clientPresentationDraft';
import { resolveMatchIdForSubmit } from './jobAppliedMatches';
import { extractApiData, isValidObjectId } from './mapCandidateProfile';
import {
  buildClientPresentationExtraDataForPhase1,
  resolveSubmitPhase1Snapshot,
} from './phase1ClientPresentation';
import { isPhase1PortalCandidate } from './phase1ProfileSnapshot';
import {
  phase1SectionVisibilityFromSubmitFields,
  sectionVisibilityFromSubmitFields,
  SUBMIT_TO_CLIENT_FIELDS,
  type SubmitToClientFieldVisibility,
} from './submitToClientFieldVisibility';
import { loadSubmitToClientVisibilityDefaults } from './submitToClientFieldVisibilityDefaults';

export type BulkSubmitCandidateEntry = {
  candidateId: string;
  jobId: string;
  matchId?: string;
  candidateName?: string;
  jobTitle?: string;
  clientId?: string;
  matchScore?: number;
};

export type SubmitToClientPreviewResult = {
  reviewUrl: string;
  candidateNames: string[];
  visibleCount: number;
  hiddenCount: number;
  jobTitle: string;
  clientEmail: string;
  clientName: string;
};

function candidateDisplayName(candidate: BackendCandidate, fallback?: string): string {
  const fromParts = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
  return fromParts || String(fallback || '').trim() || 'Candidate';
}

function readSubmitMatchReviewUrl(raw: unknown): string | null {
  const envelope = (raw && typeof raw === 'object' ? raw : {}) as {
    data?: { reviewUrl?: string | null };
    reviewUrl?: string | null;
  };
  const nested =
    envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope;
  const reviewUrlRaw = nested.reviewUrl || envelope.reviewUrl;
  return typeof reviewUrlRaw === 'string' && reviewUrlRaw.trim() ? reviewUrlRaw.trim() : null;
}

function notifyCandidateSubmitted() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:interviews-changed'));
}

async function resolveClientMailContext(
  entries: BulkSubmitCandidateEntry[],
  preparedJobTitle: string,
): Promise<{ jobTitle: string; clientEmail: string; clientName: string }> {
  const first = entries[0];
  let jobTitle = preparedJobTitle || String(first?.jobTitle || '').trim();
  let clientId = String(first?.clientId || '').trim();
  let clientEmail = '';
  let clientName = '';
  const jobId = first?.jobId;

  if (jobId && isValidObjectId(jobId)) {
    try {
      const job = extractApiData<BackendJob>(await apiGetJob(jobId));
      if (!jobTitle) jobTitle = String(job.title || '').trim();
      if (!clientId) clientId = String(job.client?.id || '').trim();
      if (!clientName) clientName = String(job.client?.companyName || '').trim();
    } catch {
      // Compose still works without a prefilled client address.
    }
  }

  if (clientId && isValidObjectId(clientId)) {
    try {
      const client = extractApiData<BackendClient>(await apiGetClient(clientId));
      const form = clientToSubmitForm(client);
      clientEmail = String(form.directorEmail || '').trim();
      clientName = String(client.companyName || clientName).trim();
    } catch {
      // Ignore — user can type the address in Gmail/Outlook compose.
    }
  }

  return { jobTitle, clientEmail, clientName };
}

async function persistVisibleClientPresentation(
  candidateId: string,
  visibleFields: SubmitToClientFieldVisibility,
  fallbackName?: string,
): Promise<{ candidate: BackendCandidate; candidateName: string }> {
  const raw = await apiGetCandidate(candidateId);
  const candidate = extractApiData<BackendCandidate>(raw);
  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? { ...(candidate.extraData as Record<string, unknown>) }
      : {};

  const extraData = isPhase1PortalCandidate(candidate)
    ? buildClientPresentationExtraDataForPhase1(
        resolveSubmitPhase1Snapshot(candidate),
        candidate,
        extra,
        {
          phase1VisibleSections: phase1SectionVisibilityFromSubmitFields(visibleFields),
          visibleFields,
        },
      )
    : buildClientPresentationExtraData(resolveSubmitToClientEditForm(candidate), extra, {
        visibleSections: sectionVisibilityFromSubmitFields(visibleFields),
        visibleFields,
      });

  await apiUpdateCandidate(candidateId, { extraData });
  return {
    candidate,
    candidateName: candidateDisplayName(candidate, fallbackName),
  };
}

export async function generateSubmitToClientPreview(
  entries: BulkSubmitCandidateEntry[],
): Promise<SubmitToClientPreviewResult> {
  if (!entries.length) {
    throw new Error('Select at least one candidate to submit to the client.');
  }

  const { visibility } = await loadSubmitToClientVisibilityDefaults();
  const hiddenCount = SUBMIT_TO_CLIENT_FIELDS.filter((id) => visibility[id] === false).length;
  const visibleCount = SUBMIT_TO_CLIENT_FIELDS.length - hiddenCount;

  const prepared: Array<{
    entry: BulkSubmitCandidateEntry;
    matchId: string;
    candidateName: string;
    jobTitle: string;
  }> = [];

  for (const entry of entries) {
    const { candidate, candidateName } = await persistVisibleClientPresentation(
      entry.candidateId,
      visibility,
      entry.candidateName,
    );
    const resolvedJobId =
      entry.jobId && isValidObjectId(entry.jobId)
        ? entry.jobId
        : resolveSubmitJobIdFromBackend(candidate);
    if (!resolvedJobId) {
      throw new Error(
        `Unable to resolve a job for ${candidateName}. Assign them to a job first.`,
      );
    }

    const { matchId, error: matchError } = await resolveMatchIdForSubmit(
      entry.candidateId,
      resolvedJobId,
      entry.matchScore ?? 0,
      entry.matchId,
    );
    if (!matchId) {
      throw new Error(
        matchError || `Unable to create a match record for ${candidateName}.`,
      );
    }

    prepared.push({
      entry,
      matchId,
      candidateName,
      jobTitle: entry.jobTitle || '',
    });
  }

  const batchMatchIds = prepared.map((item) => item.matchId);
  let reviewUrl: string | null = null;

  for (let index = 0; index < prepared.length; index += 1) {
    const item = prepared[index]!;
    const submittedRaw = await apiSubmitMatch(item.matchId, {
      message: `Please review the submitted candidate details${
        item.jobTitle ? ` for ${item.jobTitle}` : ''
      }.`,
      notifyClient: false,
      submissionType: 'INITIAL_REVIEW',
      batchMatchIds: batchMatchIds.length > 1 ? batchMatchIds : undefined,
    });
    if (index === 0) {
      reviewUrl = readSubmitMatchReviewUrl(submittedRaw);
    }
  }

  if (!reviewUrl) {
    throw new Error('The client preview link could not be generated. Try again.');
  }

  notifyCandidateSubmitted();

  const mailContext = await resolveClientMailContext(
    entries,
    prepared.find((item) => item.jobTitle)?.jobTitle || '',
  );

  return {
    reviewUrl,
    candidateNames: prepared.map((item) => item.candidateName),
    visibleCount,
    hiddenCount,
    jobTitle: mailContext.jobTitle,
    clientEmail: mailContext.clientEmail,
    clientName: mailContext.clientName,
  };
}
