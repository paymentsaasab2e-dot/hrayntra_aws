"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/common/Header";

export default function SkillsPage() {
  const router = useRouter();
  const [userSkills, setUserSkills] = useState<string[]>([
    "Project Management",
    "Agile Methodologies",
    "Data Analysis",
    "Strategic Planning",
    "Leadership",
  ]);
  const [skillInput, setSkillInput] = useState("");
  const [skillInputFocused, setSkillInputFocused] = useState(false);
  
  // Language states (from career-preferences)
  const [languages, setLanguages] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English"]);
  const [languageProficiencies, setLanguageProficiencies] = useState<{ [key: string]: string }>({
    English: "Fluent",
  });

  const aiSuggestedSkills = [
    "Machine Learning",
    "Cloud Computing",
    "UI/UX Design",
    "Cybersecurity",
    "DevOps",
    "Blockchain",
  ];

  const languageChips = ["English", "Spanish", "Chinese", "Hindi", "Arabic", "French", "Portuguese"];

  const steps = [
    { number: 1, label: "Personal Details", active: false },
    { number: 2, label: "Educational Details", active: false },
    { number: 3, label: "Manage Your Skills", active: true },
    { number: 4, label: "Work Experience", active: false },
    { number: 5, label: "Salary Expectation", active: false },
    { number: 6, label: "Career Preferences", active: false },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  const activeStepNumber = steps.find((s) => s.active)?.number || 4;

  const addSkill = () => {
    if (skillInput.trim() && !userSkills.includes(skillInput.trim())) {
      setUserSkills([...userSkills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setUserSkills(userSkills.filter((s) => s !== skill));
  };

  const addAISuggestedSkill = (skill: string) => {
    if (!userSkills.includes(skill)) {
      setUserSkills([...userSkills, skill]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  // Language functions (from career-preferences)
  const toggleLanguage = (value: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(value)) {
        // Remove proficiency when deselecting
        setLanguageProficiencies((profs) => {
          const newProfs = { ...profs };
          delete newProfs[value];
          return newProfs;
        });
        return prev.filter((v) => v !== value);
      } else {
        // Set default proficiency when selecting
        setLanguageProficiencies((profs) => ({
          ...profs,
          [value]: "Basic",
        }));
        return [...prev, value];
      }
    });
  };

  const removeLanguage = (value: string) => {
    setSelectedLanguages((prev) => prev.filter((v) => v !== value));
    setLanguageProficiencies((profs) => {
      const newProfs = { ...profs };
      delete newProfs[value];
      return newProfs;
    });
  };

  const handleLanguageEnterKey = (value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      if (!selectedLanguages.includes(trimmedValue)) {
        setSelectedLanguages((prev) => [trimmedValue, ...prev]);
        setLanguageProficiencies((profs) => ({
          ...profs,
          [trimmedValue]: "Basic",
        }));
        setLanguages("");
      }
    }
  };

  const fieldStyle = {
    height: "48.19px",
    borderRadius: "5.02px",
    border: "1px solid #99A1AF",
    backgroundColor: "#FFFFFF",
  };

  const labelFloating = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
      : "left-4 top-1/2 -translate-y-1/2 text-sm";

  const labelColor = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? {
          color: "#239CD2",
        }
      : undefined;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 800px 600px at bottom left, #bae6fd 0%, #dbeafe 30%, transparent 70%), radial-gradient(ellipse 800px 600px at 80% 60%, #fed7aa 0%, #fde2e4 30%, transparent 70%), white",
      }}
    >
      {/* Header */}
      <Header />

      {/* Progress Steps */}
      <div className="relative px-6" style={{ backgroundColor: "transparent", zIndex: 50, paddingTop: "2px", paddingBottom: "12px" }}>
        <div className="relative mx-auto flex max-w-7xl items-start justify-between">
          {steps.map((step) => {
            const isCompleted = step.number < activeStepNumber;
            return (
              <div key={step.number} className="relative z-10 flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`relative flex items-center justify-center rounded-full border-2 text-sm font-semibold ${
                    step.active
                      ? "text-white border-transparent"
                      : isCompleted
                      ? "text-white border-transparent cursor-pointer"
                      : "h-12 w-12 border-slate-300 bg-white text-slate-400"
                  }`}
                  style={
                    step.active
                      ? {
                          height: "80px",
                          width: "80px",
                          backgroundImage: "url('/ornage_stage.png')",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }
                      : isCompleted
                      ? {
                          height: "80px",
                          width: "80px",
                          backgroundImage: "url('/blue_2.png')",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }
                      : {
                          marginTop: "16px",
                        }
                  }
                  onClick={
                    isCompleted && step.number === 1
                      ? () => router.push("/personal-details")
                      : isCompleted && step.number === 2
                      ? () => router.push("/edu-details")
                      : isCompleted && step.number === 3
                      ? () => router.push("/work-exp")
                      : undefined
                  }
                >
                  {step.number}
                </div>
                <p
                  className={`mt-2 text-xs ${
                    step.active || isCompleted ? "font-semibold text-slate-900" : "text-slate-500"
                  } ${isCompleted ? "cursor-pointer hover:text-sky-600" : ""}`}
                  style={{ maxWidth: "120px", textAlign: "center", lineHeight: "1.3" }}
                  onClick={
                    isCompleted && step.number === 1
                      ? () => router.push("/personal-details")
                      : isCompleted && step.number === 2
                      ? () => router.push("/edu-details")
                      : isCompleted && step.number === 3
                      ? () => router.push("/work-exp")
                      : undefined
                  }
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6" style={{ paddingTop: "0px", paddingBottom: "32px" }}>
        {/* Title Section */}
        <div className="mb-3 text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/work-exp")}
              className="text-slate-600 hover:text-slate-900 transition"
              style={{ marginLeft: "-40px" }}
              aria-label="Go back to Work Experience"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1
              className="font-medium text-slate-900"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "32.12px",
                lineHeight: "40.2px",
                letterSpacing: "0%",
              }}
            >
              Manage Your Skills
            </h1>
            <Image
              src="/auto_ai.png"
              alt="Auto-filled by AI"
              width={109}
              height={25}
              className="h-auto w-auto"
            />
          </div>
          <p
            className="text-center"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: "normal",
              fontSize: "15px",
              lineHeight: "27.9px",
              letterSpacing: "0px",
              color: "#4B5563",
              marginTop: "8px",
              marginBottom: "16px",
            }}
          >
            Add, review, and organize your professional skills.
          </p>
        </div>

        {/* Form */}
        <div className="mx-auto flex max-w-2xl flex-col items-center" style={{ gap: "21px" }}>
          {/* Your Skills Section */}
          <div className="w-full" style={{ width: "538.07px" }}>
            {/* Input Field and Add Button */}
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onFocus={() => setSkillInputFocused(true)}
                  onBlur={() => setSkillInputFocused(false)}
                  onKeyPress={handleKeyPress}
                  className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                    skillInputFocused || skillInput.length > 0 ? "pt-5" : "pt-3"
                  }`}
                  style={{
                    height: "48.19px",
                    borderRadius: "5.02px",
                    border: "1px solid #99A1AF",
                    backgroundColor: "#FFFFFF",
                  }}
                />
                <label
                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                    skillInputFocused || skillInput.length > 0
                      ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                      : "left-4 top-1/2 -translate-y-1/2 text-sm"
                  }`}
                  style={
                    skillInputFocused || skillInput.length > 0
                      ? {
                          color: "#239CD2",
                        }
                      : undefined
                  }
                >
                  Your skills
                </label>
              </div>
              <button
                type="button"
                onClick={addSkill}
                className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700 shadow-sm"
                style={{
                  height: "48.19px",
                  borderRadius: "5.02px",
                  minWidth: "82px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "16px",
                }}
              >
                Add
              </button>
            </div>

            {/* Skills List */}
            <div className="flex flex-wrap gap-2">
              {userSkills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 font-medium"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "14px",
                    borderColor: "#E5E7EB",
                    color: "#374151",
                  }}
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-slate-600 hover:text-slate-800"
                    aria-label={`Remove ${skill}`}
                    style={{
                      color: "#374151",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* AI Suggested Skills Section */}
          <div className="w-full" style={{ width: "538.07px", marginTop: "32px" }}>
            <h2
              className="mb-3 font-semibold text-slate-900"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "18px",
                lineHeight: "1.5",
              }}
            >
              AI Suggested Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {aiSuggestedSkills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "14px",
                  }}
                >
                  <span>{skill}</span>
                  <span
                    className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-600"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                    }}
                  >
                    AI Suggested
                  </span>
                  <button
                    type="button"
                    onClick={() => addAISuggestedSkill(skill)}
                    className="text-sky-600 hover:text-sky-800"
                    aria-label={`Add ${skill}`}
                    disabled={userSkills.includes(skill)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Languages Known Section */}
          <div className="w-full" style={{ width: "538.07px" }}>
            <LanguageFieldBlock
              label="Languages Known"
              placeholder="Enter the names of the languages you know"
              value={languages}
              onChange={setLanguages}
              onEnterKey={handleLanguageEnterKey}
              chips={languageChips}
              selectedChips={selectedLanguages}
              onToggle={toggleLanguage}
              onRemove={removeLanguage}
              proficiencies={languageProficiencies}
              onProficiencyChange={(language, proficiency) => {
                setLanguageProficiencies((profs) => ({
                  ...profs,
                  [language]: proficiency,
                }));
              }}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          {/* Save & Continue Button */}
          <div className="w-full" style={{ width: "538.07px", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => router.push("/work-exp")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 font-semibold text-white transition hover:bg-sky-700"
              style={{
                height: "48.19px",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
              }}
            >
              Save & Continue
              <span>→</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 md:flex-row">
          <p>© 2025 SAASA B2E. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-700">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-700">
              Terms of Service
            </a>
            <a href="#" className="hover:text-slate-700">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// LanguageFieldBlock component (from career-preferences)
interface LanguageFieldBlockProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onEnterKey: (val: string) => void;
  chips: string[];
  selectedChips: string[];
  onToggle: (value: string) => void;
  onRemove: (value: string) => void;
  proficiencies: { [key: string]: string };
  onProficiencyChange: (language: string, proficiency: string) => void;
  fieldStyle: Record<string, string>;
  labelFloating: (focused: boolean, hasValue: boolean) => string;
  labelColor: (focused: boolean, hasValue: boolean) => Record<string, string> | undefined;
}

function LanguageFieldBlock({
  label,
  placeholder,
  value,
  onChange,
  onEnterKey,
  chips,
  selectedChips,
  onToggle,
  onRemove,
  proficiencies,
  onProficiencyChange,
  fieldStyle,
  labelFloating,
  labelColor,
}: LanguageFieldBlockProps) {
  const [focused, setFocused] = useState(false);
  const proficiencyLevels = ["Basic", "Conversational", "Professional", "Fluent"];

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnterKey(value);
    }
  };

  return (
    <div className="w-full">
      <div className="relative mb-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
            focused || value ? "pt-5" : "pt-3"
          }`}
          style={fieldStyle}
          placeholder=""
        />
        <label
          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(focused, !!value)}`}
          style={labelColor(focused, !!value)}
        >
          {label}
        </label>
      </div>
      <div className="flex flex-col gap-3">
        {/* Show selected languages with proficiency selector */}
        {selectedChips.map((chip) => (
          <div key={chip} className="flex flex-col gap-2.5 rounded-lg border bg-white p-3" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 font-medium"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  borderColor: "#239CD2",
                  color: "#374151",
                }}
              >
                <span>{chip}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(chip);
                  }}
                  className="text-slate-600 hover:text-slate-800 transition"
                  aria-label={`Remove ${chip}`}
                  style={{
                    color: "#374151",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Proficiency Level Selector */}
            <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5" style={{ backgroundColor: "#F9FAFB" }}>
              <span
                className="font-semibold whitespace-nowrap"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  color: "#374151",
                }}
              >
                Proficiency Level:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {proficiencyLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onProficiencyChange(chip, level)}
                    className="rounded-md px-3 py-1.5 transition-all duration-200 font-medium"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                      backgroundColor: proficiencies[chip] === level ? "#239CD2" : "#FFFFFF",
                      color: proficiencies[chip] === level ? "#FFFFFF" : "#6B7280",
                      border: proficiencies[chip] === level ? "1px solid #239CD2" : "1px solid #E5E7EB",
                      fontWeight: proficiencies[chip] === level ? "600" : "500",
                      boxShadow: proficiencies[chip] === level 
                        ? "0 2px 4px rgba(35, 156, 210, 0.25)" 
                        : "0 1px 2px rgba(0, 0, 0, 0.05)",
                    }}
                    onMouseEnter={(e) => {
                      if (proficiencies[chip] !== level) {
                        e.currentTarget.style.backgroundColor = "#F3F4F6";
                        e.currentTarget.style.borderColor = "#D1D5DB";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (proficiencies[chip] !== level) {
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                      }
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {/* Show unselected chips as clickable buttons */}
        <div className="flex flex-wrap gap-2">
          {chips
            .filter((chip) => !selectedChips.includes(chip))
            .map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onToggle(chip)}
                className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 font-medium transition hover:bg-slate-50"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  borderColor: "#E5E7EB",
                  color: "#374151",
                }}
              >
                <span>{chip}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}


