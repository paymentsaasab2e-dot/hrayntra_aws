'use client';

import { useState, useEffect, useRef } from 'react';
import { API_ORIGIN } from '@/lib/api-base';

interface AccomplishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AccomplishmentsData) => void;
  initialData?: AccomplishmentsData;
}

export interface AccomplishmentDocument {
  id: string;
  file?: File;
  name: string;
  url?: string;
  size?: number;
}

export interface Accomplishment {
  id: string;
  title: string;
  category: string;
  organization?: string;
  achievementDate: string;
  description?: string;
  supportingDocument?: File | string;
  documents?: AccomplishmentDocument[];
}

export interface AccomplishmentsData {
  accomplishments: Accomplishment[];
}

const ACCOMPLISHMENT_CATEGORIES = [
  'Award',
  'Publication',
  'Research',
  'Competition',
  'Conference',
  'Patent',
  'Recognition',
  'Achievement',
  'Other'
];

const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export default function AccomplishmentModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: AccomplishmentModalProps) {
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>(initialData?.accomplishments || []);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organization, setOrganization] = useState('');
  const [achievementDate, setAchievementDate] = useState('');
  const [description, setDescription] = useState('');
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [documents, setDocuments] = useState<AccomplishmentDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingAccomplishmentId, setEditingAccomplishmentId] = useState<string | null>(null);
  
  // Error states
  const [errors, setErrors] = useState({
    title: '',
    category: '',
    achievementDate: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setAccomplishments(initialData.accomplishments || []);
    } else {
      setAccomplishments([]);
    }
    // Reset form when modal opens
    if (isOpen) {
      resetForm();
    }
  }, [initialData, isOpen]);

  // Normalize documents when editing
  useEffect(() => {
    if (editingAccomplishmentId && accomplishments.length > 0) {
      const acc = accomplishments.find(a => a.id === editingAccomplishmentId);
      if (acc && acc.documents) {
        const normalizedDocs: AccomplishmentDocument[] = acc.documents.map((doc, index) => {
          if (typeof doc === 'string') {
            return {
              id: `doc-${Date.now()}-${index}`,
              url: doc,
              name: doc.split('/').pop() || 'Document',
            };
          } else if (doc && typeof doc === 'object') {
            return {
              id: (doc as AccomplishmentDocument).id || `doc-${Date.now()}-${index}`,
              file: (doc as AccomplishmentDocument).file,
              name: (doc as AccomplishmentDocument).name || 'Document',
              url: (doc as AccomplishmentDocument).url,
              size: (doc as AccomplishmentDocument).size,
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
  }, [editingAccomplishmentId, accomplishments]);

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setOrganization('');
    setAchievementDate('');
    setDescription('');
    setSupportingDocument(null);
    setDocuments([]);
    setDragActive(false);
    setEditingAccomplishmentId(null);
    setErrors({
      title: '',
      category: '',
      achievementDate: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors = {
      title: '',
      category: '',
      achievementDate: '',
    };

    if (!title.trim()) {
      newErrors.title = 'Accomplishment Title is required.';
    }
    if (!category.trim()) {
      newErrors.category = 'Category / Type is required.';
    }
    if (!achievementDate.trim()) {
      newErrors.achievementDate = 'Achievement Date is required.';
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
    const validFiles: AccomplishmentDocument[] = [];
    
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

  const handleAddAccomplishment = () => {
    if (!validateForm()) {
      return;
    }

    const newAccomplishment: Accomplishment = {
      id: editingAccomplishmentId || Date.now().toString(),
      title: title.trim(),
      category,
      organization: organization.trim() || undefined,
      achievementDate,
      description: description.trim() || undefined,
      supportingDocument: supportingDocument || undefined,
      documents: documents.length > 0 ? documents : undefined,
    };

    if (editingAccomplishmentId) {
      // Update existing accomplishment
      setAccomplishments(accomplishments.map(acc =>
        acc.id === editingAccomplishmentId ? newAccomplishment : acc
      ));
    } else {
      // Add new accomplishment
      setAccomplishments([...accomplishments, newAccomplishment]);
    }

    resetForm();
  };

  const handleEditAccomplishment = (acc: Accomplishment) => {
    setTitle(acc.title);
    setCategory(acc.category);
    setOrganization(acc.organization || '');
    setAchievementDate(acc.achievementDate);
    setDescription(acc.description || '');
    setEditingAccomplishmentId(acc.id);
    setSupportingDocument(acc.supportingDocument instanceof File ? acc.supportingDocument : null);
    setDocuments(acc.documents || []);
    setErrors({
      title: '',
      category: '',
      achievementDate: '',
    });
  };

  const handleDeleteAccomplishment = (accId: string) => {
    setAccomplishments(accomplishments.filter(acc => acc.id !== accId));
  };

  const handleSave = () => {
    onSave({ accomplishments });
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
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingAccomplishmentId ? 'Edit Accomplishment' : 'Add Accomplishment'}
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
              {/* Accomplishment Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accomplishment Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) {
                      setErrors({ ...errors, title: '' });
                    }
                  }}
                  placeholder="Enter accomplishment title..."
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                )}
              </div>

              {/* Category / Type and Organization - Two Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category / Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category / Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (errors.category) {
                        setErrors({ ...errors, category: '' });
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Category</option>
                    {ACCOMPLISHMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                  )}
                </div>

                {/* Organization / Authority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization / Authority <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g., University, Company, Institution"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Achievement Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Achievement Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="month"
                    value={achievementDate}
                    onChange={(e) => {
                      setAchievementDate(e.target.value);
                      if (errors.achievementDate) {
                        setErrors({ ...errors, achievementDate: '' });
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.achievementDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.achievementDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.achievementDate}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about the accomplishment, its significance, or your contribution..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Upload Supporting Documents */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Supporting Documents <span className="text-gray-500 text-xs">(Optional)</span>
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
                              href={`${API_ORIGIN}${doc.url}`}
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

              {/* Add/Update Button */}
              <div className="flex gap-3">
                {editingAccomplishmentId && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  onClick={handleAddAccomplishment}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                >
                  {editingAccomplishmentId ? 'Update Accomplishment' : 'Add Accomplishment'}
                </button>
              </div>

              {/* Previously Added Accomplishments */}
              {accomplishments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Previously Added Accomplishments</h3>
                  <div className="space-y-3">
                    {accomplishments.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {acc.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                            <span>{acc.category}</span>
                            {acc.organization && (
                              <>
                                <span>•</span>
                                <span>{acc.organization}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{formatDateForDisplay(acc.achievementDate)}</span>
                          </div>
                          {acc.description && (
                            <p className="text-xs text-gray-600 mt-2 line-clamp-2">{acc.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleEditAccomplishment(acc)}
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
                            onClick={() => handleDeleteAccomplishment(acc.id)}
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
                Save Accomplishment
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
