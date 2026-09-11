import {
  DIRECTOR_DETAIL_LABELS,
  isDirectorDetailLabel,
  mergeDirectorsIntoOtherDetails,
  type DirectorListItem,
} from './directorFormDetails';

export { DIRECTOR_DETAIL_LABELS, isDirectorDetailLabel } from './directorFormDetails';

export type DirectorStoredDetails = {
  directorSalutation: string;
  directorName: string;
};

export function directorFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): DirectorStoredDetails {
  const byLabel = new Map(
    (otherDetails ?? []).map((item) => [String(item.label || '').trim(), String(item.value || '').trim()]),
  );
  return {
    directorSalutation: byLabel.get(DIRECTOR_DETAIL_LABELS.salutation) || '',
    directorName: byLabel.get(DIRECTOR_DETAIL_LABELS.name) || '',
  };
}

export function mergeDirectorIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  director:
    | { directorSalutation?: string | null; directorName?: string | null }
    | DirectorListItem[],
): Array<{ label: string; value: string }> | undefined {
  if (Array.isArray(director)) {
    return mergeDirectorsIntoOtherDetails(existing, director);
  }

  return mergeDirectorsIntoOtherDetails(existing, [
    {
      salutation: director.directorSalutation || '',
      name: director.directorName || '',
      email: '',
      phone: '',
    },
  ]);
}
