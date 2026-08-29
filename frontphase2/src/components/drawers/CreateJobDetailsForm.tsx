'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { PublicVisibilityToggle } from '../forms/PublicVisibilityToggle';
import {
  isJobFieldPubliclyVisible,
  mergeClientVisibility,
  parseJobPublicFieldVisibility,
  toggleJobPublicFieldVisibility,
  type JobPublicFieldVisibility,
  type JobPublicVisibilityField,
} from '../../lib/jobPublicFieldVisibility';
import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';
import { LanguageSuggestInput, ProficiencySuggestInput } from '../forms/LanguageProficiencySuggestInput';
import { JobLocationFields } from '../location/JobLocationFields';
import { EditDateField } from '../candidates/EditDateField';
import { isOwnCompanyWorkspaceClient, type BackendClient, type BackendUser } from '../../lib/api';
import { JOB_SALARY_CURRENCY_OPTIONS } from '../../constants/jobSalary';
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
  assignedToId: string;
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
  loadingUsers,
  loadingContacts,
  dropdownsOpen,
  setDropdownsOpen,
  skillInput,
  setSkillInput,
  onAddSkill,
  onRemoveSkill,
  hideCompanyField = false,
  standaloneWorkspaceName,
  useLineManagerPicker = false,
  lineManagerOptions = [],
  loadingLineManagers = false,
}: CreateJobDetailsFormProps) {
  const managerOptions = useLineManagerPicker ? lineManagerOptions : users;
  const loadingManagerOptions = useLineManagerPicker ? loadingLineManagers : loadingUsers;
  const selectedCompany = clients.find((c) => c.id === formData.companyId);
  const companyValueLabel = selectedCompany
    ? isOwnCompanyWorkspaceClient(selectedCompany)
      ? `Own company · ${selectedCompany.companyName}`
      : selectedCompany.companyName
    : undefined;
  const selectedRecruiter = users.find((u) => u.id === formData.assignedToId);
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

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const name = client.companyName?.toLowerCase() || '';
      const industry = client.industry?.toLowerCase() || '';
      const location = client.location?.toLowerCase() || '';
      const website = client.website?.toLowerCase() || '';
      const ownLabel = isOwnCompanyWorkspaceClient(client) ? 'own company' : '';
      return (
        name.includes(query) ||
        industry.includes(query) ||
        location.includes(query) ||
        website.includes(query) ||
        ownLabel.includes(query)
      );
    });
  }, [clients, clientSearch]);

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return JOB_SALARY_CURRENCY_OPTIONS;
    return JOB_SALARY_CURRENCY_OPTIONS.filter((code) => code.toLowerCase().includes(query));
  }, [currencySearch]);

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

  const visibility = parseJobPublicFieldVisibility(formData.publicFieldVisibility);

  const isFieldVisible = (field: JobPublicVisibilityField) =>
    isJobFieldPubliclyVisible(
      visibility,
      field,
      field === 'client' ? formData.showClientNamePublicly : undefined,
    );

  const toggleFieldVisibility = (field: JobPublicVisibilityField) => {
    if (field === 'client') {
      const nextShow = !formData.showClientNamePublicly;
      patchForm({
        showClientNamePublicly: nextShow,
        publicFieldVisibility: mergeClientVisibility(visibility, nextShow),
      });
      return;
    }
    patchForm({
      publicFieldVisibility: toggleJobPublicFieldVisibility(visibility, field),
    });
  };

  const visibilityAction = (field: JobPublicVisibilityField) => (
    <PublicVisibilityToggle
      visible={isFieldVisible(field)}
      onToggle={() => toggleFieldVisibility(field)}
    />
  );

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
        <FieldLabelRow label="Nationality" labelAction={visibilityAction('nationality')} />
        <input
          type="text"
          value={formData.nationality}
          onChange={(e) => patchForm({ nationality: e.target.value })}
          placeholder="e.g. Indian, American"
          className={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow label="Job Title" required labelAction={visibilityAction('jobTitle')} />
        <input
          type="text"
          value={formData.jobTitle}
          onChange={(e) => patchForm({ jobTitle: e.target.value })}
          placeholder="Customer Success Manager"
          className={inputClass}
        />
      </div>

      <div>
        <FieldLabelRow label="Priority (optional)" labelAction={visibilityAction('priority')} />
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
            Organization
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {standaloneWorkspaceName || selectedCompany?.companyName || 'Your organization'}
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
          labelAction={visibilityAction('client')}
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
                    ? `Own company · ${client.companyName}`
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
        labelAction={visibilityAction('contactPerson')}
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
        <FieldLabelRow label="No of Positions" required labelAction={visibilityAction('openings')} />
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
          labelAction={visibilityAction('location')}
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
        <FieldLabelRow label="Industry Type (optional)" labelAction={visibilityAction('industryType')} />
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
          labelAction={visibilityAction('employmentType')}
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
          labelAction={visibilityAction('targetHireDate')}
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
          labelAction={visibilityAction('experience')}
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
        <FieldLabelRow label="Salary range (optional)" labelAction={visibilityAction('salary')} />
        <div className="flex max-w-2xl flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownsOpen((prev) => ({ ...prev, currency: !prev.currency }))}
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
                      <li className="px-3 py-2 text-sm text-slate-500">No currencies found</li>
                    ) : (
                      filteredCurrencies.map((code) => (
                        <li key={code}>
                          <button
                            type="button"
                            onClick={() => {
                              patchForm({ salaryCurrency: code });
                              setDropdownsOpen((prev) => ({ ...prev, currency: false }));
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                              formData.salaryCurrency === code
                                ? 'bg-blue-50 font-medium text-blue-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {code}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
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
            {visibilityAction('languages')}
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
        labelAction={visibilityAction('keyResponsibilities')}
      />

      <ListTextareaField
        label="Preferred Education / Qualifications"
        value={formData.qualificationsExperienceText}
        onChange={(value) => patchForm({ qualificationsExperienceText: value })}
        placeholder={'e.g. B.Tech in Computer Science\n3+ years in React development'}
        labelAction={visibilityAction('qualifications')}
      />

      <ListTextareaField
        label="Candidate Requirements"
        value={formData.candidateRequirementsText}
        onChange={(value) => patchForm({ candidateRequirementsText: value })}
        placeholder={'e.g. Must be available to join within 30 days\nValid work authorization required'}
        labelAction={visibilityAction('candidateRequirements')}
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
        <FieldLabelRow label="Skills" labelAction={visibilityAction('skills')} />
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

      {!useLineManagerPicker ? (
      <DropdownField
        label="Assign Manager"
        placeholder="Select manager"
        valueLabel={selectedManager?.name}
        openKey="manager"
        dropdownsOpen={dropdownsOpen}
        setDropdownsOpen={setDropdownsOpen}
      >
        {loadingManagerOptions ? (
          <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
        ) : (
          <>
            <li>
              <button
                type="button"
                onClick={() => {
                  patchForm({ managerId: '' });
                  setDropdownsOpen((prev) => ({ ...prev, manager: false }));
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Unassigned
              </button>
            </li>
            {managerOptions.map((user) => (
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
            ))}
          </>
        )}
      </DropdownField>
      ) : null}

      <div>
        <FieldLabelRow label="About Company" labelAction={visibilityAction('aboutCompany')} />
        <textarea
          value={formData.aboutCompany || ''}
          onChange={(e) => patchForm({ aboutCompany: e.target.value })}
          placeholder="Short description of the company for the public job page…"
          rows={4}
          className={`${inputClass} min-h-[100px] resize-y`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Shown as <span className="font-medium">About the company</span> on the public job page when
          Visible to public.
        </p>
      </div>

      <div>
        <FieldLabelRow
          label="Assign team member"
          labelAction={visibilityAction('recruiterProfile')}
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownsOpen((prev) => ({ ...prev, recruiter: !prev.recruiter }))}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {selectedRecruiter ? <span>{selectedRecruiter.name}</span> : <span className="text-slate-400">Unassigned</span>}
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          </button>
          {dropdownsOpen.recruiter ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownsOpen((prev) => ({ ...prev, recruiter: false }))}
              />
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-52 overflow-y-auto">
                {loadingUsers ? (
                  <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
                ) : (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          patchForm({ assignedToId: '' });
                          setDropdownsOpen((prev) => ({ ...prev, recruiter: false }));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700"
                      >
                        Unassigned
                      </button>
                    </li>
                    {users.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => {
                            patchForm({ assignedToId: user.id });
                            setDropdownsOpen((prev) => ({ ...prev, recruiter: false }));
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                            formData.assignedToId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                          }`}
                        >
                          <span className="block font-medium">{user.name}</span>
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

