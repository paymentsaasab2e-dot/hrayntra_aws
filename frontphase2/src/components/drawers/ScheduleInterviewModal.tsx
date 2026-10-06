'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../lib/quickSearch';
import { AnimatePresence, motion } from 'motion/react';
import { DrawerLinkActions } from './DrawerLinkActions';
import { formatDateDMY } from '../../utils/dateDisplay';
import { requestError } from '../../lib/appDialog';
import { orEmpty, startAsyncLoad } from '../../lib/asyncLoadGuard';
import { Calendar, Check, ChevronDown, AlertTriangle, MapPin, Clock, Phone, Plus, Search, Trash2, Video, X } from 'lucide-react';
import { apiAppendInterviewType, apiGenerateCandidateInterviewMeetingLink, apiGetCandidate, apiGetCandidates, apiGetClient, apiGetClients, apiGetInterviewTypeCatalog, apiGetInterviews, apiGetJobs, apiGetWorkspaceClient, apiRemoveInterviewType, getCachedOrgRecruitmentMode, type BackendCandidate } from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import { getAllTeamMembersForAssign, getLineManagersForJobPicker, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { useAssignableMembers } from '../../hooks/useAssignableMembers';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';
import { assigneeCompanyId, formatAssigneeDisplayName } from '../../lib/assigneeDisplay';
import { toast } from 'sonner';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import { clampDateToMinLocal, getLocalTimeInputMinNow, openNativeDateTimePicker } from '../../utils/dateInputConstraints';
import { computeNextInterviewRound, extractEditableInterviewNotes, interviewTime12hToInputValue, interviewTimeInputValueTo12h, mergeEditableInterviewNotesWithAudit } from '../../lib/interview-schedule-helpers';
import { ClientTimezoneSelect } from '../clients/ClientTimezoneSelect';
import { DEFAULT_INTERVIEW_TIMEZONE, formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';
import { getYmdInTimeZone } from '../../utils/zonedDateTime';
import type { CandidateScheduledInterview } from './candidateProfileDrawerData';
import { CandidateInterviewerOption, CandidatePipelineJobOption, INTERVIEW_DURATIONS, INTERVIEW_PANEL_ROLES, INTERVIEW_TYPES, InterviewerInitialsAvatar, ScheduleClientContactOption, ScheduleInterviewCandidateOption, ScheduleInterviewModalProps, getAvatarInitials, inferPlatformFromMeetingLink, isActiveScheduledInterview, isOpenScheduleJobStatus, mapInterviewListItemToScheduled, mapJobsToPipelineOptions, mergeInterviewTypeOptions, normalizePopupInterviewMode } from './candidateProfileShared';

export function ScheduleInterviewModal({
  candidate: fixedCandidate,
  candidateOptions,
  linkedJobLabel,
  linkedJobTitle,
  linkedJobCompany,
  initialJobId,
  jobs: jobsList,
  interviewers: _interviewersList,
  existingInterviews: existingInterviewsList,
  isOpen,
  onClose,
  onSchedule,
  onUpdate,
  editInterview,
  onScheduledSuccess,
}: ScheduleInterviewModalProps) {
  const jobsProp = orEmpty(jobsList);
  const existingInterviews = orEmpty(existingInterviewsList);
  /** Stable signature so parent inline `.map()` props do not restart option loads / remount animations. */
  const jobsPropSignature = useMemo(
    () => jobsProp.map((job) => `${job.id}:${job.clientId || ''}:${job.title || ''}`).join('|'),
    [jobsProp],
  );
  const jobsPropRef = useRef(jobsProp);
  jobsPropRef.current = jobsProp;
  const isStandaloneMode = getCachedOrgRecruitmentMode() === 'standalone';
  const interviewCompanySeed = String(
    jobsProp.find((job) => job.id === String(initialJobId || ''))?.orgUnitId ||
      jobsProp.find((job) => job.id === String(fixedCandidate?.assignedJobId || ''))?.orgUnitId ||
      getActiveOrgUnitId() ||
      '',
  ).trim();
  const assignableInterviewers = useAssignableMembers(isOpen, 'Interviews', {
    initialCompanyId: interviewCompanySeed,
  });
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidatePickerOpen, setCandidatePickerOpen] = useState(false);
  const [remoteCandidateOptions, setRemoteCandidateOptions] = useState<
    ScheduleInterviewCandidateOption[]
  >([]);
  const [loadingCandidateOptions, setLoadingCandidateOptions] = useState(false);
  const hydratedPrimaryCandidateRef = useRef('');
  const [interviewType, setInterviewType] = useState('');
  const [roundNumber, setRoundNumber] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [timezone, setTimezone] = useState(DEFAULT_INTERVIEW_TIMEZONE);
  const [mode, setMode] = useState<'video' | 'in-person' | 'phone' | ''>('');
  const [meetingPlatform, setMeetingPlatform] = useState<'Google Meet' | 'Zoom' | null>(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [generatingMeetingLink, setGeneratingMeetingLink] = useState(false);
  const hydratedEditInterviewIdRef = useRef<string | null>(null);
  const ignoreBackdropCloseUntilRef = useRef(0);
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [selectedInterviewers, setSelectedInterviewers] = useState<
    Array<{ id: string; name: string; role: 'Lead Interviewer' | 'Interviewer' | 'Observer' }>
  >([]);
  const [sendCandidateInvite, setSendCandidateInvite] = useState(true);
  const [sendInterviewerInvite, setSendInterviewerInvite] = useState(true);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [interviewTypeOptions, setInterviewTypeOptions] = useState<string[]>([...INTERVIEW_TYPES]);
  const [customInterviewTypes, setCustomInterviewTypes] = useState<string[]>([]);
  const [newInterviewTypeValue, setNewInterviewTypeValue] = useState('');
  const [showAddInterviewType, setShowAddInterviewType] = useState(false);
  const [savingInterviewType, setSavingInterviewType] = useState(false);
  const [deletingInterviewType, setDeletingInterviewType] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [interviewerOpen, setInterviewerOpen] = useState(false);
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null);
  const [scheduleJobOptions, setScheduleJobOptions] = useState<CandidatePipelineJobOption[]>(jobsProp);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; companyName: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loadingScheduleJobs, setLoadingScheduleJobs] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingClientContacts, setLoadingClientContacts] = useState(false);
  const [clientContactOptions, setClientContactOptions] = useState<ScheduleClientContactOption[]>([]);
  const [selectedClientContacts, setSelectedClientContacts] = useState<ScheduleClientContactOption[]>([]);
  const [clientContactSearch, setClientContactSearch] = useState('');
  const [clientContactOpen, setClientContactOpen] = useState(false);
  const [lineManagerOptions, setLineManagerOptions] = useState<CandidateInterviewerOption[]>([]);
  const [teamMemberOptions, setTeamMemberOptions] = useState<CandidateInterviewerOption[]>([]);
  const [loadingLineManagers, setLoadingLineManagers] = useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [workspaceClientName, setWorkspaceClientName] = useState('Your organization');
  const [workspaceClientId, setWorkspaceClientId] = useState('');
  const [fetchedCandidateInterviews, setFetchedCandidateInterviews] = useState<CandidateScheduledInterview[]>([]);
  const prevAutoPanelJobIdRef = useRef('');

  const typeRef = useRef<HTMLDivElement | null>(null);
  const candidatePickerRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef<HTMLDivElement | null>(null);
  const interviewerRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const clientContactRef = useRef<HTMLDivElement | null>(null);

  const selectedJob = scheduleJobOptions.find((job) => job.id === selectedJobId);
  const selectedClient = clientOptions.find((client) => client.id === selectedClientId);

  // Standalone usage (e.g. /interviews page): pick one or more candidates here.
  // Show the field as soon as the parent asks for a picker — do not wait for the
  // full CRM candidate list. Options load from the lightweight picker endpoint.
  const pickerRequested = !fixedCandidate && Array.isArray(candidateOptions);
  const allowCandidatePick = pickerRequested && !editInterview;

  useEffect(() => {
    if (!isOpen || !pickerRequested) {
      setLoadingCandidateOptions(false);
      return;
    }

    let cancelled = false;
    const query = candidateSearch.trim();
    const timer = window.setTimeout(() => {
      setLoadingCandidateOptions(true);
      void apiGetCandidates(
        {
          search: query || undefined,
          limit: 30,
          picker: true,
          includeCommonPool: false,
        },
      )
        .then((response) => {
          if (cancelled) return;
          const payload = response?.data as
            | BackendCandidate[]
            | { data?: BackendCandidate[] }
            | undefined;
          const rows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
          setRemoteCandidateOptions(
            rows
              .filter((row) => row?.id)
              .map((row) => {
                const name = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Candidate';
                const jobId = String(row.assignedJobs?.[0] || '').trim();
                return {
                  id: String(row.id),
                  name,
                  phone: row.phone || null,
                  assignedJobId: jobId || null,
                  assignedJob: row.assignedJobTitles?.[0] || null,
                };
              }),
          );
        })
        .catch(() => {
          if (!cancelled) setRemoteCandidateOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingCandidateOptions(false);
        });
    }, query ? 200 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [candidateSearch, isOpen, pickerRequested]);

  const pickerCandidateOptions = useMemo(() => {
    const seeded = Array.isArray(candidateOptions) ? candidateOptions : [];
    if (candidateSearch.trim()) return remoteCandidateOptions;
    const byId = new Map<string, ScheduleInterviewCandidateOption>();
    for (const option of seeded) byId.set(option.id, option);
    for (const option of remoteCandidateOptions) {
      const previous = byId.get(option.id);
      byId.set(option.id, {
        ...previous,
        ...option,
        assignedJob: option.assignedJob || previous?.assignedJob || null,
        assignedJobId: option.assignedJobId || previous?.assignedJobId || null,
        assignedClientId: previous?.assignedClientId || option.assignedClientId || null,
        phone: option.phone || previous?.phone || null,
      });
    }
    return Array.from(byId.values());
  }, [candidateOptions, candidateSearch, remoteCandidateOptions]);
  const selectedCandidates = useMemo(() => {
    if (fixedCandidate) {
      return [
        {
          id: fixedCandidate.id,
          name: fixedCandidate.name,
          phone: fixedCandidate.phone ?? null,
          assignedJob: fixedCandidate.assignedJob ?? null,
          assignedJobId: fixedCandidate.assignedJobId ?? null,
        },
      ];
    }
    const options = pickerCandidateOptions;
    const seeded = Array.isArray(candidateOptions) ? candidateOptions : [];
    const lookup = new Map<string, ScheduleInterviewCandidateOption>();
    for (const option of [...seeded, ...remoteCandidateOptions, ...options]) {
      if (option?.id) lookup.set(option.id, option);
    }
    return selectedCandidateIds
      .map((id) => lookup.get(id))
      .filter(Boolean) as ScheduleInterviewCandidateOption[];
  }, [fixedCandidate, candidateOptions, pickerCandidateOptions, remoteCandidateOptions, selectedCandidateIds]);

  /** Primary candidate for shared fields (round, phone, meeting-link generation). */
  const candidate = useMemo(() => {
    const primary = selectedCandidates[0];
    if (!primary) return null;
    return {
      id: primary.id,
      name: primary.name,
      phone: primary.phone ?? null,
      stage: null as string | null,
      assignedJob: primary.assignedJob ?? null,
      assignedJobId: primary.assignedJobId ?? null,
    };
  }, [selectedCandidates]);

  const filteredCandidateOptions = useMemo(() => {
    const options = pickerCandidateOptions;
    const query = candidateSearch.trim();
    if (!query) return options;
    return options.filter((option) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(option.name, option.phone, option.assignedJob),
        query,
      ),
    );
  }, [pickerCandidateOptions, candidateSearch]);

  const isEditingInterview = Boolean(editInterview);
  const minimumDate = getYmdInTimeZone(timezone);

  const relevantExistingInterviews = useMemo(() => {
    const merged = new Map<string, CandidateScheduledInterview>();
    for (const interview of [...existingInterviews, ...fetchedCandidateInterviews]) {
      if (!interview?.id) continue;
      merged.set(interview.id, interview);
    }
    if (!candidate?.id) return [];
    return Array.from(merged.values()).filter((interview) => {
      if (interview.candidateId !== candidate.id) return false;
      if (selectedJobId && interview.jobId && interview.jobId !== selectedJobId) return false;
      return isActiveScheduledInterview(interview.status);
    });
  }, [
    candidate?.id,
    existingInterviews,
    fetchedCandidateInterviews,
    selectedJobId,
  ]);

  const needsInterviewOrg =
    assignableInterviewers.canSelectCompany && !assignableInterviewers.companyId;

  const panelMemberOptions = useMemo(() => {
    if (needsInterviewOrg) return [];
    const companyId = assignableInterviewers.companyId;
    return assignableInterviewers.members
      .filter((member) => {
        if (!companyId) return true;
        const memberCompany = assigneeCompanyId(member);
        return !memberCompany || memberCompany === companyId;
      })
      .map((member) => ({
        id: member.id,
        name: formatAssigneeDisplayName(member) || member.email || 'Member',
        role: member.role?.roleName || 'Interviewer',
        department: member.department?.name || null,
        avatar: null as string | null,
      }));
  }, [
    assignableInterviewers.companyId,
    assignableInterviewers.members,
    needsInterviewOrg,
  ]);

  const loadingPanelMembers = assignableInterviewers.loading;

  useEffect(() => {
    if (!isOpen) return;
    // Ignore the same pointer gesture that opened this modal (backdrop click-through).
    ignoreBackdropCloseUntilRef.current = Date.now() + 450;
  }, [isOpen]);

  const requestModalClose = () => {
    if (Date.now() < ignoreBackdropCloseUntilRef.current) return;
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      prevAutoPanelJobIdRef.current = '';
      hydratedPrimaryCandidateRef.current = '';
      setInterviewType('');
      setRoundNumber((existingInterviews?.length || 0) + 1);
      setDate('');
      setTime('');
      setDuration('');
      setTimezone(DEFAULT_INTERVIEW_TIMEZONE);
      setMode('');
      setMeetingPlatform(null);
      setMeetingLink('');
      setLocation('');
      setPhoneNumber(candidate?.phone || '');
      setInterviewerSearch('');
      setSelectedInterviewers([]);
      setSendCandidateInvite(true);
      setSendInterviewerInvite(true);
      setAdditionalNotes('');
      setStatus('scheduled');
      setErrors({});
      setSubmitting(false);
      setTypeOpen(false);
      setShowAddInterviewType(false);
      setNewInterviewTypeValue('');
      setDurationOpen(false);
      setInterviewerOpen(false);
      setOpenRoleMenuId(null);
      setSelectedJobId('');
      setSelectedClientId('');
      setClientContactOptions([]);
      setSelectedClientContacts([]);
      setClientContactSearch('');
      setClientContactOpen(false);
      setSelectedCandidateIds([]);
      setCandidateSearch('');
      setCandidatePickerOpen(false);
      setFetchedCandidateInterviews([]);
    }
  }, [candidate?.phone, existingInterviews?.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const load = startAsyncLoad(setLoadingScheduleJobs);
    setLoadingClients(true);
    if (isStandaloneMode) {
      setLoadingLineManagers(true);
      setLoadingTeamMembers(true);
    }
    const jobsSnapshot = jobsPropRef.current;
    void (async () => {
      try {
        if (isStandaloneMode) {
          const [jobsRes, workspaceRes, lineManagers, teamMembers] = await Promise.all([
            apiGetJobs({ page: 1, limit: 500 }),
            apiGetWorkspaceClient(),
            getLineManagersForJobPicker(),
            getAllTeamMembersForAssign(getActiveOrgUnitId() || undefined, 'Interviews'),
          ]);
          if (!load.isActive()) return;

          const workspaceClient = workspaceRes?.data?.workspaceClient;
          const wsId = workspaceClient?.id ? String(workspaceClient.id) : '';
          const wsName = workspaceClient?.companyName || 'Your organization';
          setWorkspaceClientId(wsId);
          setWorkspaceClientName(wsName);
          if (wsId) {
            setClientOptions([{ id: wsId, companyName: wsName }]);
            setSelectedClientId(wsId);
          } else {
            setClientOptions([]);
          }

          const allJobs = mapJobsToPipelineOptions(parseJobsListFromResponse(jobsRes)).filter((job) =>
            isOpenScheduleJobStatus(job.status),
          );
          const fetchedJobs = wsId ? allJobs.filter((job) => job.clientId === wsId) : allJobs;
          const byJobId = new Map<string, CandidatePipelineJobOption>();
          for (const job of [...jobsSnapshot, ...fetchedJobs]) {
            if (job.id) byJobId.set(job.id, job);
          }
          setScheduleJobOptions(Array.from(byJobId.values()).sort((a, b) => a.title.localeCompare(b.title)));

          setLineManagerOptions(
            lineManagers
              .filter((manager) => manager.id)
              .map((manager) => ({
                id: String(manager.id),
                name: String(manager.name || manager.email || 'Line Manager').trim() || 'Line Manager',
                role: 'Line Manager',
                department: manager.department || null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );

          setTeamMemberOptions(
            teamMembersToBackendUsers(teamMembers)
              .filter((member) => member.id)
              .map((member) => ({
                id: String(member.id),
                name: String(member.name || member.email || 'Team member').trim() || 'Team member',
                role: member.role || null,
                department: member.department || null,
                avatar: member.avatar || null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        } else {
          const [jobsRes, clientsRes] = await Promise.all([
            apiGetJobs({ page: 1, limit: 500 }),
            // Schedule Interview must list Recruitment Clients (jobs live under those), not CRM-only.
            apiGetClients({ page: 1, limit: 500, recruitmentEnabled: true }),
          ]);
          if (!load.isActive()) return;
          const fetchedJobs = mapJobsToPipelineOptions(parseJobsListFromResponse(jobsRes)).filter((job) =>
            isOpenScheduleJobStatus(job.status),
          );
          const byJobId = new Map<string, CandidatePipelineJobOption>();
          for (const job of [...jobsSnapshot, ...fetchedJobs]) {
            if (job.id) byJobId.set(job.id, job);
          }
          setScheduleJobOptions(Array.from(byJobId.values()).sort((a, b) => a.title.localeCompare(b.title)));

          const clientsById = new Map<string, { id: string; companyName: string }>();
          for (const client of parseClientsListFromResponse(clientsRes)) {
            if (!client?.id || !client?.companyName) continue;
            clientsById.set(String(client.id), {
              id: String(client.id),
              companyName: String(client.companyName).trim(),
            });
          }
          // Always include clients linked to open jobs (covers edge cases / stale flags).
          for (const job of byJobId.values()) {
            const id = String(job.clientId || '').trim();
            const companyName = String(job.clientName || '').trim();
            if (!id || !companyName || clientsById.has(id)) continue;
            clientsById.set(id, { id, companyName });
          }
          setClientOptions(
            Array.from(clientsById.values()).sort((a, b) => a.companyName.localeCompare(b.companyName)),
          );
        }
      } catch (error) {
        console.error('Failed to load schedule interview options:', error);
        if (load.isActive()) {
          setScheduleJobOptions(jobsSnapshot);
        }
      } finally {
        load.finish();
        setLoadingClients(false);
        if (isStandaloneMode) {
          setLoadingLineManagers(false);
          setLoadingTeamMembers(false);
        }
      }
    })();

    return () => {
      load.abort();
      setLoadingClients(false);
      setLoadingLineManagers(false);
      setLoadingTeamMembers(false);
    };
  }, [isOpen, isStandaloneMode, jobsPropSignature]);

  const applyDefaultJobSelection = useCallback(
    (jobId: string, clientId?: string | null) => {
      const normalizedJobId = String(jobId || '').trim();
      if (!normalizedJobId) return false;
      const job = scheduleJobOptions.find((item) => item.id === normalizedJobId);
      if (!job) return false;
      setSelectedJobId(normalizedJobId);
      const resolvedClientId = String(clientId || job.clientId || '').trim();
      if (resolvedClientId) {
        setSelectedClientId(resolvedClientId);
      }
      return true;
    },
    [scheduleJobOptions],
  );

  useEffect(() => {
    if (!isOpen || isEditingInterview || !allowCandidatePick) return;
    if (!selectedCandidateIds.length) {
      hydratedPrimaryCandidateRef.current = '';
      setSelectedJobId('');
      setSelectedClientId('');
      return;
    }

    const primaryId = selectedCandidateIds[0]!;
    const picked = candidateOptions?.find((option) => option.id === primaryId);
    if (picked?.assignedJobId && applyDefaultJobSelection(picked.assignedJobId, picked.assignedClientId)) {
      if (picked.phone) setPhoneNumber(picked.phone);
      hydratedPrimaryCandidateRef.current = primaryId;
      return;
    }

    // Already fetched this primary — only retry local job apply above when options load.
    if (hydratedPrimaryCandidateRef.current === primaryId) return;

    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiGetCandidate(primaryId);
        const data = extractApiData<BackendCandidate>(raw);
        if (cancelled || !data?.id) return;

        if (data.phone) setPhoneNumber(String(data.phone));

        const assignedJobId = String(data.assignedJobs?.[0] || '').trim();
        if (assignedJobId && applyDefaultJobSelection(assignedJobId)) {
          hydratedPrimaryCandidateRef.current = primaryId;
          return;
        }

        const interviewRes = await apiGetInterviews({
          candidateId: primaryId,
          limit: 20,
        });
        const rows = Array.isArray(interviewRes.data?.data) ? interviewRes.data.data : [];
        const latest = [...rows].sort(
          (a, b) =>
            new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime(),
        )[0];
        if (!cancelled && latest?.job?.id) {
          applyDefaultJobSelection(
            latest.job.id,
            latest.client?.id || latest.job.client?.id || null,
          );
        }
        if (!cancelled) hydratedPrimaryCandidateRef.current = primaryId;
      } catch {
        /* best effort — user can still pick job/client manually */
        if (!cancelled) hydratedPrimaryCandidateRef.current = primaryId;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    allowCandidatePick,
    applyDefaultJobSelection,
    candidateOptions,
    isEditingInterview,
    isOpen,
    selectedCandidateIds,
  ]);

  useEffect(() => {
    // Standalone candidate-picker owns job defaults — do not fight that selection.
    if (!isOpen || allowCandidatePick || isEditingInterview) return;
    const defaultJobId =
      editInterview?.jobId ||
      initialJobId ||
      candidate?.assignedJobId ||
      scheduleJobOptions.find((j) => j.title === linkedJobTitle)?.id ||
      '';
    if (defaultJobId) {
      setSelectedJobId(String(defaultJobId));
    }
  }, [
    allowCandidatePick,
    isOpen,
    isEditingInterview,
    editInterview?.jobId,
    initialJobId,
    candidate?.assignedJobId,
    candidate?.id,
    linkedJobTitle,
    scheduleJobOptions,
  ]);

  useEffect(() => {
    if (!selectedJobId) return;
    const job = scheduleJobOptions.find((item) => item.id === selectedJobId);
    if (job?.clientId) {
      setSelectedClientId(String(job.clientId));
    }
  }, [selectedJobId, scheduleJobOptions]);

  useEffect(() => {
    if (!isOpen || !selectedClientId || isStandaloneMode) {
      setClientContactOptions([]);
      setLoadingClientContacts(false);
      return undefined;
    }

    const load = startAsyncLoad(setLoadingClientContacts);
    void (async () => {
      try {
        const res = await apiGetClient(selectedClientId);
        const client = (res as any).data?.data || (res as any).data || res;
        const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
        if (!load.isActive()) return;
        setClientContactOptions(
          contacts
            .filter((c: any) => c?.id)
            .map((c: any) => ({
              id: String(c.id),
              name: `${String(c.firstName || '').trim()} ${String(c.lastName || '').trim()}`.trim() || 'Contact',
              designation: c.designation || null,
              department: c.department || null,
              email: c.email || null,
            }))
            .sort((a: ScheduleClientContactOption, b: ScheduleClientContactOption) =>
              a.name.localeCompare(b.name)
            )
        );
      } catch (error) {
        console.error('Failed to load client contacts:', error);
        if (load.isActive()) setClientContactOptions([]);
      } finally {
        load.finish();
      }
    })();

    return () => {
      load.abort();
    };
  }, [isOpen, isStandaloneMode, selectedClientId]);

  useEffect(() => {
    if (!isOpen || !isStandaloneMode) return;
    const job = selectedJobId ? scheduleJobOptions.find((item) => item.id === selectedJobId) : null;
    const managerId = job?.managerId ? String(job.managerId) : '';
    if (!managerId) return;

    setLineManagerOptions((prev) => {
      if (prev.some((item) => item.id === managerId)) return prev;
      const managerName = job?.managerName || 'Line Manager';
      return [
        ...prev,
        {
          id: managerId,
          name: managerName,
          role: 'Line Manager',
          department: null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
    });

    const managerName = job?.managerName || 'Line Manager';
    setTeamMemberOptions((prev) => {
      if (prev.some((item) => item.id === managerId)) return prev;
      return [
        ...prev,
        {
          id: managerId,
          name: managerName,
          role: 'Line Manager',
          department: null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, [isOpen, isStandaloneMode, selectedJobId, scheduleJobOptions]);

  useEffect(() => {
    if (!isOpen || !isStandaloneMode || isEditingInterview) return;
    if (!panelMemberOptions.length) return;

    const jobChanged = prevAutoPanelJobIdRef.current !== selectedJobId;
    prevAutoPanelJobIdRef.current = selectedJobId;

    const job = selectedJobId ? scheduleJobOptions.find((item) => item.id === selectedJobId) : null;
    const preferredManagerId = job?.managerId;
    const manager =
      (preferredManagerId &&
        panelMemberOptions.find((item) => item.id === preferredManagerId)) ||
      panelMemberOptions.find((item) =>
        lineManagerOptions.some((managerOption) => managerOption.id === item.id),
      ) ||
      panelMemberOptions[0];
    if (!manager) return;

    setSelectedInterviewers((prev) => {
      if (prev.length === 0) {
        return [{ id: manager.id, name: manager.name, role: 'Lead Interviewer' }];
      }
      if (jobChanged) {
        const extras = prev.filter((item) => item.id !== manager.id && item.role !== 'Lead Interviewer');
        return [{ id: manager.id, name: manager.name, role: 'Lead Interviewer' }, ...extras];
      }
      return prev;
    });
  }, [
    isOpen,
    isStandaloneMode,
    isEditingInterview,
    lineManagerOptions,
    panelMemberOptions,
    selectedJobId,
    scheduleJobOptions,
  ]);

  useEffect(() => {
    if (!isOpen) {
      hydratedEditInterviewIdRef.current = null;
      return;
    }
    if (!editInterview) return;

    const editId = String(editInterview.id || '');
    // Only seed the form when the modal opens (or a different interview is loaded).
    // Re-running on every new object identity was resetting Video Call → In Person
    // while the user edited other fields.
    if (hydratedEditInterviewIdRef.current === editId) return;
    hydratedEditInterviewIdRef.current = editId;

    setInterviewType(editInterview.type || '');
    setRoundNumber(editInterview.round || 1);
    setDate(editInterview.date || '');
    setTime(editInterview.time || '');
    setDuration(
      INTERVIEW_DURATIONS.includes(editInterview.duration) ? editInterview.duration : '1 hour',
    );
    setTimezone(resolveIanaFromTimezoneValue(editInterview.timezone));
    setMode(normalizePopupInterviewMode(editInterview));
    setMeetingPlatform(
      editInterview.platform ||
        inferPlatformFromMeetingLink(editInterview.meetingLink || '') ||
        null,
    );
    setMeetingLink(editInterview.meetingLink || '');
    setLocation(editInterview.location || '');
    setPhoneNumber(editInterview.phoneNumber || candidate?.phone || '');
    setSelectedInterviewers(editInterview.interviewers || []);
    setSelectedClientContacts(
      (editInterview.clientPanel || []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        designation: contact.designation || null,
        department: null,
        email: null,
      }))
    );
    if (editInterview.clientId) setSelectedClientId(String(editInterview.clientId));
    if (editInterview.jobId) setSelectedJobId(String(editInterview.jobId));
    setSendCandidateInvite(Boolean(editInterview.sendCandidateInvite));
    setSendInterviewerInvite(Boolean(editInterview.sendInterviewerInvite));
    setAdditionalNotes(extractEditableInterviewNotes(editInterview.notes));
    setStatus(editInterview.status || 'scheduled');
  }, [editInterview, isOpen, candidate?.phone]);

  useEffect(() => {
    if (!isOpen || !candidate?.id || isEditingInterview) {
      if (!isOpen) setFetchedCandidateInterviews([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetInterviews({
          candidateId: candidate.id,
          ...(selectedJobId ? { jobId: selectedJobId } : {}),
          limit: 100,
        });
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (cancelled) return;
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
        );
        setFetchedCandidateInterviews(
          sorted.map((item, index) => mapInterviewListItemToScheduled(item, index + 1)),
        );
      } catch {
        if (!cancelled) setFetchedCandidateInterviews([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidate?.id, isEditingInterview, isOpen, selectedJobId]);

  useEffect(() => {
    if (!isOpen || isEditingInterview) return;
    const roundCandidateId = allowCandidatePick
      ? selectedCandidateIds[0] || ''
      : candidate?.id || '';
    setRoundNumber(
      computeNextInterviewRound(relevantExistingInterviews, roundCandidateId, selectedJobId || null),
    );
    if (!allowCandidatePick) {
      setPhoneNumber(candidate?.phone || '');
    }
  }, [
    allowCandidatePick,
    candidate?.id,
    candidate?.phone,
    isEditingInterview,
    isOpen,
    relevantExistingInterviews,
    selectedCandidateIds,
    selectedJobId,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!candidatePickerRef.current?.contains(target)) {
        setCandidatePickerOpen(false);
        setCandidateSearch('');
      }
      if (!typeRef.current?.contains(target)) {
        setTypeOpen(false);
        setShowAddInterviewType(false);
        setNewInterviewTypeValue('');
      }
      if (!durationRef.current?.contains(target)) setDurationOpen(false);
      if (!interviewerRef.current?.contains(target)) setInterviewerOpen(false);
      if (!clientContactRef.current?.contains(target)) setClientContactOpen(false);
      if (!roleMenuRef.current?.contains(target)) setOpenRoleMenuId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const filteredInterviewers = useMemo(() => {
    const query = interviewerSearch.trim();
    if (!query) return panelMemberOptions;
    return panelMemberOptions.filter((person) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(person.name, person.role, person.department),
        query,
      ),
    );
  }, [interviewerSearch, panelMemberOptions]);

  const filteredClientContacts = useMemo(() => {
    const query = clientContactSearch.trim();
    if (!query) return clientContactOptions;
    return clientContactOptions.filter((person) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(
          person.name,
          person.designation,
          person.department,
          person.email,
        ),
        query,
      ),
    );
  }, [clientContactOptions, clientContactSearch]);

  const jobsForClient = useMemo(() => {
    const openJobs = scheduleJobOptions.filter(
      (job) => isOpenScheduleJobStatus(job.status) || job.id === selectedJobId,
    );
    if (!selectedClientId) return openJobs;
    return openJobs.filter((job) => job.clientId === selectedClientId || job.id === selectedJobId);
  }, [scheduleJobOptions, selectedClientId, selectedJobId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void apiGetInterviewTypeCatalog()
      .then((response) => {
        if (cancelled) return;
        const statuses = Array.isArray(response?.data?.statuses) ? response.data.statuses : [];
        const custom = Array.isArray(response?.data?.custom) ? response.data.custom : [];
        setInterviewTypeOptions(mergeInterviewTypeOptions(statuses, interviewType));
        setCustomInterviewTypes(custom.map((item) => String(item || '').trim()).filter(Boolean));
      })
      .catch(() => {
        if (cancelled) return;
        setInterviewTypeOptions(mergeInterviewTypeOptions(undefined, interviewType));
        setCustomInterviewTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!interviewType) return;
    setInterviewTypeOptions((current) => mergeInterviewTypeOptions(current, interviewType));
  }, [interviewType]);

  const isCustomInterviewType = useCallback(
    (option: string) =>
      customInterviewTypes.some((item) => item.toLowerCase() === String(option || '').trim().toLowerCase()) ||
      !INTERVIEW_TYPES.some((item) => item.toLowerCase() === String(option || '').trim().toLowerCase()),
    [customInterviewTypes],
  );

  const handleAddInterviewType = async () => {
    const next = String(newInterviewTypeValue || '').trim();
    if (!next || savingInterviewType) return;
    setSavingInterviewType(true);
    try {
      const response = await apiAppendInterviewType(next);
      const statuses = Array.isArray(response?.data?.statuses) ? response.data.statuses : [];
      const custom = Array.isArray(response?.data?.custom)
        ? response.data.custom
        : [...customInterviewTypes, next];
      setInterviewTypeOptions(mergeInterviewTypeOptions(statuses, next));
      setCustomInterviewTypes(custom.map((item) => String(item || '').trim()).filter(Boolean));
      setInterviewType(next);
      setNewInterviewTypeValue('');
      setShowAddInterviewType(false);
      setTypeOpen(false);
      setErrors((prev) => ({ ...prev, interviewType: undefined }));
      toast.success(`Interview type "${next}" saved`);
    } catch (error: unknown) {
      void requestError(error instanceof Error ? error.message : 'Failed to add interview type');
    } finally {
      setSavingInterviewType(false);
    }
  };

  const handleDeleteInterviewType = async (option: string) => {
    if (!isCustomInterviewType(option) || deletingInterviewType) return;
    setDeletingInterviewType(true);
    try {
      const response = await apiRemoveInterviewType(option);
      const statuses = Array.isArray(response?.data?.statuses) ? response.data.statuses : [];
      const custom = Array.isArray(response?.data?.custom)
        ? response.data.custom
        : customInterviewTypes.filter(
            (item) => item.toLowerCase() !== String(option).trim().toLowerCase(),
          );
      const nextOptions = mergeInterviewTypeOptions(statuses);
      setInterviewTypeOptions(nextOptions);
      setCustomInterviewTypes(custom.map((item) => String(item || '').trim()).filter(Boolean));
      if (interviewType === option) {
        setInterviewType(nextOptions[0] || '');
      }
      toast.success(`Interview type "${option}" removed`);
    } catch (error: unknown) {
      void requestError(error instanceof Error ? error.message : 'Failed to remove interview type');
    } finally {
      setDeletingInterviewType(false);
    }
  };

  useEffect(() => {
    if (!selectedClientId || !selectedJobId) return;
    if (!jobsForClient.some((job) => job.id === selectedJobId)) {
      setSelectedJobId('');
    }
  }, [selectedClientId, selectedJobId, jobsForClient]);

  const isInterviewerBooked = (interviewerId: string) =>
    Boolean(date && time && relevantExistingInterviews.some((interview) => interview.date === date && interview.time === time && interview.interviewers.some((item) => item.id === interviewerId)));

  const validate = () => {
    const nextErrors: Record<string, string | undefined> = {};
    if (allowCandidatePick && selectedCandidateIds.length === 0) {
      nextErrors.candidate = 'Select at least one candidate';
    }
    if (!status) nextErrors.status = 'Status is required';
    if (!interviewType) nextErrors.interviewType = 'Interview type is required';
    if (!roundNumber || roundNumber < 1) nextErrors.roundNumber = 'Round number is required';
    if (!date) nextErrors.date = 'Date is required';
    if (!time) nextErrors.time = 'Time is required';
    if (!duration) nextErrors.duration = 'Duration is required';
    if (!timezone) nextErrors.timezone = 'Timezone is required';
    if (!mode) nextErrors.mode = 'Interview mode is required';
    if (!selectedJobId) {
      nextErrors.linkedJob = 'Linked job is required';
    }
    if (mode === 'video' && !meetingPlatform) {
      nextErrors.modeField = 'Select Google Meet or Zoom';
    }
    if (mode === 'video' && !meetingLink.trim()) nextErrors.modeField = 'Meeting link is required';
    if (mode === 'in-person' && !location.trim()) nextErrors.modeField = 'Location is required';
    if (mode === 'phone' && !phoneNumber.trim()) nextErrors.modeField = 'Phone number is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const isFormValid =
    (!allowCandidatePick || selectedCandidateIds.length > 0) &&
    Boolean(status && interviewType && roundNumber >= 1 && date && time && duration && timezone && mode) &&
    Boolean(selectedJobId) &&
    (mode !== 'video' || Boolean(meetingPlatform)) &&
    (mode !== 'video' || Boolean(meetingLink.trim())) &&
    (mode !== 'in-person' || Boolean(location.trim())) &&
    (mode !== 'phone' || Boolean(phoneNumber.trim()));

  const handleToggleCandidate = (option: ScheduleInterviewCandidateOption) => {
    // Keep backdrop from treating this pointer gesture as an outside close.
    ignoreBackdropCloseUntilRef.current = Date.now() + 400;
    setSelectedCandidateIds((prev) => {
      const exists = prev.includes(option.id);
      if (exists) return prev.filter((id) => id !== option.id);
      return [...prev, option.id];
    });
    setErrors((prev) => ({ ...prev, candidate: undefined }));
  };

  const handleSelectAllFilteredCandidates = () => {
    const ids = filteredCandidateOptions.map((option) => option.id);
    setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...ids])));
    setErrors((prev) => ({ ...prev, candidate: undefined }));
  };

  const handleClearSelectedCandidates = () => {
    setSelectedCandidateIds([]);
  };

  const handleGenerateMeetingLink = async (platform: 'Google Meet' | 'Zoom') => {
    if (!candidate) return;
    setMeetingPlatform(platform);
    setErrors((prev) => ({ ...prev, modeField: undefined }));

    if (!date || !time || !duration) {
      setErrors((prev) => ({
        ...prev,
        modeField: 'Select date, time, and duration, then click again to generate — or paste a link below',
      }));
      return;
    }

    try {
      setGeneratingMeetingLink(true);
      const response = await apiGenerateCandidateInterviewMeetingLink(candidate.id, {
        jobId: selectedJobId || candidate.assignedJobId || null,
        date,
        time,
        duration,
        timezone,
        mode: 'video',
        platform: platform === 'Google Meet' ? 'GOOGLE_MEET' : 'ZOOM',
        interviewers: selectedInterviewers,
        notes: additionalNotes.trim() || undefined,
      });
      setMeetingLink(response.meetingLink || '');
      setErrors((prev) => ({ ...prev, modeField: undefined }));
    } catch (error: any) {
      setErrors((prev) => ({
        ...prev,
        modeField:
          error?.message ||
          'Could not generate a link. Paste your meeting URL in the field below.',
      }));
    } finally {
      setGeneratingMeetingLink(false);
    }
  };

  const handleToggleInterviewer = (person: CandidateInterviewerOption) => {
    setSelectedInterviewers((prev) => {
      const exists = prev.some((item) => item.id === person.id);
      if (exists) {
        return prev.filter((item) => item.id !== person.id);
      }
      return [...prev, { id: person.id, name: person.name, role: 'Interviewer' }];
    });
    setErrors((prev) => ({ ...prev, interviewers: undefined }));
  };

  const handleToggleClientContact = (person: ScheduleClientContactOption) => {
    setSelectedClientContacts((prev) => {
      const exists = prev.some((item) => item.id === person.id);
      if (exists) return prev.filter((item) => item.id !== person.id);
      return [...prev, person];
    });
    setErrors((prev) => ({ ...prev, interviewers: undefined }));
  };

  const handleSchedule = async () => {
    if (!selectedCandidates.length || !validate()) return;

    const clientPanelNote =
      selectedClientContacts.length > 0
        ? `Client panel: ${selectedClientContacts
            .map((c) => `${c.name}${c.designation ? ` (${c.designation})` : ''}`)
            .join(', ')}`
        : '';
    const userFacingNotes = [additionalNotes.trim(), clientPanelNote].filter(Boolean).join('\n');
    const mergedNotes = editInterview?.id
      ? mergeEditableInterviewNotesWithAudit(userFacingNotes, editInterview.notes)
      : userFacingNotes;

    const buildPayload = (
      target: ScheduleInterviewCandidateOption,
      index: number,
    ): CandidateScheduledInterview => ({
      id: editInterview?.id || `interview-${Date.now()}-${index}`,
      type: interviewType,
      round: roundNumber,
      date,
      time,
      duration,
      timezone,
      mode: mode as 'video' | 'in-person' | 'phone',
      platform: mode === 'video' ? meetingPlatform : null,
      meetingLink: mode === 'video' ? meetingLink.trim() : null,
      location: mode === 'in-person' ? location.trim() : null,
      phoneNumber: mode === 'phone' ? phoneNumber.trim() : null,
      interviewers: selectedInterviewers.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
      })),
      clientId: selectedClientId || workspaceClientId || selectedJob?.clientId || null,
      clientName:
        selectedClient?.companyName ||
        workspaceClientName ||
        selectedJob?.clientName ||
        linkedJobCompany ||
        null,
      clientPanel: selectedClientContacts.map((item) => ({
        id: item.id,
        name: item.name,
        role: 'Client Representative',
        designation: item.designation || null,
      })),
      jobId: selectedJobId || null,
      jobTitle: selectedJob?.title || linkedJobTitle || target.assignedJob || null,
      candidateId: target.id,
      notes: mergedNotes,
      sendCandidateInvite,
      sendInterviewerInvite,
      status,
    });

    try {
      setSubmitting(true);
      if (editInterview?.id) {
        const payload = buildPayload(selectedCandidates[0]!, 0);
        await Promise.resolve(onUpdate?.(editInterview.id, payload));
      } else {
        for (let index = 0; index < selectedCandidates.length; index += 1) {
          const target = selectedCandidates[index]!;
          await Promise.resolve(onSchedule?.(buildPayload(target, index)));
        }
      }
      const prettyDate = formatDateDMY(new Date(`${date}T00:00:00`));
      const tzLabel = formatTimezoneDisplay(resolveIanaFromTimezoneValue(timezone));
      const count = selectedCandidates.length;
      onScheduledSuccess?.(
        editInterview?.id
          ? `Interview updated (${status})`
          : count > 1
            ? `Interview scheduled for ${count} candidates on ${prettyDate} at ${time} (${tzLabel})`
            : `Interview scheduled for ${prettyDate} at ${time} (${tzLabel})`,
      );
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to schedule interview. Please try again.';
      void requestError(message, { title: 'Interview conflict' });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="schedule-interview-modal"
          className="fixed inset-0 z-[155] flex items-end justify-center md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/45"
            onClick={requestModalClose}
            onMouseDown={(event) => {
              // Block the opening click from dismissing via backdrop.
              if (Date.now() < ignoreBackdropCloseUntilRef.current) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          />
          <div
            className="relative z-[1] flex h-[calc(100%-3.5rem)] w-full flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-[640px] md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-slate-900">{editInterview?.id ? 'Edit Interview' : 'Schedule Interview'}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 [overflow-anchor:none]">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Interview Details</h4>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {allowCandidatePick && !isEditingInterview ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Candidates <span className="text-red-500">*</span>
                        </label>
                        {selectedCandidates.length > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {selectedCandidates.map((option) => (
                              <span
                                key={option.id}
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                              >
                                <span className="truncate">{option.name}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${option.name}`}
                                  onClick={() =>
                                    setSelectedCandidateIds((prev) =>
                                      prev.filter((id) => id !== option.id),
                                    )
                                  }
                                  className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="relative" ref={candidatePickerRef}>
                          <button
                            type="button"
                            onClick={() => setCandidatePickerOpen((prev) => !prev)}
                            className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                              errors.candidate ? 'border-red-300' : 'border-slate-200'
                            }`}
                          >
                            <span
                              className={
                                selectedCandidates.length ? 'text-slate-700' : 'text-slate-400'
                              }
                            >
                              {selectedCandidates.length
                                ? `${selectedCandidates.length} candidate${
                                    selectedCandidates.length === 1 ? '' : 's'
                                  } selected — search to add more`
                                : 'Search and select candidates'}
                            </span>
                            <ChevronDown size={16} className="shrink-0 text-slate-400" />
                          </button>
                          {candidatePickerOpen ? (
                            <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                              <div className="border-b border-slate-100 p-2">
                                <div className="relative">
                                  <Search
                                    size={14}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                  />
                                  <input
                                    value={candidateSearch}
                                    onChange={(e) => setCandidateSearch(e.target.value)}
                                    placeholder="Search by name, phone, or job…"
                                    autoFocus
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={handleSelectAllFilteredCandidates}
                                    disabled={filteredCandidateOptions.length === 0}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Select all{candidateSearch.trim() ? ' matches' : ''} (
                                    {filteredCandidateOptions.length})
                                  </button>
                                  {selectedCandidateIds.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={handleClearSelectedCandidates}
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                      Clear selected
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
                                {loadingCandidateOptions && filteredCandidateOptions.length === 0 ? (
                                  <p className="px-3 py-3 text-sm text-slate-500">Loading candidates…</p>
                                ) : filteredCandidateOptions.length === 0 ? (
                                  <p className="px-3 py-3 text-sm text-slate-500">
                                    No candidates match your search
                                  </p>
                                ) : (
                                  filteredCandidateOptions.map((option) => {
                                    const checked = selectedCandidateIds.includes(option.id);
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onMouseDown={(event) => {
                                          // Prevent input blur/scroll jump that remounts the modal chrome.
                                          event.preventDefault();
                                        }}
                                        onClick={() => handleToggleCandidate(option)}
                                        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                          checked ? 'bg-blue-50/70' : ''
                                        }`}
                                      >
                                        <span
                                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                            checked
                                              ? 'border-blue-500 bg-blue-500 text-white'
                                              : 'border-slate-300 bg-white'
                                          }`}
                                        >
                                          {checked ? '✓' : ''}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block font-medium text-slate-800">
                                            {option.name}
                                          </span>
                                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                                            {[option.phone, option.assignedJob]
                                              .filter(Boolean)
                                              .join(' · ') || 'Candidate'}
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {errors.candidate ? (
                          <p className="mt-1 text-xs text-red-600">{errors.candidate}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            You can select multiple candidates. The same interview details are applied
                            to each.
                          </p>
                        )}
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.status ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {errors.status ? <p className="mt-1 text-xs text-red-600">{errors.status}</p> : null}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Interview Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={typeRef}>
                        <button
                          type="button"
                          onClick={() => setTypeOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                            errors.interviewType ? 'border-red-300' : 'border-slate-200'
                          }`}
                        >
                          <span className={interviewType ? 'text-slate-700' : 'text-slate-400'}>
                            {interviewType || 'Select interview type'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {typeOpen ? (
                          <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <div className="max-h-56 overflow-y-auto">
                              {interviewTypeOptions.map((option) => {
                                const canDelete = isCustomInterviewType(option);
                                return (
                                  <div
                                    key={option}
                                    className="flex items-center gap-1 rounded-xl hover:bg-slate-50"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInterviewType(option);
                                        setTypeOpen(false);
                                        setShowAddInterviewType(false);
                                        setErrors((prev) => ({ ...prev, interviewType: undefined }));
                                      }}
                                      className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left text-sm"
                                    >
                                      <span className="truncate">{option}</span>
                                      {interviewType === option ? (
                                        <Check size={15} className="shrink-0 text-blue-600" />
                                      ) : null}
                                    </button>
                                    {canDelete ? (
                                      <button
                                        type="button"
                                        title={`Delete ${option}`}
                                        disabled={deletingInterviewType}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleDeleteInterviewType(option);
                                        }}
                                        className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 border-t border-slate-100 pt-2">
                              {showAddInterviewType ? (
                                <div className="flex items-center gap-2 px-1">
                                  <input
                                    value={newInterviewTypeValue}
                                    onChange={(e) => setNewInterviewTypeValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleAddInterviewType();
                                      }
                                    }}
                                    placeholder="New interview type"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    disabled={savingInterviewType || !newInterviewTypeValue.trim()}
                                    onClick={() => void handleAddInterviewType()}
                                    className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {savingInterviewType ? '…' : 'Add'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddInterviewType(false);
                                      setNewInterviewTypeValue('');
                                    }}
                                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowAddInterviewType(true)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  <Plus size={15} />
                                  Add interview type
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {errors.interviewType ? <p className="mt-1 text-xs text-red-600">{errors.interviewType}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Round Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={roundNumber}
                        onChange={(e) => {
                          const nextValue = Math.max(1, Number(e.target.value) || 1);
                          setRoundNumber(nextValue);
                          setErrors((prev) => ({ ...prev, roundNumber: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.roundNumber ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      />
                      {errors.roundNumber ? <p className="mt-1 text-xs text-red-600">{errors.roundNumber}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={isEditingInterview ? undefined : minimumDate}
                        value={date}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = isEditingInterview ? raw : clampDateToMinLocal(raw, minimumDate);
                          setDate(next);
                          setErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.date ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      />
                      {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Time <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={interviewTime12hToInputValue(time)}
                          min={
                            !isEditingInterview && date && date === minimumDate
                              ? getLocalTimeInputMinNow()
                              : undefined
                          }
                          onChange={(e) => {
                            const next = interviewTimeInputValueTo12h(e.target.value);
                            setTime(next);
                            setErrors((prev) => ({ ...prev, time: undefined }));
                          }}
                          onClick={(e) => openNativeDateTimePicker(e.currentTarget)}
                          onFocus={(e) => openNativeDateTimePicker(e.currentTarget)}
                          className={`w-full cursor-pointer rounded-xl border bg-white px-3 py-2.5 pr-10 text-sm text-slate-700 outline-none ${
                            errors.time ? 'border-red-300' : 'border-slate-200'
                          } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                          aria-label="Interview time"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Open time picker"
                          onClick={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.parentElement?.querySelector(
                              'input[type="time"]',
                            ) as HTMLInputElement | null;
                            input?.focus();
                            openNativeDateTimePicker(input);
                          }}
                        >
                          <Clock size={16} />
                        </button>
                      </div>
                      {errors.time ? <p className="mt-1 text-xs text-red-600">{errors.time}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Duration <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={durationRef}>
                        <button
                          type="button"
                          onClick={() => setDurationOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                            errors.duration ? 'border-red-300' : 'border-slate-200'
                          }`}
                        >
                          <span className={duration ? 'text-slate-700' : 'text-slate-400'}>
                            {duration || 'Select duration'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {durationOpen ? (
                          <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            {INTERVIEW_DURATIONS.filter(
                              (option) => !/^(10|15)\s*mins?$/i.test(String(option)),
                            ).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setDuration(option);
                                  setDurationOpen(false);
                                  setErrors((prev) => ({ ...prev, duration: undefined }));
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                <span>{option}</span>
                                {duration === option ? <Check size={15} className="text-blue-600" /> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {errors.duration ? <p className="mt-1 text-xs text-red-600">{errors.duration}</p> : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Timezone <span className="text-red-500">*</span>
                      </label>
                      <ClientTimezoneSelect
                        value={timezone}
                        valueAsIana
                        placeholder="Select timezone…"
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.timezone ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                        onChange={(nextTimezone) => {
                          setTimezone(nextTimezone);
                          setErrors((prev) => ({ ...prev, timezone: undefined }));
                        }}
                      />
                      {errors.timezone ? (
                        <p className="mt-1 text-xs text-red-600">{errors.timezone}</p>
                      ) : timezone ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Interview will be scheduled in {formatTimezoneDisplay(resolveIanaFromTimezoneValue(timezone))}.
                        </p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Interview Mode <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'video', label: 'Video Call', icon: Video },
                          { value: 'in-person', label: 'In Person', icon: MapPin },
                          { value: 'phone', label: 'Phone Call', icon: Phone },
                        ].map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setMode(value as 'video' | 'in-person' | 'phone');
                              if (value !== 'video') {
                                setMeetingPlatform(null);
                                setMeetingLink('');
                              }
                              setErrors((prev) => ({ ...prev, mode: undefined, modeField: undefined }));
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                              mode === value
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon size={16} />
                            {label}
                          </button>
                        ))}
                      </div>
                      {errors.mode ? <p className="mt-1 text-xs text-red-600">{errors.mode}</p> : null}
                    </div>

                    {mode === 'video' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Meeting Platform <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {(['Google Meet', 'Zoom'] as const).map((platform) => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => void handleGenerateMeetingLink(platform)}
                              disabled={generatingMeetingLink}
                              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                                meetingPlatform === platform
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <span className="block font-medium">{platform}</span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {generatingMeetingLink && meetingPlatform === platform
                                  ? 'Generating valid link...'
                                  : `Click to generate a ${platform} link when connected`}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <input
                            value={meetingLink}
                            onChange={(e) => {
                              const next = e.target.value;
                              setMeetingLink(next);
                              const inferred = inferPlatformFromMeetingLink(next);
                              if (inferred) setMeetingPlatform(inferred);
                              setErrors((prev) => ({ ...prev, modeField: undefined }));
                            }}
                            placeholder="Meeting link appears here after generate — or paste a Meet / Zoom URL"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          {meetingLink.trim() ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                              <DrawerLinkActions url={meetingLink.trim()} shareTitle="Interview meeting link" />
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Connected accounts generate a link on click. You can also paste a link here.
                            </p>
                          )}
                        </div>
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    {mode === 'in-person' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Location / Office Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={location}
                          onChange={(e) => {
                            setLocation(e.target.value);
                            setErrors((prev) => ({ ...prev, modeField: undefined }));
                          }}
                          placeholder="Enter office address"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    {mode === 'phone' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            setErrors((prev) => ({ ...prev, modeField: undefined }));
                          }}
                          placeholder="Enter phone number"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    <div className={isStandaloneMode ? 'sm:col-span-2' : ''}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Linked Job <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedJobId}
                        onChange={(e) => {
                          const nextJobId = e.target.value;
                          setSelectedJobId(nextJobId);
                          setErrors((prev) => ({ ...prev, linkedJob: undefined }));
                          const job = scheduleJobOptions.find((item) => item.id === nextJobId);
                          if (job?.clientId) {
                            setSelectedClientId(String(job.clientId));
                            setSelectedClientContacts([]);
                          } else if (!nextJobId) {
                            // Keep client filter if user cleared job while browsing a client.
                          }
                        }}
                        disabled={loadingScheduleJobs || jobsForClient.length === 0}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                          errors.linkedJob ? 'border-red-300' : 'border-slate-200'
                        }`}
                      >
                        <option value="">
                          {loadingScheduleJobs
                            ? 'Loading jobs...'
                            : selectedClientId && jobsForClient.length === 0
                              ? 'No open jobs for this client'
                              : jobsForClient.length === 0
                                ? 'No open jobs available'
                                : 'Select job'}
                        </option>
                        {jobsForClient.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                      {errors.linkedJob ? <p className="mt-1 text-xs text-red-600">{errors.linkedJob}</p> : null}
                    </div>
                    {!isStandaloneMode ? (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Company / Client</label>
                        <select
                          value={selectedClientId}
                          onChange={(e) => {
                            const nextClientId = e.target.value;
                            setSelectedClientId(nextClientId);
                            setSelectedClientContacts([]);
                            if (nextClientId && selectedJobId) {
                              const job = scheduleJobOptions.find((item) => item.id === selectedJobId);
                              if (job && job.clientId !== nextClientId) {
                                setSelectedJobId('');
                              }
                            }
                          }}
                          disabled={loadingClients || clientOptions.length === 0}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">
                            {loadingClients ? 'Loading clients...' : 'All clients / select client'}
                          </option>
                          {clientOptions.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.companyName}
                            </option>
                          ))}
                        </select>
                        {selectedClient ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Showing open jobs for this client. Assign client contacts in the interview panel below.
                          </p>
                        ) : selectedJob?.clientName ? (
                          <p className="mt-1 text-xs text-slate-500">Client from job: {selectedJob.clientName}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Select a job to auto-fill the client, or pick a client to filter open jobs.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Interview Panel</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {isStandaloneMode
                      ? "Optional. The job's line manager is selected by default. Search below to add or remove team members."
                      : 'Optional. Assign internal interviewers and/or client contacts from the selected company.'}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isStandaloneMode ? 'Panel members' : 'Internal panel'}
                  </p>
                  {assignableInterviewers.canSelectCompany ? (
                    <div className="mt-2">
                      {assignableInterviewers.companies.length ? (
                        <AssignCompanySelect
                          companies={assignableInterviewers.companies}
                          value={assignableInterviewers.companyId}
                          label="Organization"
                          onChange={(id) => {
                            assignableInterviewers.setCompanyId(id);
                            setInterviewerSearch('');
                            setSelectedInterviewers([]);
                          }}
                        />
                      ) : (
                        <p className="text-xs text-slate-500">Loading organizations…</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Only people in this company with Interviews assignment access appear below.
                      </p>
                    </div>
                  ) : null}
                  <div className="relative mt-2" ref={interviewerRef}>
                    <button
                      type="button"
                      onClick={() => setInterviewerOpen((prev) => !prev)}
                      disabled={
                        loadingPanelMembers ||
                        needsInterviewOrg
                      }
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        errors.interviewers ? 'border-red-300' : 'border-slate-200'
                      } ${loadingPanelMembers ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span className="text-slate-400">
                        {needsInterviewOrg
                          ? 'Select an organization first'
                          : loadingPanelMembers
                            ? 'Loading interviewers…'
                            : isStandaloneMode
                              ? 'Search and assign team members'
                              : 'Search and assign interviewers'}
                      </span>
                      <ChevronDown size={16} className="text-slate-400" />
                    </button>
                    {interviewerOpen ? (
                      <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          value={interviewerSearch}
                          onChange={(e) => setInterviewerSearch(e.target.value)}
                          placeholder="Search by name, role, or department"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="mt-3 max-h-56 overflow-y-auto">
                          {filteredInterviewers.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">
                              {needsInterviewOrg
                                ? 'Select an organization to see interviewers'
                                : 'No one in this company has Interviews assignment access'}
                            </p>
                          ) : (
                            filteredInterviewers.map((person) => {
                            const selected = selectedInterviewers.some((item) => item.id === person.id);
                            return (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => handleToggleInterviewer(person)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                                  selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  <InterviewerInitialsAvatar name={person.name} />
                                  <span>
                                    <span className="block font-medium">{person.name}</span>
                                    <span className="block text-xs text-slate-500">
                                      {[person.role, person.department].filter(Boolean).join(' · ') || 'Team member'}
                                    </span>
                                  </span>
                                </span>
                                {selected ? <Check size={15} /> : null}
                              </button>
                            );
                          })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {errors.interviewers ? <p className="mt-1 text-xs text-red-600">{errors.interviewers}</p> : null}

                  {!isStandaloneMode ? (
                    <>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client representatives
                        {selectedClient ? ` · ${selectedClient.companyName}` : ''}
                      </p>
                      <div className="relative mt-2" ref={clientContactRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedClientId) return;
                        setClientContactOpen((prev) => !prev);
                      }}
                      disabled={!selectedClientId || loadingClientContacts}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        !selectedClientId ? 'cursor-not-allowed opacity-60' : ''
                      } ${errors.interviewers ? 'border-red-300' : 'border-slate-200'}`}
                    >
                      <span className="text-slate-400">
                        {!selectedClientId
                          ? 'Select a client above first'
                          : loadingClientContacts
                            ? 'Loading client contacts...'
                            : 'Search and assign client contacts'}
                      </span>
                      <ChevronDown size={16} className="text-slate-400" />
                    </button>
                    {clientContactOpen && selectedClientId ? (
                      <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          value={clientContactSearch}
                          onChange={(e) => setClientContactSearch(e.target.value)}
                          placeholder="Search client contact"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="mt-3 max-h-56 overflow-y-auto">
                          {filteredClientContacts.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">No contacts for this client</p>
                          ) : (
                            filteredClientContacts.map((person) => {
                              const selected = selectedClientContacts.some((item) => item.id === person.id);
                              return (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={() => handleToggleClientContact(person)}
                                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                                    selected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>
                                    <span className="block font-medium">{person.name}</span>
                                    <span className="block text-xs text-slate-500">
                                      {[person.designation, person.department].filter(Boolean).join(' · ') ||
                                        'Client contact'}
                                    </span>
                                  </span>
                                  {selected ? <Check size={15} /> : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                    </>
                  ) : null}

                  {selectedInterviewers.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2" ref={roleMenuRef}>
                      {selectedInterviewers.map((person) => (
                        <div
                          key={person.id}
                          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <InterviewerInitialsAvatar name={person.name} size={7} />
                          <span className="text-sm font-medium text-slate-700">{person.name}</span>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenRoleMenuId((prev) => (prev === person.id ? null : person.id))}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {person.role}
                              <ChevronDown size={12} />
                            </button>
                            {openRoleMenuId === person.id ? (
                              <div className="absolute left-0 top-9 z-20 min-w-[150px] rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                                {INTERVIEW_PANEL_ROLES.map((roleOption) => (
                                  <button
                                    key={roleOption}
                                    type="button"
                                    onClick={() => {
                                      setSelectedInterviewers((prev) =>
                                        prev.map((item) =>
                                          item.id === person.id ? { ...item, role: roleOption } : item
                                        )
                                      );
                                      setOpenRoleMenuId(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    <span>{roleOption}</span>
                                    {person.role === roleOption ? <Check size={13} className="text-blue-600" /> : null}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {isInterviewerBooked(person.id) ? (
                            <span
                              title="Already booked at this time"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                            >
                              <AlertTriangle size={14} />
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!isStandaloneMode && selectedClientContacts.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedClientContacts.map((person) => (
                        <div
                          key={`client-${person.id}`}
                          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                            {getAvatarInitials(person.name)}
                          </span>
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800">{person.name}</span>
                            <span className="block text-[10px] text-emerald-700">
                              {selectedClient?.companyName ? `${selectedClient.companyName} · Client` : 'Client'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleClientContact(person)}
                            className="ml-1 rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                            aria-label={`Remove ${person.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send calendar invite to candidate</p>
                        <p className="text-xs text-slate-500">Email with date, time, meeting link will be sent</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendCandidateInvite((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendCandidateInvite ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendCandidateInvite ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send calendar invite to interviewers</p>
                        <p className="text-xs text-slate-500">Panel members will receive Google Calendar invite</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendInterviewerInvite((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendInterviewerInvite ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendInterviewerInvite ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Additional Notes</label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 500))}
                        rows={4}
                        placeholder="Any instructions for the panel or candidate..."
                        data-gramm="false"
                        data-gramm_editor="false"
                        data-enable-grammarly="false"
                        spellCheck
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-right text-xs text-slate-400">{additionalNotes.length}/500</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={!isFormValid || submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Scheduling...'
                    : selectedCandidates.length > 1
                      ? `Confirm Schedule (${selectedCandidates.length})`
                      : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
