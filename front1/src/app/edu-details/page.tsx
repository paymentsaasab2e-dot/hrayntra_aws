"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Education {
  id: number;
  degree: string;
  institution: string;
  specialization: string;
  startYear: string;
  endYear: string;
}

export default function EduDetailsPage() {
  const router = useRouter();
  const [educations, setEducations] = useState<Education[]>([
    {
      id: 1,
      degree: "",
      institution: "",
      specialization: "",
      startYear: "",
      endYear: "",
    },
  ]);

  const [degreeFocused, setDegreeFocused] = useState<{ [key: number]: boolean }>({});
  const [degreeValue, setDegreeValue] = useState<{ [key: number]: string }>({});
  const [institutionFocused, setInstitutionFocused] = useState<{ [key: number]: boolean }>({});
  const [institutionValue, setInstitutionValue] = useState<{ [key: number]: string }>({});
  const [specializationFocused, setSpecializationFocused] = useState<{ [key: number]: boolean }>({});
  const [specializationValue, setSpecializationValue] = useState<{ [key: number]: string }>({});
  const [startYearFocused, setStartYearFocused] = useState<{ [key: number]: boolean }>({});
  const [startYearValue, setStartYearValue] = useState<{ [key: number]: string }>({});
  const [endYearFocused, setEndYearFocused] = useState<{ [key: number]: boolean }>({});
  const [endYearValue, setEndYearValue] = useState<{ [key: number]: string }>({});

  const startYearInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const endYearInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Dummy data for dropdowns
  const degrees = [
    "Bachelor of Engineering",
    "Bachelor of Science",
    "Bachelor of Arts",
    "Bachelor of Commerce",
    "Master of Engineering",
    "Master of Science",
    "Master of Business Administration",
    "Doctor of Philosophy",
  ];

  const institutions = [
    "University of Mumbai",
    "Indian Institute of Technology",
    "Delhi University",
    "Bangalore University",
    "Anna University",
    "Jawaharlal Nehru University",
    "University of Delhi",
    "Calcutta University",
  ];

  const specializations = [
    "Computer Science",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Electronics Engineering",
    "Information Technology",
    "Business Administration",
    "Data Science",
  ];

  const steps = [
    { number: 1, label: "Personal Details", active: false },
    { number: 2, label: "Educational Details", active: true },
    { number: 3, label: "Work Experience", active: false },
    { number: 4, label: "Manage Your Skills", active: false },
    { number: 5, label: "Career Preferences", active: false },
    { number: 6, label: "Salary Expectation", active: false },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  const activeStepNumber = steps.find((s) => s.active)?.number || 2;

  const addEducation = () => {
    const newId = Math.max(...educations.map((e) => e.id), 0) + 1;
    setEducations((prev) => [
      ...prev,
      {
        id: newId,
        degree: "",
        institution: "",
        specialization: "",
        startYear: "",
        endYear: "",
      },
    ]);
  };

  const deleteEducation = (id: number) => {
    if (educations.length > 1) {
      setEducations((prev) => prev.filter((edu) => edu.id !== id));
      // Clean up state values
      setDegreeValue((prev) => {
        const newVal = { ...prev };
        delete newVal[id];
        return newVal;
      });
      setInstitutionValue((prev) => {
        const newVal = { ...prev };
        delete newVal[id];
        return newVal;
      });
      setSpecializationValue((prev) => {
        const newVal = { ...prev };
        delete newVal[id];
        return newVal;
      });
      setStartYearValue((prev) => {
        const newVal = { ...prev };
        delete newVal[id];
        return newVal;
      });
      setEndYearValue((prev) => {
        const newVal = { ...prev };
        delete newVal[id];
        return newVal;
      });
    }
  };

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
            <Image
              src="/SAASA%20Logo.png"
              alt="SAASA B2E"
              width={110}
              height={32}
              className="h-8 w-auto"
            />
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
                  onClick={isCompleted && step.number === 1 ? () => router.push("/personal-details") : undefined}
                >
                  {step.number}
                </div>
              <p
                className={`mt-2 text-xs ${
                  step.active || isCompleted ? "font-semibold text-slate-900" : "text-slate-500"
                } ${isCompleted && step.number === 1 ? "cursor-pointer hover:text-sky-600" : ""}`}
                style={{ maxWidth: "120px", textAlign: "center", lineHeight: "1.3" }}
                onClick={isCompleted && step.number === 1 ? () => router.push("/personal-details") : undefined}
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
              onClick={() => router.push("/personal-details")}
              className="text-slate-600 hover:text-slate-900 transition"
              style={{ marginLeft: "-40px" }}
              aria-label="Go back to Personal Details"
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
              Educational Details
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
            }}
          >
            Review and update your educational information. Some fields
            <br />
            might be pre-filled from your CV.
          </p>
        </div>

        {/* Form */}
        <form
          className="mx-auto flex max-w-2xl flex-col items-center"
          style={{ gap: "21px" }}
        >
          {/* Education Entries */}
          {educations.map((edu, index) => (
            <div key={edu.id} className="w-full" style={{ width: "538.07px" }}>
              {/* Education Header */}
              <div className="flex w-full items-center justify-between mb-4">
                <h2
                  className="font-semibold text-slate-900"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "18px",
                    lineHeight: "1.5",
                  }}
                >
                  Education {index + 1}
                </h2>
                <button
                  type="button"
                  onClick={() => deleteEducation(edu.id)}
                  className="text-red-500 hover:text-red-700"
                  disabled={educations.length === 1}
                  aria-label="Delete education"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
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
              </div>

              {/* Degree */}
              <div className="relative" style={{ marginBottom: "21px" }}>
                <div className="relative">
                  <select
                    value={degreeValue[edu.id] || edu.degree}
                    onChange={(event) => {
                      setDegreeValue({ ...degreeValue, [edu.id]: event.target.value });
                      setEducations((prev) =>
                        prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, degree: event.target.value } : eduItem))
                      );
                    }}
                    onFocus={() => setDegreeFocused({ ...degreeFocused, [edu.id]: true })}
                    onBlur={() => setDegreeFocused({ ...degreeFocused, [edu.id]: false })}
                    className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                      degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree) ? "pt-5" : "pt-3"
                    }`}
                    style={{
                      width: "538.07px",
                      height: "48.19px",
                      borderRadius: "5.02px",
                      border: "1px solid #99A1AF",
                      backgroundColor: "#FFFFFF",
                      appearance: "none",
                    }}
                  >
                    <option value="" disabled hidden></option>
                    {degrees.map((degree) => (
                      <option key={degree} value={degree}>
                        {degree}
                      </option>
                    ))}
                  </select>
                  <label
                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                      degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree)
                        ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                        : "left-4 top-1/2 -translate-y-1/2 text-sm"
                    }`}
                    style={
                      degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree)
                        ? {
                            color: "#239CD2",
                          }
                        : undefined
                    }
                  >
                    Degree
                  </label>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="#99A1AF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Institution */}
              <div className="relative" style={{ marginBottom: "21px" }}>
                <div className="relative">
                  <select
                    value={institutionValue[edu.id] || edu.institution}
                    onChange={(event) => {
                      setInstitutionValue({ ...institutionValue, [edu.id]: event.target.value });
                      setEducations((prev) =>
                        prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, institution: event.target.value } : eduItem))
                      );
                    }}
                    onFocus={() => setInstitutionFocused({ ...institutionFocused, [edu.id]: true })}
                    onBlur={() => setInstitutionFocused({ ...institutionFocused, [edu.id]: false })}
                    className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                      institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution) ? "pt-5" : "pt-3"
                    }`}
                    style={{
                      width: "538.07px",
                      height: "48.19px",
                      borderRadius: "5.02px",
                      border: "1px solid #99A1AF",
                      backgroundColor: "#FFFFFF",
                      appearance: "none",
                    }}
                  >
                    <option value="" disabled hidden></option>
                    {institutions.map((institution) => (
                      <option key={institution} value={institution}>
                        {institution}
                      </option>
                    ))}
                  </select>
                  <label
                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                      institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution)
                        ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                        : "left-4 top-1/2 -translate-y-1/2 text-sm"
                    }`}
                    style={
                      institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution)
                        ? {
                            color: "#239CD2",
                          }
                        : undefined
                    }
                  >
                    Institution
                  </label>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="#99A1AF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Specialization */}
              <div className="relative" style={{ marginBottom: "21px" }}>
                <div className="relative">
                  <select
                    value={specializationValue[edu.id] || edu.specialization}
                    onChange={(event) => {
                      setSpecializationValue({ ...specializationValue, [edu.id]: event.target.value });
                      setEducations((prev) =>
                        prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, specialization: event.target.value } : eduItem))
                      );
                    }}
                    onFocus={() => setSpecializationFocused({ ...specializationFocused, [edu.id]: true })}
                    onBlur={() => setSpecializationFocused({ ...specializationFocused, [edu.id]: false })}
                    className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                      specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization) ? "pt-5" : "pt-3"
                    }`}
                    style={{
                      width: "538.07px",
                      height: "48.19px",
                      borderRadius: "5.02px",
                      border: "1px solid #99A1AF",
                      backgroundColor: "#FFFFFF",
                      appearance: "none",
                    }}
                  >
                    <option value="" disabled hidden></option>
                    {specializations.map((specialization) => (
                      <option key={specialization} value={specialization}>
                        {specialization}
                      </option>
                    ))}
                  </select>
                  <label
                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                      specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization)
                        ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                        : "left-4 top-1/2 -translate-y-1/2 text-sm"
                    }`}
                    style={
                      specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization)
                        ? {
                            color: "#239CD2",
                          }
                        : undefined
                    }
                  >
                    Specialization
                  </label>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="#99A1AF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Start Year and End Year Row */}
              <div className="flex items-center" style={{ gap: "23px", marginBottom: "21px" }}>
                <div className="relative" style={{ flex: 1 }}>
                  <div className="relative">
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
                      onClick={() => startYearInputRefs.current[edu.id]?.showPicker()}
                    >
                      <Image
                        src="/calendar_icon.png"
                        alt="Calendar"
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                    </div>
                    <input
                      ref={(el) => {
                        startYearInputRefs.current[edu.id] = el;
                      }}
                      type="date"
                      value={startYearValue[edu.id] || edu.startYear}
                      onChange={(event) => {
                        setStartYearValue({ ...startYearValue, [edu.id]: event.target.value });
                        setEducations((prev) =>
                          prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, startYear: event.target.value } : eduItem))
                        );
                      }}
                      onFocus={() => setStartYearFocused({ ...startYearFocused, [edu.id]: true })}
                      onBlur={() => setStartYearFocused({ ...startYearFocused, [edu.id]: false })}
                      onClick={() => startYearInputRefs.current[edu.id]?.showPicker()}
                      className={`px-4 pb-2 pl-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                        startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear) ? "pt-5" : "pt-3"
                      }`}
                      style={{
                        width: "100%",
                        height: "48.19px",
                        borderRadius: "5.02px",
                        border: "1px solid #99A1AF",
                        backgroundColor: "#FFFFFF",
                        color: startYearValue[edu.id] || edu.startYear ? "#1e293b" : "transparent",
                      }}
                    />
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                        startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear)
                          ? "left-10 -top-2.5 text-xs font-medium bg-white px-1"
                          : "left-10 top-1/2 -translate-y-1/2 text-sm"
                      }`}
                      style={
                        startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear)
                          ? {
                              color: "#239CD2",
                            }
                          : undefined
                      }
                    >
                      Start Year
                    </label>
                  </div>
                </div>
                <div className="relative" style={{ flex: 1 }}>
                  <div className="relative">
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
                      onClick={() => endYearInputRefs.current[edu.id]?.showPicker()}
                    >
                      <Image
                        src="/calendar_icon.png"
                        alt="Calendar"
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                    </div>
                    <input
                      ref={(el) => {
                        endYearInputRefs.current[edu.id] = el;
                      }}
                      type="date"
                      value={endYearValue[edu.id] || edu.endYear}
                      onChange={(event) => {
                        setEndYearValue({ ...endYearValue, [edu.id]: event.target.value });
                        setEducations((prev) =>
                          prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, endYear: event.target.value } : eduItem))
                        );
                      }}
                      onFocus={() => setEndYearFocused({ ...endYearFocused, [edu.id]: true })}
                      onBlur={() => setEndYearFocused({ ...endYearFocused, [edu.id]: false })}
                      onClick={() => endYearInputRefs.current[edu.id]?.showPicker()}
                      className={`px-4 pb-2 pl-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                        endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear) ? "pt-5" : "pt-3"
                      }`}
                      style={{
                        width: "100%",
                        height: "48.19px",
                        borderRadius: "5.02px",
                        border: "1px solid #99A1AF",
                        backgroundColor: "#FFFFFF",
                        color: endYearValue[edu.id] || edu.endYear ? "#1e293b" : "transparent",
                      }}
                    />
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                        endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear)
                          ? "left-10 -top-2.5 text-xs font-medium bg-white px-1"
                          : "left-10 top-1/2 -translate-y-1/2 text-sm"
                      }`}
                      style={
                        endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear)
                          ? {
                              color: "#239CD2",
                            }
                          : undefined
                      }
                    >
                      End Year
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Buttons Row */}
          <div className="flex items-center gap-3" style={{ width: "538.07px" }}>
            {/* Add More Button */}
            <button
              type="button"
              onClick={addEducation}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-sky-500 bg-white px-4 py-3 font-medium text-sky-600 transition hover:bg-sky-50"
              style={{
                width: "38%",
                height: "48.19px",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
              }}
            >
              <Image
                src="/plus-icopn.png"
                alt="Add"
                width={20}
                height={20}
                className="h-5 w-5"
              />
              Add More
            </button>

            {/* Save & Continue Button */}
            <button
              type="button"
              onClick={() => router.push("/skills")}
              className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 font-semibold text-white transition hover:bg-sky-700"
              style={{
                width: "60%",
                height: "48.19px",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
              }}
            >
              Save & Continue
              <span>→</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
