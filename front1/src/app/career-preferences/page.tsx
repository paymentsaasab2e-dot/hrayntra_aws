"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CareerPreferencesPage() {
  const router = useRouter();

  const steps = [
    { number: 1, label: "Personal Details", active: false },
    { number: 2, label: "Educational Details", active: false },
    { number: 3, label: "Manage Your Skills", active: false },
    { number: 4, label: "Work Experience", active: false },
    { number: 5, label: "Salary Expectation", active: false },
    { number: 6, label: "Career Preferences", active: true },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  const activeStepNumber = steps.find((s) => s.active)?.number || 5;

  const [preferredLocation, setPreferredLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [languages, setLanguages] = useState("");

  const [selectedLocations, setSelectedLocations] = useState<string[]>(["New York", "London"]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(["Full-time"]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["IT"]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["Software Developer"]);
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>(["On-site"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English"]);
  const [languageProficiencies, setLanguageProficiencies] = useState<{ [key: string]: string }>({
    English: "Fluent",
  });

  const chips = {
    locations: ["New York", "London", "Berlin", "Dubai", "Singapore"],
    jobTypes: ["Full-time", "Part-time", "Contract", "Temporary", "Internship"],
    departments: ["Accounts", "Human Resource", "Sales", "Marketing", "IT", "Operations"],
    roles: ["Software Developer", "Tech Lead", "UX Designer", "Accountant"],
    workModes: ["Remote", "On-site", "Hybrid"],
    languages: ["English", "Spanish", "French"],
  };

  const toggleSelection = (field: string, value: string) => {
    switch (field) {
      case "locations":
        setSelectedLocations((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
        break;
      case "jobTypes":
        setSelectedJobTypes((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
        break;
      case "departments":
        setSelectedDepartments((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
        break;
      case "roles":
        setSelectedRoles((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
        break;
      case "workModes":
        setSelectedWorkModes((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
        break;
      case "languages":
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
        break;
    }
  };

  const removeSelection = (field: string, value: string) => {
    switch (field) {
      case "locations":
        setSelectedLocations((prev) => prev.filter((v) => v !== value));
        break;
      case "jobTypes":
        setSelectedJobTypes((prev) => prev.filter((v) => v !== value));
        break;
      case "departments":
        setSelectedDepartments((prev) => prev.filter((v) => v !== value));
        break;
      case "roles":
        setSelectedRoles((prev) => prev.filter((v) => v !== value));
        break;
      case "workModes":
        setSelectedWorkModes((prev) => prev.filter((v) => v !== value));
        break;
      case "languages":
        setSelectedLanguages((prev) => prev.filter((v) => v !== value));
        setLanguageProficiencies((profs) => {
          const newProfs = { ...profs };
          delete newProfs[value];
          return newProfs;
        });
        break;
    }
  };

  const handleEnterKey = (field: string, value: string) => {
    if (value.trim()) {
      const trimmedValue = value.trim();
      switch (field) {
        case "locations":
          if (!selectedLocations.includes(trimmedValue)) {
            setSelectedLocations((prev) => [trimmedValue, ...prev]);
            setPreferredLocation("");
          }
          break;
        case "jobTypes":
          if (!selectedJobTypes.includes(trimmedValue)) {
            setSelectedJobTypes((prev) => [trimmedValue, ...prev]);
            setJobType("");
          }
          break;
        case "departments":
          if (!selectedDepartments.includes(trimmedValue)) {
            setSelectedDepartments((prev) => [trimmedValue, ...prev]);
            setDepartment("");
          }
          break;
        case "roles":
          if (!selectedRoles.includes(trimmedValue)) {
            setSelectedRoles((prev) => [trimmedValue, ...prev]);
            setRole("");
          }
          break;
        case "workModes":
          if (!selectedWorkModes.includes(trimmedValue)) {
            setSelectedWorkModes((prev) => [trimmedValue, ...prev]);
            setWorkMode("");
          }
          break;
        case "languages":
          if (!selectedLanguages.includes(trimmedValue)) {
            setSelectedLanguages((prev) => [trimmedValue, ...prev]);
            setLanguageProficiencies((profs) => ({
              ...profs,
              [trimmedValue]: "Basic",
            }));
            setLanguages("");
          }
          break;
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
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image src="/SAASA%20Logo.png" alt="SAASA B2E" width={110} height={32} className="h-8 w-auto" />
            <p className="ml-2 text-xs text-sky-600">SUSTAINABLE, WISE AND SUCCESSFUL APPS</p>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Upload CV
            </a>
            <a href="#" className="relative text-sm font-medium text-sky-600">
              Profile
              <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-600" />
            </a>
            <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Complete
            </a>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
              Help
            </a>
            <div className="h-8 w-8 rounded-full bg-slate-300" />
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div
        className="relative px-6"
        style={{ backgroundColor: "transparent", zIndex: 50, paddingTop: "2px", paddingBottom: "12px" }}
      >
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
                      : isCompleted && step.number === 4
                      ? () => router.push("/skills")
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
                      : isCompleted && step.number === 4
                      ? () => router.push("/skills")
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
              onClick={() => router.push("/skills")}
              className="text-slate-600 hover:text-slate-900 transition"
              style={{ marginLeft: "-40px" }}
              aria-label="Go back to Manage Your Skills"
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
              Career Preferences
            </h1>
            <Image src="/auto_ai.png" alt="Auto-filled by AI" width={109} height={25} className="h-auto w-auto" />
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
            }}
          >
            Select your preferred job characteristics to tailor recommendations.
          </p>
        </div>

        {/* Form */}
        <div className="mx-auto flex max-w-2xl flex-col items-center" style={{ gap: "21px" }}>
          <div className="w-full" style={{ width: "538.07px" }}>
            <FieldBlock
              label="Preferred Location"
              placeholder="Enter your preferred location"
              value={preferredLocation}
              onChange={setPreferredLocation}
              onEnterKey={(val) => handleEnterKey("locations", val)}
              chips={chips.locations}
              selectedChips={selectedLocations}
              onToggle={(value) => toggleSelection("locations", value)}
              onRemove={(value) => removeSelection("locations", value)}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          <div className="w-full" style={{ width: "538.07px" }}>
            <FieldBlock
              label="Job Type"
              placeholder="Enter your preferred job type"
              value={jobType}
              onChange={setJobType}
              onEnterKey={(val) => handleEnterKey("jobTypes", val)}
              chips={chips.jobTypes}
              selectedChips={selectedJobTypes}
              onToggle={(value) => toggleSelection("jobTypes", value)}
              onRemove={(value) => removeSelection("jobTypes", value)}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          <div className="w-full" style={{ width: "538.07px" }}>
            <FieldBlock
              label="Department"
              placeholder="Enter your preferred department"
              value={department}
              onChange={setDepartment}
              onEnterKey={(val) => handleEnterKey("departments", val)}
              chips={chips.departments}
              selectedChips={selectedDepartments}
              onToggle={(value) => toggleSelection("departments", value)}
              onRemove={(value) => removeSelection("departments", value)}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          <div className="w-full" style={{ width: "538.07px" }}>
            <FieldBlock
              label="Role"
              placeholder="Enter your preferred job role"
              value={role}
              onChange={setRole}
              onEnterKey={(val) => handleEnterKey("roles", val)}
              chips={chips.roles}
              selectedChips={selectedRoles}
              onToggle={(value) => toggleSelection("roles", value)}
              onRemove={(value) => removeSelection("roles", value)}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          <div className="w-full" style={{ width: "538.07px" }}>
            <FieldBlock
              label="Work Mode"
              placeholder="Enter your preferred work mode"
              value={workMode}
              onChange={setWorkMode}
              onEnterKey={(val) => handleEnterKey("workModes", val)}
              chips={chips.workModes}
              selectedChips={selectedWorkModes}
              onToggle={(value) => toggleSelection("workModes", value)}
              onRemove={(value) => removeSelection("workModes", value)}
              fieldStyle={fieldStyle}
              labelFloating={labelFloating}
              labelColor={labelColor}
            />
          </div>

          <div className="w-full" style={{ width: "538.07px" }}>
            <LanguageFieldBlock
              label="Languages Known"
              placeholder="Enter the names of the languages you know"
              value={languages}
              onChange={setLanguages}
              onEnterKey={(val) => handleEnterKey("languages", val)}
              chips={chips.languages}
              selectedChips={selectedLanguages}
              onToggle={(value) => toggleSelection("languages", value)}
              onRemove={(value) => removeSelection("languages", value)}
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

          <div className="w-full" style={{ width: "538.07px", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => router.push("/salary-expectation")}
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

interface FieldBlockProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onEnterKey: (val: string) => void;
  chips: string[];
  selectedChips: string[];
  onToggle: (value: string) => void;
  onRemove: (value: string) => void;
  fieldStyle: Record<string, string>;
  labelFloating: (focused: boolean, hasValue: boolean) => string;
  labelColor: (focused: boolean, hasValue: boolean) => Record<string, string> | undefined;
}

function FieldBlock({
  label,
  placeholder,
  value,
  onChange,
  onEnterKey,
  chips,
  selectedChips,
  onToggle,
  onRemove,
  fieldStyle,
  labelFloating,
  labelColor,
}: FieldBlockProps) {
  const [focused, setFocused] = useState(false);

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
      <div className="flex flex-wrap gap-2">
        {/* Show selected chips first with remove button */}
        {selectedChips.map((chip) => (
          <div
            key={chip}
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
              className="text-slate-600 hover:text-slate-800"
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
        ))}
        {/* Show unselected chips as clickable buttons */}
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
  );
}

interface LanguageFieldBlockProps extends FieldBlockProps {
  proficiencies: { [key: string]: string };
  onProficiencyChange: (language: string, proficiency: string) => void;
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

