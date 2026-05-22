export type ApplicationFormFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'yes_no'
  | 'single_choice'
  | 'multi_choice'
  | 'education'
  | 'work_history'
  | 'photo'
  | 'resume'
  | 'section_title';

export interface ApplicationFormField {
  id: string;
  type: ApplicationFormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export interface ApplicationFormSchema {
  version: 1;
  fields: ApplicationFormField[];
}

export interface JobApplicationFormTemplate {
  id: string;
  name: string;
  schema: ApplicationFormSchema;
}

export const APPLICATION_FORM_FIELD_TYPE_OPTIONS: Array<{
  value: ApplicationFormFieldType;
  label: string;
}> = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'multi_choice', label: 'Multiple choice' },
  { value: 'education', label: 'Education (repeatable)' },
  { value: 'work_history', label: 'Work history (repeatable)' },
  { value: 'photo', label: 'Photo upload' },
  { value: 'resume', label: 'Resume upload' },
  { value: 'section_title', label: 'Section title' },
];

export function generateFormFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function defaultApplicationFormSchema(): ApplicationFormSchema {
  return {
    version: 1,
    fields: [
      { id: 'f_first', type: 'short_text', label: 'First name', required: true },
      { id: 'f_last', type: 'short_text', label: 'Last name', required: true },
      { id: 'f_email', type: 'email', label: 'Email address', required: true },
      { id: 'f_phone', type: 'phone', label: 'Phone number', required: true },
      { id: 'f_photo', type: 'photo', label: 'Profile photo', required: false },
      { id: 'f_resume', type: 'resume', label: 'Resume / CV', required: true },
      { id: 'f_edu', type: 'education', label: 'Education', required: false },
      { id: 'f_work', type: 'work_history', label: 'Work experience', required: false },
    ],
  };
}

export function normalizeApplicationFormSchema(raw: unknown): ApplicationFormSchema | null {
  if (!raw || typeof raw !== 'object') return null;
  const fields = Array.isArray((raw as ApplicationFormSchema).fields)
    ? (raw as ApplicationFormSchema).fields
    : [];
  const normalized = fields
    .map((field, index) => {
      const f = field as ApplicationFormField;
      const type = APPLICATION_FORM_FIELD_TYPE_OPTIONS.some((o) => o.value === f.type)
        ? f.type
        : 'short_text';
      const label = String(f.label || '').trim() || `Field ${index + 1}`;
      return {
        id: String(f.id || generateFormFieldId()),
        type,
        label,
        required: Boolean(f.required),
        placeholder: f.placeholder ? String(f.placeholder) : undefined,
        helpText: f.helpText ? String(f.helpText) : undefined,
        options:
          type === 'single_choice' || type === 'multi_choice'
            ? Array.isArray(f.options)
              ? f.options.map((o) => String(o).trim()).filter(Boolean)
              : ['Option 1', 'Option 2']
            : undefined,
      };
    })
    .filter((f) => f.type === 'section_title' || f.label);
  return normalized.length ? { version: 1, fields: normalized } : null;
}
