'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Pencil, Plus, Search, X } from 'lucide-react';
import type { JobPublicFieldVisibility } from '../../lib/jobPublicFieldVisibility';
import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';
import { LanguageSuggestInput, ProficiencySuggestInput } from '../forms/LanguageProficiencySuggestInput';
import { JobLocationFields } from '../location/JobLocationFields';
import { EditDateField } from '../candidates/EditDateField';
import { isOwnCompanyWorkspaceClient, type BackendClient, type BackendUser } from '../../lib/api';
import { useAssignableMembers } from '../../hooks/useAssignableMembers';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';
import { formatAssigneeDisplayName } from '../../lib/assigneeDisplay';
import {
  formatJobSalaryCurrencyLabel,
  listCustomJobSalaryCurrencies,
  listCustomJobSalaryCurrencyEntries,
  mergeJobSalaryCurrencyOptions,
  saveCustomJobSalaryCurrency,
  updateCustomJobSalaryCurrency,
} from '../../constants/jobSalary';
import {
  createEmptyCustomJdSection,
  type JobCustomJdSection,
} from '../../lib/jobCustomJdSections';
import {
  isSyntheticJobContactId,
  type JobContactPersonOption,
} from '../../lib/jobClientContacts';
import { useDrawerPortalDropdownPosition } from './drawerFormUi';

export interface JobLanguageEntry {
  language: string;
  proficiency: string;
}

export interface CreateJobDetailsFormData {
  nationality: string;
  jobTitle: string;
  priority: string;
  companyId: string;
  showClientNamePublicly: boolean;
  contactPersonId: string;
  contactPersonName: string;
  numberOfOpenings: string;
  country: string;
  state: string;
  city: string;
  industryType: string;
  employmentType: string;
  targetHireDate: string;
  minExperience: string;
  maxExperience: string;
  payRangeMin: string;
  payRangeMax: string;
  salaryCurrency: string;
  languages: JobLanguageEntry[];
  skills: string[];
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  /** Extra JD sections parsed from the description or added manually. */
  customJdSections?: JobCustomJdSection[];
  videoMediaLink: string;
  forecastRevenue: string;
  managerId: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedToCompanyId?: string;
  /** Ordered assignee list — first is primary recruiter; rest are supporting. */
  assignedToIds?: string[];
  aboutCompany: string;
  publicFieldVisibility: JobPublicFieldVisibility;
  postingOrgUnitId?: string;
  postingCompanyName?: string;
}

type ContactOption = JobContactPersonOption;

