'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import ResumeTemplate, { ResumeJSON } from '@/components/resume/ResumeTemplate';

import { API_BASE_URL } from '@/lib/api-base';

export default function AICVEditorPage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeJSON>({
    name: '',
    title: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    custom_sections: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');
  const [editingIndex, setEditingIndex] = useState<{ section: string; index: number } | null>(null);
  const [aiImproving, setAiImproving] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const resumePreviewRef = useRef<HTMLDivElement>(null);

  // Load resume data on mount
  useEffect(() => {
    const loadResume = async () => {
      const candidateId = sessionStorage.getItem('candidateId');
      if (!candidateId) {
        alert('Please login first');
        router.push('/login');
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔄 Loading resume from database...');
        const response = await fetch(`${API_BASE_URL}/resume-editor/${candidateId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to load resume');
        }
        
        const result = await response.json();
        console.log('📥 Resume data received:', result);
        
        if (result.success && result.data?.resumeJson) {
          const normalizedSkills = Array.isArray(result.data.resumeJson.skills)
            ? result.data.resumeJson.skills.map((skill: any) => {
                if (typeof skill === 'string') return skill;
                return skill?.name || skill?.languageName || skill?.skill || skill?.title || String(skill);
              })
            : [];

          // Ensure all array fields are initialized
          const resumeData = {
            name: result.data.resumeJson.name || '',
            title: result.data.resumeJson.title || '',
            summary: result.data.resumeJson.summary || '',
            experience: Array.isArray(result.data.resumeJson.experience) 
              ? result.data.resumeJson.experience 
              : [],
            education: Array.isArray(result.data.resumeJson.education) 
              ? result.data.resumeJson.education 
              : [],
            skills: normalizedSkills,
            projects: Array.isArray(result.data.resumeJson.projects) 
              ? result.data.resumeJson.projects 
              : [],
            certifications: Array.isArray(result.data.resumeJson.certifications) 
              ? result.data.resumeJson.certifications 
              : [],
            custom_sections: Array.isArray(result.data.resumeJson.custom_sections) 
              ? result.data.resumeJson.custom_sections 
              : []
          };
          
          console.log('✅ Resume data loaded successfully:', resumeData);
          setResume(resumeData);
        } else {
          console.warn('⚠️ No resume data found, using empty template');
          // Keep the default empty resume state
        }
      } catch (error: any) {
        console.error('❌ Error loading resume:', error);
        const errorMessage = error.message || 'Failed to load resume data';
        alert(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadResume();
  }, [router]);

  // Update resume state helper
  const updateResume = (updates: Partial<ResumeJSON>) => {
    setResume(prev => ({ ...prev, ...updates }));
  };

  // Export resume as PDF
  const exportToPDF = async () => {
    if (!resumePreviewRef.current) {
      alert('Resume preview not found');
      return;
    }

    try {
      setIsExporting(true);
      
      // Dynamically import PDF libraries (client-side only)
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      
      // Hide header and footer for PDF export
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const originalHeaderDisplay = header?.style.display || '';
      const originalFooterDisplay = footer?.style.display || '';
      
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';

      // Capture the resume preview as canvas
      const canvas = await html2canvas(resumePreviewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Restore header and footer
      if (header) header.style.display = originalHeaderDisplay;
      if (footer) footer.style.display = originalFooterDisplay;

      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download PDF
      const fileName = `${resume.name || 'Resume'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      alert('Resume exported as PDF successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Save resume to database
  const saveResume = async () => {
    const candidateId = sessionStorage.getItem('candidateId');
    if (!candidateId) {
      alert('Please login first');
      return;
    }

    // Validate resume data before saving
    if (!resume || (typeof resume === 'object' && Object.keys(resume).length === 0)) {
      alert('Resume data is empty. Please add some content before saving.');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`${API_BASE_URL}/resume-editor/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeJson: resume }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        const errorMessage = result.message || 'Failed to save resume';
        console.error('API Error:', errorMessage, result.error);
        alert(errorMessage);
        return;
      }
      
      if (result.success) {
        alert(result.message || 'Resume saved successfully!');
      } else {
        alert(result.message || 'Failed to save resume');
      }
    } catch (error: any) {
      console.error('Error saving resume:', error);
      const errorMessage = error.message || 'Failed to save resume. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Improve text with AI
  const improveTextWithAI = async (text: string, context: string, updateCallback: (improved: string) => void) => {
    try {
      setAiImproving(context);
      const response = await fetch(`${API_BASE_URL}/resume-editor/improve-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        const errorMessage = result.message || 'Failed to improve text with AI';
        console.error('API Error:', errorMessage, result.error);
        alert(errorMessage);
        return;
      }
      
      if (result.success && result.data?.improvedText) {
        updateCallback(result.data.improvedText);
      } else {
        throw new Error(result.message || 'No improved text received');
      }
    } catch (error: any) {
      console.error('Error improving text:', error);
      const errorMessage = error.message || 'Failed to improve text with AI. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setAiImproving(null);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  // Add new item to array section
  const addItem = (section: keyof ResumeJSON, item: any) => {
    const current = resume[section] as any[];
    updateResume({ [section]: [...current, item] });
  };

  // Update item in array section
  const updateItem = (section: keyof ResumeJSON, index: number, updates: any) => {
    const current = resume[section] as any[];
    const updated = [...current];
    updated[index] = { ...updated[index], ...updates };
    updateResume({ [section]: updated });
  };

  // Delete item from array section
  const deleteItem = (section: keyof ResumeJSON, index: number) => {
    const current = resume[section] as any[];
    const updated = current.filter((_, i) => i !== index);
    updateResume({ [section]: updated });
  };

  // Add custom section
  const addCustomSection = () => {
    const title = prompt('Enter section title:');
    if (title) {
      addItem('custom_sections', { title, items: [] });
    }
  };

  // Add item to custom section
  const addItemToCustomSection = (sectionIndex: number) => {
    const item = { title: '', description: '', date: '' };
    const current = [...(resume.custom_sections || [])];
    current[sectionIndex].items.push(item);
    updateResume({ custom_sections: current });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading resume...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header with Export and Save buttons */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Resume Editor</h1>
          <div className="flex gap-3">
            <button
              onClick={saveResume}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Resume'}
            </button>
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Live Resume Preview */}
          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <div ref={resumePreviewRef} className="bg-white rounded-lg shadow-lg p-8 print:p-4">
              <ResumeTemplate resume={resume} />
            </div>
          </div>

          {/* Right Column - Editing Controls */}
          <div className="space-y-6">
            {/* Basic Info Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                <button
                  onClick={() => toggleSection('basic')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'basic' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'basic' && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={resume.name}
                    onChange={(e) => updateResume({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Full Name"
                  />
                  <input
                    type="text"
                    value={resume.title}
                    onChange={(e) => updateResume({ title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Professional Title"
                  />
                </div>
              )}
            </div>

            {/* Summary Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Summary</h3>
                <button
                  onClick={() => toggleSection('summary')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'summary' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'summary' && (
                <div className="space-y-4">
                  <textarea
                    value={resume.summary}
                    onChange={(e) => updateResume({ summary: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                    rows={4}
                    placeholder="Enter your professional summary..."
                  />
                  <button
                    onClick={() => improveTextWithAI(resume.summary, 'summary', (improved) => updateResume({ summary: improved }))}
                    disabled={aiImproving === 'summary' || !resume.summary}
                    className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {aiImproving === 'summary' ? 'Improving...' : 'AI Improve Summary'}
                  </button>
                </div>
              )}
            </div>

            {/* Experience Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Experience</h3>
                <button
                  onClick={() => toggleSection('experience')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'experience' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'experience' && (
                <div className="space-y-6">
                  {(resume.experience || []).map((exp, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => updateItem('experience', index, { role: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Job Title"
                        />
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => updateItem('experience', index, { company: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Company"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={exp.start_date}
                          onChange={(e) => updateItem('experience', index, { start_date: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Start Date"
                        />
                        <input
                          type="text"
                          value={exp.end_date}
                          onChange={(e) => updateItem('experience', index, { end_date: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="End Date"
                        />
                      </div>
                      <textarea
                        value={exp.description}
                        onChange={(e) => updateItem('experience', index, { description: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                        rows={3}
                        placeholder="Job Description"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => improveTextWithAI(exp.description, `experience-${index}`, (improved) => updateItem('experience', index, { description: improved }))}
                          disabled={aiImproving === `experience-${index}` || !exp.description}
                          className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
                        >
                          {aiImproving === `experience-${index}` ? 'Improving...' : 'AI Improve'}
                        </button>
                        <button
                          onClick={() => deleteItem('experience', index)}
                          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addItem('experience', { role: '', company: '', start_date: '', end_date: '', description: '' })}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    + Add Experience
                  </button>
                </div>
              )}
            </div>

            {/* Education Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Education</h3>
                <button
                  onClick={() => toggleSection('education')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'education' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'education' && (
                <div className="space-y-6">
                  {(resume.education || []).map((edu, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateItem('education', index, { degree: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Degree"
                      />
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateItem('education', index, { institution: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Institution"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={edu.start_year}
                          onChange={(e) => updateItem('education', index, { start_year: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Start Year"
                        />
                        <input
                          type="text"
                          value={edu.end_year}
                          onChange={(e) => updateItem('education', index, { end_year: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="End Year"
                        />
                      </div>
                      <button
                        onClick={() => deleteItem('education', index)}
                        className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addItem('education', { degree: '', institution: '', start_year: '', end_year: '' })}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    + Add Education
                  </button>
                </div>
              )}
            </div>

            {/* Skills Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Skills</h3>
                <button
                  onClick={() => toggleSection('skills')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'skills' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'skills' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(resume.skills || []).map((skill, index) => {
                      return (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded flex items-center gap-2"
                        >
                          {skill}
                          <button
                            onClick={() => deleteItem('skills', index)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          addItem('skills', e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Add skill and press Enter"
                    />
                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input.value) {
                          addItem('skills', input.value);
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Projects Editing */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Projects</h3>
                <button
                  onClick={() => toggleSection('projects')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className={`w-5 h-5 transition-transform ${expandedSection === 'projects' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'projects' && (
                <div className="space-y-6">
                  {(resume.projects || []).map((project, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => updateItem('projects', index, { title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Project Title"
                      />
                      <textarea
                        value={project.description}
                        onChange={(e) => updateItem('projects', index, { description: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                        rows={3}
                        placeholder="Project Description"
                      />
                      <input
                        type="text"
                        value={project.link || ''}
                        onChange={(e) => updateItem('projects', index, { link: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Project Link (optional)"
                      />
                      <button
                        onClick={() => deleteItem('projects', index)}
                        className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addItem('projects', { title: '', description: '', link: '' })}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    + Add Project
                  </button>
                </div>
              )}
            </div>

            {/* Add Custom Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <button
                onClick={addCustomSection}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 transition-colors"
              >
                + Add Custom Section
              </button>
            </div>

            {/* Custom Sections Editing */}
            {(resume.custom_sections || []).map((section, sectionIndex) => (
              <div key={sectionIndex} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{section.title}</h3>
                  <button
                    onClick={() => deleteItem('custom_sections', sectionIndex)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete Section
                  </button>
                </div>
                <div className="space-y-4">
                  {(section.items || []).map((item, itemIndex) => (
                    <div key={itemIndex} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <input
                        type="text"
                        value={item.title || ''}
                        onChange={(e) => {
                          const updated = [...(resume.custom_sections || [])];
                          updated[sectionIndex].items[itemIndex].title = e.target.value;
                          updateResume({ custom_sections: updated });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Title"
                      />
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => {
                          const updated = [...(resume.custom_sections || [])];
                          updated[sectionIndex].items[itemIndex].description = e.target.value;
                          updateResume({ custom_sections: updated });
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                        placeholder="Description"
                      />
                      <button
                        onClick={() => {
                          const updated = [...(resume.custom_sections || [])];
                          updated[sectionIndex].items = updated[sectionIndex].items.filter((_, i) => i !== itemIndex);
                          updateResume({ custom_sections: updated });
                        }}
                        className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Delete Item
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addItemToCustomSection(sectionIndex)}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
