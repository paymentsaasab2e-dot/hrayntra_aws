'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { JobPublicVisibilityDefaultsPanel } from '../jobs/JobPublicVisibilityDefaultsPanel';
import { LinkedInPublishingDefaultsPanel } from '../jobs/LinkedInPublishingDefaultsPanel';
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
  listCustomJobSalaryCurrencies,
  mergeJobSalaryCurrencyOptions,
  saveCustomJobSalaryCurrency,
} from '../../constants/jobSalary';
import {
  createEmptyCustomJdSection,
  type JobCustomJdSection,
} from '../../lib/jobCustomJdSections';

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
  assignedToName?: string;
  assignedToCompanyId?: string;
  aboutCompany: string;
  publicFieldVisibility: JobPublicFieldVisibility;
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
  const isOpen = dropdownsOpen[openKey];
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
          type="button"
          onClick={() => setDropdownsOpen((prev) => ({ ...prev, [openKey]: !prev[openKey] }))}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {valueLabel ? <span>{valueLabel}</span> : <span className="text-slate-400">{placeholder}</span>}
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        </button>
        {isOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownsOpen((prev) => ({ ...prev, [openKey]: false }))}
            />
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
            </div>
          </>
        ) : null}
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
}: CreateJobDetailsFormProps) {
  const assignable = useAssignableMembers(true, 'Jobs', {
    initialCompanyId: formData.assignedToCompanyId,
  });
  const recruiterUsers = assignable.users;
  const loadingRecruiters = assignable.loading;
  const managerOptions = lineManagerOptions;
  const loadingManagerOptions = loadingLineManagers;
  const selectedCompany = clients.find((c) => c.id === formData.companyId);
  const ownCompanyName = (client: BackendClient) =>
    ownCompanyDisplayName || client.companyName || 'Your organization';
  const companyValueLabel = selectedCompany
    ? isOwnCompanyWorkspaceClient(selectedCompany)
      ? `Own company · ${ownCompanyName(selectedCompany)}`
      : selectedCompany.companyName
    : undefined;
  const selectedRecruiter =
    recruiterUsers.find((u) => u.id === formData.assignedToId) ||
    users.find((u) => u.id === formData.assignedToId) ||
    (formData.assignedToId && formData.assignedToName
      ? { id: formData.assignedToId, name: formData.assignedToName }
      : undefined);
  const selectedRecruiterLabel = selectedRecruiter
    ? formatAssigneeDisplayName(selectedRecruiter) || selectedRecruiter.name
    : '';
  const selectedManager = managerOptions.find((u) => u.id === formData.managerId);
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
  const [addingCurrency, setAddingCurrency] = useState(false);
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

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return currencyOptions;
    return currencyOptions.filter((code) => code.toLowerCase().includes(query));
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

  const saveCurrencyEntry = (raw: string) => {
    const result = saveCustomJobSalaryCurrency(raw);
    if (!result.ok) {
      setCurrencyAddError(result.message);
      return false;
    }
    setCustomCurrencies(listCustomJobSalaryCurrencies());
    patchForm({ salaryCurrency: result.code });
    setCurrencyAddError('');
    setNewCurrencyCode('');
    setAddingCurrency(false);
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
      <JobPublicVisibilityDefaultsPanel
        visibility={formData.publicFieldVisibility}
        showClientNamePublicly={formData.showClientNamePublicly}
        onChange={(next) => patchForm(next)}
      />

      <LinkedInPublishingDefaultsPanel />

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

      {hideCompanyField ? (
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

      {useLineManagerPicker ? (
        <DropdownField
          label="Line Manager"
          required
          placeholder="Select line manager"
          valueLabel={selectedManager?.name}
          openKey="manager"
          dropdownsOpen={dropdownsOpen}
          setDropdownsOpen={setDropdownsOpen}
        >
          {loadingManagerOptions ? (
            <li className="px-4 py-2 text-sm text-slate-500">Loading line managers…</li>
          ) : managerOptions.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">No line managers found</li>
          ) : (
            managerOptions.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => {
                    patchForm({ managerId: user.id });
                    setDropdownsOpen((prev) => ({ ...prev, manager: false }));
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    formData.managerId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                </button>
              </li>
            ))
          )}
        </DropdownField>
      ) : null}

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
                setAddingCurrency(false);
                setDropdownsOpen((prev) => ({ ...prev, currency: !prev.currency }));
              }}
              className={`${compactInputClass} flex w-[7.5rem] items-center justify-between bg-white font-medium text-slate-800`}
              aria-label="Salary currency"
            >
              <span>{formData.salaryCurrency || 'Currency'}</span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
            {dropdownsOpen.currency ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownsOpen((prev) => ({ ...prev, currency: false }))}
                />
                <div className="absolute z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
                      <li className="px-3 py-2 text-sm text-slate-500">
                        {/^[A-Za-z]{3}$/.test(currencySearch.trim()) ? (
                          <button
                            type="button"
                            onClick={() => saveCurrencyEntry(currencySearch)}
                            className="inline-flex items-center gap-1 font-semibold text-[#2098C8] hover:text-[#176F96]"
                          >
                            <Plus size={14} />
                            Add {currencySearch.trim().toUpperCase()}
                          </button>
                        ) : (
                          'No currencies found'
                        )}
                      </li>
                    ) : (
                      filteredCurrencies.map((code) => (
                        <li key={code}>
                          <button
                            type="button"
                            onClick={() => {
                              patchForm({ salaryCurrency: code });
                              setDropdownsOpen((prev) => ({ ...prev, currency: false }));
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                              formData.salaryCurrency === code
                                ? 'bg-blue-50 font-medium text-blue-700'
                                : 'text-slate-700'
                            }`}
                          >
                            <span>{code}</span>
                            {customCurrencies.includes(code) ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Saved
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDropdownsOpen((prev) => ({ ...prev, currency: false }));
                setCurrencyAddError('');
                setAddingCurrency((open) => !open);
              }}
              className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-[#2098C8]/30 bg-[#E8F6FC] text-[#2098C8] transition hover:bg-[#D6EEF8]"
              aria-label="Add currency"
              title="Add currency"
            >
              <Plus size={16} />
            </button>
            {addingCurrency ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setAddingCurrency(false);
                    setCurrencyAddError('');
                  }}
                />
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="text-xs font-semibold text-slate-700">Add currency</p>
                  <form
                    className="mt-2 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveCurrencyEntry(newCurrencyCode);
                    }}
                  >
                    <input
                      type="text"
                      value={newCurrencyCode}
                      onChange={(e) => {
                        setNewCurrencyCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3));
                        setCurrencyAddError('');
                      }}
                      placeholder="e.g. UGX"
                      maxLength={3}
                      autoFocus
                      className={`${compactInputClass} w-full uppercase`}
                      aria-label="New currency code"
                    />
                    {currencyAddError ? (
                      <p className="text-xs text-red-600">{currencyAddError}</p>
                    ) : (
                      <p className="text-[11px] text-slate-400">3-letter code, then Save.</p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-[#2098C8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1A86B3]"
                    >
                      Save
                    </button>
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
            placeholder="Min (e.g. 18 or 18 LPA)"
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
            placeholder="Max (e.g. 28 or 28 LPA)"
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

      <div>
        <FieldLabelRow
          label="Assign team member"
        />
        {assignable.canSelectCompany ? (
          <AssignCompanySelect
            companies={assignable.companies}
            value={assignable.companyId}
            onChange={(id) => {
              assignable.setCompanyId(id);
              if (id !== assignable.companyId) {
                patchForm({ assignedToId: '', assignedToName: '', assignedToCompanyId: id });
              }
            }}
            className="mb-2"
          />
        ) : null}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownsOpen((prev) => ({ ...prev, recruiter: !prev.recruiter }))}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {selectedRecruiterLabel ? (
              <span>{selectedRecruiterLabel}</span>
            ) : (
              <span className="text-slate-400">
                {assignable.canSelectCompany && !assignable.companyId
                  ? 'Select a company first'
                  : loadingRecruiters
                    ? 'Loading team…'
                    : recruiterUsers.length === 0
                      ? 'No team members with access'
                      : 'Select team member'}
              </span>
            )}
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          </button>
          {dropdownsOpen.recruiter ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownsOpen((prev) => ({ ...prev, recruiter: false }))}
              />
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-52 overflow-y-auto">
                {loadingRecruiters ? (
                  <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
                ) : assignable.canSelectCompany && !assignable.companyId ? (
                  <li className="px-4 py-2 text-sm text-slate-500">Select a company to see members</li>
                ) : recruiterUsers.length === 0 ? (
                  <li className="px-4 py-2 text-sm text-slate-500">No team members with access in this company</li>
                ) : (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          patchForm({ assignedToId: '', assignedToName: '' });
                          setDropdownsOpen((prev) => ({ ...prev, recruiter: false }));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700"
                      >
                        Unassigned
                      </button>
                    </li>
                    {recruiterUsers.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => {
                            patchForm({
                              assignedToId: user.id,
                              assignedToName: formatAssigneeDisplayName(user) || user.name,
                              assignedToCompanyId: assignable.companyId || formData.assignedToCompanyId,
                            });
                            setDropdownsOpen((prev) => ({ ...prev, recruiter: false }));
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                            formData.assignedToId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                          }`}
                        >
                          <span className="block font-medium">{formatAssigneeDisplayName(user) || user.name}</span>
                          <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Shown as the <span className="font-medium">Recruiter</span> card on the public job page
          (name, photo, designation). Use the hide pill to keep this internal.
        </p>
      </div>
    </div>
  );
}

