export const DIRECTOR_DETAIL_LABELS = {
  salutation: 'Director Salutation',
  name: 'Director Name',
};

const DIRECTOR_LABEL_SET = new Set(Object.values(DIRECTOR_DETAIL_LABELS));

export function isDirectorDetailLabel(label) {
  return DIRECTOR_LABEL_SET.has(String(label || '').trim());
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

  push(DIRECTOR_DETAIL_LABELS.salutation, director.directorSalutation);
  push(DIRECTOR_DETAIL_LABELS.name, director.directorName);

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
