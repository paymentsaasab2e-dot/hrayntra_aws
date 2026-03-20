"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SalaryExpectationPage() {
  const router = useRouter();

  const steps = [
    { number: 1, label: "Personal Details", active: false },
    { number: 2, label: "Educational Details", active: false },
    { number: 3, label: "Manage Your Skills", active: false },
    { number: 4, label: "Work Experience", active: false },
    { number: 5, label: "Salary Expectation", active: true },
    { number: 6, label: "Career Preferences", active: false },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  const activeStepNumber = steps.find((s) => s.active)?.number || 6;

  // Current Salary states
  const [currentCurrency, setCurrentCurrency] = useState("");
  const [currentCurrencyFocused, setCurrentCurrencyFocused] = useState(false);
  const [currentSalaryType, setCurrentSalaryType] = useState("");
  const [currentSalaryTypeFocused, setCurrentSalaryTypeFocused] = useState(false);
  const [currentSalary, setCurrentSalary] = useState("");
  const [currentSalaryFocused, setCurrentSalaryFocused] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("");
  const [currentLocationFocused, setCurrentLocationFocused] = useState(false);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [benefitOptions, setBenefitOptions] = useState<string[]>([
    "Family Accommodation",
    "Bachelor Accommodation",
    "Food Allowance",
    "Car Allowance",
    "Fuel and Driver",
    "Medical",
    "Visa",
    "Travel and Tickets",
    "Additional Benefits",
  ]);
  const [newBenefit, setNewBenefit] = useState("");
  const [showAddBenefit, setShowAddBenefit] = useState(false);

  // Expected Salary states
  const [preferredSalary, setPreferredSalary] = useState("");
  const [preferredSalaryFocused, setPreferredSalaryFocused] = useState(false);
  const [preferredLocationInput, setPreferredLocationInput] = useState("");
  const [preferredLocationFocused, setPreferredLocationFocused] = useState(false);
  const [selectedPreferredLocations, setSelectedPreferredLocations] = useState<string[]>([]);
  const [showVisaQuestions, setShowVisaQuestions] = useState(false);
  const [currentLocationForVisa, setCurrentLocationForVisa] = useState<string>("");
  const [visaQuestionStep, setVisaQuestionStep] = useState(0);
  const [hasVisa, setHasVisa] = useState<string>("");
  const [visaStatus, setVisaStatus] = useState("");
  const [visaStatusFocused, setVisaStatusFocused] = useState(false);
  const [visaStartDate, setVisaStartDate] = useState("");
  const [visaStartDateFocused, setVisaStartDateFocused] = useState(false);
  const [visaEndDate, setVisaEndDate] = useState("");
  const [visaEndDateFocused, setVisaEndDateFocused] = useState(false);
  const [visaSponsorshipRequired, setVisaSponsorshipRequired] = useState<string>("");
  const [visaDetailsByLocation, setVisaDetailsByLocation] = useState<Record<string, {
    hasVisa: string;
    visaStatus?: string;
    visaStartDate?: string;
    visaEndDate?: string;
    visaSponsorshipRequired?: string;
  }>>({});
  const [preferredRoleInput, setPreferredRoleInput] = useState("");
  const [preferredRoleFocused, setPreferredRoleFocused] = useState(false);
  const [selectedPreferredRoles, setSelectedPreferredRoles] = useState<string[]>([]);
  const [preferredWorkMode, setPreferredWorkMode] = useState("");
  const [preferredWorkModeFocused, setPreferredWorkModeFocused] = useState(false);
  const [expectedSelectedBenefits, setExpectedSelectedBenefits] = useState<string[]>([]);

  // Chips for Preferred Locations and Roles
  const locationChips = ["New York", "London", "Berlin", "Dubai", "Singapore", "San Francisco", "Toronto", "Sydney"];
  const roleChips = ["Software Developer", "Tech Lead", "UX Designer", "Product Manager", "Data Scientist", "DevOps Engineer", "QA Engineer", "Business Analyst"];

  // Locations that require company-sponsored visa
  const locationsRequiringSponsorship = ["New York", "Singapore"];

  // Expected Salary states
  const [expectedCurrency, setExpectedCurrency] = useState("");
  const [expectedCurrencyFocused, setExpectedCurrencyFocused] = useState(false);
  const [expectedSalaryType, setExpectedSalaryType] = useState("");
  const [expectedSalaryTypeFocused, setExpectedSalaryTypeFocused] = useState(false);
  const [minSalary, setMinSalary] = useState("");
  const [minSalaryFocused, setMinSalaryFocused] = useState(false);
  const [maxSalary, setMaxSalary] = useState("");
  const [maxSalaryFocused, setMaxSalaryFocused] = useState(false);

  const currencies = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY"];
  const salaryTypes = ["Annual", "Monthly", "Hourly"];
  const workModes = ["Remote", "Hybrid", "On-site"];
  const visaStatusOptions = ["Citizen", "Permanent Resident", "Work Visa", "Student Visa", "Tourist Visa", "No Visa Required", "Other"];

  // Toggle functions for Preferred Locations and Roles
  const toggleLocation = (value: string) => {
    setSelectedPreferredLocations((prev) => {
      const isCurrentlySelected = prev.includes(value);
      const newLocations = isCurrentlySelected
        ? prev.filter((v) => v !== value)
        : [...prev, value];

      // Show visa questions when a new location is added (if not already completed for this location)
      if (!isCurrentlySelected && newLocations.length > 0 && !visaDetailsByLocation[value]) {
        setCurrentLocationForVisa(value);
        setShowVisaQuestions(true);
        setVisaQuestionStep(0);
        setHasVisa("");
        setVisaStatus("");
        setVisaStartDate("");
        setVisaEndDate("");
        setVisaSponsorshipRequired("");
      } else if (isCurrentlySelected && newLocations.length === 0) {
        // Remove visa details when location is removed
        setVisaDetailsByLocation((prev) => {
          const newDetails = { ...prev };
          delete newDetails[value];
          return newDetails;
        });
        resetVisaQuestions();
      }

      return newLocations;
    });
  };

  const removeLocation = (value: string) => {
    setSelectedPreferredLocations((prev) => {
      const newLocations = prev.filter((v) => v !== value);
      // Remove visa details when location is removed
      setVisaDetailsByLocation((prev) => {
        const newDetails = { ...prev };
        delete newDetails[value];
        return newDetails;
      });
      if (newLocations.length === 0) {
        resetVisaQuestions();
      }
      return newLocations;
    });
  };

  const handleLocationEnterKey = (value: string) => {
    if (value.trim() && !selectedPreferredLocations.includes(value.trim())) {
      const newLocations = [value.trim(), ...selectedPreferredLocations];
      setSelectedPreferredLocations(newLocations);
      setPreferredLocationInput("");
      // Show visa questions for new location (if not already completed)
      if (!visaDetailsByLocation[value.trim()]) {
        setCurrentLocationForVisa(value.trim());
        setShowVisaQuestions(true);
        setVisaQuestionStep(0);
        setHasVisa("");
        setVisaStatus("");
        setVisaStartDate("");
        setVisaEndDate("");
        setVisaSponsorshipRequired("");
      }
    }
  };

  // Get visa summary text for a specific location
  const getVisaSummaryForLocation = (location: string) => {
    const details = visaDetailsByLocation[location];
    if (!details || !details.hasVisa) return "";
    if (details.hasVisa === "yes") {
      if (details.visaStatus === "Citizen" || details.visaStatus === "Permanent Resident") {
        return `Yes - ${details.visaStatus}`;
      } else if (details.visaStatus) {
        return `Yes - ${details.visaStatus}${details.visaStartDate && details.visaEndDate ? ` (${details.visaStartDate} to ${details.visaEndDate})` : ""}`;
      }
      return "Yes";
    } else if (details.hasVisa === "no") {
      if (details.visaSponsorshipRequired) {
        return `No - Sponsorship: ${details.visaSponsorshipRequired === "yes" ? "Yes" : details.visaSponsorshipRequired === "no" ? "No" : "Not sure"}`;
      }
      return "No";
    }
    return "";
  };

  const handleVisaNext = (hasVisaValue?: string, visaStatusValue?: string, sponsorshipValue?: string) => {
    const currentHasVisa = hasVisaValue !== undefined ? hasVisaValue : hasVisa;
    const currentVisaStatus = visaStatusValue !== undefined ? visaStatusValue : visaStatus;
    const currentSponsorship = sponsorshipValue !== undefined ? sponsorshipValue : visaSponsorshipRequired;

    if (visaQuestionStep === 0) {
      if (currentHasVisa === "yes") {
        setVisaQuestionStep(1); // Yes → Visa Status
      } else if (currentHasVisa === "no") {
        setVisaQuestionStep(3); // No → Visa Sponsorship
      }
    } else if (visaQuestionStep === 1) {
      if (currentVisaStatus && (currentVisaStatus === "Work Visa" || currentVisaStatus === "Student Visa" || currentVisaStatus === "Tourist Visa" || currentVisaStatus === "Other")) {
        setVisaQuestionStep(2); // Work/Student/Tourist/Other → Visa Dates
      } else if (currentVisaStatus && (currentVisaStatus === "Citizen" || currentVisaStatus === "Permanent Resident")) {
        // Complete for Citizen/Permanent Resident
        saveVisaDetailsForCurrentLocation();
        resetVisaQuestions();
      }
    } else if (visaQuestionStep === 2) {
      // Complete when end date is selected (even if start date is not filled yet)
      if (visaEndDate) {
        saveVisaDetailsForCurrentLocation(visaEndDate);
        resetVisaQuestions();
      }
    } else if (visaQuestionStep === 3) {
      if (currentSponsorship) {
        saveVisaDetailsForCurrentLocation();
        resetVisaQuestions();
      }
    }
  };

  const saveVisaDetailsForCurrentLocation = (endDateValue?: string) => {
    if (currentLocationForVisa) {
      const endDate = endDateValue !== undefined ? endDateValue : visaEndDate;
      setVisaDetailsByLocation((prev) => ({
        ...prev,
        [currentLocationForVisa]: {
          hasVisa,
          ...(visaStatus && { visaStatus }),
          ...(visaStartDate && { visaStartDate }),
          ...(endDate && { visaEndDate: endDate }),
          ...(visaSponsorshipRequired && { visaSponsorshipRequired }),
        },
      }));
    }
  };

  const resetVisaQuestions = () => {
    setShowVisaQuestions(false);
    setVisaQuestionStep(0);
    setHasVisa("");
    setVisaStatus("");
    setVisaStartDate("");
    setVisaEndDate("");
    setVisaSponsorshipRequired("");
    setCurrentLocationForVisa("");
  };

  const handleVisaBack = () => {
    if (visaQuestionStep > 0) {
      setVisaQuestionStep(visaQuestionStep - 1);
    }
  };

  const requiresSponsorship = selectedPreferredLocations.some(loc =>
    locationsRequiringSponsorship.includes(loc)
  );

  const toggleRole = (value: string) => {
    setSelectedPreferredRoles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const removeRole = (value: string) => {
    setSelectedPreferredRoles((prev) => prev.filter((v) => v !== value));
  };

  const handleRoleEnterKey = (value: string) => {
    if (value.trim() && !selectedPreferredRoles.includes(value.trim())) {
      setSelectedPreferredRoles((prev) => [value.trim(), ...prev]);
      setPreferredRoleInput("");
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
      <div className="relative px-6" style={{ backgroundColor: "transparent", zIndex: 50, paddingTop: "2px", paddingBottom: "12px" }}>
        <div className="relative mx-auto flex max-w-7xl items-start justify-between">
          {steps.map((step) => {
            const isCompleted = step.number < activeStepNumber;
            return (
              <div key={step.number} className="relative z-10 flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`relative flex items-center justify-center rounded-full border-2 text-sm font-semibold ${step.active
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
                          ? () => router.push("/skills")
                          : isCompleted && step.number === 4
                            ? () => router.push("/work-exp")
                            : undefined
                  }
                >
                  {step.number}
                </div>
                <p
                  className={`mt-2 text-xs ${step.active || isCompleted ? "font-semibold text-slate-900" : "text-slate-500"
                    } ${isCompleted ? "cursor-pointer hover:text-sky-600" : ""}`}
                  style={{ maxWidth: "120px", textAlign: "center", lineHeight: "1.3" }}
                  onClick={
                    isCompleted && step.number === 1
                      ? () => router.push("/personal-details")
                      : isCompleted && step.number === 2
                        ? () => router.push("/edu-details")
                        : isCompleted && step.number === 3
                          ? () => router.push("/skills")
                          : isCompleted && step.number === 4
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
              Salary Expectation
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
            Tell us your expected salary so we can match you with the most relevant opportunities. You can choose your currency and provide a range.
          </p>
        </div>

        {/* Form */}
        <form className="mx-auto flex max-w-2xl flex-col items-center" style={{ gap: "21px" }}>
          {/* Two Column Section: Current Salary and Expected Salary */}
          <div className="w-full flex items-start justify-center" style={{ width: "800px", gap: "0px" }}>
            {/* Current Salary Section - Left Column */}
            <div className="flex-1 pr-6" style={{ maxWidth: "50%" }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current</h3>
              <div className="space-y-4">
                {/* Currency and Salary Type in one row */}
                <div className="flex items-center gap-2">
                  {/* Currency */}
                  <div className="relative flex-1">
                    <div className="relative">
                      <select
                        value={currentCurrency}
                        onChange={(e) => setCurrentCurrency(e.target.value)}
                        onFocus={() => setCurrentCurrencyFocused(true)}
                        onBlur={() => setCurrentCurrencyFocused(false)}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentCurrencyFocused || currentCurrency ? "pt-5" : "pt-3"
                          }`}
                        style={{
                          width: "100%",
                          ...fieldStyle,
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {currencies.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(currentCurrencyFocused, !!currentCurrency)}`}
                        style={labelColor(currentCurrencyFocused, !!currentCurrency)}
                      >
                        Currency
                      </label>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Salary Type */}
                  <div className="relative flex-1">
                    <div className="relative">
                      <select
                        value={currentSalaryType}
                        onChange={(e) => setCurrentSalaryType(e.target.value)}
                        onFocus={() => setCurrentSalaryTypeFocused(true)}
                        onBlur={() => setCurrentSalaryTypeFocused(false)}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentSalaryTypeFocused || currentSalaryType ? "pt-5" : "pt-3"
                          }`}
                        style={{
                          width: "100%",
                          ...fieldStyle,
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {salaryTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(currentSalaryTypeFocused, !!currentSalaryType)}`}
                        style={labelColor(currentSalaryTypeFocused, !!currentSalaryType)}
                      >
                        Salary Type
                      </label>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Current Salary */}
                <div className="relative">
                  <div className="relative">
                    <input
                      type="number"
                      value={currentSalary}
                      onChange={(e) => setCurrentSalary(e.target.value)}
                      onFocus={() => setCurrentSalaryFocused(true)}
                      onBlur={() => setCurrentSalaryFocused(false)}
                      className={`px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentSalaryFocused || currentSalary ? "pt-5" : "pt-3"
                        }`}
                      style={{
                        width: "100%",
                        ...fieldStyle,
                      }}
                    />
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(currentSalaryFocused, !!currentSalary)}`}
                      style={labelColor(currentSalaryFocused, !!currentSalary)}
                    >
                      Current Salary
                    </label>
                  </div>
                </div>
                {/* Current Location */}
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={currentLocation}
                      onChange={(e) => setCurrentLocation(e.target.value)}
                      onFocus={() => setCurrentLocationFocused(true)}
                      onBlur={() => setCurrentLocationFocused(false)}
                      className={`px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentLocationFocused || currentLocation ? "pt-5" : "pt-3"
                        }`}
                      style={{
                        width: "100%",
                        ...fieldStyle,
                      }}
                    />
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(currentLocationFocused, !!currentLocation)}`}
                      style={labelColor(currentLocationFocused, !!currentLocation)}
                    >
                      Current Location
                    </label>
                  </div>
                </div>
                {/* Benefits */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-3" style={{ color: "#239CD2" }}>
                    Benefits
                  </label>
                  <div className="space-y-2.5" style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {benefitOptions.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`benefit-${benefit}`}
                          checked={selectedBenefits.includes(benefit)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBenefits([...selectedBenefits, benefit]);
                            } else {
                              setSelectedBenefits(selectedBenefits.filter((b) => b !== benefit));
                            }
                          }}
                          className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 focus:ring-2 cursor-pointer"
                          style={{
                            accentColor: "#239CD2",
                          }}
                        />
                        <label
                          htmlFor={`benefit-${benefit}`}
                          className="text-sm text-slate-700 cursor-pointer select-none"
                        >
                          {benefit}
                        </label>
                      </div>
                    ))}
                  </div>
                  {showAddBenefit ? (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newBenefit}
                          onChange={(e) => setNewBenefit(e.target.value)}
                          onFocus={() => { }}
                          onBlur={() => { }}
                          className={`px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${newBenefit ? "pt-5" : "pt-3"
                            }`}
                          style={{
                            width: "100%",
                            ...fieldStyle,
                          }}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && newBenefit.trim()) {
                              setBenefitOptions([...benefitOptions, newBenefit.trim()]);
                              setSelectedBenefits([...selectedBenefits, newBenefit.trim()]);
                              setNewBenefit("");
                              setShowAddBenefit(false);
                            }
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(!!newBenefit, !!newBenefit)}`}
                          style={labelColor(!!newBenefit, !!newBenefit)}
                        >
                          Enter new benefit
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newBenefit.trim()) {
                            setBenefitOptions([...benefitOptions, newBenefit.trim()]);
                            setSelectedBenefits([...selectedBenefits, newBenefit.trim()]);
                            setNewBenefit("");
                            setShowAddBenefit(false);
                          }
                        }}
                        className="px-4 py-2 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 transition"
                        style={{
                          height: "48.19px",
                          borderRadius: "5.02px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBenefit(false);
                          setNewBenefit("");
                        }}
                        className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition text-slate-700"
                        style={{
                          height: "48.19px",
                          borderRadius: "5.02px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddBenefit(true)}
                      className="mt-3 flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium transition"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Add Other
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Vertical Divider Line */}
            <div className="w-px bg-gray-300 h-full flex-shrink-0" style={{ minHeight: "200px" }}></div>

            {/* Expected Salary Section - Right Column */}
            <div className="flex-1 pl-6" style={{ maxWidth: "50%" }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferred</h3>
              <div className="space-y-4">
                {/* Currency and Salary Type in one row */}
                <div className="flex items-center gap-2">
                  {/* Currency */}
                  <div className="relative flex-1">
                    <div className="relative">
                      <select
                        value={expectedCurrency}
                        onChange={(e) => setExpectedCurrency(e.target.value)}
                        onFocus={() => setExpectedCurrencyFocused(true)}
                        onBlur={() => setExpectedCurrencyFocused(false)}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${expectedCurrencyFocused || expectedCurrency ? "pt-5" : "pt-3"
                          }`}
                        style={{
                          width: "100%",
                          ...fieldStyle,
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {currencies.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(expectedCurrencyFocused, !!expectedCurrency)}`}
                        style={labelColor(expectedCurrencyFocused, !!expectedCurrency)}
                      >
                        Currency
                      </label>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Salary Type */}
                  <div className="relative flex-1">
                    <div className="relative">
                      <select
                        value={expectedSalaryType}
                        onChange={(e) => setExpectedSalaryType(e.target.value)}
                        onFocus={() => setExpectedSalaryTypeFocused(true)}
                        onBlur={() => setExpectedSalaryTypeFocused(false)}
                        className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${expectedSalaryTypeFocused || expectedSalaryType ? "pt-5" : "pt-3"
                          }`}
                        style={{
                          width: "100%",
                          ...fieldStyle,
                          appearance: "none",
                        }}
                      >
                        <option value="" disabled hidden></option>
                        {salaryTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(expectedSalaryTypeFocused, !!expectedSalaryType)}`}
                        style={labelColor(expectedSalaryTypeFocused, !!expectedSalaryType)}
                      >
                        Salary Type
                      </label>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Preferred Salary */}
                <div className="relative">
                  <div className="relative">
                    <input
                      type="number"
                      value={preferredSalary}
                      onChange={(e) => setPreferredSalary(e.target.value)}
                      onFocus={() => setPreferredSalaryFocused(true)}
                      onBlur={() => setPreferredSalaryFocused(false)}
                      className={`px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${preferredSalaryFocused || preferredSalary ? "pt-5" : "pt-3"
                        }`}
                      style={{
                        width: "100%",
                        ...fieldStyle,
                      }}
                    />
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(preferredSalaryFocused, !!preferredSalary)}`}
                      style={labelColor(preferredSalaryFocused, !!preferredSalary)}
                    >
                      Preferred Salary
                    </label>
                  </div>
                </div>
                {/* Preferred Locations */}
                <div className="relative">
                  <PreferredLocationFieldBlock
                    label="Preferred Locations"
                    placeholder="Enter your preferred location"
                    value={preferredLocationInput}
                    onChange={setPreferredLocationInput}
                    onEnterKey={(val) => handleLocationEnterKey(val)}
                    chips={locationChips}
                    selectedChips={selectedPreferredLocations}
                    onToggle={(value) => toggleLocation(value)}
                    onRemove={(value) => removeLocation(value)}
                    fieldStyle={fieldStyle}
                    labelFloating={labelFloating}
                    labelColor={labelColor}
                    focused={preferredLocationFocused}
                    setFocused={setPreferredLocationFocused}
                    visaDetailsByLocation={visaDetailsByLocation}
                    getVisaSummaryForLocation={getVisaSummaryForLocation}
                  />

                  {/* Visa Questions - Rendered directly below locations */}
                  {showVisaQuestions && (
                    <div className="mt-4 space-y-4">
                      {/* Step 0: Do you have visa? */}
                      {visaQuestionStep === 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Do you have a visa?</h3>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHasVisa("yes");
                                setVisaStatus("");
                                setVisaStartDate("");
                                setVisaEndDate("");
                                setVisaSponsorshipRequired("");
                                handleVisaNext("yes");
                              }}
                              className={`flex-1 px-4 py-2 text-sm rounded-lg border-2 font-medium transition ${hasVisa === "yes"
                                ? "bg-sky-600 border-sky-600 text-white"
                                : "bg-white border-gray-300 text-gray-700 hover:border-sky-300"
                                }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHasVisa("no");
                                setVisaStatus("");
                                setVisaStartDate("");
                                setVisaEndDate("");
                                setVisaSponsorshipRequired("");
                                handleVisaNext("no");
                              }}
                              className={`flex-1 px-4 py-2 text-sm rounded-lg border-2 font-medium transition ${hasVisa === "no"
                                ? "bg-sky-600 border-sky-600 text-white"
                                : "bg-white border-gray-300 text-gray-700 hover:border-sky-300"
                                }`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 1: Visa Status (if Yes) */}
                      {visaQuestionStep === 1 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Visa Status</h3>
                            <button
                              onClick={handleVisaBack}
                              className="text-sky-600 hover:text-sky-700 text-sm font-medium"
                            >
                              ← Back
                            </button>
                          </div>
                          <div className="relative">
                            <select
                              value={visaStatus}
                              onChange={(e) => {
                                const value = e.target.value;
                                setVisaStatus(value);
                                if (value) {
                                  handleVisaNext(undefined, value);
                                }
                              }}
                              onFocus={() => setVisaStatusFocused(true)}
                              onBlur={() => setVisaStatusFocused(false)}
                              className={`w-full px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${visaStatusFocused || visaStatus ? "pt-5" : "pt-3"
                                }`}
                              style={{
                                ...fieldStyle,
                                appearance: "none",
                              }}
                            >
                              <option value="" disabled hidden>Select visa status</option>
                              {visaStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Visa Dates (if Work/Student/Tourist/Other visa) */}
                      {visaQuestionStep === 2 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Visa Dates</h3>
                            <button
                              type="button"
                              onClick={handleVisaBack}
                              className="text-sky-600 hover:text-sky-700 text-sm font-medium"
                            >
                              ← Back
                            </button>
                          </div>
                          <div className="space-y-3">
                            <div className="relative">
                              <input
                                type="date"
                                value={visaStartDate}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setVisaStartDate(value);
                                  // Check if end date is already filled
                                  if (value && visaEndDate) {
                                    requestAnimationFrame(() => {
                                      handleVisaNext();
                                    });
                                  }
                                }}
                                onFocus={() => setVisaStartDateFocused(true)}
                                onBlur={() => {
                                  setVisaStartDateFocused(false);
                                  // Also check on blur in case end date was filled after start date
                                  if (visaStartDate && visaEndDate) {
                                    requestAnimationFrame(() => {
                                      handleVisaNext();
                                    });
                                  }
                                }}
                                className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${visaStartDateFocused || visaStartDate ? "pt-5" : "pt-3"
                                  }`}
                                style={fieldStyle}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(visaStartDateFocused, !!visaStartDate)}`}
                                style={labelColor(visaStartDateFocused, !!visaStartDate)}
                              >
                                Start Date
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="date"
                                value={visaEndDate}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setVisaEndDate(value);
                                  // Complete process immediately when end date is selected from calendar
                                  if (value && currentLocationForVisa) {
                                    // Save immediately with the selected date value
                                    saveVisaDetailsForCurrentLocation(value);
                                    resetVisaQuestions();
                                  }
                                }}
                                onInput={(e) => {
                                  // Handle input event for immediate response
                                  const value = (e.target as HTMLInputElement).value;
                                  if (value && currentLocationForVisa) {
                                    setVisaEndDate(value);
                                    saveVisaDetailsForCurrentLocation(value);
                                    resetVisaQuestions();
                                  }
                                }}
                                onFocus={() => setVisaEndDateFocused(true)}
                                onBlur={() => setVisaEndDateFocused(false)}
                                className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${visaEndDateFocused || visaEndDate ? "pt-5" : "pt-3"
                                  }`}
                                style={fieldStyle}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(visaEndDateFocused, !!visaEndDate)}`}
                                style={labelColor(visaEndDateFocused, !!visaEndDate)}
                              >
                                End Date
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Visa Sponsorship (if No) */}
                      {visaQuestionStep === 3 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Visa Sponsorship Required?</h3>
                            <button
                              type="button"
                              onClick={handleVisaBack}
                              className="text-sky-600 hover:text-sky-700 text-sm font-medium"
                            >
                              ← Back
                            </button>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs italic text-gray-600 mb-3">
                              Sponsorship means the employer must apply for or support your legal work authorization.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setVisaSponsorshipRequired("yes");
                                  handleVisaNext(undefined, undefined, "yes");
                                }}
                                className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition ${visaSponsorshipRequired === "yes"
                                  ? "bg-sky-600 border-sky-600 text-white"
                                  : "bg-white border-gray-300 text-gray-700 hover:border-sky-300"
                                  }`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setVisaSponsorshipRequired("no");
                                  handleVisaNext(undefined, undefined, "no");
                                }}
                                className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition ${visaSponsorshipRequired === "no"
                                  ? "bg-sky-600 border-sky-600 text-white"
                                  : "bg-white border-gray-300 text-gray-700 hover:border-sky-300"
                                  }`}
                              >
                                No
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setVisaSponsorshipRequired("not sure");
                                  handleVisaNext(undefined, undefined, "not sure");
                                }}
                                className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition ${visaSponsorshipRequired === "not sure"
                                  ? "bg-sky-600 border-sky-600 text-white"
                                  : "bg-white border-gray-300 text-gray-700 hover:border-sky-300"
                                  }`}
                              >
                                Not sure
                              </button>
                            </div>
                          </div>
                          {requiresSponsorship && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-3">
                              <p className="text-xs text-blue-800">
                                <strong>Note:</strong> Some selected locations require company-sponsored visas.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
                {/* Preferred Role */}
                <PreferredRoleFieldBlock
                  label="Preferred Role"
                  placeholder="Enter your preferred job role"
                  value={preferredRoleInput}
                  onChange={setPreferredRoleInput}
                  onEnterKey={(val) => handleRoleEnterKey(val)}
                  chips={roleChips}
                  selectedChips={selectedPreferredRoles}
                  onToggle={(value) => toggleRole(value)}
                  onRemove={(value) => removeRole(value)}
                  fieldStyle={fieldStyle}
                  labelFloating={labelFloating}
                  labelColor={labelColor}
                  focused={preferredRoleFocused}
                  setFocused={setPreferredRoleFocused}
                />
                {/* Preferred Work Mode */}
                <div className="relative">
                  <div className="relative">
                    <select
                      value={preferredWorkMode}
                      onChange={(e) => setPreferredWorkMode(e.target.value)}
                      onFocus={() => setPreferredWorkModeFocused(true)}
                      onBlur={() => setPreferredWorkModeFocused(false)}
                      className={`px-4 pb-2 pr-10 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${preferredWorkModeFocused || preferredWorkMode ? "pt-5" : "pt-3"
                        }`}
                      style={{
                        width: "100%",
                        ...fieldStyle,
                        appearance: "none",
                      }}
                    >
                      <option value="" disabled hidden></option>
                      {workModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                    <label
                      className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(preferredWorkModeFocused, !!preferredWorkMode)}`}
                      style={labelColor(preferredWorkModeFocused, !!preferredWorkMode)}
                    >
                      Preferred Work Mode
                    </label>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="#99A1AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
                {/* Benefits - Same as Current Salary */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-3" style={{ color: "#239CD2" }}>
                    Benefits
                  </label>
                  <div className="space-y-2.5" style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {benefitOptions.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`expected-benefit-${benefit}`}
                          checked={expectedSelectedBenefits.includes(benefit)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExpectedSelectedBenefits([...expectedSelectedBenefits, benefit]);
                            } else {
                              setExpectedSelectedBenefits(expectedSelectedBenefits.filter((b) => b !== benefit));
                            }
                          }}
                          className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 focus:ring-2 cursor-pointer"
                          style={{
                            accentColor: "#239CD2",
                          }}
                        />
                        <label
                          htmlFor={`expected-benefit-${benefit}`}
                          className="text-sm text-slate-700 cursor-pointer select-none"
                        >
                          {benefit}
                        </label>
                      </div>
                    ))}
                  </div>
                  {showAddBenefit ? (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newBenefit}
                          onChange={(e) => setNewBenefit(e.target.value)}
                          onFocus={() => { }}
                          onBlur={() => { }}
                          className={`px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${newBenefit ? "pt-5" : "pt-3"
                            }`}
                          style={{
                            width: "100%",
                            ...fieldStyle,
                          }}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && newBenefit.trim()) {
                              setBenefitOptions([...benefitOptions, newBenefit.trim()]);
                              setExpectedSelectedBenefits([...expectedSelectedBenefits, newBenefit.trim()]);
                              setNewBenefit("");
                              setShowAddBenefit(false);
                            }
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${labelFloating(!!newBenefit, !!newBenefit)}`}
                          style={labelColor(!!newBenefit, !!newBenefit)}
                        >
                          Enter new benefit
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newBenefit.trim()) {
                            setBenefitOptions([...benefitOptions, newBenefit.trim()]);
                            setExpectedSelectedBenefits([...expectedSelectedBenefits, newBenefit.trim()]);
                            setNewBenefit("");
                            setShowAddBenefit(false);
                          }
                        }}
                        className="px-4 py-2 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 transition"
                        style={{
                          height: "48.19px",
                          borderRadius: "5.02px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBenefit(false);
                          setNewBenefit("");
                        }}
                        className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition text-slate-700"
                        style={{
                          height: "48.19px",
                          borderRadius: "5.02px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddBenefit(true)}
                      className="mt-3 flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium transition"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Add Other
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Explanatory Text */}
          <p
            className="text-center w-full"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: "normal",
              fontSize: "14px",
              lineHeight: "20px",
              letterSpacing: "0px",
              color: "#6B7280",
              width: "800px",
              marginTop: "8px",
            }}
          >
            Provide your expected salary range. You can update this anytime.
          </p>

          {/* Save & Continue Button */}
          <div className="w-full" style={{ width: "800px", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => router.push("/completion-profile")}
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

interface PreferredLocationFieldBlockProps {
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
  focused: boolean;
  setFocused: (val: boolean) => void;
  visaDetailsByLocation: Record<string, {
    hasVisa: string;
    visaStatus?: string;
    visaStartDate?: string;
    visaEndDate?: string;
    visaSponsorshipRequired?: string;
  }>;
  getVisaSummaryForLocation: (location: string) => string;
}

function PreferredLocationFieldBlock({
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
  focused,
  setFocused,
  visaDetailsByLocation,
  getVisaSummaryForLocation,
}: PreferredLocationFieldBlockProps) {
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
          className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${focused || value ? "pt-5" : "pt-3"
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
      {/* Show selected locations with visa details - one row per location */}
      <div className="space-y-2">
        {selectedChips.map((chip) => {
          const visaSummary = getVisaSummaryForLocation(chip);
          return (
            <div key={chip} className="flex items-center gap-2 flex-wrap">
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
              {visaSummary && (
                <span
                  className="text-xs text-gray-600 font-medium"
                  style={{
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {visaSummary}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Suggestions removed as per user request */}
    </div>
  );
}

interface PreferredRoleFieldBlockProps {
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
  focused: boolean;
  setFocused: (val: boolean) => void;
}

function PreferredRoleFieldBlock({
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
  focused,
  setFocused,
}: PreferredRoleFieldBlockProps) {
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
          className={`w-full px-4 pb-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${focused || value ? "pt-5" : "pt-3"
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
        {/* Suggestions removed as per user request */}
      </div>
    </div>
  );
}

