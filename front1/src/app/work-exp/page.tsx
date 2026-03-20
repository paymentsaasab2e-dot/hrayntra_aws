"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/common/Header";

interface WorkExperience {
  id: number;
  jobTitle: string;
  company: string;
  workLocation: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string;
  isExpanded: boolean;
}

export default function WorkExpPage() {
  const router = useRouter();
  const [experiences, setExperiences] = useState<WorkExperience[]>([
    {
      id: 1,
      jobTitle: "Senior Software Engineer",
      company: "Innovatech Solutions",
      workLocation: "New York",
      startDate: "2024-05-01",
      endDate: "",
      isCurrent: true,
      responsibilities: "Led a team of 5 engineers in developing scalable microservices using Node.js and AWS. Designed and implemented new features, reducing processing time by 20%.",
      isExpanded: true,
    },
    {
      id: 2,
      jobTitle: "Web Developer",
      company: "TechGrowth Labs",
      workLocation: "San Francisco",
      startDate: "2021-03-01",
      endDate: "2024-04-01",
      isCurrent: false,
      responsibilities: "",
      isExpanded: false,
    },
  ]);

  const [jobTitleFocused, setJobTitleFocused] = useState<{ [key: number]: boolean }>({});
  const [jobTitleValue, setJobTitleValue] = useState<{ [key: number]: string }>({});
  const [companyFocused, setCompanyFocused] = useState<{ [key: number]: boolean }>({});
  const [companyValue, setCompanyValue] = useState<{ [key: number]: string }>({});
  const [workLocationFocused, setWorkLocationFocused] = useState<{ [key: number]: boolean }>({});
  const [workLocationValue, setWorkLocationValue] = useState<{ [key: number]: string }>({});
  const [startDateFocused, setStartDateFocused] = useState<{ [key: number]: boolean }>({});
  const [startDateValue, setStartDateValue] = useState<{ [key: number]: string }>({});
  const [endDateFocused, setEndDateFocused] = useState<{ [key: number]: boolean }>({});
  const [endDateValue, setEndDateValue] = useState<{ [key: number]: string }>({});
  const [responsibilitiesFocused, setResponsibilitiesFocused] = useState<{ [key: number]: boolean }>({});
  const [responsibilitiesValue, setResponsibilitiesValue] = useState<{ [key: number]: string }>({});

  const startDateInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const endDateInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const jobTitles = [
    "Web Developer",
    "Senior Software Engineer",
    "Software Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "DevOps Engineer",
    "Product Manager",
  ];

  const companies = [
    "Wipro",
    "Innovatech Solutions",
    "TechGrowth Labs",
    "Infosys",
    "TCS",
    "Accenture",
    "Microsoft",
    "Google",
  ];

  const workLocations = [
    "New York",
    "London",
    "Berlin",
    "Dubai",
    "Singapore",
    "San Francisco",
    "Toronto",
    "Sydney",
    "Mumbai",
    "Bangalore",
    "Delhi",
    "Hyderabad",
    "Remote",
    "Hybrid",
  ];

  const steps = [
    { number: 1, label: "Personal Details", active: false },
    { number: 2, label: "Educational Details", active: false },
    { number: 3, label: "Manage Your Skills", active: false },
    { number: 4, label: "Work Experience", active: true },
    { number: 5, label: "Salary Expectation", active: false },
    { number: 6, label: "Career Preferences", active: false },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  const activeStepNumber = steps.find((s) => s.active)?.number || 3;

  const toggleExpand = (id: number) => {
    setExperiences((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, isExpanded: !exp.isExpanded } : exp))
    );
  };

  const deleteExperience = (id: number) => {
    setExperiences((prev) => prev.filter((exp) => exp.id !== id));
  };

  const addExperience = () => {
    const newId = Math.max(...experiences.map((e) => e.id), 0) + 1;
    setExperiences((prev) => [
      ...prev,
      {
        id: newId,
        jobTitle: "",
        company: "",
        workLocation: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        responsibilities: "",
        isExpanded: true,
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
                  onClick={isCompleted && step.number === 1 ? () => router.push("/personal-details") : isCompleted && step.number === 2 ? () => router.push("/edu-details") : isCompleted && step.number === 3 ? () => router.push("/skills") : undefined}
                >
                  {step.number}
                </div>
                <p
                  className={`mt-2 text-xs ${
                    step.active || isCompleted ? "font-semibold text-slate-900" : "text-slate-500"
                  } ${isCompleted ? "cursor-pointer hover:text-sky-600" : ""}`}
                  style={{ maxWidth: "120px", textAlign: "center", lineHeight: "1.3" }}
                  onClick={isCompleted && step.number === 1 ? () => router.push("/personal-details") : isCompleted && step.number === 2 ? () => router.push("/edu-details") : isCompleted && step.number === 3 ? () => router.push("/skills") : undefined}
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
              aria-label="Go back to Skills"
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
              Work Experience
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
            Add and manage your professional experience.
          </p>
        </div>

        {/* Form */}
        <form
          className="mx-auto flex max-w-2xl flex-col items-center"
          style={{ gap: "21px" }}
        >
          {/* Work Experience Entries */}
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="w-full"
              style={{ width: "538.07px" }}
            >
              {/* Entry Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3
                    className="font-semibold text-slate-900"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "16px",
                      lineHeight: "1.5",
                    }}
                  >
                    {exp.jobTitle || "Job Title"} {exp.company ? `at ${exp.company}` : ""}
                  </h3>
                  <p
                    className="mt-1 text-slate-600"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "14px",
                    }}
                  >
                    {exp.startDate ? formatDate(exp.startDate) : "Start Date"} -{" "}
                    {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "End Date"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => deleteExperience(exp.id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Delete experience"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
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
                  <button
                    type="button"
                    onClick={() => toggleExpand(exp.id)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={exp.isExpanded ? "Collapse" : "Expand"}
                  >
                    {exp.isExpanded ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {exp.isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Job Title */}
                  <div className="relative">
                    <div className="relative">
                      <select
                        value={jobTitleValue[exp.id] || exp.jobTitle}
                        onChange={(event) => {
                          setJobTitleValue({ ...jobTitleValue, [exp.id]: event.target.value });
                          setExperiences((prev) =>
                            prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, jobTitle: event.target.value } : expItem))
                          );
                        }}
                        onFocus={() => setJobTitleFocused({ ...jobTitleFocused, [exp.id]: true })}
                        onBlur={() => setJobTitleFocused({ ...jobTitleFocused, [exp.id]: false })}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                          jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle) ? "pt-5" : "pt-3"
                        }`}
                        style={{
                          width: "100%",
                          height: "48.19px",
                          borderRadius: "5.02px",
                          border: "1px solid #99A1AF",
                          backgroundColor: "#FFFFFF",
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {jobTitles.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                          jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle)
                            ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-4 top-1/2 -translate-y-1/2 text-sm"
                        }`}
                        style={
                          jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle)
                            ? {
                                color: "#239CD2",
                              }
                            : undefined
                        }
                      >
                        Job Title eg. Web Developer
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

                  {/* Company */}
                  <div className="relative">
                    <div className="relative">
                      <select
                        value={companyValue[exp.id] || exp.company}
                        onChange={(event) => {
                          setCompanyValue({ ...companyValue, [exp.id]: event.target.value });
                          setExperiences((prev) =>
                            prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, company: event.target.value } : expItem))
                          );
                        }}
                        onFocus={() => setCompanyFocused({ ...companyFocused, [exp.id]: true })}
                        onBlur={() => setCompanyFocused({ ...companyFocused, [exp.id]: false })}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                          companyFocused[exp.id] || (companyValue[exp.id] || exp.company) ? "pt-5" : "pt-3"
                        }`}
                        style={{
                          width: "100%",
                          height: "48.19px",
                          borderRadius: "5.02px",
                          border: "1px solid #99A1AF",
                          backgroundColor: "#FFFFFF",
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {companies.map((company) => (
                          <option key={company} value={company}>
                            {company}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                          companyFocused[exp.id] || (companyValue[exp.id] || exp.company)
                            ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-4 top-1/2 -translate-y-1/2 text-sm"
                        }`}
                        style={
                          companyFocused[exp.id] || (companyValue[exp.id] || exp.company)
                            ? {
                                color: "#239CD2",
                              }
                            : undefined
                        }
                      >
                        Company eg. Wipro
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

                  {/* Work Location */}
                  <div className="relative">
                    <div className="relative">
                      <select
                        value={workLocationValue[exp.id] || exp.workLocation}
                        onChange={(event) => {
                          setWorkLocationValue({ ...workLocationValue, [exp.id]: event.target.value });
                          setExperiences((prev) =>
                            prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, workLocation: event.target.value } : expItem))
                          );
                        }}
                        onFocus={() => setWorkLocationFocused({ ...workLocationFocused, [exp.id]: true })}
                        onBlur={() => setWorkLocationFocused({ ...workLocationFocused, [exp.id]: false })}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                          workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation) ? "pt-5" : "pt-3"
                        }`}
                        style={{
                          width: "100%",
                          height: "48.19px",
                          borderRadius: "5.02px",
                          border: "1px solid #99A1AF",
                          backgroundColor: "#FFFFFF",
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {workLocations.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                          workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation)
                            ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-4 top-1/2 -translate-y-1/2 text-sm"
                        }`}
                        style={
                          workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation)
                            ? {
                                color: "#239CD2",
                              }
                            : undefined
                        }
                      >
                        Work Location
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

                  {/* Start Date and End Date Row */}
                  <div className="flex items-center" style={{ gap: "23px" }}>
                    <div className="relative" style={{ flex: 1 }}>
                      <div className="relative">
                        <div
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
                          onClick={() => startDateInputRefs.current[exp.id]?.showPicker()}
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
                            startDateInputRefs.current[exp.id] = el;
                          }}
                          type="date"
                          value={startDateValue[exp.id] || exp.startDate}
                          onChange={(event) => {
                            setStartDateValue({ ...startDateValue, [exp.id]: event.target.value });
                            setExperiences((prev) =>
                              prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, startDate: event.target.value } : expItem))
                            );
                          }}
                          onFocus={() => setStartDateFocused({ ...startDateFocused, [exp.id]: true })}
                          onBlur={() => setStartDateFocused({ ...startDateFocused, [exp.id]: false })}
                          onClick={() => startDateInputRefs.current[exp.id]?.showPicker()}
                          className={`px-4 pb-2 pl-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                            startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate) ? "pt-5" : "pt-3"
                          }`}
                          style={{
                            width: "100%",
                            height: "48.19px",
                            borderRadius: "5.02px",
                            border: "1px solid #99A1AF",
                            backgroundColor: "#FFFFFF",
                            color: startDateValue[exp.id] || exp.startDate ? "#1e293b" : "transparent",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                            startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate)
                              ? "left-10 -top-2.5 text-xs font-medium bg-white px-1"
                              : "left-10 top-1/2 -translate-y-1/2 text-sm"
                          }`}
                          style={
                            startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate)
                              ? {
                                  color: "#239CD2",
                                }
                              : undefined
                          }
                        >
                          Start Date
                        </label>
                      </div>
                    </div>
                    <div className="relative" style={{ flex: 1 }}>
                      <div className="relative">
                        <div
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
                          onClick={() => endDateInputRefs.current[exp.id]?.showPicker()}
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
                            endDateInputRefs.current[exp.id] = el;
                          }}
                          type="date"
                          value={endDateValue[exp.id] || exp.endDate}
                          onChange={(event) => {
                            setEndDateValue({ ...endDateValue, [exp.id]: event.target.value });
                            setExperiences((prev) =>
                              prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, endDate: event.target.value, isCurrent: false } : expItem))
                            );
                          }}
                          onFocus={() => setEndDateFocused({ ...endDateFocused, [exp.id]: true })}
                          onBlur={() => setEndDateFocused({ ...endDateFocused, [exp.id]: false })}
                          onClick={() => endDateInputRefs.current[exp.id]?.showPicker()}
                          disabled={exp.isCurrent}
                          className={`px-4 pb-2 pl-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                            endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate) ? "pt-5" : "pt-3"
                          } ${exp.isCurrent ? "opacity-50 cursor-not-allowed" : ""}`}
                          style={{
                            width: "100%",
                            height: "48.19px",
                            borderRadius: "5.02px",
                            border: "1px solid #99A1AF",
                            backgroundColor: "#FFFFFF",
                            color: endDateValue[exp.id] || exp.endDate ? "#1e293b" : "transparent",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                            endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate)
                              ? "left-10 -top-2.5 text-xs font-medium bg-white px-1"
                              : "left-10 top-1/2 -translate-y-1/2 text-sm"
                          }`}
                          style={
                            endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate)
                              ? {
                                  color: "#239CD2",
                                }
                              : undefined
                          }
                        >
                          End Date
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* I currently work here checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`current-${exp.id}`}
                      checked={exp.isCurrent}
                      onChange={(event) => {
                        setExperiences((prev) =>
                          prev.map((expItem) =>
                            expItem.id === exp.id
                              ? { ...expItem, isCurrent: event.target.checked, endDate: event.target.checked ? "" : expItem.endDate }
                              : expItem
                          )
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <label
                      htmlFor={`current-${exp.id}`}
                      className="text-slate-700"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "14px",
                      }}
                    >
                      I currently work here
                    </label>
                  </div>

                  {/* Responsibilities */}
                  <div className="relative">
                    <div className="relative">
                      <textarea
                        value={responsibilitiesValue[exp.id] || exp.responsibilities}
                        onChange={(event) => {
                          setResponsibilitiesValue({ ...responsibilitiesValue, [exp.id]: event.target.value });
                          setExperiences((prev) =>
                            prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, responsibilities: event.target.value } : expItem))
                          );
                        }}
                        onFocus={() => setResponsibilitiesFocused({ ...responsibilitiesFocused, [exp.id]: true })}
                        onBlur={() => setResponsibilitiesFocused({ ...responsibilitiesFocused, [exp.id]: false })}
                        rows={4}
                        className={`px-4 pb-2 pt-5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 resize-none`}
                        style={{
                          width: "100%",
                          minHeight: "100px",
                          borderRadius: "5.02px",
                          border: "1px solid #99A1AF",
                          backgroundColor: "#FFFFFF",
                        }}
                      />
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                          responsibilitiesFocused[exp.id] || (responsibilitiesValue[exp.id] || exp.responsibilities)
                            ? "left-4 top-1.5 text-xs font-medium bg-white px-1"
                            : "left-4 top-4 text-sm"
                        }`}
                        style={
                          responsibilitiesFocused[exp.id] || (responsibilitiesValue[exp.id] || exp.responsibilities)
                            ? {
                                color: "#239CD2",
                              }
                            : undefined
                        }
                      >
                        Responsibilities
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add More Experience Button */}
          <div className="w-full" style={{ width: "538.07px" }}>
            <button
              type="button"
              onClick={addExperience}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-sky-500 bg-white px-4 py-3 font-medium text-sky-600 transition hover:bg-sky-50"
              style={{
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
              Add More Experience
            </button>
          </div>

          {/* Save & Continue Button */}
          <div className="w-full" style={{ width: "538.07px" }}>
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
        </form>
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

