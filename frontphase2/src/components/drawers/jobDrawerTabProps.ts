import type { JobForDrawer, JobCandidateItem, JobPipelineStage, JobApplicationSubmission } from './jobDetailsShared';

export interface ClientTabProps {
  "clientRemarkCandidates": Array<import("../../lib/api").JobClientRemarkCandidate>;
  "clientRemarksClientName": string;
  "clientRemarksError": string;
  "displayJobCandidates": Array<JobCandidateItem>;
  "job": JobForDrawer;
  "loadingClientRemarks": boolean;
  "mapJobCandidateToTableRow": (candidate: JobCandidateItem, jobTitle?: string | null, jobId?: string | null) => import("../../app/candidate/components/CandidateTable").Candidate;
  "onViewCandidateProfile": ((candidate: import("../../app/candidate/components/CandidateTable").Candidate) => void) | undefined;
}

export interface PipelineTabProps {
  "PIPELINE_SYSTEM_ROLE_OPTIONS": Array<{ value: string; label: string; }>;
  "draggedStageId": string | null;
  "handleAddStage": () => void;
  "handlePipelineReorder": (fromIndex: number, toIndex: number) => void;
  "handleRemoveStage": (id: string) => void;
  "handleStageNameChange": (id: string, name: string) => void;
  "handleStageSlaChange": (id: string, sla: string) => void;
  "handleStageSystemRoleChange": (id: string, systemRole: string) => void;
  "isDefaultPipelineStage": (stage: JobPipelineStage) => boolean;
  "job": JobForDrawer;
  "notifyPipelineChange": (stages: JobPipelineStage[]) => void;
  "onSavePipelineStages": ((stages: JobPipelineStage[]) => void) | undefined;
  "pipelineConfigLocked": boolean;
  "pipelineDirty": boolean;
  "pipelineStageCountCards": Array<{ id: string; name: string; count: number; }>;
  "pipelineStages": Array<JobPipelineStage>;
  "pipelineValidationError": string;
  "setDraggedStageId": (value: import("react").SetStateAction<string | null>) => void;
  "setJobPipelineCustomized": (value: import("react").SetStateAction<boolean>) => void;
  "setPipelineDirty": (value: import("react").SetStateAction<boolean>) => void;
  "setPipelineStages": (value: import("react").SetStateAction<Array<JobPipelineStage>>) => void;
  "setPipelineValidationError": (value: import("react").SetStateAction<string>) => void;
}

export interface AnalyticsTabProps {
  "job": JobForDrawer;
}

export interface AssignmentTabProps {
  "applyAssignmentMemberIds": (ids: string[]) => void;
  "assignable": { canSelectCompany: boolean; mayPickCompany: boolean; companies: Array<import("../../hooks/useAssignableMembers").AssignCompanyOption>; companyId: string; setCompanyId: import("react").Dispatch<import("react").SetStateAction<string>>; members: Array<import("../../types/team").TeamMember>; users: Array<import("../../lib/api").BackendUser>; loading: boolean; companiesReady: boolean; };
  "assignmentContacts": Array<{ id: string; name: string; }>;
  "assignmentCurrentUserId": string;
  "assignmentDirty": boolean;
  "assignmentHiringManagerId": string;
  "assignmentHiringManagerName": string;
  "assignmentManagerId": string;
  "assignmentManagerUsers": Array<import("../../lib/api").BackendUser>;
  "assignmentMemberIds": Array<string>;
  "assignmentRecruiterMenuPosition": { left: number; width: number; placement: "top" | "bottom"; top?: number; bottom?: number; maxHeight: number; } | null;
  "assignmentRecruiterMenuRef": import("react").MutableRefObject<HTMLDivElement | null>;
  "assignmentRecruiterOpen": boolean;
  "assignmentRecruiterTriggerRef": import("react").MutableRefObject<HTMLButtonElement | null>;
  "closeAssignmentRecruiterMenu": () => void;
  "filteredAssignmentRecruiters": Array<import("../../lib/api").BackendUser>;
  "job": JobForDrawer;
  "loadingAssignmentMeta": boolean;
  "loadingAssignmentRecruiters": boolean;
  "needsAssignmentManagerFirst": boolean;
  "needsAssignmentOrganizationFirst": boolean;
  "saveAssignment": () => Promise<void>;
  "savingAssignment": boolean;
  "selectAssignmentManager": (userId: string) => void;
  "selectedAssignmentAssignees": Array<import("../../lib/api").BackendUser>;
  "setAssignmentDirty": (value: import("react").SetStateAction<boolean>) => void;
  "setAssignmentHiringManagerId": (value: import("react").SetStateAction<string>) => void;
  "setAssignmentHiringManagerName": (value: import("react").SetStateAction<string>) => void;
  "setAssignmentManagerId": (value: import("react").SetStateAction<string>) => void;
  "setAssignmentMemberIds": (value: import("react").SetStateAction<Array<string>>) => void;
  "setAssignmentRecruiterOpen": (value: import("react").SetStateAction<boolean>) => void;
}

