'use client';

import { useState, useEffect, KeyboardEvent } from 'react';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SkillsData) => void;
  initialData?: SkillsData;
}

export interface Skill {
  name: string;
  proficiency: 'Beginner' | 'Intermediate' | 'Advanced';
  category: 'Hard Skills' | 'Soft Skills' | 'Tools / Technologies';
}

export interface SkillsData {
  skills: Skill[];
  additionalNotes: string;
}

const AI_SUGGESTIONS = {
  'Hard Skills': ['Python', 'SQL', 'Data Analysis', 'JavaScript', 'HTML/CSS', 'Machine Learning', 'Cloud Computing', 'DevOps'],
  'Soft Skills': ['Communication', 'Problem Solving', 'Project Management', 'Leadership', 'Teamwork', 'Time Management', 'Critical Thinking'],
  'Tools / Technologies': ['Excel', 'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Jira', 'Slack']
};

export default function SkillsModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SkillsModalProps) {
  const [skills, setSkills] = useState<Skill[]>(initialData?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [activeTab, setActiveTab] = useState<'Hard Skills' | 'Soft Skills' | 'Tools / Technologies'>('Hard Skills');
  const [additionalNotes, setAdditionalNotes] = useState(initialData?.additionalNotes || '');

  // Update values when initialData changes
  useEffect(() => {
    if (initialData) {
      setSkills(initialData.skills || []);
      setAdditionalNotes(initialData.additionalNotes || '');
    } else {
      setSkills([]);
      setAdditionalNotes('');
    }
  }, [initialData, isOpen]);

  const handleAddSkill = (skillName: string, category?: 'Hard Skills' | 'Soft Skills' | 'Tools / Technologies') => {
    if (skillName.trim() && skills.length < 30) {
      const newSkill: Skill = {
        name: skillName.trim(),
        proficiency: 'Intermediate',
        category: category || activeTab,
      };
      setSkills([...skills, newSkill]);
      setSkillInput('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleProficiencyChange = (index: number, proficiency: 'Beginner' | 'Intermediate' | 'Advanced') => {
    const updatedSkills = [...skills];
    updatedSkills[index].proficiency = proficiency;
    setSkills(updatedSkills);
  };

  const handleSave = () => {
    onSave({
      skills,
      additionalNotes,
    });
    onClose();
  };

  const filteredSuggestions = AI_SUGGESTIONS[activeTab].filter(
    suggestion => !skills.some(skill => skill.name.toLowerCase() === suggestion.toLowerCase())
  );

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
            <h2 className="text-xl font-semibold text-gray-900">Edit Skills</h2>
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
              {/* Add Skills Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Skills
                </label>
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a skill and press Enter..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Allow up to ~30 skills</p>

                {/* Display Added Skills */}
                {skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skills.map((skill, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                        <select
                          value={skill.proficiency}
                          onChange={(e) => handleProficiencyChange(index, e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')}
                          className="text-xs border border-gray-300 rounded px-2 py-0.5 bg-white text-gray-700 focus:ring-1 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                        <button
                          onClick={() => handleRemoveSkill(index)}
                          className="text-[#9095A1] hover:text-gray-600 ml-1"
                        >
                          <svg
                            width="16"
                            height="16"
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
              </div>

              {/* Skill Categories Tabs */}
              <div>
                <div className="flex border-b border-gray-200">
                  {(['Hard Skills', 'Soft Skills', 'Tools / Technologies'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Suggestions Area */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg min-h-[100px]">
                  <p className="text-sm text-gray-500">
                    Suggestions for {activeTab} will appear here when typing.
                  </p>
                </div>
              </div>

              {/* AI Suggestions Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Suggestions for You</h3>
                <div className="flex flex-wrap gap-2">
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddSkill(suggestion, activeTab)}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      {suggestion} <span className="text-blue-600 font-medium">+ Add</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any relevant skill information, training, or certifications..."
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
                Save Skills
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
