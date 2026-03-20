'use client';

import { useState, useEffect, useRef } from 'react';
import GapExplanationModal, { GapExplanationData } from './GapExplanationModal';

interface WorkExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: WorkExperienceData) => void;
  initialData?: WorkExperienceData;
  onAddEntry?: (entry: WorkExperienceEntry) => Promise<WorkExperienceEntry | null>;
}

export interface WorkExperienceDocument {
  id: string;
  file?: File | string;
  name: string;
  url?: string;
  size?: number;
}

export interface WorkExperienceEntry {
  id: string;
  jobTitle: string;
  companyName: string;
  employmentType: string;
  industryDomain: string;
  numberOfReportees: string;
  startDate: string;
  endDate: string;
  currentlyWorkHere: boolean;
  workLocation: string;
  workMode: string;
  companyProfile: string;
  companyTurnover: string;
  keyResponsibilities: string;
  achievements: string;
  workSkills: string[];
  documents?: WorkExperienceDocument[];
}

export interface WorkExperienceData {
  workExperiences: WorkExperienceEntry[];
}

export default function WorkExperienceModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  onAddEntry,
}: WorkExperienceModalProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [industryDomain, setIndustryDomain] = useState('');
  const [numberOfReportees, setNumberOfReportees] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentlyWorkHere, setCurrentlyWorkHere] = useState(false);
  const [workLocation, setWorkLocation] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [companyProfile, setCompanyProfile] = useState('');
  const [companyTurnover, setCompanyTurnover] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState('');
  const [achievements, setAchievements] = useState('');
  const [workSkillsInput, setWorkSkillsInput] = useState('');
  const [workSkills, setWorkSkills] = useState<string[]>([]);
  const [documents, setDocuments] = useState<WorkExperienceDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [workExperiences, setWorkExperiences] = useState<WorkExperienceEntry[]>(initialData?.workExperiences || []);
  const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});
  const [isGapModalOpen, setIsGapModalOpen] = useState(false);
  const [gapInfo, setGapInfo] = useState<{
    gapYears: number;
    gapMonths: number;
    gapDays?: number;
    fromDate: string;
    toDate: string;
  } | null>(null);
  const [gapExplanationData, setGapExplanationData] = useState<GapExplanationData | undefined>();

  // Function to populate form fields from an entry
  const populateFormFromEntry = (entry: WorkExperienceEntry) => {
    setJobTitle(entry.jobTitle || '');
    setCompanyName(entry.companyName || '');
    setEmploymentType(entry.employmentType || '');
    setIndustryDomain(entry.industryDomain || '');
    setNumberOfReportees(entry.numberOfReportees || '');
    setStartDate(entry.startDate || '');
    setEndDate(entry.endDate || '');
    setCurrentlyWorkHere(entry.currentlyWorkHere || false);
    setWorkLocation(entry.workLocation || '');
    setWorkMode(entry.workMode || '');
    setCompanyProfile(entry.companyProfile || '');
    setCompanyTurnover(entry.companyTurnover || '');
    setKeyResponsibilities(entry.keyResponsibilities || '');
    setAchievements(entry.achievements || '');
    setWorkSkills(entry.workSkills || []);
    
    // Handle documents - convert URLs to document objects
    if (entry.documents && entry.documents.length > 0) {
      const normalizedDocs: WorkExperienceDocument[] = entry.documents.map((doc: any, index: number) => {
        if (typeof doc === 'string') {
          return {
            id: `doc-${Date.now()}-${index}`,
            url: doc,
            name: doc.split('/').pop() || 'Document',
          };
        } else if (doc && typeof doc === 'object') {
          return {
            id: doc.id || `doc-${Date.now()}-${index}`,
            url: doc.url,
            name: doc.name || 'Document',
            size: doc.size,
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
  };

  useEffect(() => {
    if (initialData && initialData.workExperiences) {
      setWorkExperiences(initialData.workExperiences || []);
      
      // If there's only one entry, populate the form fields for editing
      if (initialData.workExperiences.length === 1) {
        populateFormFromEntry(initialData.workExperiences[0]);
      } else {
        // If multiple entries, clear form fields
        clearFormFields();
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const clearFormFields = () => {
    setJobTitle('');
    setCompanyName('');
    setEmploymentType('');
    setIndustryDomain('');
    setNumberOfReportees('');
    setStartDate('');
    setEndDate('');
    setCurrentlyWorkHere(false);
    setWorkLocation('');
    setWorkMode('');
    setCompanyProfile('');
    setCompanyTurnover('');
    setKeyResponsibilities('');
    setAchievements('');
    setWorkSkillsInput('');
    setWorkSkills([]);
  };

  const resetForm = () => {
    clearFormFields();
    setWorkExperiences([]);
    setExpandedEntries({});
  };

  const handleAddWorkExperience = () => {
    if (!jobTitle.trim()) {
      alert('Please enter Job Title.');
      return;
    }
    if (!companyName.trim()) {
      alert('Please enter Company Name.');
      return;
    }
    if (!employmentType) {
      alert('Please select Employment Type.');
      return;
    }
    if (!startDate) {
      alert('Please select Start Date.');
      return;
    }

    // Check for gap before adding (only if there are existing experiences and gap modal is not already open)
    if (!isGapModalOpen) {
      const hasGap = checkForGapAndShowModal(startDate);
      
      if (hasGap) {
        // Don't add yet, wait for user to acknowledge the gap in the modal
        return;
      }
    } else {
      // If gap modal is already open, don't check again - user needs to close or save it first
      return;
    }

    // If no gap or first experience, proceed with adding
    addWorkExperienceEntry();
  };

  const addWorkExperienceEntry = async () => {
    const newEntry: WorkExperienceEntry = {
      id: Date.now().toString(),
      jobTitle: jobTitle.trim(),
      companyName: companyName.trim(),
      employmentType,
      industryDomain,
      numberOfReportees,
      startDate,
      endDate,
      currentlyWorkHere,
      workLocation,
      workMode,
      companyProfile,
      companyTurnover,
      keyResponsibilities,
      achievements,
      workSkills,
      documents: documents.length > 0 ? documents : undefined,
    };

    // If onAddEntry callback is provided, save to database immediately
    if (onAddEntry) {
      try {
        const savedEntry = await onAddEntry(newEntry);
        if (savedEntry) {
          // Use the saved entry with database ID
          setWorkExperiences([...workExperiences, savedEntry]);
        } else {
          // If save failed, still add to local state
          setWorkExperiences([...workExperiences, newEntry]);
        }
      } catch (error) {
        console.error('Error saving work experience entry:', error);
        alert('Error saving work experience. Entry added locally but not saved to database.');
        // Still add to local state even if save failed
        setWorkExperiences([...workExperiences, newEntry]);
      }
    } else {
      // No callback provided, just add to local state (old behavior)
      setWorkExperiences([...workExperiences, newEntry]);
    }
    
    // Clear only the form fields for the next entry
    clearFormFields();
    
    // Close gap modal if open
    setIsGapModalOpen(false);
    setGapInfo(null);
  };

  const handleGapExplanationSave = (data: GapExplanationData) => {
    setGapExplanationData(data);
    // Close the gap modal
    setIsGapModalOpen(false);
    // After saving gap explanation, proceed to add the work experience
    addWorkExperienceEntry();
  };

  const getGapDurationText = () => {
    if (!gapInfo) return '6 months - 1 year';
    const { gapYears, gapMonths } = gapInfo;
    
    if (gapYears === 0 && gapMonths < 3) {
      return 'Less than 3 months';
    } else if (gapYears === 0 && gapMonths < 6) {
      return '3-6 months';
    } else if (gapYears === 0) {
      return '6 months - 1 year';
    } else if (gapYears === 1) {
      return '1-2 years';
    } else {
      return 'More than 2 years';
    }
  };

  const handleRemoveWorkExperience = (id: string) => {
    setWorkExperiences(workExperiences.filter(entry => entry.id !== id));
  };

  const toggleExpandEntry = (id: string) => {
    setExpandedEntries({
      ...expandedEntries,
      [id]: !expandedEntries[id]
    });
  };

  const formatDateRange = (startDate: string, endDate: string, currentlyWorkHere: boolean) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const day = String(start.getDate()).padStart(2, '0');
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const year = start.getFullYear();
    const startFormatted = `${day}-${month}-${year}`;
    
    if (currentlyWorkHere || !endDate) {
      return `${startFormatted} - Present`;
    }
    
    const end = new Date(endDate);
    const endDay = String(end.getDate()).padStart(2, '0');
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endYear = end.getFullYear();
    const endFormatted = `${endDay}-${endMonth}-${endYear}`;
    
    return `${startFormatted} - ${endFormatted}`;
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const calculateGap = (previousEndDate: string, newStartDate: string) => {
    if (!previousEndDate || !newStartDate) {
      return null;
    }
    
    // Normalize dates - ensure they're in YYYY-MM-DD format
    let prevEnd: Date;
    let newStart: Date;
    
    try {
      // Handle different date formats
      if (previousEndDate.includes('/')) {
        // Handle MM/DD/YYYY or DD/MM/YYYY format
        const parts = previousEndDate.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YYYY format
          prevEnd = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00`);
        } else {
          prevEnd = new Date(previousEndDate + 'T00:00:00');
        }
      } else {
        prevEnd = new Date(previousEndDate + 'T00:00:00');
      }
      
      if (newStartDate.includes('/')) {
        // Handle MM/DD/YYYY or DD/MM/YYYY format
        const parts = newStartDate.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YYYY format
          newStart = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00`);
        } else {
          newStart = new Date(newStartDate + 'T00:00:00');
        }
      } else {
        newStart = new Date(newStartDate + 'T00:00:00');
      }
      
      // Check if dates are valid
      if (isNaN(prevEnd.getTime()) || isNaN(newStart.getTime())) {
        return null;
      }
      
      // Check if new start date is actually after previous end date
      // Add 1 day buffer to account for same-day transitions
      const prevEndPlusOne = new Date(prevEnd);
      prevEndPlusOne.setDate(prevEndPlusOne.getDate() + 1);
      
      if (newStart <= prevEndPlusOne) {
        return null; // No gap, dates overlap or are continuous (within 1 day)
      }
      
      // Calculate the difference in milliseconds
      const diffTime = newStart.getTime() - prevEnd.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate years, months, and days
      let gapYears = 0;
      let gapMonths = 0;
      let gapDays = diffDays;
      
      // Calculate years
      if (diffDays >= 365) {
        gapYears = Math.floor(diffDays / 365);
        gapDays = diffDays % 365;
      }
      
      // Calculate months from remaining days
      if (gapDays >= 30) {
        gapMonths = Math.floor(gapDays / 30);
        gapDays = gapDays % 30;
      }
      
      // Return gap info for ANY gap (even if just days)
      return {
        gapYears,
        gapMonths,
        gapDays,
        fromDate: previousEndDate,
        toDate: newStartDate,
      };
    } catch (error) {
      console.error('Error calculating gap:', error);
      return null;
    }
  };

  const checkForGapAndShowModal = (newStartDate: string) => {
    if (!newStartDate || workExperiences.length === 0) {
      return false;
    }
    
    const lastExperience = workExperiences[workExperiences.length - 1];
    let previousEndDate = lastExperience.endDate;
    
    // If currently working or no end date, use today's date
    if (lastExperience.currentlyWorkHere || !previousEndDate) {
      const today = new Date();
      previousEndDate = today.toISOString().split('T')[0];
    }
    
    // Calculate gap - returns gap info for ANY gap (days, months, or years)
    const gap = calculateGap(previousEndDate, newStartDate);
    
    if (gap) {
      // Show modal for ANY gap detected (days, months, or years)
      setGapInfo(gap);
      setIsGapModalOpen(true);
      return true; // Gap detected
    }
    
    return false; // No gap detected
  };

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    
    // Check for gap when start date is selected
    checkForGapAndShowModal(newStartDate);
  };

  // File upload handlers
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newDocuments: WorkExperienceDocument[] = [];
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

    setDocuments([...documents, ...newDocuments]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (documentId: string) => {
    setDocuments(documents.filter(doc => doc.id !== documentId));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };


  const isFormComplete = jobTitle.trim() && companyName.trim() && employmentType && startDate;

  // Helper function to check if an ID is a persisted MongoDB ObjectId
  const isPersistedId = (value?: string) => Boolean(value && /^[a-f\d]{24}$/i.test(value));

  const handleSave = async () => {
    // Check if there's unsaved form data (user filled form but didn't click "Add Work Experience")
    const hasFormData = jobTitle.trim() && companyName.trim() && startDate;
    
    let finalWorkExperiences = [...workExperiences];
    
    if (hasFormData) {
      // Check if we're editing an existing entry (single entry with persisted ID)
      const isEditing = workExperiences.length === 1 && isPersistedId(workExperiences[0].id);
      
      if (isEditing) {
        // Update existing entry with form field values
        const updatedEntry: WorkExperienceEntry = {
          ...workExperiences[0],
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          employmentType,
          industryDomain,
          numberOfReportees,
          startDate,
          endDate,
          currentlyWorkHere,
          workLocation,
          workMode,
          companyProfile,
          companyTurnover,
          keyResponsibilities,
          achievements,
          workSkills,
          documents: documents.length > 0 ? documents : workExperiences[0].documents,
        };
        finalWorkExperiences[0] = updatedEntry;
      } else {
        // User filled form but didn't add it to the list - create entry and add it
        const newEntry: WorkExperienceEntry = {
          id: Date.now().toString(),
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          employmentType,
          industryDomain,
          numberOfReportees,
          startDate,
          endDate,
          currentlyWorkHere,
          workLocation,
          workMode,
          companyProfile,
          companyTurnover,
          keyResponsibilities,
          achievements,
          workSkills,
          documents: documents.length > 0 ? documents : undefined,
        };

        // If onAddEntry callback is provided, save to database immediately
        if (onAddEntry) {
          try {
            const savedEntry = await onAddEntry(newEntry);
            if (savedEntry) {
              finalWorkExperiences.push(savedEntry);
            } else {
              finalWorkExperiences.push(newEntry);
            }
          } catch (error) {
            console.error('Error saving work experience entry:', error);
            // Still add to list even if save failed
            finalWorkExperiences.push(newEntry);
          }
        } else {
          finalWorkExperiences.push(newEntry);
        }
      }
    }

    // Save all work experiences
    onSave({
      workExperiences: finalWorkExperiences,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Gap Explanation Modal */}
      <GapExplanationModal
        isOpen={isGapModalOpen}
        onClose={() => {
          // When closing without saving, allow user to add experience anyway
          setIsGapModalOpen(false);
          // Keep gapInfo in case user wants to add experience
        }}
        onSave={handleGapExplanationSave}
        initialData={gapInfo ? {
          gapCategory: 'Professional',
          reasonForGap: '',
          gapDuration: getGapDurationText(),
          selectedSkills: [],
          coursesText: '',
          preferredSupport: {
            flexibleRole: false,
            hybridRemote: false,
            midLevelReEntry: false,
            skillRefresher: false,
          },
        } : undefined}
        gapInfo={gapInfo || undefined}
      />

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
            <h2 className="text-xl font-semibold text-gray-900">Work Experience</h2>
            <button
              onClick={onClose}
              className="text-[#9095A1] hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-6 space-y-6">
            {/* Basic Information Section - Two Column Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Job Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Software Developer"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  />
                </div>

                {/* Employment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Select employment type</option>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>

                {/* Number of Reportees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Reportees
                  </label>
                  <input
                    type="number"
                    value={numberOfReportees}
                    onChange={(e) => setNumberOfReportees(e.target.value)}
                    placeholder="e.g., 5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    How many people directly reported to you in this role?
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., TCS, Deloitte, Amazon"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  />
                </div>

                {/* Industry / Domain */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry / Domain
                  </label>
                  <select
                    value={industryDomain}
                    onChange={(e) => setIndustryDomain(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Select Industry / Domain</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="education">Education</option>
                    <option value="consulting">Consulting</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dates Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Dates</h3>
              <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9095A1] pointer-events-none"
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
                  End Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={currentlyWorkHere}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    }}
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9095A1] pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentlyWorkHere}
                    onChange={(e) => {
                      setCurrentlyWorkHere(e.target.checked);
                      if (e.target.checked) {
                        setEndDate('');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                  />
                  <span className="text-sm text-blue-600 font-medium">I currently work here</span>
                </label>
              </div>
            </div>
            </div>

            {/* Location & Mode Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Location & Mode</h3>
              <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Location
                </label>
                <input
                  type="text"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  placeholder="City, Country"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Mode
                </label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Select work mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
            </div>
            </div>

            {/* Company Profile Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Company Profile</h3>
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Profile
              </label>
              <div className="relative">
                <textarea
                  value={companyProfile}
                  onChange={(e) => setCompanyProfile(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none pr-16"
                  placeholder="Brief description of the company during your tenure (size, business focus)"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                />
                <p className="absolute bottom-3 right-3 text-xs text-gray-500">
                  {companyProfile.length}/500
                </p>
              </div>
            </div>
            </div>

            {/* Company Turnover Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Company Turnover</h3>
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Turnover
              </label>
              <select
                value={companyTurnover}
                onChange={(e) => setCompanyTurnover(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                }}
              >
                <option value="">Select annual revenue</option>
                <option value="less-than-1m">Less than $1M</option>
                <option value="1m-10m">$1M - $10M</option>
                <option value="10m-50m">$10M - $50M</option>
                <option value="50m-100m">$50M - $100M</option>
                <option value="more-than-100m">More than $100M</option>
              </select>
            </div>
            </div>

            {/* Role Details Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Role Details</h3>
              
              {/* Key Responsibilities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Responsibilities
                </label>
                <textarea
                  value={keyResponsibilities}
                  onChange={(e) => setKeyResponsibilities(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe your main tasks, duties, and contributions..."
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Achievements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Achievements
                </label>
                <textarea
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Highlight major results, improvements, awards, metrics, etc."
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Skills Used Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Skills Used</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skills Used
                </label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={workSkillsInput}
                  onChange={(e) => setWorkSkillsInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && workSkillsInput.trim()) {
                      setWorkSkills([...workSkills, workSkillsInput.trim()]);
                      setWorkSkillsInput('');
                    }
                  }}
                  placeholder="Add skills you applied in this role..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (workSkillsInput.trim()) {
                      setWorkSkills([...workSkills, workSkillsInput.trim()]);
                      setWorkSkillsInput('');
                    }
                  }}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
              {workSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {workSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      {skill}
                      <button
                        onClick={() => {
                          setWorkSkills(workSkills.filter((_, i) => i !== index));
                        }}
                        className="text-blue-700 hover:text-blue-900"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            </div>

            {/* Upload Documents Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Your Work Experience Certificates/Documents
              </label>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                }`}
              >
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF, PNG, JPG (MAX. 5MB per file)</p>
                </div>
              </div>

              {/* Uploaded Files List */}
              {documents.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Uploaded Documents ({documents.length})
                  </p>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-5 h-5 text-[#9095A1]"
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
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          {doc.size && (
                            <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(doc.id);
                        }}
                        className="text-red-600 hover:text-red-800"
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

            {/* Add Button */}
            {isFormComplete && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddWorkExperience}
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
                  Add Work Experience
                </button>
              </div>
            )}

            {/* Added Work Experiences List */}
            {workExperiences.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Added Work Experiences</h3>
                {workExperiences.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-gray-200 rounded-lg p-4 bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {entry.jobTitle} at {entry.companyName}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateRange(entry.startDate, entry.endDate, entry.currentlyWorkHere)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveWorkExperience(entry.id)}
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
                            <span className="text-xs text-gray-500">Job Title:</span>
                            <p className="text-sm text-gray-900">{entry.jobTitle}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Company:</span>
                            <p className="text-sm text-gray-900">{entry.companyName}</p>
                          </div>
                          {entry.employmentType && (
                            <div>
                              <span className="text-xs text-gray-500">Employment Type:</span>
                              <p className="text-sm text-gray-900">{entry.employmentType}</p>
                            </div>
                          )}
                          {entry.workLocation && (
                            <div>
                              <span className="text-xs text-gray-500">Location:</span>
                              <p className="text-sm text-gray-900">{entry.workLocation}</p>
                            </div>
                          )}
                          {entry.workMode && (
                            <div>
                              <span className="text-xs text-gray-500">Work Mode:</span>
                              <p className="text-sm text-gray-900">{entry.workMode}</p>
                            </div>
                          )}
                          {entry.keyResponsibilities && (
                            <div>
                              <span className="text-xs text-gray-500">Key Responsibilities:</span>
                              <p className="text-sm text-gray-900">{entry.keyResponsibilities}</p>
                            </div>
                          )}
                          {entry.achievements && (
                            <div>
                              <span className="text-xs text-gray-500">Achievements:</span>
                              <p className="text-sm text-gray-900">{entry.achievements}</p>
                            </div>
                          )}
                          {entry.workSkills && entry.workSkills.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-500">Skills:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {entry.workSkills.map((skill, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                                  >
                                    {skill}
                                  </span>
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
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Save Work Experience
            </button>
          </div>
        </div>
      </div>
    </>
  );
}