export interface InterviewsTabProps {
  "candidateNameFromInterview": (item: import("../../lib/api").BackendInterviewListItem) => string;
  "filteredJobInterviews": Array<import("../../lib/api").BackendInterviewListItem>;
  "formatInterviewListStatus": (status: string) => string;
  "formatInterviewTypeLabel": (item: import("../../lib/api").BackendInterviewListItem) => string;
  "interviewListStatusBadgeClass": (statusLabel: string) => string;
  "jobInterviewAllCandidateCount": number;
  "jobInterviewCountsByRound": { [x: number]: number; };
  "jobInterviewRoundById": { [x: string]: number; };
  "jobInterviewRoundNumbers": Array<number>;
  "jobInterviews": Array<import("../../lib/api").BackendInterviewListItem>;
  "loadingJobInterviews": boolean;
  "onScheduleInterview": ((candidateId: string, jobId: string, pendingStage?: { stageId: string; stageName: string; }, bulkCandidateIds?: string[]) => void) | undefined;
  "openScheduleInterviewCandidatePicker": () => Promise<void>;
  "panelNamesFromInterview": (item: import("../../lib/api").BackendInterviewListItem) => string;
  "selectedInterviewRound": number | "all";
  "setJobInterviewDetailOpen": (value: import("react").SetStateAction<boolean>) => void;
  "setSelectedInterviewRound": (value: import("react").SetStateAction<number | "all">) => void;
  "setSelectedJobInterview": (value: import("react").SetStateAction<import("../../lib/api").BackendInterviewListItem | null>) => void;
}

export interface PlacementsTabProps {
  "candidateNameFromPlacement": (item: import("../../types/placement").Placement) => string;
  "formatPlacementStatusLabel": (status: string) => string;
  "job": JobForDrawer;
  "jobPlacements": Array<import("../../types/placement").Placement>;
  "loadingJobPlacements": boolean;
}

export interface ActivityTabProps {
  "activityFilter": "Candidates" | "Interviews" | "Files" | "All" | "Jobs" | "Notes";
  "job": JobForDrawer;
  "jobActivities": Array<import("../../lib/api").BackendActivity>;
  "loadingActivities": boolean;
  "setActivityFilter": (value: import("react").SetStateAction<"Candidates" | "Interviews" | "Files" | "All" | "Jobs" | "Notes">) => void;
}

export interface NotesTabProps {
  "job": JobForDrawer;
}

export interface ChatTabProps {
  "activeTab": "chat";
  "isOpen": true;
  "job": JobForDrawer;
}

