'use client';

import { useState, useEffect, useRef } from 'react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProjectData) => void;
  initialData?: ProjectData;
}

export interface ProjectDocument {
  id: string;
  file?: File;
  name: string;
  url?: string;
  size?: number;
}

export interface ProjectData {
  projectTitle: string;
  projectType: string;
  organizationClient: string;
  currentlyWorking: boolean;
  startDate: string;
  endDate: string;
  projectDescription: string;
  responsibilities: string;
  technologies: string[];
  projectOutcome: string;
  projectLink: string;
  documents?: ProjectDocument[];
}

const PROJECT_TYPES = [
  'Academic Project',
  'Personal Project',
  'Freelance Project',
  'Open Source',
  'Company Project',
  'Research Project',
  'Other'
];

export default function ProjectModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: ProjectModalProps) {
  const [projectTitle, setProjectTitle] = useState(initialData?.projectTitle || '');
  const [projectType, setProjectType] = useState(initialData?.projectType || '');
  const [organizationClient, setOrganizationClient] = useState(initialData?.organizationClient || '');
  const [currentlyWorking, setCurrentlyWorking] = useState(initialData?.currentlyWorking ?? false);
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [projectDescription, setProjectDescription] = useState(initialData?.projectDescription || '');
  const [responsibilities, setResponsibilities] = useState(initialData?.responsibilities || '');
  const [technologiesInput, setTechnologiesInput] = useState('');
  const [technologies, setTechnologies] = useState<string[]>(initialData?.technologies || []);
  const [projectOutcome, setProjectOutcome] = useState(initialData?.projectOutcome || '');
  const [projectLink, setProjectLink] = useState(initialData?.projectLink || '');
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Normalize documents to ensure each has a unique id
    if (initialData?.documents && Array.isArray(initialData.documents)) {
      const normalizedDocs = initialData.documents.map((doc: any, index: number) => {
        if (typeof doc === 'string') {
          return {
            id: `doc-${index}-${Date.now()}`,
            name: doc.split('/').pop() || 'Document',
            url: doc,
          };
        }
        return {
          id: doc.id || `doc-${index}-${Date.now()}`,
          name: doc.name || 'Document',
          url: doc.url,
          file: doc.file,
          size: doc.size,
        };
      });
      setDocuments(normalizedDocs);
    } else {
      setDocuments([]);
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (initialData) {
      setProjectTitle(initialData.projectTitle || '');
      setProjectType(initialData.projectType || '');
      setOrganizationClient(initialData.organizationClient || '');
      setCurrentlyWorking(initialData.currentlyWorking ?? false);
      setStartDate(initialData.startDate || '');
      setEndDate(initialData.endDate || '');
      setProjectDescription(initialData.projectDescription || '');
      setResponsibilities(initialData.responsibilities || '');
      setTechnologies(initialData.technologies || []);
      setProjectOutcome(initialData.projectOutcome || '');
      setProjectLink(initialData.projectLink || '');
    } else {
      // Reset all fields when initialData is undefined (Add mode)
      setProjectTitle('');
      setProjectType('');
      setOrganizationClient('');
      setCurrentlyWorking(false);
      setStartDate('');
      setEndDate('');
      setProjectDescription('');
      setResponsibilities('');
      setTechnologies([]);
      setProjectOutcome('');
      setProjectLink('');
      setDocuments([]);
    }
  }, [initialData, isOpen]);

  const handleAddTechnology = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && technologiesInput.trim()) {
      e.preventDefault();
      if (!technologies.includes(technologiesInput.trim())) {
        setTechnologies([...technologies, technologiesInput.trim()]);
      }
      setTechnologiesInput('');
    }
  };

  const handleRemoveTechnology = (index: number) => {
    setTechnologies(technologies.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    Array.from(e.target.files).forEach((file) => {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Only PDF, PNG, and JPG files are allowed.`);
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 10MB.`);
        return;
      }

      const newDoc: ProjectDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
      };
      setDocuments(prev => [...prev, newDoc]);
    });
  };

  const handleRemoveFile = (docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
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

    if (!e.dataTransfer.files) return;

    Array.from(e.dataTransfer.files).forEach((file) => {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Only PDF, PNG, and JPG files are allowed.`);
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 10MB.`);
        return;
      }

      const newDoc: ProjectDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
      };
      setDocuments(prev => [...prev, newDoc]);
    });
  };

  const handleSave = () => {
    if (!projectTitle.trim() || !projectType.trim() || !startDate.trim() || !projectDescription.trim()) {
      return;
    }
    onSave({
      projectTitle,
      projectType,
      organizationClient,
      currentlyWorking,
      startDate,
      endDate,
      projectDescription,
      responsibilities,
      technologies,
      projectOutcome,
      projectLink,
      documents,
    });
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
              {initialData ? 'Edit Project' : 'Add Project'}
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
              {/* Project Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g., E-commerce Website, Machine Learning Model, Marketing Campaign"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Project Type and Organization / Client - Two Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Project Type</option>
                    {PROJECT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Organization / Client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization / Client <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={organizationClient}
                    onChange={(e) => setOrganizationClient(e.target.value)}
                    placeholder="If applicable — Company, University, or Client Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Currently Working Checkbox */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentlyWorking}
                    onChange={(e) => setCurrentlyWorking(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">I am currently working on this project</span>
                </label>
              </div>

              {/* Dates - Two Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <svg
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9095A1] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={currentlyWorking}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <svg
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9095A1] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Project Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Explain the project goals, your role, key tasks, and outcomes…"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Responsibilities / Contributions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsibilities / Contributions <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder="Mention what you contributed—features built, research done, tasks handled…"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Technologies / Tools Used */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Technologies / Tools Used <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={technologiesInput}
                  onChange={(e) => setTechnologiesInput(e.target.value)}
                  onKeyPress={handleAddTechnology}
                  placeholder="Add technologies (e.g., React, Python, Figma, SQL)…"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {technologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {technologies.map((tech, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {tech}
                        <button
                          onClick={() => handleRemoveTechnology(index)}
                          className="text-blue-700 hover:text-blue-900"
                        >
                          <svg
                            width="14"
                            height="14"
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
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Project Outcome / Results */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Outcome / Results <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={projectOutcome}
                  onChange={(e) => setProjectOutcome(e.target.value)}
                  placeholder="Mention improvements, results, metrics, awards, or impact…"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Project Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Link <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={projectLink}
                  onChange={(e) => setProjectLink(e.target.value)}
                  placeholder="GitHub, Behance, Portfolio, Drive link…"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Upload Your Project Documents/Certificates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Your Project Documents/Certificates <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                  <p className="mt-1 text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                </div>
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            {doc.size && (
                              <p className="text-xs text-gray-500">
                                {(doc.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(doc.id)}
                          className="ml-3 text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!projectTitle.trim() || !projectType.trim() || !startDate.trim() || !projectDescription.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save Project
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
