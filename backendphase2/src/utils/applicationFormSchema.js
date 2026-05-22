import crypto from 'crypto';

export const APPLICATION_FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'date',
  'yes_no',
  'single_choice',
  'multi_choice',
  'education',
  'work_history',
  'photo',
  'resume',
  'section_title',
];

export function generateFormFieldId() {
  return `f_${crypto.randomBytes(6).toString('hex')}`;
}

export function generateApplyLinkToken() {
  return crypto.randomBytes(18).toString('hex');
}

export function defaultApplicationFormSchema() {
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

export function normalizeApplicationFormSchema(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fields = Array.isArray(raw.fields) ? raw.fields : [];
  const normalized = fields
    .map((field, index) => {
      const type = APPLICATION_FORM_FIELD_TYPES.includes(field?.type)
        ? field.type
        : 'short_text';
      const label = String(field?.label || '').trim() || `Field ${index + 1}`;
      if (type === 'section_title') {
        return {
          id: String(field?.id || generateFormFieldId()),
          type,
          label,
          required: false,
          helpText: field?.helpText ? String(field.helpText) : undefined,
        };
      }
      const out = {
        id: String(field?.id || generateFormFieldId()),
        type,
        label,
        required: Boolean(field?.required),
        placeholder: field?.placeholder ? String(field.placeholder) : undefined,
        helpText: field?.helpText ? String(field.helpText) : undefined,
      };
      if (type === 'single_choice' || type === 'multi_choice') {
        out.options = Array.isArray(field?.options)
          ? field.options.map((o) => String(o).trim()).filter(Boolean)
          : ['Option 1', 'Option 2'];
      }
      return out;
    })
    .filter((f) => f.type === 'section_title' || f.label);

  if (!normalized.length) return null;
  return { version: 1, fields: normalized };
}

export function schemaFromLegacyQuestions(questions = []) {
  if (!Array.isArray(questions) || !questions.length) return defaultApplicationFormSchema();
  const fields = questions
    .map((raw) => {
      const text = String(raw || '').trim();
      if (!text) return null;
      if (text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed?.label) {
            return {
              id: parsed.id || generateFormFieldId(),
              type: parsed.type === 'yes_no' ? 'yes_no' : 'short_text',
              label: String(parsed.label),
              required: Boolean(parsed.required),
              options: parsed.options,
            };
          }
        } catch {
          /* plain text */
        }
      }
      return {
        id: generateFormFieldId(),
        type: 'short_text',
        label: text,
        required: false,
      };
    })
    .filter(Boolean);
  return normalizeApplicationFormSchema({ version: 1, fields }) || defaultApplicationFormSchema();
}
