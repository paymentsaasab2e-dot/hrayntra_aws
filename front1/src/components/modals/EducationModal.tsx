'use client';

import { useState, useEffect, useRef } from 'react';

interface EducationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EducationData) => void;
  initialData?: EducationData;
}

export interface EducationDocument {
  id: string;
  file?: File;
  name: string;
  url?: string;
  size?: number;
}

export interface EducationData {
  id?: string;
  educationLevel: string;
  degreeProgram: string;
  institutionName: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  currentlyStudying: boolean;
  grade: string;
  modeOfStudy: string;
  courseDuration: string;
  documents?: EducationDocument[];
}

export default function EducationModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: EducationModalProps) {
  const [educationLevel, setEducationLevel] = useState(initialData?.educationLevel || '');
  const [degreeProgram, setDegreeProgram] = useState(initialData?.degreeProgram || '');
  const [institutionName, setInstitutionName] = useState(initialData?.institutionName || '');
  const [fieldOfStudy, setFieldOfStudy] = useState(initialData?.fieldOfStudy || '');
  const [startYear, setStartYear] = useState(initialData?.startYear || '');
  const [endYear, setEndYear] = useState(initialData?.endYear || '');
  const [currentlyStudying, setCurrentlyStudying] = useState(initialData?.currentlyStudying || false);
  const [grade, setGrade] = useState(initialData?.grade || '');
  const [modeOfStudy, setModeOfStudy] = useState(initialData?.modeOfStudy || '');
  const [courseDuration, setCourseDuration] = useState(initialData?.courseDuration || '');
  const [documents, setDocuments] = useState<EducationDocument[]>(initialData?.documents || []);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update values when initialData changes
  useEffect(() => {
    if (initialData) {
      setEducationLevel(initialData.educationLevel || '');
      setDegreeProgram(initialData.degreeProgram || '');
      setInstitutionName(initialData.institutionName || '');
      setFieldOfStudy(initialData.fieldOfStudy || '');
      setStartYear(initialData.startYear || '');
      setEndYear(initialData.endYear || '');
      setCurrentlyStudying(initialData.currentlyStudying || false);
      setGrade(initialData.grade || '');
      setModeOfStudy(initialData.modeOfStudy || '');
      setCourseDuration(initialData.courseDuration || '');
      
      // Normalize documents to ensure they all have unique IDs
      const normalizedDocuments: EducationDocument[] = (initialData.documents || []).map((doc, index) => {
        if (typeof doc === 'string') {
          // If it's a string (URL from database), convert to object
          return {
            id: `doc-${Date.now()}-${index}`,
            url: doc,
            name: doc.split('/').pop() || 'Document',
          };
        } else if (doc && typeof doc === 'object') {
          // If it's already an object, ensure it has an id
          return {
            id: doc.id || `doc-${Date.now()}-${index}`,
            file: doc.file,
            name: doc.name || 'Document',
            url: doc.url,
            size: doc.size,
          };
        } else {
          // Fallback for any other type
          return {
            id: `doc-${Date.now()}-${index}`,
            name: 'Document',
          };
        }
      });
      setDocuments(normalizedDocuments);
    } else {
      // Clear all fields for "Add" mode
      setEducationLevel('');
      setDegreeProgram('');
      setInstitutionName('');
      setFieldOfStudy('');
      setStartYear('');
      setEndYear('');
      setCurrentlyStudying(false);
      setGrade('');
      setModeOfStudy('');
      setCourseDuration('');
      setDocuments([]);
    }
  }, [initialData, isOpen]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach((file) => {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Only PDF, PNG, and JPG files are allowed.`);
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 5MB.`);
        return;
      }

      const newDoc: EducationDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
      };
      setDocuments((prev) => [...prev, newDoc]);
    });
  };

  const handleRemoveFile = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
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
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSave = () => {
    onSave({
      id: initialData?.id,
      educationLevel,
      degreeProgram,
      institutionName,
      fieldOfStudy,
      startYear,
      endYear,
      currentlyStudying,
      grade,
      modeOfStudy,
      courseDuration,
      documents: documents.length > 0 ? documents : undefined,
    });
    onClose();
  };

  // Generate year options (last 50 years to next 10 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = currentYear - 50; i <= currentYear + 10; i++) {
    yearOptions.push(i);
  }

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
            <h2 className="text-xl font-semibold text-gray-900">Add Education</h2>
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
              {/* Education Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Education Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Education Level</option>
                  <option value="High School">High School</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Bachelor's">Bachelor's</option>
                  <option value="Master's">Master's</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Degree / Program */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Degree / Program <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={degreeProgram}
                  onChange={(e) => setDegreeProgram(e.target.value)}
                  placeholder="e.g., B.Tech in Computer Science"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Institution / University Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution / University Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g., Delhi University"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Field of Study / Major */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field of Study / Major
                </label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="e.g., Computer Science"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Dates Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Start Year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Year
                  </label>
                  <select
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    disabled={currentlyStudying}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select End Year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Currently Studying Checkbox */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={currentlyStudying}
                    onChange={(e) => {
                      setCurrentlyStudying(e.target.checked);
                      if (e.target.checked) {
                        setEndYear('');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">I am currently studying here</span>
                </label>
              </div>

              {/* Academic Details Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Academic Details</h3>
                
                {/* Grade / Percentage / GPA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade / Percentage / GPA
                  </label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g., 8.2 CGPA, 78%, 3.5 GPA"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Mode of Study */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mode of Study
                  </label>
                  <select
                    value={modeOfStudy}
                    onChange={(e) => setModeOfStudy(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Mode of Study</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Online">Online</option>
                    <option value="Distance Learning">Distance Learning</option>
                  </select>
                </div>

                {/* Course Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Duration
                  </label>
                  <input
                    type="text"
                    value={courseDuration}
                    onChange={(e) => setCourseDuration(e.target.value)}
                    placeholder="e.g., 3 years"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Upload Documents */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Your Education Certificates/Documents
                </label>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />

                {/* Drag and drop area */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm text-gray-600 text-center">
                      <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG (Max 5MB per file)</p>
                  </div>
                </div>

                {/* Display uploaded files */}
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Uploaded Documents ({documents.length})
                    </p>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg
                            className="w-5 h-5 text-gray-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">{doc.name}</span>
                          {doc.size && (
                            <span className="text-xs text-gray-500">
                              ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(doc.id)}
                          className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          aria-label="Remove file"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                Save Education
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
