export const DIRECTOR_DETAIL_LABELS = {
  salutation: 'Director Salutation',
  name: 'Director Name',
};

const DIRECTOR_LABEL_SET = new Set(Object.values(DIRECTOR_DETAIL_LABELS));
const DIRECTOR_NUMBERED_LABEL_REGEX =
  /^Director\s+(\d+)\s+(Salutation|Name|Email|Phone)$/i;

export function isDirectorDetailLabel(label) {
  const normalized = String(label || '').trim();
  return DIRECTOR_LABEL_SET.has(normalized) || DIRECTOR_NUMBERED_LABEL_REGEX.test(normalized);
}

export function directorFromOtherDetails(otherDetails) {
  const byLabel = new Map(
    (Array.isArray(otherDetails) ? otherDetails : []).map((item) => [
      String(item?.label || '').trim(),
      String(item?.value || '').trim(),
    ]),
  );
  return {
    directorSalutation: byLabel.get(DIRECTOR_DETAIL_LABELS.salutation) || '',
    directorName: byLabel.get(DIRECTOR_DETAIL_LABELS.name) || '',
  };
}

export function mergeDirectorIntoOtherDetails(existing, director = {}) {
  const base = (Array.isArray(existing) ? existing : []).filter(
    (item) => !isDirectorDetailLabel(item?.label),
  );
  const entries = [...base];
  const push = (label, value) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) entries.push({ label, value: trimmed });
  };

  // Support array of directors from API/UI
  if (Array.isArray(director)) {
    const list = director.filter((item) =>
      String(item?.name || item?.directorName || item?.email || item?.phone || '').trim(),
    );
    const primary = list[0] || {};
    push(DIRECTOR_DETAIL_LABELS.salutation, primary.salutation || primary.directorSalutation);
    push(DIRECTOR_DETAIL_LABELS.name, primary.name || primary.directorName);
    list.forEach((item, index) => {
      const position = index + 1;
      push(`Director ${position} Salutation`, item.salutation || item.directorSalutation);
      push(`Director ${position} Name`, item.name || item.directorName);
      push(`Director ${position} Email`, item.email);
      push(`Director ${position} Phone`, item.phone);
    });
    return entries.length ? entries : null;
  }

  push(DIRECTOR_DETAIL_LABELS.salutation, director.directorSalutation);
  push(DIRECTOR_DETAIL_LABELS.name, director.directorName);
  push('Director 1 Salutation', director.directorSalutation);
  push('Director 1 Name', director.directorName);
  if (director.email) push('Director 1 Email', director.email);
  if (director.phone) push('Director 1 Phone', director.phone);

  return entries.length ? entries : null;
}

export function resolveDirectorNameFromLeadContext(clientData = {}, lead = {}) {
  return String(
    clientData.directorName ||
      clientData.contactPerson ||
      clientData.primaryContact ||
      lead.directorName ||
      lead.contactPerson ||
      '',
  ).trim();
}

export function resolveDirectorSalutationFromLeadContext(clientData = {}, lead = {}) {
  return String(
    clientData.directorSalutation || lead.directorSalutation || '',
  ).trim();
}
