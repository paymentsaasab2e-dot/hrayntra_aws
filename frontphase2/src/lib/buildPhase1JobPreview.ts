import type { CreateJobDetailsFormData } from '../components/drawers/CreateJobDetailsForm';
import type { PublicJobOverviewJob } from '../components/jobs/PublicJobOverviewPanel';

function linesToList(text: string): string[] {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatExperienceRequired(min: string, max: string): string | null {
  const a = String(min || '').trim();
  const b = String(max || '').trim();
  if (a && b) return `${a}-${b}`;
  if (a) return a;
  if (b) return b;
  return null;
}

function formatPreviewLocation(city: string, state: string, country: string): string | null {
  const parts = [city, state, country].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function buildPhase1JobPreviewFromForm(
  form: CreateJobDetailsFormData,
  options?: { companyName?: string | null; jobDescriptionHtml?: string },
): PublicJobOverviewJob {
  const location = formatPreviewLocation(form.city, form.state, form.country);
  const experienceRequired = formatExperienceRequired(form.minExperience, form.maxExperience);

  return {
    title: form.jobTitle?.trim() || undefined,
    company: options?.companyName?.trim() || undefined,
    showClientNamePublicly: form.showClientNamePublicly,
    publicFieldVisibility: form.publicFieldVisibility,
    location: location || undefined,
    description: options?.jobDescriptionHtml?.trim() || undefined,
    overview: options?.jobDescriptionHtml?.trim() || undefined,
    keyResponsibilities: linesToList(form.keyResponsibilitiesText),
    requirements: linesToList(form.qualificationsExperienceText),
    candidateRequirements: linesToList(form.candidateRequirementsText),
    skills: form.skills || [],
    experienceRequired,
    employmentType: form.employmentType || null,
  };
}