export interface JobDrawerModalsProps {
  "confirmScheduleInterviewCandidatePicker": () => void;
  "confirmSubmitCandidatePicker": () => void;
  "displayJobCandidates": Array<JobCandidateItem>;
  "setDisplayJobCandidates"?: import("react").Dispatch<import("react").SetStateAction<Array<JobCandidateItem>>>;
  "onJobCandidatesChange"?: (candidates: Array<JobCandidateItem>) => void;
  "ensurePickerCvMeta": (candidateId: string) => void;
  "isOpen": boolean;
  "job": JobForDrawer | null;
  "jobInterviewDetailOpen": boolean;
  "moveStageCandidate": import("./candidateProfileDrawerData").CandidateProfileDrawerData | null;
  "moveStageModalOpen": boolean;
  "onAddToPipeline": ((payload: { candidateId: string; jobId: string; stage: string; recruiterId?: string; priority: "High" | "Medium" | "Low"; notes?: string; }) => void | Promise<void>) | undefined;
  "onClose": () => void;
  "onCreatePlacement": ((candidateId: string, jobId: string, pendingStage?: { stageId: string; stageName: string; }) => void) | undefined;
  "onRemoveFromPipeline": ((payload: { candidateId: string; jobId: string; }) => void | Promise<void>) | undefined;
  "onScheduleInterview": ((candidateId: string, jobId: string, pendingStage?: { stageId: string; stageName: string; }, bulkCandidateIds?: string[]) => void) | undefined;
  "openFromJobDrawerRow": (row: JobCandidateItem, jobId: string, jobTitle?: string, clientId?: string) => void;
  "openPickerUpdatedCvEditor": (candidateId: string, candidateName: string) => Promise<void>;
  "pickerCandidates": Array<JobCandidateItem>;
  "pickerCvMetaById": { [x: string]: import("./jobDetailsShared").PickerCvMeta; };
  "pickerCvMetaLoading": boolean;
  "pickerCvModeById": { [x: string]: import("../../lib/cvEditorMapping").CvShareMode; };
  "pickerResumeFileIdById": { [x: string]: string; };
  "pickerResumePreview": { url: string; name: string; } | null;
  "pickerSaasaCv": { open: boolean; openModal: () => void; closeModal: () => void; busy: boolean; preferredResumeViewMode: import("../../lib/cvEditorMapping").ResumeCvViewMode | null; annotationCount: number; stored: import("../../lib/saasaCvAnnotations").SaasaCvAnnotationsStored | null; deleteSavedCv: () => Promise<boolean>; modals: import("react").JSX.Element; };
  "pickerSaasaTarget": { id: string; name: string; resumeUrl: string | null; extraData: Record<string, unknown> | null; } | null;
  "pickerScopeIds": Array<string> | null;
  "pickerSearch": string;
  "pickerSelectedIds": Array<string>;
  "pipelineJobOptions": Array<import("./CandidateProfileDrawer").CandidatePipelineJobOption>;
  "pipelineRecruiters": Array<import("./CandidateProfileDrawer").CandidatePipelineRecruiterOption>;
  "refreshAppliedJobCandidates": (opts?: { runPipeline?: boolean; refresh?: boolean; silent?: boolean; seedOverride?: JobCandidateItem[]; }) => Promise<Array<JobCandidateItem>>;
  "refreshJobInterviews": () => void;
  "scheduleCandidatePickerOpen": boolean;
  "schedulePickerCandidates": Array<JobCandidateItem>;
  "schedulePickerSearch": string;
  "schedulePickerSelectedIds": Array<string>;
  "selectedJobInterview": import("../../lib/api").BackendInterviewListItem | null;
  "setJobInterviewDetailOpen": (value: import("react").SetStateAction<boolean>) => void;
  "setMoveStageCandidate": (value: import("react").SetStateAction<import("./candidateProfileDrawerData").CandidateProfileDrawerData | null>) => void;
  "setMoveStageModalOpen": (value: import("react").SetStateAction<boolean>) => void;
  "setPickerCvModeById": (value: import("react").SetStateAction<Record<string, import("../../lib/cvEditorMapping").CvShareMode>>) => void;
  "setPickerResumeFileIdById": (value: import("react").SetStateAction<Record<string, string>>) => void;
  "setPickerResumePreview": (value: import("react").SetStateAction<{ url: string; name: string; } | null>) => void;
  "setPickerScopeIds": (value: import("react").SetStateAction<Array<string> | null>) => void;
  "setPickerSearch": (value: import("react").SetStateAction<string>) => void;
  "setPickerSelectedIds": (value: import("react").SetStateAction<Array<string>>) => void;
  "setScheduleCandidatePickerOpen": (value: import("react").SetStateAction<boolean>) => void;
  "setSchedulePickerSearch": (value: import("react").SetStateAction<string>) => void;
  "setSchedulePickerSelectedIds": (value: import("react").SetStateAction<Array<string>>) => void;
  "setSelectedJobInterview": (value: import("react").SetStateAction<import("../../lib/api").BackendInterviewListItem | null>) => void;
  "setSubmitCandidatePickerOpen": (value: import("react").SetStateAction<boolean>) => void;
  "setSubmitClientRowId": (value: import("react").SetStateAction<string | null>) => void;
  "submitCandidatePickerOpen": boolean;
  "submitToClientModal": import("react").JSX.Element | null;
}

