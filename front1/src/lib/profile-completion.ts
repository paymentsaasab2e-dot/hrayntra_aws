import { API_BASE_URL as DerivedAPI_BASE_URL } from './api-base';

export const API_BASE_URL = DerivedAPI_BASE_URL;

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  retries = 2,
  retryDelayMs = 500
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Network error while calling API");
}

export type ProfileSectionKey =
  | "basicInformation"
  | "summary"
  | "education"
  | "skills"
  | "languages"
  | "projects"
  | "portfolioLinks"
  | "careerPreferences"
  | "visaWorkAuthorization"
  | "vaccination"
  | "resume";

export interface ProfileSectionStatus {
  key: ProfileSectionKey;
  label: string;
  completionRule: string;
  schemaFields: string[];
  requiredFields: string[];
  missingFields: string[];
  isComplete: boolean;
}

export interface ProfileCompletenessResponse {
  candidateId: string;
  percentage: number;
  completedSections: string[];
  missingSections: string[];
  sections: ProfileSectionStatus[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function fetchProfileCompleteness(
  candidateId: string
): Promise<ProfileCompletenessResponse> {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/profile/completeness/${candidateId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = (await response.json()) as {
    success: boolean;
    message?: string;
    data?: ProfileCompletenessResponse;
  };

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "Failed to fetch profile completeness");
  }

  return result.data;
}

export async function askProfileQuestion(params: {
  currentSection: ProfileSectionKey;
  missingFields: string[];
  conversationHistory: ChatMessage[];
  userMessage?: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/ai/profile-questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const result = (await response.json()) as {
    success: boolean;
    message?: string;
    data?: { message?: string };
  };

  if (!response.ok || !result.success || !result.data?.message) {
    throw new Error(result.message || "Failed to fetch AI question");
  }

  return result.data.message;
}

export async function extractProfileData<T>(params: {
  currentSection: ProfileSectionKey;
  userMessage: string;
}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/ai/extract-profile-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const result = (await response.json()) as {
    success: boolean;
    message?: string;
    data?: { data?: T };
  };

  if (!response.ok || !result.success || !result.data?.data) {
    throw new Error(result.message || "Failed to extract profile data");
  }

  return result.data.data;
}

async function saveBasicInformation(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/personal-info/${candidateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveSummary(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/summary/${candidateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveEducation(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/education/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveSkills(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/skills/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveLanguages(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/languages/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveProject(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/project/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function savePortfolioLinks(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/portfolio-links/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveCareerPreferences(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/career-preferences/${candidateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveVisaAuthorization(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/visa-work-authorization/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveVaccination(candidateId: string, data: Record<string, unknown>) {
  return fetch(`${API_BASE_URL}/profile/vaccination/${candidateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function saveResume(candidateId: string, file: File) {
  const formData = new FormData();
  formData.append("resume", file);

  return fetch(`${API_BASE_URL}/profile/resume/upload/${candidateId}`, {
    method: "POST",
    body: formData,
  });
}

export async function saveSectionDraft(
  candidateId: string,
  sectionKey: ProfileSectionKey,
  data: unknown
): Promise<void> {
  let response: Response;

  switch (sectionKey) {
    case "basicInformation":
      response = await saveBasicInformation(candidateId, data as Record<string, unknown>);
      break;
    case "summary":
      response = await saveSummary(candidateId, data as Record<string, unknown>);
      break;
    case "education":
      response = await saveEducation(candidateId, data as Record<string, unknown>);
      break;
    case "skills":
      response = await saveSkills(candidateId, data as Record<string, unknown>);
      break;
    case "languages":
      response = await saveLanguages(candidateId, data as Record<string, unknown>);
      break;
    case "projects":
      response = await saveProject(candidateId, data as Record<string, unknown>);
      break;
    case "portfolioLinks":
      response = await savePortfolioLinks(candidateId, data as Record<string, unknown>);
      break;
    case "careerPreferences":
      response = await saveCareerPreferences(candidateId, data as Record<string, unknown>);
      break;
    case "visaWorkAuthorization":
      response = await saveVisaAuthorization(candidateId, data as Record<string, unknown>);
      break;
    case "vaccination":
      response = await saveVaccination(candidateId, data as Record<string, unknown>);
      break;
    case "resume": {
      const resumeData = data as { file?: File };
      if (!(resumeData.file instanceof File)) {
        throw new Error("Resume upload requires a file");
      }
      response = await saveResume(candidateId, resumeData.file);
      break;
    }
    default:
      throw new Error(`Unsupported section: ${sectionKey satisfies never}`);
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(result?.message || `Failed to save ${sectionKey}`);
  }
}
