'use client';

import { useState, useEffect, useRef } from 'react';

interface LanguagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LanguagesData) => void;
  initialData?: LanguagesData;
}

export interface LanguageDocument {
  id: string;
  file?: File;
  name: string;
  url?: string;
  size?: number;
}

export interface Language {
  id?: string;
  name: string;
  proficiency: string;
  speak: boolean;
  read: boolean;
  write: boolean;
  documents?: LanguageDocument[];
}

export interface LanguagesData {
  languages: Language[];
}

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Russian', 'Dutch', 'Swedish', 'Norwegian', 'Danish',
  'Polish', 'Turkish', 'Greek', 'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Other'
];

const PROFICIENCY_LEVELS = [
  'Beginner',
  'Elementary',
  'Intermediate',
  'Advanced',
  'Fluent / Native'
];

export default function LanguagesModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: LanguagesModalProps) {
  const [languages, setLanguages] = useState<Language[]>(initialData?.languages || []);
  const [newLanguage, setNewLanguage] = useState('');
  const [newProficiency, setNewProficiency] = useState('');
  const [newSpeak, setNewSpeak] = useState(false);
  const [newRead, setNewRead] = useState(false);
  const [newWrite, setNewWrite] = useState(false);
  const [languageDocuments, setLanguageDocuments] = useState<{ [key: number]: LanguageDocument[] }>({});
  const [dragActive, setDragActive] = useState<{ [key: number]: boolean }>({});
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Update values when initialData changes
  useEffect(() => {
    if (initialData) {
      const normalizedLanguages = (initialData.languages || []).map((lang, index) => {
        // Normalize documents to ensure each has a unique id
        if (lang.documents && Array.isArray(lang.documents)) {
          const normalizedDocs = lang.documents.map((doc: any, docIndex: number) => {
            if (typeof doc === 'string') {
              return {
                id: `doc-${index}-${docIndex}-${Date.now()}`,
                name: doc.split('/').pop() || 'Document',
                url: doc,
              };
            }
            return {
              id: doc.id || `doc-${index}-${docIndex}-${Date.now()}`,
              name: doc.name || 'Document',
              url: doc.url,
              file: doc.file,
              size: doc.size,
            };
          });
          setLanguageDocuments(prev => ({ ...prev, [index]: normalizedDocs }));
        }
        return {
          ...lang,
          documents: lang.documents || [],
        };
      });
      setLanguages(normalizedLanguages);
    } else {
      setLanguages([]);
      setLanguageDocuments({});
    }
  }, [initialData, isOpen]);

  const handleFileSelect = (languageIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
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

      const newDoc: LanguageDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
      };
      setLanguageDocuments(prev => ({
        ...prev,
        [languageIndex]: [...(prev[languageIndex] || []), newDoc],
      }));
    });
  };

  const handleRemoveFile = (languageIndex: number, docId: string) => {
    setLanguageDocuments(prev => ({
      ...prev,
      [languageIndex]: (prev[languageIndex] || []).filter(doc => doc.id !== docId),
    }));
  };

  const handleDragEnter = (languageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [languageIndex]: true }));
  };

  const handleDragLeave = (languageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [languageIndex]: false }));
  };

  const handleDragOver = (languageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (languageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [languageIndex]: false }));

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

      const newDoc: LanguageDocument = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
      };
      setLanguageDocuments(prev => ({
        ...prev,
        [languageIndex]: [...(prev[languageIndex] || []), newDoc],
      }));
    });
  };

  const handleAddLanguage = () => {
    if (newLanguage && newProficiency) {
      const language: Language = {
        name: newLanguage,
        proficiency: newProficiency,
        speak: newSpeak,
        read: newRead,
        write: newWrite,
        documents: [],
      };
      setLanguages([...languages, language]);
      // Reset form
      setNewLanguage('');
      setNewProficiency('');
      setNewSpeak(false);
      setNewRead(false);
      setNewWrite(false);
    }
  };

  const handleRemoveLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index));
  };

  const handleUpdateLanguage = (index: number, field: keyof Language, value: any) => {
    const updatedLanguages = [...languages];
    updatedLanguages[index] = { ...updatedLanguages[index], [field]: value };
    setLanguages(updatedLanguages);
  };

  const handleSave = () => {
    // Merge documents into languages
    const languagesWithDocuments = languages.map((lang, index) => ({
      ...lang,
      documents: languageDocuments[index] || lang.documents || [],
    }));
    
    onSave({
      languages: languagesWithDocuments,
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
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Add Language</h2>
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
              {/* Languages Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Language Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Proficiency</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Speak</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Read</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Write</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Existing Languages */}
                    {languages.map((language, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <select
                            value={language.name}
                            onChange={(e) => handleUpdateLanguage(index, 'name', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                            style={{ color: '#000000' }}
                          >
                            {LANGUAGE_OPTIONS.map((lang) => (
                              <option key={lang} value={lang} style={{ color: '#000000' }}>{lang}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={language.proficiency}
                            onChange={(e) => handleUpdateLanguage(index, 'proficiency', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                            style={{ color: '#000000' }}
                          >
                            {PROFICIENCY_LEVELS.map((level) => (
                              <option key={level} value={level} style={{ color: '#000000' }}>{level}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={language.speak}
                            onChange={(e) => handleUpdateLanguage(index, 'speak', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={language.read}
                            onChange={(e) => handleUpdateLanguage(index, 'read', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={language.write}
                            onChange={(e) => handleUpdateLanguage(index, 'write', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleRemoveLanguage(index)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete language"
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
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Add New Language Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <select
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                          style={{ color: '#000000' }}
                        >
                          <option value="" style={{ color: '#000000' }}>Select Language</option>
                          {LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={newProficiency}
                          onChange={(e) => setNewProficiency(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                          style={{ color: '#000000' }}
                        >
                          <option value="" style={{ color: '#000000' }}>Select proficiency level</option>
                          {PROFICIENCY_LEVELS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={newSpeak}
                          onChange={(e) => setNewSpeak(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={newRead}
                          onChange={(e) => setNewRead(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={newWrite}
                          onChange={(e) => setNewWrite(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={handleAddLanguage}
                          disabled={!newLanguage || !newProficiency}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                Save Language
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
