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
import {
  CLIENT_TRACKER_OPTION_DEFAULTS,
  normalizeClientTrackerOptions,
  type ClientTrackerOptions,
} from './clientTrackerOptions';

export type BulkSubmitCandidateEntry = {
  candidateId: string;
  jobId: string;
  matchId?: string;
  candidateName?: string;
  jobTitle?: string;
  clientId?: string;
  matchScore?: number;
  /** Which CV the client should see: original resume, edited profile CV, or HRYantra annotated CV. */
  cvShareMode?: 'edited' | 'original' | 'saasa';
};

export type SubmitToClientPreviewResult = {
  reviewUrl: string;
  candidateNames: string[];
  visibleCount: number;
  hiddenCount: number;
  jobTitle: string;
  clientEmail: string;
  clientName: string;
  matchId: string;
  batchMatchIds: string[];
  trackerOptions: ClientTrackerOptions;
};

/** Keep API pressure reasonable while still parallelizing bulk preview generation. */
const PREVIEW_CONCURRENCY = 5;

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

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index]!, index);
      }
    }),
  );

  return results;
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

  const jobPromise =
    jobId && isValidObjectId(jobId)
      ? apiGetJob(jobId)
          .then((raw) => extractApiData<BackendJob>(raw))
          .catch(() => null)
      : Promise.resolve(null);

  const job = await jobPromise;
  if (job) {
    if (!jobTitle) jobTitle = String(job.title || '').trim();
    if (!clientId) clientId = String(job.client?.id || '').trim();
    if (!clientName) clientName = String(job.client?.companyName || '').trim();
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

/**
 * Original / HRYantra CV shares do not need the edited presentation draft write —
 * skipping that get+update pair is the main speed win for those modes.
 */
function needsPresentationPersist(cvShareMode?: BulkSubmitCandidateEntry['cvShareMode']): boolean {
  return !cvShareMode || cvShareMode === 'edited';
}

async function prepareEntryForPreview(
  entry: BulkSubmitCandidateEntry,
  visibility: SubmitToClientFieldVisibility,
): Promise<{
  entry: BulkSubmitCandidateEntry;
  matchId: string;
  candidateName: string;
  jobTitle: string;
}> {
  let candidate: BackendCandidate | null = null;
  let candidateName = String(entry.candidateName || '').trim() || 'Candidate';

  if (needsPresentationPersist(entry.cvShareMode)) {
    const persisted = await persistVisibleClientPresentation(
      entry.candidateId,
      visibility,
      entry.candidateName,
    );
    candidate = persisted.candidate;
    candidateName = persisted.candidateName;
  } else if (!entry.jobId || !isValidObjectId(entry.jobId)) {
    const raw = await apiGetCandidate(entry.candidateId);
    candidate = extractApiData<BackendCandidate>(raw);
    candidateName = candidateDisplayName(candidate, entry.candidateName);
  }

  const resolvedJobId =
    entry.jobId && isValidObjectId(entry.jobId)
      ? entry.jobId
      : candidate
        ? resolveSubmitJobIdFromBackend(candidate)
        : '';
  if (!resolvedJobId) {
    throw new Error(`Unable to resolve a job for ${candidateName}. Assign them to a job first.`);
  }

  const { matchId, error: matchError } = await resolveMatchIdForSubmit(
    entry.candidateId,
    resolvedJobId,
    entry.matchScore ?? 0,
    entry.matchId,
  );
  if (!matchId) {
    throw new Error(matchError || `Unable to create a match record for ${candidateName}.`);
  }

  return {
    entry,
    matchId,
    candidateName,
    jobTitle: entry.jobTitle || '',
  };
}

export async function generateSubmitToClientPreview(
  entries: BulkSubmitCandidateEntry[],
): Promise<SubmitToClientPreviewResult> {
  if (!entries.length) {
    throw new Error('Select at least one candidate to submit to the client.');
  }

  const [{ visibility }, mailContextEarly] = await Promise.all([
    loadSubmitToClientVisibilityDefaults(),
    resolveClientMailContext(entries, String(entries[0]?.jobTitle || '').trim()),
  ]);
  const hiddenCount = SUBMIT_TO_CLIENT_FIELDS.filter((id) => visibility[id] === false).length;
  const visibleCount = SUBMIT_TO_CLIENT_FIELDS.length - hiddenCount;

  const prepared = await mapPool(entries, PREVIEW_CONCURRENCY, (entry) =>
    prepareEntryForPreview(entry, visibility),
  );

  const batchMatchIds = prepared.map((item) => item.matchId);
  const trackerOptions = normalizeClientTrackerOptions(CLIENT_TRACKER_OPTION_DEFAULTS, true);
  const messageJobTitle =
    prepared.find((item) => item.jobTitle)?.jobTitle || mailContextEarly.jobTitle || '';

  const submitResults = await mapPool(prepared, PREVIEW_CONCURRENCY, async (item) => {
    const submittedRaw = await apiSubmitMatch(item.matchId, {
      message: `Please review the submitted candidate details${
        messageJobTitle ? ` for ${messageJobTitle}` : ''
      }.`,
      notifyClient: false,
      previewOnly: true,
      submissionType: 'INITIAL_REVIEW',
      batchMatchIds: batchMatchIds.length > 1 ? batchMatchIds : undefined,
      trackerOptions,
      ...(item.entry.cvShareMode ? { cvShareMode: item.entry.cvShareMode } : {}),
    });
    return readSubmitMatchReviewUrl(submittedRaw);
  });

  const reviewUrl = submitResults.find((url) => Boolean(url)) || null;
  if (!reviewUrl) {
    throw new Error('The client preview link could not be generated. Try again.');
  }

  notifyCandidateSubmitted();

  return {
    reviewUrl,
    candidateNames: prepared.map((item) => item.candidateName),
    visibleCount,
    hiddenCount,
    jobTitle: mailContextEarly.jobTitle || messageJobTitle,
    clientEmail: mailContextEarly.clientEmail,
    clientName: mailContextEarly.clientName,
    matchId: prepared[0]!.matchId,
    batchMatchIds,
    trackerOptions,
  };
}
