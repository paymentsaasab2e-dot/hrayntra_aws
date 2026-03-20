'use client';

import { useState, useEffect, useRef } from 'react';

interface VisaWorkAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: VisaWorkAuthorizationData) => void;
  initialData?: VisaWorkAuthorizationData;
}

export interface VisaDocument {
  id: string;
  file: File | string;
  name: string;
  size?: number;
}

export interface VisaDetailsSection {
  id: string;
  visaType: string;
  visaStatus: string;
  itemFamilyNumber?: string;
  visaExpiryDate?: string;
  documents: VisaDocument[];
}

export interface VisaEntry {
  id: string;
  country: string;
  countryName: string;
  visaDetails: VisaDetailsSection;
}

export interface VisaWorkAuthorizationData {
  selectedDestination: string;
  visaDetailsInitial?: VisaDetailsSection;
  visaDetailsExpected?: VisaDetailsSection;
  visaWorkpermitRequired: string;
  openForAll: boolean;
  additionalRemarks?: string;
  visaEntries?: VisaEntry[];
}

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
];

const VISA_TYPES = [
  'Citizen / Permanent Resident',
  'Work Visa',
  'Student Visa',
  'Tourist Visa',
  'Business Visa',
  'Dependent Visa',
  'Other'
];

const VISA_STATUSES = [
  'Active',
  'Expired',
  'Pending',
  'Renewal Required'
];

const VISA_WORKPERMIT_OPTIONS = [
  'Yes, I require sponsorship',
  'No, I don\'t require sponsorship',
  'Open to either'
];

const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
};

export default function VisaWorkAuthorizationModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: VisaWorkAuthorizationModalProps) {
  const [selectedDestination, setSelectedDestination] = useState(initialData?.selectedDestination || '');
  const [requiresVisa, setRequiresVisa] = useState<'Yes' | 'No' | ''>('');
  const [visaDetailsExpected, setVisaDetailsExpected] = useState<VisaDetailsSection | undefined>(
    initialData?.visaDetailsExpected || { id: 'expected', visaType: '', visaStatus: 'Active', documents: [] }
  );
  const [visaWorkpermitRequired, setVisaWorkpermitRequired] = useState(initialData?.visaWorkpermitRequired || '');
  const [openForAll, setOpenForAll] = useState(initialData?.openForAll || false);
  const [additionalRemarks, setAdditionalRemarks] = useState(initialData?.additionalRemarks || '');
  const [visaEntries, setVisaEntries] = useState<VisaEntry[]>(initialData?.visaEntries || []);
  const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    expected: true
  });

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const dragCounter = useRef<{ [key: string]: number }>({ expected: 0 });

  useEffect(() => {
    if (initialData) {
      setSelectedDestination(initialData.selectedDestination || '');
      setVisaDetailsExpected(initialData.visaDetailsExpected || { id: 'expected', visaType: '', visaStatus: 'Active', documents: [] });
      setVisaWorkpermitRequired(initialData.visaWorkpermitRequired || '');
      setOpenForAll(initialData.openForAll || false);
      setAdditionalRemarks(initialData.additionalRemarks || '');
      setVisaEntries(initialData.visaEntries || []);
      if (initialData.visaDetailsExpected?.visaType) {
        setRequiresVisa('Yes');
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setSelectedDestination('');
    setRequiresVisa('');
    setVisaDetailsExpected({ id: 'expected', visaType: '', visaStatus: 'Active', documents: [] });
    setVisaWorkpermitRequired('');
    setOpenForAll(false);
    setAdditionalRemarks('');
    setVisaEntries([]);
    setExpandedEntries({});
    setExpandedSections({ expected: true });
  };

  const handleAddVisaEntry = () => {
    if (!selectedDestination) {
      alert('Please select a country.');
      return;
    }
    if (!visaDetailsExpected?.visaType) {
      alert('Please select Visa Type.');
      return;
    }

    const countryName = COUNTRIES.find(c => c.code === selectedDestination)?.name || selectedDestination;
    const newEntry: VisaEntry = {
      id: Date.now().toString(),
      country: selectedDestination,
      countryName,
      visaDetails: { ...visaDetailsExpected }
    };

    setVisaEntries([...visaEntries, newEntry]);
    
    // Reset form for next entry
    setSelectedDestination('');
    setRequiresVisa('');
    setVisaDetailsExpected({ id: 'expected', visaType: '', visaStatus: 'Active', documents: [] });
    if (fileInputRefs.current['expected']) {
      fileInputRefs.current['expected']!.value = '';
    }
  };

  const handleRemoveVisaEntry = (id: string) => {
    setVisaEntries(visaEntries.filter(entry => entry.id !== id));
  };

  const toggleExpandEntry = (id: string) => {
    setExpandedEntries({
      ...expandedEntries,
      [id]: !expandedEntries[id]
    });
  };

  const formatDateRange = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const isFormComplete = selectedDestination && requiresVisa === 'Yes' && visaDetailsExpected?.visaType;

  const toggleSection = (sectionId: string) => {
    setExpandedSections({
      ...expandedSections,
      [sectionId]: !expandedSections[sectionId]
    });
  };

  const handleVisaDetailChange = (section: 'expected', field: keyof VisaDetailsSection, value: string) => {
    setVisaDetailsExpected({
      ...visaDetailsExpected!,
      [field]: value
    });
  };

  const handleFileSelect = (section: 'expected', files: FileList | null) => {
    if (!files) return;
    
    const newDocuments: VisaDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: File size must be less than 5MB`);
        continue;
      }
      // Check file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        alert(`${file.name}: Please upload a PDF, PNG, or JPG file`);
        continue;
      }
      newDocuments.push({
        id: Date.now().toString() + i,
        file,
        name: file.name,
        size: file.size
      });
    }

    setVisaDetailsExpected({
      ...visaDetailsExpected!,
      documents: [...(visaDetailsExpected?.documents || []), ...newDocuments]
    });
  };

  const handleFileInputChange = (section: 'expected', e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(section, e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRefs.current[section]) {
      fileInputRefs.current[section]!.value = '';
    }
  };

  const handleRemoveFile = (section: 'expected', documentId: string) => {
    setVisaDetailsExpected({
      ...visaDetailsExpected!,
      documents: visaDetailsExpected?.documents.filter((doc: VisaDocument) => doc.id !== documentId) || []
    });
  };

  const handleDragEnter = (section: 'expected', e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[section] = (dragCounter.current[section] || 0) + 1;
  };

  const handleDragLeave = (section: 'expected', e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[section] = (dragCounter.current[section] || 0) - 1;
    if (dragCounter.current[section] === 0) {
      // Reset drag state
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (section: 'expected', e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current[section] = 0;
    handleFileSelect(section, e.dataTransfer.files);
  };

  const handleSave = () => {
    onSave({
      selectedDestination,
      visaDetailsInitial: undefined,
      visaDetailsExpected,
      visaWorkpermitRequired,
      openForAll,
      additionalRemarks,
      visaEntries,
    });
    onClose();
  };

  if (!isOpen) return null;

  const renderVisaDetailsSection = (section: VisaDetailsSection | undefined, sectionId: 'expected', title: string) => {
    const isExpanded = expandedSections[sectionId] !== false;
    const sectionData = section || { id: sectionId, visaType: '', visaStatus: 'Active', documents: [] };

    return (
      <div className="border border-gray-200 rounded-lg">
        {/* Section Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => toggleSection(sectionId)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-900"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            {title}
          </button>
        </div>

        {/* Section Content */}
        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Visa Type and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visa Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={sectionData.visaType}
                  onChange={(e) => handleVisaDetailChange(sectionId, 'visaType', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Visa Type</option>
                  {VISA_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visa Status
                </label>
                <select
                  value={sectionData.visaStatus}
                  onChange={(e) => handleVisaDetailChange(sectionId, 'visaStatus', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {VISA_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visa Expiry Date (only for Expected section) */}
            {sectionId === 'expected' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visa Expiry Date
                </label>
                <input
                  type="date"
                  value={sectionData.visaExpiryDate || ''}
                  onChange={(e) => handleVisaDetailChange(sectionId, 'visaExpiryDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Visa must always be valid for your assignment
                </p>
              </div>
            )}

            {/* Work Permit Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Permit Number
              </label>
              <input
                type="text"
                value={sectionData.itemFamilyNumber || ''}
                onChange={(e) => handleVisaDetailChange(sectionId, 'itemFamilyNumber', e.target.value)}
                placeholder="Enter work permit number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Visa/Work Permit Document
              </label>
              
              {/* Drag and Drop Area */}
              <div
                onDragEnter={(e) => handleDragEnter(sectionId, e)}
                onDragLeave={(e) => handleDragLeave(sectionId, e)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(sectionId, e)}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors bg-gray-50"
              >
                <input
                  ref={(el) => { fileInputRefs.current[sectionId] = el; }}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileInputChange(sectionId, e)}
                  multiple
                  className="hidden"
                />
                <svg
                  className="mx-auto h-12 w-12 text-[#9095A1] mb-2"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop files here or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[sectionId]?.click()}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Browse files
                  </button>
                </p>
              </div>

              {/* Uploaded Files List */}
              {sectionData.documents && sectionData.documents.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Existing Work Permit/Visa ({sectionData.documents.length} {sectionData.documents.length === 1 ? 'file' : 'files'})
                  </p>
                  {sectionData.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-5 h-5 text-[#9095A1]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-sm text-gray-900">{doc.name}</p>
                          {doc.size && (
                            <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          title="View"
                        >
                          View
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleRemoveFile(sectionId, doc.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                          title="Delete"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Visa & Work Authorization</h2>
              <p className="text-sm text-gray-600 mt-1">Tell us where you are going to work and upload supporting documents.</p>
            </div>
            <button
              onClick={onClose}
              className="text-[#9095A1] hover:text-gray-600"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Select Countries */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Countries
                </label>
                <select
                  value={selectedDestination}
                  onChange={(e) => {
                    setSelectedDestination(e.target.value);
                    setRequiresVisa('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a Country...</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select all countries where you are legally authorized to work.
                </p>
              </div>

              {/* Yes/No Options - Show when country is selected */}
              {selectedDestination && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Do you require a visa for this country?
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="requiresVisa"
                        value="Yes"
                        checked={requiresVisa === 'Yes'}
                        onChange={(e) => setRequiresVisa(e.target.value as 'Yes')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="requiresVisa"
                        value="No"
                        checked={requiresVisa === 'No'}
                        onChange={(e) => setRequiresVisa(e.target.value as 'No')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">No</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Visa Details Form - Show when Yes is selected */}
              {requiresVisa === 'Yes' && (
                <div className="space-y-4">
                  {/* Row 1: Visa Type and Visa Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Visa Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={visaDetailsExpected?.visaType || ''}
                        onChange={(e) => handleVisaDetailChange('expected', 'visaType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Visa Type</option>
                        {VISA_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Visa Status
                      </label>
                      <select
                        value={visaDetailsExpected?.visaStatus || 'Active'}
                        onChange={(e) => handleVisaDetailChange('expected', 'visaStatus', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {VISA_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Visa Expiry Date and Work Permit Number */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Visa Expiry Date
                      </label>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9095A1] pointer-events-none"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <input
                          type="date"
                          value={visaDetailsExpected?.visaExpiryDate || ''}
                          onChange={(e) => handleVisaDetailChange('expected', 'visaExpiryDate', e.target.value)}
                          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        This helps employers understand your visa timeline.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Work Permit Number
                      </label>
                      <input
                        type="text"
                        value={visaDetailsExpected?.itemFamilyNumber || ''}
                        onChange={(e) => handleVisaDetailChange('expected', 'itemFamilyNumber', e.target.value)}
                        placeholder="Enter work permit number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Row 3: Upload Visa / Work Permit Document */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Visa / Work Permit Document
                    </label>
                    <input
                      ref={(el) => { fileInputRefs.current['expected'] = el; }}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileInputChange('expected', e)}
                      className="hidden"
                    />
                    {(!visaDetailsExpected?.documents || visaDetailsExpected.documents.length === 0) ? (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current['expected']?.click()}
                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Choose file
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {visaDetailsExpected.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-3">
                              <svg
                                className="w-5 h-5 text-[#9095A1]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-sm text-gray-900">{doc.name}</p>
                                {doc.size && (
                                  <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveFile('expected', doc.id)}
                              className="text-[#9095A1] hover:text-red-600"
                              title="Delete"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Accepted: PDF, JPG, PNG. Max 5MB.
                    </p>
                  </div>

                  {/* Add Button */}
                  {isFormComplete && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddVisaEntry}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M8 3.33333V12.6667"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M3.33333 8H12.6667"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Add Visa Entry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Added Visa Entries List */}
              {visaEntries.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Added Visa Entries</h3>
                  {visaEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="border border-gray-200 rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {entry.visaDetails.visaType} - {entry.countryName}
                          </h4>
                          {entry.visaDetails.visaExpiryDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              Expires: {formatDateRange(entry.visaDetails.visaExpiryDate)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveVisaEntry(entry.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 4L4 12M4 4L12 12"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleExpandEntry(entry.id)}
                            className="text-gray-500 hover:text-gray-700 p-1"
                            title="Expand"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className={`transition-transform ${expandedEntries[entry.id] ? 'rotate-180' : ''}`}
                            >
                              <path
                                d="M4 6L8 10L12 6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {expandedEntries[entry.id] && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs text-gray-500">Country:</span>
                              <p className="text-sm text-gray-900">{entry.countryName}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Visa Type:</span>
                              <p className="text-sm text-gray-900">{entry.visaDetails.visaType}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Visa Status:</span>
                              <p className="text-sm text-gray-900">{entry.visaDetails.visaStatus}</p>
                            </div>
                            {entry.visaDetails.itemFamilyNumber && (
                              <div>
                                <span className="text-xs text-gray-500">Work Permit Number:</span>
                                <p className="text-sm text-gray-900">{entry.visaDetails.itemFamilyNumber}</p>
                              </div>
                            )}
                            {entry.visaDetails.visaExpiryDate && (
                              <div>
                                <span className="text-xs text-gray-500">Visa Expiry Date:</span>
                                <p className="text-sm text-gray-900">
                                  {formatDateRange(entry.visaDetails.visaExpiryDate)}
                                </p>
                              </div>
                            )}
                            {entry.visaDetails.documents && entry.visaDetails.documents.length > 0 && (
                              <div>
                                <span className="text-xs text-gray-500">Documents:</span>
                                <div className="mt-1 space-y-1">
                                  {entry.visaDetails.documents.map((doc) => (
                                    <p key={doc.id} className="text-sm text-gray-900">
                                      {doc.name}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Visa/Workpermit Required - Show only when No is selected */}
              {requiresVisa === 'No' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Visa/Workpermit Required?
                  </label>
                  <div className="space-y-2">
                    {VISA_WORKPERMIT_OPTIONS.map((option) => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visaWorkpermit"
                          value={option}
                          checked={visaWorkpermitRequired === option}
                          onChange={(e) => setVisaWorkpermitRequired(e.target.value)}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-0.5 shrink-0">
                      <g clipPath="url(#clip0_3_14286)">
                        <path d="M14.0289 8.00086C14.0289 4.67058 11.3292 1.97086 7.99891 1.97086C4.66863 1.97086 1.96891 4.67058 1.96891 8.00086C1.96891 11.3312 4.66863 14.0309 7.99891 14.0309C11.3292 14.0309 14.0289 11.3312 14.0289 8.00086ZM15.3689 8.00086C15.3689 12.0712 12.0692 15.3709 7.99891 15.3709C3.92857 15.3709 0.628906 12.0712 0.628906 8.00086C0.628906 3.93052 3.92857 0.630859 7.99891 0.630859C12.0692 0.630859 15.3689 3.93052 15.3689 8.00086Z" fill="#4B5563"/>
                        <path d="M7.32812 10.6703L7.32812 7.99031C7.32812 7.62027 7.62808 7.32031 7.99813 7.32031C8.36817 7.32031 8.66813 7.62027 8.66813 7.99031V10.6703C8.66813 11.0404 8.36817 11.3403 7.99813 11.3403C7.62808 11.3403 7.32812 11.0404 7.32812 10.6703Z" fill="#4B5563"/>
                        <path d="M8.00469 4.66016L8.07337 4.66343C8.41118 4.69775 8.67469 4.98326 8.67469 5.33016C8.67469 5.67706 8.41118 5.96256 8.07337 5.99689L8.00469 6.00016H7.99813C7.62808 6.00016 7.32812 5.70018 7.32812 5.33016C7.32812 4.96013 7.62808 4.66016 7.99813 4.66016H8.00469Z" fill="#4B5563"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_3_14286">
                          <rect width="16" height="16" fill="white"/>
                        </clipPath>
                      </defs>
                    </svg>
                    <p className="text-xs text-gray-500">
                      Some selected locations may require company-sponsored visas depending on role and country.
                    </p>
                  </div>
                </div>
              )}

              {/* Additional Notes (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={additionalRemarks}
                  onChange={(e) => setAdditionalRemarks(e.target.value)}
                  placeholder="Add any further information about your visa or work authorization."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Save Visa & Work Authorization
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}