interface CreateJobDetailsFormProps {
  formData: CreateJobDetailsFormData;
  setFormData: (patch: Partial<CreateJobDetailsFormData> | ((prev: CreateJobDetailsFormData) => Partial<CreateJobDetailsFormData>)) => void;
  clients: BackendClient[];
  users: BackendUser[];
  contacts: ContactOption[];
  loadingClients: boolean;
  loadingUsers: boolean;
  loadingContacts: boolean;
  dropdownsOpen: Record<string, boolean>;
  setDropdownsOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  skillInput: string;
  setSkillInput: (value: string) => void;
  onAddSkill: () => void;
  onRemoveSkill: (index: number) => void;
  /** Standalone tenants use an internal workspace company — hide client picker. */
  hideCompanyField?: boolean;
  standaloneWorkspaceName?: string;
  /** Overlay for own-company / workspace name: org unit when companies exist, else tenant company. */
  ownCompanyDisplayName?: string;
  /** Standalone banner heading — Organization vs Company. */
  workspaceOwnerHeading?: string;
  /** Standalone / request flow: job is owned by a Line Manager. */
  useLineManagerPicker?: boolean;
  lineManagerOptions?: BackendUser[];
  loadingLineManagers?: boolean;
  postingCompanyOptions?: { id: string; name: string }[];
  canChoosePostingCompany?: boolean;
  postingCompanyFieldLabel?: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const compactInputClass =
  'rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

function FieldLabelRow({
  label,
  required,
  labelAction,
}: {
  label: string;
  required?: boolean;
  labelAction?: React.ReactNode;
}) {
  return (
    <div className={`${labelAction ? 'mb-2 flex flex-wrap items-center justify-between gap-2' : ''}`}>
      <label className={labelAction ? 'mb-0 block text-sm font-medium text-slate-700' : labelClass}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {labelAction}
    </div>
  );
}

function ListTextareaField({
  label,
  value,
  onChange,
  placeholder,
  labelAction,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  labelAction?: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabelRow label={label} labelAction={labelAction} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter one item per line'}
        rows={4}
        className={`${inputClass} min-h-[100px] resize-y`}
      />
      <p className="mt-1 text-xs text-slate-500">One item per line</p>
    </div>
  );
}

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship', 'Freelance'];

function DropdownField({
  label,
  required,
  placeholder,
  valueLabel,
  openKey,
  dropdownsOpen,
  setDropdownsOpen,
  searchable,
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder = 'Search…',
  labelAction,
  children,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  valueLabel?: string;
  openKey: string;
  dropdownsOpen: Record<string, boolean>;
  setDropdownsOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  searchable?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchPlaceholder?: string;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isOpen = Boolean(dropdownsOpen[openKey]);
  const closeMenu = useCallback(() => {
    setDropdownsOpen((prev) => ({ ...prev, [openKey]: false }));
  }, [openKey, setDropdownsOpen]);
  // Portal + prefer upward so Create Job review step menus aren't clipped by overflow.
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(isOpen, true, closeMenu);

  const menu =
    isOpen && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: menuPosition.width,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {searchable ? (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange?.(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={searchPlaceholder}
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            ) : null}
            <ul className="max-h-52 overflow-y-auto py-1">{children}</ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div>
      <div className={`${labelAction ? 'mb-2 flex flex-wrap items-center justify-between gap-2' : ''}`}>
        <label className={labelAction ? 'mb-0 block text-sm font-medium text-slate-700' : labelClass}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropdownsOpen((prev) => ({ ...prev, [openKey]: !prev[openKey] }))}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {valueLabel ? <span>{valueLabel}</span> : <span className="text-slate-400">{placeholder}</span>}
          <ChevronDown
            size={16}
            className={`text-slate-400 shrink-0 transition-transform ${
              isOpen && menuPosition?.placement === 'top' ? 'rotate-180' : ''
            }`}
          />
        </button>
        {menu}
      </div>
    </div>
  );
}

export function CreateJobDetailsForm({
  formData,
  setFormData,
  clients,
  users,
  contacts,
  loadingClients,
  loadingUsers: _loadingUsers,
  loadingContacts,
  dropdownsOpen,
  setDropdownsOpen,
  skillInput,
  setSkillInput,
  onAddSkill,
  onRemoveSkill,
  hideCompanyField = false,
  standaloneWorkspaceName,
  ownCompanyDisplayName,
  workspaceOwnerHeading,
  useLineManagerPicker = false,
  lineManagerOptions = [],
  loadingLineManagers = false,
  postingCompanyOptions = [],
  canChoosePostingCompany = false,
  postingCompanyFieldLabel = 'Company name',
}: CreateJobDetailsFormProps) {
  const assignable = useAssignableMembers(true, 'Jobs', {
    initialCompanyId: formData.assignedToCompanyId,
  });
  const recruiterUsers = assignable.users;
  const loadingRecruiters = assignable.loading;
  const recruiterMenuOpen = Boolean(dropdownsOpen.recruiter);
  const closeRecruiterMenu = useCallback(() => {
    setDropdownsOpen((prev) => ({ ...prev, recruiter: false }));
  }, [setDropdownsOpen]);
  const {
    triggerRef: recruiterTriggerRef,
    menuRef: recruiterMenuRef,
    menuPosition: recruiterMenuPosition,
  } = useDrawerPortalDropdownPosition(recruiterMenuOpen, true, closeRecruiterMenu);

  /** Managers of the selected organization: people who have reports, or manager-role users. */
  const managerUsers = useMemo(() => {
    const byId = new Map<string, BackendUser>();
    const reportCount = new Map<string, number>();

    for (const member of assignable.members) {
      const managerId = String(member.manager?.id || member.managerId || '').trim();
      if (!managerId) continue;
      reportCount.set(managerId, (reportCount.get(managerId) || 0) + 1);
      if (byId.has(managerId)) continue;
      if (member.manager?.id === managerId) {
        const name = [member.manager.firstName, member.manager.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        byId.set(managerId, {
          id: managerId,
          name: name || 'Manager',
          email: member.manager.email || '',
          role: 'Manager',
          isActive: true,
          createdAt: '',
        });
      }
    }

    const looksLikeManager = (user: BackendUser) => {
      const role = String(user.role || '').toLowerCase();
      return (
        role.includes('manager') ||
        role.includes('director') ||
        role.includes('head') ||
        role.includes('lead')
      );
    };

    if (useLineManagerPicker) {
      for (const user of lineManagerOptions) {
        byId.set(user.id, user);
      }
    }

    for (const user of recruiterUsers) {
      if (reportCount.has(user.id) || looksLikeManager(user)) {
        byId.set(user.id, user);
      }
    }

    for (const user of lineManagerOptions) {
      byId.set(user.id, user);
    }

    // Fallback: if hierarchy has no managers yet, allow any org member.
    if (byId.size === 0) {
      for (const user of recruiterUsers) {
        byId.set(user.id, user);
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
  }, [assignable.members, lineManagerOptions, recruiterUsers, useLineManagerPicker]);

  const loadingManagerOptions = loadingLineManagers || loadingRecruiters;
  const needsOrganizationFirst = assignable.canSelectCompany && !assignable.companyId;
  const needsManagerFirst = !formData.managerId;

  /** Team under the selected manager only (org → manager → team). Manager is never listed as a recruiter. */
  const filteredRecruiterUsers = useMemo(() => {
    if (!formData.managerId) return [];
    return recruiterUsers.filter((user) => {
      if (user.id === formData.managerId) return false;
      const member = assignable.members.find((row) => row.id === user.id);
      const reportsTo = member?.manager?.id || member?.managerId || user.managerId || '';
      return reportsTo === formData.managerId;
    });
  }, [assignable.members, formData.managerId, recruiterUsers]);
  const selectedCompany = clients.find((c) => c.id === formData.companyId);
  const ownCompanyName = (client: BackendClient) =>
    ownCompanyDisplayName || client.companyName || 'Your organization';
  const companyValueLabel = selectedCompany
    ? isOwnCompanyWorkspaceClient(selectedCompany)
      ? `Own company · ${ownCompanyName(selectedCompany)}`
      : selectedCompany.companyName
    : undefined;
  const selectedAssigneeIds = useMemo(() => {
    if (Array.isArray(formData.assignedToIds) && formData.assignedToIds.length) {
      return formData.assignedToIds.filter(Boolean);
    }
    return formData.assignedToId ? [formData.assignedToId] : [];
  }, [formData.assignedToId, formData.assignedToIds]);

  const selectedAssignees = useMemo(() => {
    const managerId = String(formData.managerId || '').trim();
    return selectedAssigneeIds
      .filter((id) => id !== managerId)
      .map((id) => {
        const fromFiltered = filteredRecruiterUsers.find((u) => u.id === id);
        if (fromFiltered) return fromFiltered;
        const fromAll =
          recruiterUsers.find((u) => u.id === id) || users.find((u) => u.id === id);
        if (fromAll) return fromAll;
        if (id === formData.assignedToId && formData.assignedToName) {
          return { id, name: formData.assignedToName, email: '', role: '', isActive: true, createdAt: '' };
        }
        return null;
      })
      .filter(Boolean) as BackendUser[];
  }, [
    filteredRecruiterUsers,
    formData.assignedToId,
    formData.assignedToName,
    formData.managerId,
    recruiterUsers,
    selectedAssigneeIds,
    users,
  ]);

  const selectedManager =
    managerUsers.find((u) => u.id === formData.managerId) ||
    (formData.managerId
      ? lineManagerOptions.find((u) => u.id === formData.managerId)
      : undefined);
  const selectedManagerLabel = selectedManager
    ? formatAssigneeDisplayName(selectedManager) || selectedManager.name
    : '';

  const applyAssigneeIds = useCallback(
    (ids: string[]) => {
      const selectedManagerId = String(formData.managerId || '').trim();
      const unique = [
        ...new Set(
          ids
            .map((id) => String(id || '').trim())
            .filter((id) => id && id !== selectedManagerId),
        ),
      ];
      const primary = unique[0] || '';
      const primaryUser =
        filteredRecruiterUsers.find((u) => u.id === primary) ||
        recruiterUsers.find((u) => u.id === primary) ||
        users.find((u) => u.id === primary);
      const primaryMember = assignable.members.find((row) => row.id === primary);
      const managerId =
        primaryMember?.manager?.id || primaryMember?.managerId || primaryUser?.managerId || '';
      setFormData({
        assignedToIds: unique,
        assignedToId: primary,
        assignedToName: primaryUser
          ? formatAssigneeDisplayName(primaryUser) || primaryUser.name
          : '',
        assignedToCompanyId: assignable.companyId || formData.assignedToCompanyId,
        ...(managerId && !formData.managerId ? { managerId } : {}),
      });
    },
    [
      assignable.companyId,
      assignable.members,
      filteredRecruiterUsers,
      formData.assignedToCompanyId,
      formData.managerId,
      recruiterUsers,
      setFormData,
      users,
    ],
  );

  const selectManager = (userId: string) => {
    const patch: Partial<CreateJobDetailsFormData> = { managerId: userId };
    if (selectedAssigneeIds.length) {
      const kept = selectedAssigneeIds.filter((id) => {
        if (userId && id === userId) return false; // manager cannot also be a recruiter
        const member = assignable.members.find((row) => row.id === id);
        const reportsTo = member?.manager?.id || member?.managerId || '';
        return !userId || reportsTo === userId;
      });
      if (kept.length !== selectedAssigneeIds.length) {
        const primary = kept[0] || '';
        const primaryUser =
          recruiterUsers.find((u) => u.id === primary) ||
          users.find((u) => u.id === primary);
        patch.assignedToIds = kept;
        patch.assignedToId = primary;
        patch.assignedToName = primaryUser
          ? formatAssigneeDisplayName(primaryUser) || primaryUser.name
          : '';
      }
    }
    setFormData(patch);
    setDropdownsOpen((prev) => ({ ...prev, manager: false }));
  };

  const toggleAssignee = (user: BackendUser) => {
    const exists = selectedAssigneeIds.includes(user.id);
    const next = exists
      ? selectedAssigneeIds.filter((id) => id !== user.id)
      : [...selectedAssigneeIds, user.id];
    applyAssigneeIds(next);
  };

  const clearAssignees = () => {
    applyAssigneeIds([]);
    closeRecruiterMenu();
  };

  const selectedContact =
    contacts.find((c) => c.id === formData.contactPersonId) ||
    contacts.find(
      (c) =>
        !formData.contactPersonId &&
        formData.contactPersonName &&
        c.name === formData.contactPersonName,
    );
  const directorContacts = contacts.filter((c) => c.role === 'Director');
  const teamMemberContacts = contacts.filter((c) => c.role === 'Team Member');
  const otherContacts = contacts.filter((c) => c.role === 'Contact');

  const selectContact = (contact: ContactOption) => {
    patchForm({
      contactPersonId: isSyntheticJobContactId(contact.id) ? '' : contact.id,
      contactPersonName: contact.name,
    });
    setDropdownsOpen((prev) => ({ ...prev, contact: false }));
  };

  const renderContactOption = (contact: ContactOption) => (
    <li key={contact.id}>
      <button
        type="button"
        onClick={() => selectContact(contact)}
        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
          (formData.contactPersonId && formData.contactPersonId === contact.id) ||
          (!formData.contactPersonId && formData.contactPersonName === contact.name)
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-slate-700'
        }`}
      >
        {contact.name}
      </button>
    </li>
  );
  const [clientSearch, setClientSearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [customCurrencies, setCustomCurrencies] = useState<string[]>(() => listCustomJobSalaryCurrencies());
  const [customCurrencyEntries, setCustomCurrencyEntries] = useState(() =>
    listCustomJobSalaryCurrencyEntries(),
  );
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [editingCurrencyCode, setEditingCurrencyCode] = useState<string | null>(null);
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [currencyAddError, setCurrencyAddError] = useState('');

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const name = client.companyName?.toLowerCase() || '';
      const industry = client.industry?.toLowerCase() || '';
      const location = client.location?.toLowerCase() || '';
      const website = client.website?.toLowerCase() || '';
      const ownLabel = isOwnCompanyWorkspaceClient(client)
        ? `own company ${ownCompanyDisplayName || ''}`.toLowerCase()
        : '';
      return (
        name.includes(query) ||
        industry.includes(query) ||
        location.includes(query) ||
        website.includes(query) ||
        ownLabel.includes(query)
      );
    });
  }, [clients, clientSearch, ownCompanyDisplayName]);

  const currencyOptions = useMemo(
    () => mergeJobSalaryCurrencyOptions(customCurrencies),
    [customCurrencies],
  );

  const customCurrencyCodeSet = useMemo(() => new Set(customCurrencies), [customCurrencies]);

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return currencyOptions;
    return currencyOptions.filter((code) => {
      const label = formatJobSalaryCurrencyLabel(code).toLowerCase();
      return code.toLowerCase().includes(query) || label.includes(query);
    });
  }, [currencyOptions, currencySearch]);

  useEffect(() => {
    if (!dropdownsOpen.company) {
      setClientSearch('');
    }
  }, [dropdownsOpen.company]);

  useEffect(() => {
    if (!dropdownsOpen.currency) {
      setCurrencySearch('');
    }
  }, [dropdownsOpen.currency]);

  const patchForm = (patch: Partial<CreateJobDetailsFormData>) => setFormData(patch);

  const refreshCustomCurrencies = () => {
    setCustomCurrencyEntries(listCustomJobSalaryCurrencyEntries());
    setCustomCurrencies(listCustomJobSalaryCurrencies());
  };

  const closeCurrencyEditor = () => {
    setAddingCurrency(false);
    setEditingCurrencyCode(null);
    setNewCurrencyCode('');
    setNewCurrencySymbol('');
    setCurrencyAddError('');
  };

  const openAddCurrency = () => {
    setDropdownsOpen((prev) => ({ ...prev, currency: false }));
    setEditingCurrencyCode(null);
    setNewCurrencyCode('');
    setNewCurrencySymbol('');
    setCurrencyAddError('');
    setAddingCurrency((open) => !open);
  };

  const openEditCurrency = (code: string) => {
    const entry = customCurrencyEntries.find((item) => item.code === code);
    setDropdownsOpen((prev) => ({ ...prev, currency: false }));
    setEditingCurrencyCode(code);
    setNewCurrencyCode(code);
    setNewCurrencySymbol(entry?.symbol || '');
    setCurrencyAddError('');
    setAddingCurrency(true);
  };

  const saveCurrencyEntry = (rawCode?: string, rawSymbol?: string) => {
    const codeValue = rawCode ?? newCurrencyCode;
    const symbolValue = rawSymbol ?? newCurrencySymbol;
    const result = editingCurrencyCode
      ? updateCustomJobSalaryCurrency(editingCurrencyCode, codeValue, symbolValue)
      : saveCustomJobSalaryCurrency(codeValue, symbolValue);
    if (!result.ok) {
      setCurrencyAddError(result.message);
      return false;
    }
    refreshCustomCurrencies();
    patchForm({ salaryCurrency: result.code });
    closeCurrencyEditor();
    setCurrencySearch('');
    setDropdownsOpen((prev) => ({ ...prev, currency: false }));
    return true;
  };

  const addLanguageRow = () => {
    setFormData({
      languages: [...formData.languages, { language: '', proficiency: 'Conversational' }],
    });
  };

  const updateLanguageRow = (index: number, patch: Partial<JobLanguageEntry>) => {
    setFormData({
      languages: formData.languages.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  const removeLanguageRow = (index: number) => {
    setFormData({
      languages: formData.languages.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabelRow label="Nationality" />
        <input
          type="text"
          value={formData.nationality}
          onChange={(e) => patchForm({ nationality: e.target.value })}
          placeholder="e.g. Indian, American"
          className={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow label="Job Title" required />
        <input
          type="text"
          value={formData.jobTitle}
          onChange={(e) => patchForm({ jobTitle: e.target.value })}
          placeholder="Customer Success Manager"
          className={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow label="Priority (optional)" />
        <select
          value={formData.priority}
          onChange={(e) => patchForm({ priority: e.target.value })}
          className={inputClass}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {canChoosePostingCompany && postingCompanyOptions.length > 1 ? (
        <DropdownField
          label={postingCompanyFieldLabel || 'Company name'}
          required
          placeholder="Select company"
          valueLabel={formData.postingCompanyName || undefined}
          openKey="postingCompany"
          dropdownsOpen={dropdownsOpen}
          setDropdownsOpen={setDropdownsOpen}
        >
          {postingCompanyOptions.map((option) => (
            <li key={option.id || option.name}>
              <button
                type="button"
                onClick={() => {
                  patchForm({
                    postingOrgUnitId: option.id,
                    postingCompanyName: option.name,
                  });
                  setDropdownsOpen((prev) => ({ ...prev, postingCompany: false }));
                }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                  formData.postingOrgUnitId === option.id && formData.postingCompanyName === option.name
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-700'
                }`}
              >
                {option.name}
              </button>
            </li>
          ))}
        </DropdownField>
      ) : !hideCompanyField && (formData.postingCompanyName || postingCompanyOptions[0]?.name) ? (
        <div>
          <FieldLabelRow label={postingCompanyFieldLabel || 'Company name'} required />
          <input
            type="text"
            readOnly
            value={formData.postingCompanyName || postingCompanyOptions[0]?.name || ''}
            className={`${inputClass} bg-slate-50 text-slate-800`}
          />
          <p className="mt-1 text-xs text-slate-500">
            This name is shown on Phase 1, LinkedIn, and the public job page.
          </p>
        </div>
      ) : null}

      {hideCompanyField && !canChoosePostingCompany ? (
        <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700/70">
            {workspaceOwnerHeading || 'Company'}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {standaloneWorkspaceName ||
              ownCompanyDisplayName ||
              selectedCompany?.companyName ||
              'Your organization'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Jobs under your own company are visible to all team members in this tenant.
          </p>
        </div>
      ) : (
        <DropdownField
          label="Client"
          required
          placeholder="Select client"
          valueLabel={companyValueLabel}
          openKey="company"
          dropdownsOpen={dropdownsOpen}
          setDropdownsOpen={setDropdownsOpen}
          searchable
          searchQuery={clientSearch}
          onSearchQueryChange={setClientSearch}
          searchPlaceholder="Search companies…"
        >
          {loadingClients ? (
            <li className="px-4 py-2 text-sm text-slate-500">Loading…</li>
          ) : clients.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">No companies found</li>
          ) : filteredClients.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">No companies match your search</li>
          ) : (
            filteredClients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => {
                    patchForm({
                      companyId: client.id,
                      contactPersonId: '',
                      contactPersonName: '',
                    });
                    setClientSearch('');
                    setDropdownsOpen((prev) => ({ ...prev, company: false }));
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    formData.companyId === client.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  {isOwnCompanyWorkspaceClient(client)
                    ? `Own company · ${ownCompanyName(client)}`
                    : client.companyName}
                </button>
              </li>
            ))
          )}
        </DropdownField>
      )}

      {!hideCompanyField ? (
      <DropdownField
        label="Contact Person (optional)"
        placeholder={formData.companyId ? 'Select contact' : 'Select a client first'}
        valueLabel={selectedContact?.name || formData.contactPersonName || undefined}
        openKey="contact"
        dropdownsOpen={dropdownsOpen}
        setDropdownsOpen={setDropdownsOpen}
      >
        {loadingContacts ? (
          <li className="px-4 py-2 text-sm text-slate-500">Loading contacts…</li>
        ) : (
          <>
            <li>
              <button
                type="button"
                onClick={() => {
                  patchForm({ contactPersonId: '', contactPersonName: '' });
                  setDropdownsOpen((prev) => ({ ...prev, contact: false }));
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                None
              </button>
            </li>
            {directorContacts.length > 0 ? (
              <>
                <li className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Director
                </li>
                {directorContacts.map(renderContactOption)}
              </>
            ) : null}
            {teamMemberContacts.length > 0 ? (
              <>
                <li className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Team Members
                </li>
                {teamMemberContacts.map(renderContactOption)}
              </>
            ) : null}
            {otherContacts.length > 0 ? (
              <>
                {directorContacts.length > 0 || teamMemberContacts.length > 0 ? (
                  <li className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Other Contacts
                  </li>
                ) : null}
                {otherContacts.map(renderContactOption)}
              </>
            ) : null}
            {contacts.length === 0 ? (
              <li className="px-4 py-2 text-sm text-slate-500">No contacts for this client</li>
            ) : null}
          </>
        )}
      </DropdownField>
      ) : null}

      <div>
        <FieldLabelRow label="No of Positions" required />
        <input
          type="number"
          min={1}
          value={formData.numberOfOpenings}
          onChange={(e) => patchForm({ numberOfOpenings: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow
          label="Location (Country / State / City)"
        />
        <JobLocationFields
          country={formData.country}
          state={formData.state}
          city={formData.city}
          onChange={(patch) => patchForm(patch)}
          labelClass={labelClass}
          inputClass={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow label="Industry Type (optional)" />
        <IndustryMultiSelect
          value={formData.industryType}
          onChange={(industryType) => patchForm({ industryType })}
          companyName={selectedCompany?.companyName ?? ''}
          placeholder="Type an industry (e.g. technology, healthcare)"
        />
      </div>

      <div>
        <FieldLabelRow
          label="Employment Type (optional)"
        />
        <select
          value={formData.employmentType}
          onChange={(e) => patchForm({ employmentType: e.target.value })}
          className={inputClass}
        >
          <option value="">Select employment type</option>
          {EMPLOYMENT_TYPES.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabelRow
          label="Target Hire Date"
          required
        />
        <EditDateField
          label="Target Hire Date"
          hideLabel
          outputIso
          placeholder="DD/MM/YYYY"
          value={formData.targetHireDate}
          onChange={(targetHireDate) => patchForm({ targetHireDate })}
        />
      </div>

      <div>
        <FieldLabelRow
          label="Years of Experience (optional)"
        />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Minimum Years of Experience (optional)</label>
          <input
            type="number"
            min={0}
            value={formData.minExperience}
            onChange={(e) => patchForm({ minExperience: e.target.value })}
            placeholder="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Maximum Years of Experience (optional)</label>
          <input
            type="number"
            min={0}
            value={formData.maxExperience}
            onChange={(e) => patchForm({ maxExperience: e.target.value })}
            placeholder="10"
            className={inputClass}
          />
        </div>
      </div>
      </div>

      <div>
        <FieldLabelRow label="Salary range (optional)" />
        <div className="flex max-w-2xl flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                closeCurrencyEditor();
                setDropdownsOpen((prev) => ({ ...prev, currency: !prev.currency }));
              }}
              className={`${compactInputClass} flex min-w-[7.5rem] items-center justify-between bg-white font-medium text-slate-800`}
              aria-label="Salary currency"
            >
              <span>
                {formData.salaryCurrency
                  ? formatJobSalaryCurrencyLabel(formData.salaryCurrency)
                  : 'Currency'}
              </span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
            {dropdownsOpen.currency ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownsOpen((prev) => ({ ...prev, currency: false }))}
                />
                <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 p-2">
                    <div className="relative">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search currency…"
                        autoFocus
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {filteredCurrencies.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-slate-500">No currencies found</li>
                    ) : (
                      filteredCurrencies.map((code) => {
                        const isCustom = customCurrencyCodeSet.has(code);
                        const label = formatJobSalaryCurrencyLabel(code);
                        return (
                          <li
                            key={code}
                            className="flex items-stretch border-b border-slate-50 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                patchForm({ salaryCurrency: code });
                                setDropdownsOpen((prev) => ({ ...prev, currency: false }));
                              }}
                              className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                formData.salaryCurrency === code
                                  ? 'bg-blue-50 font-medium text-blue-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              <span className="truncate">{label}</span>
                              {isCustom ? (
                                <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Saved
                                </span>
                              ) : null}
                            </button>
                            {isCustom ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditCurrency(code);
                                }}
                                className="inline-flex w-9 shrink-0 items-center justify-center border-l border-slate-100 text-slate-500 hover:bg-[#E8F6FC] hover:text-[#2098C8]"
                                aria-label={`Edit ${code}`}
                                title="Edit symbol or code"
                              >
                                <Pencil size={14} strokeWidth={2.25} />
                              </button>
                            ) : null}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={openAddCurrency}
              className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-[#2098C8]/30 bg-[#E8F6FC] text-[#2098C8] transition hover:bg-[#D6EEF8]"
              aria-label="Add currency"
              title="Add currency"
            >
              <Plus size={16} />
            </button>
            {addingCurrency ? (
              <>
                <div className="fixed inset-0 z-10" onClick={closeCurrencyEditor} />
                <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:w-72">
                  <p className="text-xs font-semibold text-slate-700">
                    {editingCurrencyCode ? 'Edit currency' : 'Add currency'}
                  </p>
                  <form
                    className="mt-2 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveCurrencyEntry();
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">
                          Symbol
                        </label>
                        <input
                          type="text"
                          value={newCurrencySymbol}
                          onChange={(e) => {
                            setNewCurrencySymbol(e.target.value.slice(0, 8));
                            setCurrencyAddError('');
                          }}
                          placeholder="e.g. Fr"
                          maxLength={8}
                          autoFocus
                          className={`${compactInputClass} w-full`}
                          aria-label="Currency symbol"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">
                          Code
                        </label>
                        <input
                          type="text"
                          value={newCurrencyCode}
                          onChange={(e) => {
                            setNewCurrencyCode(
                              e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5),
                            );
                            setCurrencyAddError('');
                          }}
                          placeholder="e.g. CFA"
                          maxLength={5}
                          className={`${compactInputClass} w-full uppercase`}
                          aria-label="Currency code"
                        />
                      </div>
                    </div>
                    {currencyAddError ? (
                      <p className="text-xs text-red-600">{currencyAddError}</p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Symbol first, then code like CFA.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeCurrencyEditor}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-[#2098C8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1A86B3]"
                      >
                        {editingCurrencyCode ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : null}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={formData.payRangeMin}
            onChange={(e) => patchForm({ payRangeMin: e.target.value })}
            placeholder="Min (e.g. 100000 or 100k)"
            className={`${compactInputClass} w-36 sm:w-44`}
            aria-label="Minimum salary"
          />
          <span className="shrink-0 text-sm font-medium text-slate-400" aria-hidden>
            –
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={formData.payRangeMax}
            onChange={(e) => patchForm({ payRangeMax: e.target.value })}
            placeholder="Max (e.g. 200000 or 200k)"
            className={`${compactInputClass} w-36 sm:w-44`}
            aria-label="Maximum salary"
          />
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className={labelClass}>Language & Proficiency</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addLanguageRow}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#28A8E1] hover:text-[#1f8fc4]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add language
            </button>
          </div>
        </div>
        {formData.languages.length === 0 ? (
          <p className="text-xs text-slate-500">No languages added yet.</p>
        ) : (
          <div className="space-y-2">
            {formData.languages.map((row, index) => (
              <div key={`lang-${index}`} className="relative z-10 grid grid-cols-[1fr_1fr_auto] gap-2">
                <LanguageSuggestInput
                  value={row.language}
                  onChange={(language) => updateLanguageRow(index, { language })}
                  jobTitle={formData.jobTitle}
                  excludeLanguages={formData.languages
                    .map((entry, i) => (i === index ? '' : entry.language))
                    .filter(Boolean)}
                />
                <ProficiencySuggestInput
                  value={row.proficiency}
                  onChange={(proficiency) => updateLanguageRow(index, { proficiency })}
                  language={row.language}
                />
                <button
                  type="button"
                  onClick={() => removeLanguageRow(index)}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove language"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ListTextareaField
        label="Key Responsibilities"
        value={formData.keyResponsibilitiesText}
        onChange={(value) => patchForm({ keyResponsibilitiesText: value })}
        placeholder={'e.g. Design and develop features\nCollaborate with cross-functional teams'}
      />

      <ListTextareaField
        label="Preferred Education / Qualifications"
        value={formData.qualificationsExperienceText}
        onChange={(value) => patchForm({ qualificationsExperienceText: value })}
        placeholder={'e.g. B.Tech in Computer Science\n3+ years in React development'}
      />

      <ListTextareaField
        label="Candidate Requirements"
        value={formData.candidateRequirementsText}
        onChange={(value) => patchForm({ candidateRequirementsText: value })}
        placeholder={'e.g. Must be available to join within 30 days\nValid work authorization required'}
      />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Additional JD sections</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Extra sections from the pasted JD (About the team, Nice to have, Tools, etc.) plus any
              sections you add manually.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              patchForm({
                customJdSections: [
                  ...(formData.customJdSections || []),
                  createEmptyCustomJdSection(),
                ],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add section
          </button>
        </div>

        {(formData.customJdSections || []).length === 0 ? (
          <p className="text-xs text-slate-400">
            No extra sections yet. Paste a JD to auto-create them, or click Add section.
          </p>
        ) : (
          <div className="space-y-3">
            {(formData.customJdSections || []).map((section, index) => (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => {
                      const next = [...(formData.customJdSections || [])];
                      next[index] = { ...next[index], title: e.target.value };
                      patchForm({ customJdSections: next });
                    }}
                    placeholder="Section title (e.g. Nice to Have)"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (formData.customJdSections || []).filter((_, i) => i !== index);
                      patchForm({ customJdSections: next });
                    }}
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove section"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={section.body}
                  onChange={(e) => {
                    const next = [...(formData.customJdSections || [])];
                    next[index] = { ...next[index], body: e.target.value };
                    patchForm({ customJdSections: next });
                  }}
                  rows={4}
                  placeholder={'One item per line\ne.g. Experience with AWS\nWillingness to travel'}
                  className={`${inputClass} min-h-[96px] resize-y`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <FieldLabelRow label="Skills" />
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddSkill();
              }
            }}
            placeholder="Type a skill and press Enter"
            className={inputClass}
          />
          <button
            type="button"
            onClick={onAddSkill}
            className="shrink-0 rounded-xl bg-[#28A8E1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f8fc4]"
          >
            Add
          </button>
        </div>
        {formData.skills.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {formData.skills.map((skill, index) => (
              <span
                key={`${skill}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {skill}
                <button type="button" onClick={() => onRemoveSkill(index)} className="text-slate-400 hover:text-rose-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <FieldLabelRow label="About Company" />
        <textarea
          value={formData.aboutCompany || ''}
          onChange={(e) => patchForm({ aboutCompany: e.target.value })}
          placeholder="Short description of the company for the public job page…"
          rows={4}
          className={`${inputClass} min-h-[100px] resize-y`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Shown as <span className="font-medium">About the company</span> on the public job page when
          About Company is visible under Public Visibility.
        </p>
      </div>

      {assignable.canSelectCompany ? (
        <div>
          <AssignCompanySelect
            companies={assignable.companies}
            value={assignable.companyId}
            label="Organization"
            onChange={(id) => {
              assignable.setCompanyId(id);
              if (id !== assignable.companyId) {
                patchForm({
                  assignedToId: '',
                  assignedToName: '',
                  assignedToIds: [],
                  assignedToCompanyId: id,
                  managerId: '',
                });
              }
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            Assignment organization (who owns this job). Separate from the posting company name above.
          </p>
        </div>
      ) : null}

      <DropdownField
        label="Manager"
        required={useLineManagerPicker || assignable.canSelectCompany}
        placeholder={
          needsOrganizationFirst
            ? 'Select an organization first'
            : 'Select manager of this organization'
        }
        valueLabel={selectedManagerLabel || undefined}
        openKey="manager"
        dropdownsOpen={dropdownsOpen}
        setDropdownsOpen={setDropdownsOpen}
      >
        {loadingManagerOptions ? (
          <li className="px-4 py-2 text-sm text-slate-500">Loading managers…</li>
        ) : needsOrganizationFirst ? (
          <li className="px-4 py-2 text-sm text-slate-500">Select an organization to see managers</li>
        ) : managerUsers.length === 0 ? (
          <li className="px-4 py-2 text-sm text-slate-500">No managers found in this organization</li>
        ) : (
          <>
            {!useLineManagerPicker ? (
              <li>
                <button
                  type="button"
                  onClick={() => selectManager('')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  None
                </button>
              </li>
            ) : null}
            {managerUsers.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => selectManager(user.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    formData.managerId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className="block font-medium">{formatAssigneeDisplayName(user) || user.name}</span>
                  {user.email ? (
                    <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </>
        )}
      </DropdownField>

      <div>
        <FieldLabelRow label="Recruiters / Team members" />
        {selectedAssignees.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedAssignees.map((user, index) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
              >
                <span className="max-w-[140px] truncate">
                  {formatAssigneeDisplayName(user) || user.name}
                </span>
                {index === 0 ? (
                  <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
                    Primary
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${formatAssigneeDisplayName(user) || user.name}`}
                  onClick={() => applyAssigneeIds(selectedAssigneeIds.filter((id) => id !== user.id))}
                  className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <button
            ref={recruiterTriggerRef}
            type="button"
            onClick={() => setDropdownsOpen((prev) => ({ ...prev, recruiter: !prev.recruiter }))}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <span className={selectedAssignees.length ? 'text-slate-700' : 'text-slate-400'}>
              {needsOrganizationFirst
                ? 'Select an organization first'
                : needsManagerFirst
                  ? 'Select a manager first'
                  : loadingRecruiters
                    ? 'Loading team…'
                    : filteredRecruiterUsers.length === 0
                      ? 'No team members under this manager'
                      : selectedAssignees.length
                        ? `${selectedAssignees.length} selected — add more`
                        : 'Select team members under this manager'}
            </span>
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          </button>
          {recruiterMenuOpen && recruiterMenuPosition && typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={recruiterMenuRef}
                  className="fixed z-[1200] max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
                  style={{
                    left: recruiterMenuPosition.left,
                    width: recruiterMenuPosition.width,
                    ...(recruiterMenuPosition.placement === 'top'
                      ? { bottom: recruiterMenuPosition.bottom }
                      : { top: recruiterMenuPosition.top }),
                  }}
                >
                  <ul>
                    {loadingRecruiters ? (
                      <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
                    ) : needsOrganizationFirst ? (
                      <li className="px-4 py-2 text-sm text-slate-500">Select an organization to see members</li>
                    ) : needsManagerFirst ? (
                      <li className="px-4 py-2 text-sm text-slate-500">
                        Select a manager to see their team
                      </li>
                    ) : filteredRecruiterUsers.length === 0 ? (
                      <li className="px-4 py-2 text-sm text-slate-500">
                        No team members report to this manager
                      </li>
                    ) : (
                      <>
                        <li>
                          <button
                            type="button"
                            onClick={clearAssignees}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700"
                          >
                            Clear all
                          </button>
                        </li>
                        {filteredRecruiterUsers.map((user) => {
                          const checked = selectedAssigneeIds.includes(user.id);
                          const isPrimary = selectedAssigneeIds[0] === user.id;
                          return (
                            <li key={user.id}>
                              <button
                                type="button"
                                onClick={() => toggleAssignee(user)}
                                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                  checked ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                }`}
                              >
                                <span className="flex items-start gap-2">
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
                                    <span className="block font-medium">
                                      {formatAssigneeDisplayName(user) || user.name}
                                      {isPrimary ? (
                                        <span className="ml-1 text-[10px] font-bold uppercase text-blue-500">
                                          Primary
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </>
                    )}
                  </ul>
                </div>,
                document.body,
              )
            : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Choose organization → manager → team. The first selected member is the primary recruiter;
          others are supporting assignees and can also see this job.
        </p>
      </div>
    </div>
  );
}

