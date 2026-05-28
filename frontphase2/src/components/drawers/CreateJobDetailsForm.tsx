'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, User, X } from 'lucide-react';
import { DocumentUploadDropzone } from '../import/documentUploadUi';
import type { BackendClient, BackendUser } from '../../lib/api';
import { JOB_SALARY_CURRENCY_OPTIONS } from '../../constants/jobSalary';

export interface JobLanguageEntry {
  language: string;
  proficiency: string;
}

export interface CreateJobDetailsFormData {
  nationality: string;
  jobTitle: string;
  priority: string;
  companyId: string;
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
  videoMediaLink: string;
  forecastRevenue: string;
  managerId: string;
  assignedToId: string;
}

interface ContactOption {
  id: string;
  name: string;
}

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
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  existingOtherDocName: string;
  uploadingFile: boolean;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const compactInputClass =
  'rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship', 'Freelance'];
const PROFICIENCY_OPTIONS = ['Basic', 'Conversational', 'Professional', 'Native'];

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
  children: React.ReactNode;
}) {
  const isOpen = dropdownsOpen[openKey];
  return (
    <div>
      <label className={labelClass}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
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
  uploadedFile,
  setUploadedFile,
  existingOtherDocName,
  uploadingFile,
}: CreateJobDetailsFormProps) {
  const selectedCompany = clients.find((c) => c.id === formData.companyId);
  const selectedRecruiter = users.find((u) => u.id === formData.assignedToId);
  const selectedManager = users.find((u) => u.id === formData.managerId);
  const selectedContact = contacts.find((c) => c.id === formData.contactPersonId);
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
      return (
        name.includes(query) ||
        industry.includes(query) ||
        location.includes(query) ||
        website.includes(query)
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
        <label className={labelClass}>Nationality</label>
        <input
          type="text"
          value={formData.nationality}
          onChange={(e) => patchForm({ nationality: e.target.value })}
          placeholder="e.g. Indian, American"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Job Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.jobTitle}
          onChange={(e) => patchForm({ jobTitle: e.target.value })}
          placeholder="Customer Success Manager"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Priority (optional)</label>
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

      <DropdownField
        label="Client"
        required
        placeholder="Select client"
        valueLabel={selectedCompany?.companyName}
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
                {client.companyName}
              </button>
            </li>
          ))
        )}
      </DropdownField>

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
            {contacts.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => {
                    patchForm({
                      contactPersonId: contact.id,
                      contactPersonName: contact.name,
                    });
                    setDropdownsOpen((prev) => ({ ...prev, contact: false }));
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    formData.contactPersonId === contact.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  {contact.name}
                </button>
              </li>
            ))}
          </>
        )}
      </DropdownField>

      <div>
        <label className={labelClass}>
          No of Positions <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={formData.numberOfOpenings}
          onChange={(e) => patchForm({ numberOfOpenings: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>
            Country <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => patchForm({ country: e.target.value })}
            placeholder="India"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>State (optional)</label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => patchForm({ state: e.target.value })}
            placeholder="Karnataka"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>City (optional)</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => patchForm({ city: e.target.value })}
            placeholder="Bengaluru"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Industry Type (optional)</label>
        <input
          type="text"
          value={formData.industryType}
          onChange={(e) => setFormData((prev) => ({ ...prev, industryType: e.target.value }))}
          placeholder="Information Technology"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Employment Type (optional)</label>
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
        <label className={labelClass}>
          Target Hire Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.targetHireDate}
          onChange={(e) => patchForm({ targetHireDate: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Other Document (optional)</label>
        <DocumentUploadDropzone
          selectedFileName={uploadedFile?.name || existingOtherDocName || undefined}
          placeholder="Upload PDF, DOC, or image"
          hint="Optional job description or supporting document"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
          isUploading={uploadingFile}
          onFileSelect={(file) => setUploadedFile(file)}
        />
      </div>

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

      <div>
        <label className={labelClass}>Salary range (optional)</label>
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
        <div className="mb-2 flex items-center justify-between">
          <label className={labelClass}>Language & Proficiency</label>
          <button
            type="button"
            onClick={addLanguageRow}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#28A8E1] hover:text-[#1f8fc4]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add language
          </button>
        </div>
        {formData.languages.length === 0 ? (
          <p className="text-xs text-slate-500">No languages added yet.</p>
        ) : (
          <div className="space-y-2">
            {formData.languages.map((row, index) => (
              <div key={`lang-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="text"
                  value={row.language}
                  onChange={(e) => updateLanguageRow(index, { language: e.target.value })}
                  placeholder="Language"
                  className={inputClass}
                />
                <select
                  value={row.proficiency}
                  onChange={(e) => updateLanguageRow(index, { proficiency: e.target.value })}
                  className={inputClass}
                >
                  {PROFICIENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
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

      <div>
        <label className={labelClass}>Skills</label>
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

      <DropdownField
        label="Assign Manager"
        placeholder="Select manager"
        valueLabel={selectedManager?.name}
        openKey="manager"
        dropdownsOpen={dropdownsOpen}
        setDropdownsOpen={setDropdownsOpen}
      >
        {loadingUsers ? (
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
            {users.map((user) => (
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

      <div>
        <label className={labelClass}>
          <span className="inline-flex items-center gap-1.5">
            <User size={14} className="text-slate-400" aria-hidden />
            Assign Recruiter
          </span>
        </label>
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
      </div>
    </div>
  );
}

