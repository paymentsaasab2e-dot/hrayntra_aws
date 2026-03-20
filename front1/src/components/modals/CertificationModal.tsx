'use client';

import { useState, useEffect, useRef } from 'react';

interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CertificationsData) => void;
  initialData?: CertificationsData;
}

export interface CertificationDocument {
  id: string;
  file?: File;
  name: string;
  url?: string;
  size?: number;
}

export interface Certification {
  id: string;
  certificationName: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  doesNotExpire: boolean;
  credentialId?: string;
  credentialUrl?: string;
  certificateFile?: File | string;
  documents?: CertificationDocument[];
  description?: string;
}

export interface CertificationsData {
  certifications: Certification[];
}

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return true; // Optional field
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export default function CertificationModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: CertificationModalProps) {
  const [certifications, setCertifications] = useState<Certification[]>(initialData?.certifications || []);
  const [certificationName, setCertificationName] = useState('');
  const [issuingOrganization, setIssuingOrganization] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [doesNotExpire, setDoesNotExpire] = useState(false);
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [description, setDescription] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<CertificationDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  
  // Error states
  const [errors, setErrors] = useState({
    certificationName: '',
    issuingOrganization: '',
    issueDate: '',
    credentialUrl: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setCertifications(initialData.certifications || []);
    } else {
      setCertifications([]);
    }
    // Reset form when modal opens
    if (isOpen) {
      resetForm();
    }
  }, [initialData, isOpen]);

  // Normalize documents when editing
  useEffect(() => {
    if (editingCertId && certifications.length > 0) {
      const cert = certifications.find(c => c.id === editingCertId);
      if (cert && cert.documents) {
        const normalizedDocs: CertificationDocument[] = cert.documents.map((doc, index) => {
          if (typeof doc === 'string') {
            return {
              id: `doc-${Date.now()}-${index}`,
              url: doc,
              name: doc.split('/').pop() || 'Document',
            };
          } else if (doc && typeof doc === 'object') {
            return {
              id: (doc as CertificationDocument).id || `doc-${Date.now()}-${index}`,
              file: (doc as CertificationDocument).file,
              name: (doc as CertificationDocument).name || 'Document',
              url: (doc as CertificationDocument).url,
              size: (doc as CertificationDocument).size,
            };
          } else {
            return {
              id: `doc-${Date.now()}-${index}`,
              name: 'Document',
            };
          }
        });
        setDocuments(normalizedDocs);
      } else {
        setDocuments([]);
      }
    } else {
      setDocuments([]);
    }
  }, [editingCertId, certifications]);

  const resetForm = () => {
    setCertificationName('');
    setIssuingOrganization('');
    setIssueDate('');
    setExpiryDate('');
    setDoesNotExpire(false);
    setCredentialId('');
    setCredentialUrl('');
    setDescription('');
    setCertificateFile(null);
    setDocuments([]);
    setDragActive(false);
    setEditingCertId(null);
    setErrors({
      certificationName: '',
      issuingOrganization: '',
      issueDate: '',
      credentialUrl: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors = {
      certificationName: '',
      issuingOrganization: '',
      issueDate: '',
      credentialUrl: '',
    };

    if (!certificationName.trim()) {
      newErrors.certificationName = 'Certification Name is required.';
    }
    if (!issuingOrganization.trim()) {
      newErrors.issuingOrganization = 'Issuing Organization is required.';
    }
    if (!issueDate.trim()) {
      newErrors.issueDate = 'Issue Date is required.';
    }
    if (credentialUrl.trim() && !isValidUrl(credentialUrl)) {
      newErrors.credentialUrl = 'Please enter a valid URL format.';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles: CertificationDocument[] = [];
    
    for (const file of files) {
      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 5MB.`);
        continue;
      }
      // Check file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        alert(`${file.name} is not a valid file type. Please upload PDF, PNG, or JPG files.`);
        continue;
      }
      
      validFiles.push({
        id: `doc-${Date.now()}-${Math.random()}`,
        file: file,
        name: file.name,
        size: file.size,
      });
    }
    
    setDocuments([...documents, ...validFiles]);
  };

  const handleRemoveFile = (docId: string) => {
    setDocuments(documents.filter(doc => doc.id !== docId));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const handleAddCertification = () => {
    if (!validateForm()) {
      return;
    }

    const newCertification: Certification = {
      id: editingCertId || Date.now().toString(),
      certificationName: certificationName.trim(),
      issuingOrganization: issuingOrganization.trim(),
      issueDate,
      expiryDate: doesNotExpire ? undefined : (expiryDate || undefined),
      doesNotExpire,
      credentialId: credentialId.trim() || undefined,
      credentialUrl: credentialUrl.trim() || undefined,
      certificateFile: certificateFile || undefined,
      documents: documents.length > 0 ? documents : undefined,
      description: description.trim() || undefined,
    };

    if (editingCertId) {
      // Update existing certification
      setCertifications(certifications.map(cert =>
        cert.id === editingCertId ? newCertification : cert
      ));
    } else {
      // Add new certification
      setCertifications([...certifications, newCertification]);
    }

    resetForm();
  };

  const handleEditCertification = (cert: Certification) => {
    setCertificationName(cert.certificationName);
    setIssuingOrganization(cert.issuingOrganization);
    setIssueDate(cert.issueDate);
    setExpiryDate(cert.expiryDate || '');
    setDoesNotExpire(cert.doesNotExpire);
    setCredentialId(cert.credentialId || '');
    setCredentialUrl(cert.credentialUrl || '');
    setDescription(cert.description || '');
    setEditingCertId(cert.id);
    setCertificateFile(cert.certificateFile instanceof File ? cert.certificateFile : null);
    setDocuments(cert.documents || []);
    setErrors({
      certificationName: '',
      issuingOrganization: '',
      issueDate: '',
      credentialUrl: '',
    });
  };

  const handleDeleteCertification = (certId: string) => {
    setCertifications(certifications.filter(cert => cert.id !== certId));
  };

  const handleSave = () => {
    onSave({ certifications });
    onClose();
  };

  if (!isOpen) return null;

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
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCertId ? 'Edit Certification' : 'Add Certification'}
            </h2>
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
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Certification Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Certification Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={certificationName}
                      onChange={(e) => {
                        setCertificationName(e.target.value);
                        if (errors.certificationName) {
                          setErrors({ ...errors, certificationName: '' });
                        }
                      }}
                      placeholder="Enter certification name..."
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.certificationName ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.certificationName && (
                      <p className="mt-1 text-sm text-red-600">{errors.certificationName}</p>
                    )}
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issue Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="month"
                      value={issueDate}
                      onChange={(e) => {
                        setIssueDate(e.target.value);
                        if (errors.issueDate) {
                          setErrors({ ...errors, issueDate: '' });
                        }
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.issueDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.issueDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.issueDate}</p>
                    )}
                  </div>

                  {/* Credential ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Credential ID <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={credentialId}
                      onChange={(e) => setCredentialId(e.target.value)}
                      placeholder="ID or registration number (if applicable)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Upload Certificate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Certificate <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileSelect}
                      multiple
                      className="hidden"
                    />
                    <div
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`w-full px-4 py-6 border-2 border-dashed rounded-lg transition-colors ${
                        dragActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 text-blue-600"
                      >
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-medium">Click to upload or drag and drop</span>
                        <span className="text-xs text-gray-500">PDF, PNG, JPG (Max 5MB per file)</span>
                      </button>
                    </div>
                    {documents.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg
                                className="w-5 h-5 text-gray-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-sm text-gray-700 truncate">{doc.name}</span>
                              {doc.url && (
                                <a
                                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${doc.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  View
                                </a>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(doc.id)}
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Issuing Organization */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issuing Organization <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={issuingOrganization}
                      onChange={(e) => {
                        setIssuingOrganization(e.target.value);
                        if (errors.issuingOrganization) {
                          setErrors({ ...errors, issuingOrganization: '' });
                        }
                      }}
                      placeholder="e.g., Coursera, Google, AWS, Microsoft"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.issuingOrganization ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.issuingOrganization && (
                      <p className="mt-1 text-sm text-red-600">{errors.issuingOrganization}</p>
                    )}
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="month"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      disabled={doesNotExpire}
                      placeholder="Pick a date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <div className="mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={doesNotExpire}
                          onChange={(e) => {
                            setDoesNotExpire(e.target.checked);
                            if (e.target.checked) {
                              setExpiryDate('');
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">This certification does not expire</span>
                      </label>
                    </div>
                  </div>

                  {/* Credential URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      Credential URL <span className="text-gray-500 text-xs">(Optional)</span>
                      <svg
                        className="w-4 h-4 text-[#9095A1]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9095A1]">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={credentialUrl}
                        onChange={(e) => {
                          setCredentialUrl(e.target.value);
                          if (errors.credentialUrl) {
                            setErrors({ ...errors, credentialUrl: '' });
                          }
                        }}
                        onBlur={() => {
                          if (credentialUrl.trim() && !isValidUrl(credentialUrl)) {
                            setErrors({ ...errors, credentialUrl: 'Please enter a valid URL format.' });
                          }
                        }}
                        placeholder="Paste certificate verification link (https://...)"
                        className={`w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.credentialUrl ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    {errors.credentialUrl && (
                      <p className="mt-1 text-sm text-red-600">{errors.credentialUrl}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description - Full Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details such as skills gained, course topics, project work, or achievements..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Add/Update Button */}
              <div className="flex gap-3">
                {editingCertId && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  onClick={handleAddCertification}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                >
                  {editingCertId ? 'Update Certification' : 'Add Certification'}
                </button>
              </div>

              {/* Previously Added Certifications */}
              {certifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Previously Added Certifications</h3>
                  <div className="space-y-3">
                    {certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {cert.certificationName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                            <span>{cert.issuingOrganization}</span>
                            <span>•</span>
                            <span>{formatDateForDisplay(cert.issueDate)}</span>
                            {cert.credentialId && (
                              <>
                                <span>•</span>
                                <span>{cert.credentialId}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleEditCertification(cert)}
                            className="p-2 text-[#9095A1] hover:text-blue-600"
                            title="Edit"
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
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCertification(cert.id)}
                            className="p-2 text-[#9095A1] hover:text-red-600"
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
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                Add Certification
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