export interface UseJobPipelineTabParams {
  "initialPipelineStages": Array<JobPipelineStage> | undefined;
  "job": JobForDrawer | null;
  "onPipelineStagesChange": ((stages: JobPipelineStage[]) => void) | undefined;
}

export interface UseJobCandidateActionsParams {
  "activeTab": "overview" | "assessments" | "candidates" | "client" | "pipeline" | "analytics" | "assignment" | "interviews" | "placements" | "activity" | "chat" | "notes" | "files";
  "isOpen": boolean;
  "job": JobForDrawer | null;
  "jobCandidates": Array<JobCandidateItem>;
  "onAddToPipeline": ((payload: { candidateId: string; jobId: string; stage: string; recruiterId?: string; priority: "High" | "Medium" | "Low"; notes?: string; }) => void | Promise<void>) | undefined;
  "onCreatePlacement": ((candidateId: string, jobId: string, pendingStage?: { stageId: string; stageName: string; }) => void) | undefined;
  "onJobCandidatesChange": ((candidates: JobCandidateItem[]) => void) | undefined;
  "onScheduleInterview": ((candidateId: string, jobId: string, pendingStage?: { stageId: string; stageName: string; }, bulkCandidateIds?: string[]) => void) | undefined;
  "onViewCandidateProfile": ((candidate: import("../../app/candidate/components/CandidateTable").Candidate) => void) | undefined;
  "pipelineStages": Array<JobPipelineStage>;
  "setActiveTab": (value: import("react").SetStateAction<"overview" | "assessments" | "candidates" | "client" | "pipeline" | "analytics" | "assignment" | "interviews" | "placements" | "activity" | "chat" | "notes" | "files">) => void;
}

export interface UseJobTabDataParams {
  "activeTab": "overview" | "assessments" | "candidates" | "client" | "pipeline" | "analytics" | "assignment" | "interviews" | "placements" | "activity" | "chat" | "notes" | "files";
  "displayJobCandidates": Array<JobCandidateItem>;
  "isOpen": boolean;
  "job": JobForDrawer | null;
  "refreshAppliedJobCandidates": (opts?: { runPipeline?: boolean; refresh?: boolean; silent?: boolean; seedOverride?: JobCandidateItem[]; }) => Promise<Array<JobCandidateItem>>;
}

export interface UseJobAssignmentTabParams {
  "activeTab": "overview" | "assessments" | "candidates" | "client" | "pipeline" | "analytics" | "assignment" | "interviews" | "placements" | "activity" | "chat" | "notes" | "files";
  "isOpen": boolean;
  "job": JobForDrawer | null;
  "onAssignmentUpdated": ((jobId: string) => void | Promise<void>) | undefined;
}

export interface UseJobDrawerHeaderParams {
  "isOpen": boolean;
  "job": JobForDrawer | null;
  "onStatusUpdated": ((jobId: string, status: string) => void) | undefined;
}
