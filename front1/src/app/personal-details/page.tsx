"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from '@/lib/api-base';

// Form types
interface LanguageEntry {
  name: string;
  proficiency: string;
  speak: boolean;
  read: boolean;
  write: boolean;
}

interface Education {
  id: number;
  degree: string;
  institution: string;
  specialization: string;
  startYear: string;
  endYear: string;
}

export default function PersonalDetailsPage() {
  const router = useRouter();
  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [fullNameValue, setFullNameValue] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [nationalityFocused, setNationalityFocused] = useState(false);
  const [nationalityValue, setNationalityValue] = useState("");
  const [dobFocused, setDobFocused] = useState(false);
  const [dobValue, setDobValue] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressValue, setAddressValue] = useState("");
  const [genderFocused, setGenderFocused] = useState(false);
  const [genderValue, setGenderValue] = useState("Male");
  const [alternateNumbers, setAlternateNumbers] = useState<string[]>(['']);
  const [alternateNumberFocused, setAlternateNumberFocused] = useState<boolean[]>([false]);
  const [countryFocused, setCountryFocused] = useState(false);
  const [countryValue, setCountryValue] = useState("");
  const [cityFocused, setCityFocused] = useState(false);
  const [cityValue, setCityValue] = useState("");
  const [maritalStatusFocused, setMaritalStatusFocused] = useState(false);
  const [maritalStatusValue, setMaritalStatusValue] = useState("");
  const [passportFocused, setPassportFocused] = useState(false);
  const [passportValue, setPassportValue] = useState("");
  const [linkedinFocused, setLinkedinFocused] = useState(false);
  const [linkedinValue, setLinkedinValue] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userJobTitle, setUserJobTitle] = useState<string>("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSlideContainerRef = useRef<HTMLDivElement>(null);

  // Form switching state
  const [activeForm, setActiveForm] = useState<'personal' | 'education' | 'skills' | 'work-exp' | 'salary-exp'>('personal');
  const [prevForm, setPrevForm] = useState<'personal' | 'education' | 'skills' | 'work-exp' | 'salary-exp' | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Education form state
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

  // Store unique values from database for dropdown suggestions
  const [degreeOptions, setDegreeOptions] = useState<string[]>([]);
  const [institutionOptions, setInstitutionOptions] = useState<string[]>([]);
  const [specializationOptions, setSpecializationOptions] = useState<string[]>([]);

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

  // Skills form state
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skillInputFocused, setSkillInputFocused] = useState(false);
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>([]);
  
  // AI suggested skills from database (skills marked as AI suggested)
  const [aiSuggestedSkills, setAiSuggestedSkills] = useState<string[]>([]);

  const languageChips = ["English", "Spanish", "Chinese", "Hindi", "Arabic", "French", "Portuguese"];

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

  const addLanguageEntry = (entry: LanguageEntry) => {
    if (entry.name && !languageEntries.find(e => e.name === entry.name)) {
      setLanguageEntries([...languageEntries, entry]);
    }
  };

  const removeLanguageEntry = (name: string) => {
    setLanguageEntries(languageEntries.filter((e) => e.name !== name));
  };

  // Fetch profile data on component mount
  useEffect(() => {
    const fetchProfileData = async () => {
      const candidateId = sessionStorage.getItem("candidateId");
      if (!candidateId) {
        console.log("No candidate ID found, redirecting to upload");
        router.push("/uploadcv");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/cv/profile/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const result = await response.json();
          console.log('📊 Profile API Response:', result);
          if (result.success && result.data) {
            const data = result.data;
            console.log('📊 Profile Data:', {
              hasPersonalInfo: !!data.personalInformation,
              educationCount: data.education?.length || 0,
              workExperienceCount: data.workExperience?.length || 0,
              skillsCount: data.skills?.length || 0,
              languagesCount: data.languages?.length || 0,
              skills: data.skills,
            });

            // Populate personal information
            if (data.personalInformation) {
              const pi = data.personalInformation;
              if (pi.fullName) setFullNameValue(pi.fullName);
              if (pi.email) setEmailValue(pi.email);
              // Use WhatsApp number (the number used for OTP) - it already includes country code
              if (pi.phoneNumber) {
                setPhoneValue(pi.phoneNumber);
              } else if (pi.whatsappNumber) {
                setPhoneValue(pi.whatsappNumber);
              }
              if (pi.alternatePhoneNumber) {
                setAlternateNumbers([pi.alternatePhoneNumber]);
              }
              if (pi.nationality) setNationalityValue(pi.nationality);
              if (pi.dateOfBirth) setDobValue(pi.dateOfBirth);
              if (pi.address) setAddressValue(pi.address);
              if (pi.gender) setGenderValue(pi.gender);
              if (pi.country) setCountryValue(pi.country);
              if (pi.city) setCityValue(pi.city);
              if (pi.maritalStatus) setMaritalStatusValue(pi.maritalStatus);
              if (pi.passportNumber) setPassportValue(pi.passportNumber);
              if (pi.linkedinProfile) setLinkedinValue(pi.linkedinProfile);
            }

            // Populate portfolio links
            if (data.portfolioLinks && data.portfolioLinks.length > 0) {
              console.log('📊 Portfolio Links Data:', data.portfolioLinks);
              // Portfolio links are stored in the database and will be displayed in the profile page
            }

            // Populate education
            if (data.education && data.education.length > 0) {
              const eduData = data.education.map((edu: any, index: number) => {
                // Convert year numbers to date format (YYYY-01-01 for start, YYYY-12-31 for end)
                const formatYearToDate = (year: string | number | null | undefined): string => {
                  if (!year) return "";
                  const yearStr = String(year);
                  // If it's already a date format (YYYY-MM-DD), return as is
                  if (yearStr.includes("-")) return yearStr;
                  // If it's just a year number, convert to date format
                  if (yearStr.length === 4 && /^\d{4}$/.test(yearStr)) {
                    return `${yearStr}-01-01`;
                  }
                  return yearStr;
                };

                return {
                  id: edu.id || index + 1,
                  degree: edu.degree || "",
                  institution: edu.institution || "",
                  specialization: edu.specialization || "",
                  startYear: formatYearToDate(edu.startYear),
                  endYear: formatYearToDate(edu.endYear),
                };
              });
              setEducations(eduData);

              // Extract unique values for dropdown suggestions
              const uniqueDegrees = Array.from(new Set(eduData.map((e: any) => e.degree).filter(Boolean))) as string[];
              const uniqueInstitutions = Array.from(new Set(eduData.map((e: any) => e.institution).filter(Boolean))) as string[];
              const uniqueSpecializations = Array.from(new Set(eduData.map((e: any) => e.specialization).filter(Boolean))) as string[];
              
              setDegreeOptions(uniqueDegrees);
              setInstitutionOptions(uniqueInstitutions);
              setSpecializationOptions(uniqueSpecializations);

              // Set education field values
              eduData.forEach((edu: any) => {
                if (edu.degree) setDegreeValue((prev) => ({ ...prev, [edu.id]: edu.degree }));
                if (edu.institution) setInstitutionValue((prev) => ({ ...prev, [edu.id]: edu.institution }));
                if (edu.specialization) setSpecializationValue((prev) => ({ ...prev, [edu.id]: edu.specialization }));
                if (edu.startYear) setStartYearValue((prev) => ({ ...prev, [edu.id]: edu.startYear }));
                if (edu.endYear) setEndYearValue((prev) => ({ ...prev, [edu.id]: edu.endYear }));
              });
            } else {
              // If no education data, initialize with empty arrays
              setDegreeOptions([]);
              setInstitutionOptions([]);
              setSpecializationOptions([]);
            }

            // Populate work experience
            if (data.workExperience && data.workExperience.length > 0) {
              const workExpData = data.workExperience.map((exp: any, index: number) => ({
                id: exp.id || index + 1,
                jobTitle: exp.jobTitle || "",
                company: exp.company || "",
                workLocation: exp.workLocation || "",
                startDate: exp.startDate || "",
                endDate: exp.endDate || "",
                isCurrent: exp.currentlyWorking || false,
                responsibilities: exp.responsibilities || "",
                isExpanded: true,
              }));
              setExperiences(workExpData);

              // Set work experience field values
              workExpData.forEach((exp: any) => {
                if (exp.jobTitle) setJobTitleValue((prev) => ({ ...prev, [exp.id]: exp.jobTitle }));
                if (exp.company) setCompanyValue((prev) => ({ ...prev, [exp.id]: exp.company }));
                if (exp.workLocation) setWorkLocationValue((prev) => ({ ...prev, [exp.id]: exp.workLocation }));
                if (exp.startDate) setStartDateValue((prev) => ({ ...prev, [exp.id]: exp.startDate }));
                if (exp.endDate) setEndDateValue((prev) => ({ ...prev, [exp.id]: exp.endDate }));
                if (exp.responsibilities) setResponsibilitiesValue((prev) => ({ ...prev, [exp.id]: exp.responsibilities }));
              });
            }

            // Populate skills
            if (data.skills && data.skills.length > 0) {
              console.log('📊 Skills data received:', data.skills);
              const allSkillNames = data.skills.map((skill: any) => skill.name).filter((name: string) => name && name.trim() !== '');
              console.log('📊 Skill names extracted:', allSkillNames);
              setUserSkills(allSkillNames);
              
              // Extract AI suggested skills (skills that are marked as AI suggested in database)
              const aiSuggested = data.skills
                .filter((skill: any) => skill.isAiSuggested === true && skill.name && skill.name.trim() !== '')
                .map((skill: any) => skill.name);
              console.log('🤖 AI Suggested skills:', aiSuggested);
              setAiSuggestedSkills(aiSuggested);
            } else {
              console.log('⚠️ No skills data found in response');
              setUserSkills([]);
              setAiSuggestedSkills([]);
            }

            // Populate languages
            if (data.languages && data.languages.length > 0) {
              const langData = data.languages.map((lang: any) => ({
                name: lang.name || "",
                proficiency: lang.proficiency || "INTERMEDIATE",
                speak: lang.speak || false,
                read: lang.read || false,
                write: lang.write || false,
              }));
              setLanguageEntries(langData);
            } else {
              setLanguageEntries([]);
            }
          }
        } else {
          console.error("Failed to fetch profile data");
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchProfileData();
  }, [router]);

  // Fetch dashboard data for profile photo and user info
  useEffect(() => {
    const fetchDashboardData = async () => {
      const candidateId = sessionStorage.getItem("candidateId");
      if (!candidateId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/cv/dashboard/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.profile) {
            const profile = result.data.profile;
            
            // Set user name (first name only)
            if (profile.fullName) {
              const firstName = profile.fullName.split(' ')[0];
              setUserName(firstName);
            }
            
            // Set profile photo URL
            if (profile.profilePhotoUrl) {
              const photoUrl = profile.profilePhotoUrl;
              let imageSrc: string;
              
              if (photoUrl.startsWith('data:')) {
                imageSrc = photoUrl;
              } else if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
                imageSrc = photoUrl;
              } else {
                const baseUrl = API_BASE_URL.replace('/api', '');
                const cleanPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
                imageSrc = `${baseUrl}${cleanPath}`;
              }
              setProfilePhotoUrl(imageSrc);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  // Scroll to top when switching forms
  useEffect(() => {
    if (formSlideContainerRef.current) {
      formSlideContainerRef.current.scrollTop = 0;
    }
  }, [activeForm]);

  // Handle profile photo upload
  const handlePhotoUpload = async (file: File) => {
    const candidateId = sessionStorage.getItem("candidateId");
    if (!candidateId) {
      console.error("No candidate ID found");
      alert("Please log in to upload profile photo");
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch(`${API_BASE_URL}/profile/photo/${candidateId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.profilePhotoUrl) {
          // Update profile photo URL
          const photoUrl = result.data.profilePhotoUrl;
          let imageSrc: string;
          
          if (photoUrl.startsWith('data:')) {
            imageSrc = photoUrl;
          } else if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
            imageSrc = photoUrl;
          } else {
            const baseUrl = API_BASE_URL.replace('/api', '');
            const cleanPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
            imageSrc = `${baseUrl}${cleanPath}`;
          }
          setProfilePhotoUrl(imageSrc);
          alert('Profile photo uploaded successfully!');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to upload profile photo');
      }
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      alert('Failed to upload profile photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const fieldStyle = {
                                  height: "42px",
    borderRadius: "8px",
    border: "1px solid #F3F4F6",
    backgroundColor: "#F9FAFB",
    width: "calc(100% - 24px)",
    marginLeft: "12px",
    marginRight: "12px",
  };

  const labelFloating = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
      : "left-6 top-1/2 -translate-y-1/2 text-sm";

  const labelColor = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? {
        color: "#239CD2",
      }
      : undefined;

  // Work Experience form state
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

  // Salary Expectation form state
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

  // Preferred Salary states
  const [preferredSalary, setPreferredSalary] = useState("");
  const [preferredSalaryFocused, setPreferredSalaryFocused] = useState(false);
  const [preferredLocationInput, setPreferredLocationInput] = useState("");
  const [preferredLocationFocused, setPreferredLocationFocused] = useState(false);
  const [selectedPreferredLocations, setSelectedPreferredLocations] = useState<string[]>([]);
  // Passport numbers by location (simplified from visa flow)
  const [passportNumbersByLocation, setPassportNumbersByLocation] = useState<Record<string, string>>({});
  const [passportNumberFocused, setPassportNumberFocused] = useState<Record<string, boolean>>({});
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

  const currencies = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY"];
  const salaryTypes = ["Annual", "Monthly", "Hourly"];
  const workModes = ["Remote", "Hybrid", "On-site"];
  const visaStatusOptions = ["Citizen", "Permanent Resident", "Work Visa", "Student Visa", "Tourist Visa", "No Visa Required", "Other"];

  const salaryFieldStyle = {
    height: "48.19px",
    borderRadius: "5.02px",
    border: "1px solid #F3F4F6",
    backgroundColor: "#F9FAFB",
  };

  const salaryLabelFloating = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? "left-4 -top-2.5 text-xs font-medium bg-white px-1"
      : "left-4 top-1/2 -translate-y-1/2 text-sm";

  const salaryLabelColor = (focused: boolean, hasValue: boolean) =>
    focused || hasValue
      ? {
        color: "#239CD2",
      }
      : undefined;

  // Toggle functions for Preferred Locations and Roles
  const toggleLocation = (value: string) => {
    setSelectedPreferredLocations((prev) => {
      const isCurrentlySelected = prev.includes(value);
      const newLocations = isCurrentlySelected
        ? prev.filter((v) => v !== value)
        : [...prev, value];

      // Remove passport number when location is removed
      if (isCurrentlySelected) {
        setPassportNumbersByLocation((prev) => {
          const newDetails = { ...prev };
          delete newDetails[value];
          return newDetails;
        });
        setPassportNumberFocused((prev) => {
          const newFocused = { ...prev };
          delete newFocused[value];
          return newFocused;
        });
      }

      return newLocations;
    });
  };

  const removeLocation = (value: string) => {
    setSelectedPreferredLocations((prev) => {
      const newLocations = prev.filter((v) => v !== value);
      // Remove passport number when location is removed
      setPassportNumbersByLocation((prev) => {
        const newDetails = { ...prev };
        delete newDetails[value];
        return newDetails;
      });
      setPassportNumberFocused((prev) => {
        const newFocused = { ...prev };
        delete newFocused[value];
        return newFocused;
      });
      return newLocations;
    });
  };

  const handleLocationEnterKey = (value: string) => {
    if (value.trim() && !selectedPreferredLocations.includes(value.trim())) {
      const newLocations = [value.trim(), ...selectedPreferredLocations];
      setSelectedPreferredLocations(newLocations);
      setPreferredLocationInput("");
    }
  };


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
      setSelectedPreferredRoles([value.trim(), ...selectedPreferredRoles]);
      setPreferredRoleInput("");
    }
  };

  // Save profile data to backend
  const saveProfileData = async (formSection?: string) => {
    const candidateId = sessionStorage.getItem("candidateId");
    if (!candidateId) {
      console.error("No candidate ID found");
      return;
    }

    try {
      // Prepare data based on current form section or all sections
      const updateData: any = {};

      // Always include personal information
      updateData.personalInformation = {
        fullName: fullNameValue,
        email: emailValue,
        phoneNumber: phoneValue,
        alternatePhoneNumber: alternateNumbers[0] || '',
        gender: genderValue,
        dateOfBirth: dobValue,
        maritalStatus: maritalStatusValue,
        address: addressValue,
        city: cityValue,
        country: countryValue,
        nationality: nationalityValue,
        passportNumber: passportValue,
        linkedinProfile: linkedinValue,
      };

      // Include education if on education form or saving all
      if (!formSection || formSection === 'education' || formSection === 'all') {
        updateData.education = educations.map((edu) => ({
          degree: degreeValue[edu.id] || edu.degree,
          institution: institutionValue[edu.id] || edu.institution,
          specialization: specializationValue[edu.id] || edu.specialization,
          startYear: startYearValue[edu.id] || edu.startYear,
          endYear: endYearValue[edu.id] || edu.endYear,
          isOngoing: !endYearValue[edu.id] && !edu.endYear,
        }));
      }

      // Include work experience if on work-exp form or saving all
      if (!formSection || formSection === 'work-exp' || formSection === 'all') {
        updateData.workExperience = experiences.map((exp) => ({
          jobTitle: jobTitleValue[exp.id] || exp.jobTitle,
          company: companyValue[exp.id] || exp.company,
          workLocation: workLocationValue[exp.id] || exp.workLocation,
          startDate: startDateValue[exp.id] || exp.startDate,
          endDate: endDateValue[exp.id] || exp.endDate,
          currentlyWorking: exp.isCurrent,
          responsibilities: responsibilitiesValue[exp.id] || exp.responsibilities,
        }));
      }

      // Include skills if on skills form or saving all
      if (!formSection || formSection === 'skills' || formSection === 'all') {
        updateData.skills = userSkills;
      }

      // Include languages if on skills form or saving all
      if (!formSection || formSection === 'skills' || formSection === 'all') {
        updateData.languages = languageEntries;
      }

      // Include career preferences if on salary-exp form or saving all
      if (!formSection || formSection === 'salary-exp' || formSection === 'all') {
        updateData.careerPreferences = {
          currentCurrency: currentCurrency,
          currentSalaryType: currentSalaryType,
          currentSalary: currentSalary,
          currentLocation: currentLocation,
          currentBenefits: selectedBenefits,
          preferredCurrency: expectedCurrency,
          preferredSalaryType: expectedSalaryType,
          preferredSalary: preferredSalary,
          preferredLocations: selectedPreferredLocations,
          preferredRoles: selectedPreferredRoles,
          preferredWorkMode: preferredWorkMode,
          preferredBenefits: expectedSelectedBenefits,
          passportNumbersByLocation: passportNumbersByLocation,
        };
      }

      const response = await fetch(`${API_BASE_URL}/cv/profile/${candidateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ Profile data saved successfully');
          return true;
        } else {
          console.error('Failed to save profile:', result.message);
          return false;
        }
      } else {
        console.error('Failed to save profile:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error saving profile data:', error);
      return false;
    }
  };

  const handleSaveChanges = async () => {
    // Save current form data before navigating
    const saved = await saveProfileData(activeForm);
    
    if (saved) {
      if (activeForm === 'personal') {
        setPrevForm(activeForm);
        setTimeout(() => {
          setActiveForm('education');
        }, 50);
      } else if (activeForm === 'education') {
        setPrevForm(activeForm);
        setTimeout(() => {
          setActiveForm('skills');
        }, 50);
      } else if (activeForm === 'skills') {
        setPrevForm(activeForm);
        setTimeout(() => {
          setActiveForm('work-exp');
        }, 50);
      } else if (activeForm === 'work-exp') {
        setPrevForm(activeForm);
        setTimeout(() => {
          setActiveForm('salary-exp');
        }, 50);
      }
    } else {
      alert('Failed to save changes. Please try again.');
    }
  };

  const steps = [
    { number: 1, label: "Personal Details", active: true },
    { number: 2, label: "Educational Details", active: false },
    { number: 3, label: "Work Experience", active: false },
    { number: 4, label: "Manage Your Skills", active: false },
    { number: 5, label: "Career Preferences", active: false },
    { number: 6, label: "Salary Expectation", active: false },
    { number: 7, label: "Work Locations & Eligibility", active: false },
    { number: 8, label: "Profile Completion Summary", active: false },
  ];

  return (
    <div
      className="h-screen"
      style={{
        background: "linear-gradient(135deg, #fde9d4, #fafbfb, #bddffb)",
        overflow: "hidden",
      }}
    >
      {/* Main Content */}
      <main className="mx-auto px-6 flex justify-center h-full" style={{ paddingTop: "16px", paddingBottom: "16px", width: "100%", maxWidth: "100vw", overflowX: "hidden", overflowY: "hidden" }}>
        {/* Form */}
        <form className="mx-auto flex flex-col items-center" style={{ width: "100%", maxWidth: "100%" }}>
          <style dangerouslySetInnerHTML={{
            __html: `
            input[type="radio"][name="gender"] {
              appearance: none;
              -webkit-appearance: none;
              -moz-appearance: none;
            }
            input[type="radio"][name="gender"]:checked {
              background-color: #fcd34d !important;
              border: 1px solid #cbd5e1 !important;
              outline: none !important;
              box-shadow: inset 0 0 0 2px white !important;
            }
            input[type="checkbox"] {
              cursor: pointer;
              width: 16px;
              height: 16px;
              appearance: none;
              -webkit-appearance: none;
              -moz-appearance: none;
              border: 2px solid #cbd5e1;
              border-radius: 3px;
              background-color: white;
              position: relative;
            }
            input[type="checkbox"]:checked {
              background-color: #0EA5E9 !important;
              border-color: #0EA5E9 !important;
            }
            input[type="checkbox"]:checked::after {
              content: "✓";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              color: white;
              font-weight: bold;
              font-size: 12px;
              line-height: 1;
            }
            .form-slide-container {
              position: relative;
              width: 100%;
              height: 100%;
              padding-top: 0;
              margin-top: 0;
            }
            .form-slide {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: fit-content;
              min-height: 100%;
              overflow: visible;
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              justify-content: flex-start;
              padding-top: 0;
              margin-top: 0;
            }
            .form-slide.active {
              animation: slideInFromRight 0.4s ease-out forwards;
              z-index: 10;
              opacity: 1;
              pointer-events: auto;
            }
            .form-slide.inactive {
              animation: slideOutToLeft 0.4s ease-out forwards;
              z-index: 0;
              opacity: 0;
              pointer-events: none;
            }
            @keyframes slideInFromRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
            @keyframes slideOutToLeft {
              from {
                transform: translateX(0);
                opacity: 1;
              }
              to {
                transform: translateX(-100%);
                opacity: 0;
              }
            }
          `}} />
          {/* White Card Container */}
          <div
            className="flex w-full flex-col relative"
            style={{
              width: "100%",
              maxWidth: "1400px",
              height: "100%",
              maxHeight: "calc(100vh - 32px)",
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              padding: "30px",
              gap: "30px",
              overflow: "hidden",
            }}
          >
            {/* SAASA Logo - Upper Left Corner */}
            <div className="absolute top-4 left-4 z-30">
              <Image 
                src="/SAASA Logo.png" 
                alt="SAASA Logo" 
                width={120} 
                height={40} 
                className="object-contain"
                style={{ maxHeight: "40px" }}
              />
            </div>
            <div className="flex w-full" style={{ gap: "24px", height: "100%", minHeight: 0, maxHeight: "100%", overflow: "hidden" }}>
              {/* Sidebar */}
              <aside
                className="flex flex-col items-center"
                style={{
                  width: "25%",
                  minWidth: "220px",
                  borderRight: "1px solid #e5e7eb",
                  paddingRight: "16px",
                  paddingTop: "24px",
                  gap: "14px",
                  flexShrink: 0,
                }}
              >
                <div className="flex flex-col items-center text-center" style={{ gap: "8px" }}>
                  <div className="relative" style={{ width: "100px", height: "100px" }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handlePhotoUpload(file);
                        }
                      }}
                      className="hidden"
                    />
                    <div
                      className="flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative"
                      style={{ width: "100px", height: "100px", cursor: "pointer" }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {profilePhotoUrl ? (
                        <Image 
                          src={profilePhotoUrl} 
                          alt="Profile" 
                          fill 
                          className="object-contain" 
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-gray-400"
                          >
                            <path
                              d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                      {isUploadingPhoto && (
                        <div
                          style={{
                            position: "absolute",
                            top: "0",
                            left: "0",
                            right: "0",
                            bottom: "0",
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            zIndex: 10,
                          }}
                        >
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute flex items-center justify-center rounded-full"
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor: "#FF8C00",
                        bottom: "0",
                        right: "0",
                        border: "2px solid #FFFFFF",
                        cursor: "pointer",
                        zIndex: 20,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploadingPhoto}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M11.3333 2.00004C11.5084 1.82493 11.7163 1.68607 11.9447 1.59131C12.1731 1.49655 12.4178 1.44775 12.6667 1.44775C12.9155 1.44775 13.1602 1.49655 13.3886 1.59131C13.617 1.68607 13.8249 1.82493 14 2.00004C14.1751 2.17515 14.314 2.38305 14.4087 2.61146C14.5035 2.83987 14.5523 3.08458 14.5523 3.33337C14.5523 3.58216 14.5035 3.82687 14.4087 4.05528C14.314 4.28369 14.1751 4.49159 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{userName || fullNameValue?.split(' ')[0] || 'User'}</p>
                    <p className="text-xs text-slate-500">{userJobTitle || 'Job Seeker'}</p>
                  </div>
                </div>
                <nav className="flex w-full flex-col" style={{ gap: "6px" }}>
                  {[
                    {
                      label: "Personal Information", icon: (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor" />
                          <path d="M8 10C4.68629 10 2 12.6863 2 16H14C14 12.6863 11.3137 10 8 10Z" fill="currentColor" />
                        </svg>
                      )
                    },
                    {
                      label: "Educational Details", icon: (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 3C2 2.44772 2.44772 2 3 2H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          <path d="M5 6H11M5 9H11M5 12H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )
                    },
                    {
                      label: "Manage Your Skills", icon: (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 0L10.1631 5.52786L16 6.11146L12 10.4721L12.9443 16L8 13.1115L3.05569 16L4 10.4721L0 6.11146L5.83686 5.52786L8 0Z" fill="currentColor" />
                        </svg>
                      )
                    },
                    {
                      label: "Work Experience", icon: (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 4C2 3.44772 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          <path d="M5 6L7 8L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )
                    },
                    {
                      label: "Career Preferences", icon: (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          <circle cx="8" cy="8" r="2" fill="currentColor" />
                        </svg>
                      )
                    },
                  ].map((item, idx) => {
                    const tabKey = idx === 0 ? 'personal' : idx === 1 ? 'education' : idx === 2 ? 'skills' : idx === 3 ? 'work-exp' : item.label.toLowerCase().replace(/\s+/g, '-');
                    const active = (idx === 0 && activeForm === 'personal') || (idx === 1 && activeForm === 'education') || (idx === 2 && activeForm === 'skills') || (idx === 3 && activeForm === 'work-exp') || (idx === 4 && activeForm === 'salary-exp');
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setPrevForm(activeForm);
                          if (idx === 0) {
                            setTimeout(() => setActiveForm('personal'), 50);
                          } else if (idx === 1) {
                            setTimeout(() => setActiveForm('education'), 50);
                          } else if (idx === 2) {
                            setTimeout(() => setActiveForm('skills'), 50);
                          } else if (idx === 3) {
                            setTimeout(() => setActiveForm('work-exp'), 50);
                          } else if (idx === 4) {
                            setTimeout(() => setActiveForm('salary-exp'), 50);
                          }
                        }}
                        className={`text-left text-sm transition flex items-center gap-2 ${active
                          ? "font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                          }`}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          backgroundColor: active ? "#FFF8F0" : "transparent",
                          color: active ? "#FF8C00" : undefined,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: active ? "#FF8C00" : undefined }}>
                          {item.icon}
                        </span>
                        <span style={{ color: active ? "#FF8C00" : undefined }}>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              {/* Main Content */}
              <section className="flex flex-col" style={{ width: "75%", gap: "0px", paddingTop: "0px", position: "relative", flex: '1 1 0', minHeight: 0, height: '100%', alignItems: 'flex-start' }}>
                <div ref={formSlideContainerRef} className="form-slide-container" style={{ position: 'relative', height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingTop: '0px', marginTop: '0px' }}>
                  <style dangerouslySetInnerHTML={{__html: `
                    .form-slide-container::-webkit-scrollbar {
                      width: 8px;
                    }
                    .form-slide-container::-webkit-scrollbar-track {
                      background: #F3F4F6;
                      border-radius: 10px;
                    }
                    .form-slide-container::-webkit-scrollbar-thumb {
                      background: #D1D5DB;
                      border-radius: 10px;
                    }
                    .form-slide-container::-webkit-scrollbar-thumb:hover {
                      background: #9CA3AF;
                    }
                    @keyframes glassy-shimmer {
                      0% {
                        background-position: -200% center;
                      }
                      100% {
                        background-position: 200% center;
                      }
                    }
                    .glassy-badge {
                      position: relative;
                      overflow: hidden;
                    }
                    .glassy-badge::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: -100%;
                      width: 100%;
                      height: 100%;
                      background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(255, 255, 255, 0.4),
                        transparent
                      );
                      animation: glassy-shimmer 3s infinite;
                    }
                  `}} />
                  {/* Personal Information Form */}
                  <div
                    className={`form-slide ${activeForm === 'personal' ? 'active' : prevForm === 'personal' ? 'inactive' : ''}`}
                    style={{
                      position: 'absolute',
                      top: '0px',
                      left: '0px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      height: 'fit-content',
                      minHeight: '100%',
                      gap: '26px',
                      paddingRight: '12px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                      marginTop: '0px',
                      opacity: activeForm === 'personal' ? 1 : 0,
                      pointerEvents: activeForm === 'personal' ? 'auto' : 'none',
                      zIndex: activeForm === 'personal' ? 10 : 0,
                    }}
                  >
                    <div className="flex items-center sticky bg-white z-20" style={{ top: '0px', marginTop: '0px', paddingTop: '0px', marginBottom: '20px', paddingBottom: '0px' }}>
                      <h2
                        className="font-medium text-slate-900"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "32.12px",
                          lineHeight: "40.2px",
                          letterSpacing: "0%",
                        }}
                      >
                        Personal Information
                      </h2>
                    </div>
                    <div
                      className="glassy-badge"
                      style={{
                        position: 'absolute',
                        top: '0px',
                        right: '12px',
                        padding: "1.5px",
                        borderRadius: "16px",
                        background: "linear-gradient(to right, #0EA5E9, #FF8C00)",
                        display: "inline-block",
                        boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        zIndex: 30,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0EA5E9",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          backgroundColor: "#FFFFFF",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        Auto-filled by AI
                      </div>
                    </div>

                    {/* Name / Email */}
                    <div className="flex w-full" style={{ gap: "16px" }}>
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                          <Image src="/perosn_icon.png" alt="Person" width={14} height={14} className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={fullNameValue}
                          onChange={(e) => setFullNameValue(e.target.value)}
                          onFocus={() => setFullNameFocused(true)}
                          onBlur={() => setFullNameFocused(false)}
                          className={`px-3 pb-1.5 pl-12 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${fullNameFocused || fullNameValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${fullNameFocused || fullNameValue.length > 0
                            ? "left-12 -top-2 text-xs font-medium bg-white px-1"
                            : "left-12 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={fullNameFocused || fullNameValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Full Name
                        </label>
                      </div>
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                          <Image src="/email_icon.png" alt="Email" width={14} height={14} className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          className={`px-3 pb-1.5 pl-12 pr-24 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${emailFocused || emailValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${emailFocused || emailValue.length > 0
                            ? "left-12 -top-2 text-xs font-medium bg-white px-1"
                            : "left-12 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={emailFocused || emailValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Email address
                        </label>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5">
                          <Image src="/green_tick.png" alt="Verified" width={16} height={16} className="h-4 w-4" />
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: "#00ab08",
                            }}
                          >
                            Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Phones */}
                    <div className="flex w-full" style={{ gap: "16px" }}>
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                          <Image src="/telephone_icon.png" alt="Telephone" width={14} height={14} className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="tel"
                          value={phoneValue}
                          onChange={(e) => setPhoneValue(e.target.value)}
                          onFocus={() => setPhoneFocused(true)}
                          onBlur={() => setPhoneFocused(false)}
                          className={`px-3 pb-1.5 pl-12 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${phoneFocused || phoneValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${phoneFocused || phoneValue.length > 0
                            ? "left-12 -top-2 text-xs font-medium bg-white px-1"
                            : "left-12 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={phoneFocused || phoneValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Phone Number
                        </label>
                      </div>
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                          <Image src="/telephone_icon.png" alt="Telephone" width={14} height={14} className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="tel"
                          value={alternateNumbers[0]}
                          onChange={(e) => {
                            const newNumbers = [...alternateNumbers];
                            newNumbers[0] = e.target.value;
                            setAlternateNumbers(newNumbers);
                          }}
                          onFocus={() => {
                            const newFocused = [...alternateNumberFocused];
                            newFocused[0] = true;
                            setAlternateNumberFocused(newFocused);
                          }}
                          onBlur={() => {
                            const newFocused = [...alternateNumberFocused];
                            newFocused[0] = false;
                            setAlternateNumberFocused(newFocused);
                          }}
                          className={`px-3 pb-1.5 pl-12 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${alternateNumberFocused[0] || alternateNumbers[0].length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${alternateNumberFocused[0] || alternateNumbers[0].length > 0
                            ? "left-12 -top-2 text-xs font-medium bg-white px-1"
                            : "left-12 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={
                            alternateNumberFocused[0] || alternateNumbers[0].length > 0 ? { color: "#239CD2" } : undefined
                          }
                        >
                          Alternate Phone Number (optional)
                        </label>
                      </div>
                    </div>

                    {/* Gender */}
                    <div className="flex flex-col" style={{ gap: "12px", marginLeft: "16px" }}>
                      <span className="text-[13px] text-slate-600 font-medium">Gender</span>
                      <div className="flex items-center text-sm text-slate-700" style={{ gap: "24px" }}>
                        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                          <input
                            type="radio"
                            name="gender"
                            value="Male"
                            defaultChecked
                            onChange={(e) => setGenderValue(e.target.value)}
                            className="h-4 w-4 rounded-full"
                            style={{
                              appearance: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#FFFFFF",
                              outline: "none",
                              boxShadow: "none",
                              accentColor: "#fbbf24",
                            }}
                          />
                          Male
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                          <input
                            type="radio"
                            name="gender"
                            value="Female"
                            onChange={(e) => setGenderValue(e.target.value)}
                            className="h-4 w-4 rounded-full"
                            style={{
                              appearance: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#FFFFFF",
                              outline: "none",
                              boxShadow: "none",
                              accentColor: "#fbbf24",
                            }}
                          />
                          Female
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                          <input
                            type="radio"
                            name="gender"
                            value="Other"
                            onChange={(e) => setGenderValue(e.target.value)}
                            className="h-4 w-4 rounded-full"
                            style={{
                              appearance: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#FFFFFF",
                              outline: "none",
                              boxShadow: "none",
                              accentColor: "#fbbf24",
                            }}
                          />
                          Other
                        </label>
                      </div>
                    </div>

                    {/* Date of Birth / Marital Status */}
                    <div className="flex w-full" style={{ gap: "16px" }}>
                      <div className="relative flex-1">
                        <div
                          className="absolute left-7 top-1/2 -translate-y-1/2 z-10 cursor-pointer flex items-center justify-center"
                          onClick={() => dateInputRef.current?.showPicker()}
                        >
                          <Image src="/calendar_icon.png" alt="Calendar" width={16} height={16} className="h-4 w-4" />
                        </div>
                        <input
                          ref={dateInputRef}
                          type="date"
                          value={dobValue}
                          onChange={(e) => setDobValue(e.target.value)}
                          onFocus={() => setDobFocused(true)}
                          onBlur={() => setDobFocused(false)}
                          onClick={() => dateInputRef.current?.showPicker()}
                          className={`px-3 pb-1.5 pl-14 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${dobFocused || dobValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                            color: dobValue ? "#1e293b" : "transparent",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${dobFocused || dobValue.length > 0
                            ? "left-14 -top-2 text-xs font-medium bg-white px-1"
                            : "left-14 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={dobFocused || dobValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Date of Birth
                        </label>
                      </div>
                      <div className="relative flex-1">
                        <select
                          value={maritalStatusValue}
                          onChange={(e) => setMaritalStatusValue(e.target.value)}
                          onFocus={() => setMaritalStatusFocused(true)}
                          onBlur={() => setMaritalStatusFocused(false)}
                          className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${maritalStatusFocused || maritalStatusValue.length > 0 ? "pt-4" : "py-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                            appearance: "none",
                            backgroundImage:
                              maritalStatusValue.length > 0
                                ? "none"
                                : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2399A1AF' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 12px center",
                            paddingRight: "32px",
                          }}
                        >
                          <option value="" disabled hidden></option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${maritalStatusFocused || maritalStatusValue.length > 0
                            ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-6 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={maritalStatusFocused || maritalStatusValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Marital Status
                        </label>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="relative w-full">
                      <div className="absolute left-7 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                        <Image src="/location_icon.png" alt="Location" width={16} height={16} className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={addressValue}
                        onChange={(e) => setAddressValue(e.target.value)}
                        onFocus={() => setAddressFocused(true)}
                        onBlur={() => setAddressFocused(false)}
                        className={`px-3 pb-1.5 pl-14 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${addressFocused || addressValue.length > 0 ? "pt-4" : "pt-2.5"
                          }`}
                        style={{
                          width: "calc(100% - 24px)",
                          marginLeft: "12px",
                          marginRight: "12px",
                          height: "67px",
                          borderRadius: "8px",
                          border: "1px solid #F3F4F6",
                          backgroundColor: "#F9FAFB",
                          boxShadow: undefined,
                        }}
                      />
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${addressFocused || addressValue.length > 0
                          ? "left-14 -top-2.5 text-xs font-medium bg-white px-1"
                          : "left-14 top-1/2 -translate-y-1/2 text-sm"
                          }`}
                        style={addressFocused || addressValue.length > 0 ? { color: "#239CD2" } : undefined}
                      >
                        Address
                      </label>
                    </div>

                    {/* City / Country */}
                    <div className="flex w-full" style={{ gap: "16px" }}>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={cityValue}
                          onChange={(e) => setCityValue(e.target.value)}
                          onFocus={() => setCityFocused(true)}
                          onBlur={() => setCityFocused(false)}
                          className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${cityFocused || cityValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                            boxShadow: undefined,
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${cityFocused || cityValue.length > 0
                            ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-6 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={cityFocused || cityValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          City
                        </label>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={countryValue}
                          onChange={(e) => setCountryValue(e.target.value)}
                          onFocus={() => setCountryFocused(true)}
                          onBlur={() => setCountryFocused(false)}
                          className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${countryFocused || countryValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${countryFocused || countryValue.length > 0
                            ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-6 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={countryFocused || countryValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Country
                        </label>
                      </div>
                    </div>

                    {/* Nationality / Passport */}
                    <div className="flex w-full" style={{ gap: "16px" }}>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={nationalityValue}
                          onChange={(e) => setNationalityValue(e.target.value)}
                          onFocus={() => setNationalityFocused(true)}
                          onBlur={() => setNationalityFocused(false)}
                          className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${nationalityFocused || nationalityValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                            boxShadow: undefined,
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${nationalityFocused || nationalityValue.length > 0
                            ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-6 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={nationalityFocused || nationalityValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Nationality
                        </label>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={passportValue}
                          onChange={(e) => setPassportValue(e.target.value)}
                          onFocus={() => setPassportFocused(true)}
                          onBlur={() => setPassportFocused(false)}
                          className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${passportFocused || passportValue.length > 0 ? "pt-4" : "pt-2.5"
                            }`}
                          style={{
                            width: "calc(100% - 24px)",
                            marginLeft: "12px",
                            marginRight: "12px",
                            height: "42px",
                            borderRadius: "8px",
                            border: "1px solid #F3F4F6",
                            backgroundColor: "#F9FAFB",
                            boxShadow: undefined,
                          }}
                        />
                        <label
                          className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${passportFocused || passportValue.length > 0
                            ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                            : "left-6 top-1/2 -translate-y-1/2 text-sm"
                            }`}
                          style={passportFocused || passportValue.length > 0 ? { color: "#239CD2" } : undefined}
                        >
                          Passport Number (Optional)
                        </label>
                      </div>
                    </div>

                    {/* LinkedIn */}
                    <div className="relative w-full">
                      <input
                        type="url"
                        value={linkedinValue}
                        onChange={(e) => setLinkedinValue(e.target.value)}
                        onFocus={() => setLinkedinFocused(true)}
                        onBlur={() => setLinkedinFocused(false)}
                        className={`px-3 pb-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${linkedinFocused || linkedinValue.length > 0 ? "pt-4" : "pt-2.5"
                          }`}
                        style={{
                          width: "calc(100% - 24px)",
                          marginLeft: "12px",
                          marginRight: "12px",
                          height: "42px",
                          borderRadius: "8px",
                          border: "1px solid #F3F4F6",
                          backgroundColor: "#F9FAFB",
                          boxShadow: undefined,
                        }}
                      />
                      <label
                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${linkedinFocused || linkedinValue.length > 0
                          ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                          : "left-6 top-1/2 -translate-y-1/2 text-sm"
                          }`}
                        style={linkedinFocused || linkedinValue.length > 0 ? { color: "#239CD2" } : undefined}
                      >
                        LinkedIn Profile URL
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3" style={{ marginRight: "48px", marginBottom: "0px", marginTop: "0px", paddingBottom: "0px" }}>
                      <button
                        type="button"
                        className="transition"
                        style={{
                          width: "181.53px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FFFFFF",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          borderColor: "#239CD2",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "500",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#239CD2",
                        }}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="text-white transition hover:opacity-90"
                        style={{
                          width: "161px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FF8C00",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "700",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#FFFFFF",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Educational Details Form */}
                  <div
                    className={`form-slide ${activeForm === 'education' ? 'active' : prevForm === 'education' ? 'inactive' : ''}`}
                    style={{
                      position: 'absolute',
                      top: '0px',
                      left: '0px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      height: 'fit-content',
                      minHeight: '100%',
                      gap: '0px',
                      paddingRight: '12px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                      marginTop: '0px',
                      opacity: activeForm === 'education' ? 1 : 0,
                      pointerEvents: activeForm === 'education' ? 'auto' : 'none',
                      zIndex: activeForm === 'education' ? 10 : 0,
                    }}
                  >
                    <div className="flex items-center sticky bg-white z-20" style={{ top: '0px', marginTop: '0px', paddingTop: '0px', marginBottom: '20px', paddingBottom: '0px' }}>
                      <h2
                        className="font-medium text-slate-900"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "32.12px",
                          lineHeight: "40.2px",
                          letterSpacing: "0%",
                        }}
                      >
                        Educational Details
                      </h2>
                    </div>
                    <div
                      className="glassy-badge"
                      style={{
                        position: 'absolute',
                        top: '0px',
                        right: '12px',
                        padding: "1.5px",
                        borderRadius: "16px",
                        background: "linear-gradient(to right, #0EA5E9, #FF8C00)",
                        display: "inline-block",
                        boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        zIndex: 30,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0EA5E9",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          backgroundColor: "#FFFFFF",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        Auto-filled by AI
                      </div>
                    </div>

                    {/* Education Entries */}
                    {educations.map((edu, index) => (
                      <div key={edu.id} className="w-full" style={{ width: "100%", marginBottom: "21px" }}>
                        {/* Education Header */}
                        <div className="flex w-full items-center justify-between mb-4">
                          <h3
                            className="font-semibold text-slate-900"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: "18px",
                              lineHeight: "1.5",
                            }}
                          >
                            Education {index + 1}
                          </h3>
                          {educations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteEducation(edu.id)}
                              className="text-red-500 hover:text-red-700"
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
                          )}
                        </div>

                        {/* Degree */}
                        <div className="relative" style={{ marginBottom: "21px" }}>
                          <div className="relative">
                            <input
                              type="text"
                              list={`degree-list-${edu.id}`}
                              value={degreeValue[edu.id] || edu.degree}
                              onChange={(event) => {
                                setDegreeValue({ ...degreeValue, [edu.id]: event.target.value });
                                setEducations((prev) =>
                                  prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, degree: event.target.value } : eduItem))
                                );
                              }}
                              onFocus={() => setDegreeFocused({ ...degreeFocused, [edu.id]: true })}
                              onBlur={() => setDegreeFocused({ ...degreeFocused, [edu.id]: false })}
                              className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree) ? "pt-5" : "pt-3"
                                }`}
                              style={{
                                width: "calc(100% - 24px)",
                                marginLeft: "12px",
                                marginRight: "12px",
                                height: "42px",
                                borderRadius: "8px",
                                border: "1px solid #F3F4F6",
                                backgroundColor: "#F9FAFB",
                                boxShadow: undefined,
                              }}
                            />
                            <datalist id={`degree-list-${edu.id}`}>
                              {degreeOptions.map((degree) => (
                                <option key={degree} value={degree} />
                              ))}
                            </datalist>
                            <label
                              className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree)
                                ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                }`}
                              style={
                                degreeFocused[edu.id] || (degreeValue[edu.id] || edu.degree)
                                  ? { color: "#239CD2" }
                                  : undefined
                              }
                            >
                              Degree
                            </label>
                          </div>
                        </div>

                        {/* Institution */}
                        <div className="relative" style={{ marginBottom: "21px" }}>
                          <div className="relative">
                            <input
                              type="text"
                              list={`institution-list-${edu.id}`}
                              value={institutionValue[edu.id] || edu.institution}
                              onChange={(event) => {
                                setInstitutionValue({ ...institutionValue, [edu.id]: event.target.value });
                                setEducations((prev) =>
                                  prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, institution: event.target.value } : eduItem))
                                );
                              }}
                              onFocus={() => setInstitutionFocused({ ...institutionFocused, [edu.id]: true })}
                              onBlur={() => setInstitutionFocused({ ...institutionFocused, [edu.id]: false })}
                              className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution) ? "pt-5" : "pt-3"
                                }`}
                              style={{
                                width: "calc(100% - 24px)",
                                marginLeft: "12px",
                                marginRight: "12px",
                                height: "42px",
                                borderRadius: "8px",
                                border: "1px solid #F3F4F6",
                                backgroundColor: "#F9FAFB",
                                boxShadow: undefined,
                              }}
                            />
                            <datalist id={`institution-list-${edu.id}`}>
                              {institutionOptions.map((institution) => (
                                <option key={institution} value={institution} />
                              ))}
                            </datalist>
                            <label
                              className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution)
                                ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                }`}
                              style={
                                institutionFocused[edu.id] || (institutionValue[edu.id] || edu.institution)
                                  ? { color: "#239CD2" }
                                  : undefined
                              }
                            >
                              Institution
                            </label>
                          </div>
                        </div>

                        {/* Specialization */}
                        <div className="relative" style={{ marginBottom: "21px" }}>
                          <div className="relative">
                            <input
                              type="text"
                              list={`specialization-list-${edu.id}`}
                              value={specializationValue[edu.id] || edu.specialization}
                              onChange={(event) => {
                                setSpecializationValue({ ...specializationValue, [edu.id]: event.target.value });
                                setEducations((prev) =>
                                  prev.map((eduItem) => (eduItem.id === edu.id ? { ...eduItem, specialization: event.target.value } : eduItem))
                                );
                              }}
                              onFocus={() => setSpecializationFocused({ ...specializationFocused, [edu.id]: true })}
                              onBlur={() => setSpecializationFocused({ ...specializationFocused, [edu.id]: false })}
                              className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization) ? "pt-5" : "pt-3"
                                }`}
                              style={{
                                width: "calc(100% - 24px)",
                                marginLeft: "12px",
                                marginRight: "12px",
                                height: "42px",
                                borderRadius: "8px",
                                border: "1px solid #F3F4F6",
                                backgroundColor: "#F9FAFB",
                                boxShadow: undefined,
                              }}
                            />
                            <datalist id={`specialization-list-${edu.id}`}>
                              {specializationOptions.map((specialization) => (
                                <option key={specialization} value={specialization} />
                              ))}
                            </datalist>
                            <label
                              className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization)
                                ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                }`}
                              style={
                                specializationFocused[edu.id] || (specializationValue[edu.id] || edu.specialization)
                                  ? { color: "#239CD2" }
                                  : undefined
                              }
                            >
                              Specialization
                            </label>
                          </div>
                        </div>

                        {/* Start Year and End Year Row */}
                        <div className="flex items-center" style={{ gap: "23px", marginBottom: "21px" }}>
                          <div className="relative" style={{ flex: 1 }}>
                            <div className="relative">
                              <div
                                className="absolute left-7 top-1/2 -translate-y-1/2 z-10 cursor-pointer flex items-center justify-center"
                                onClick={() => startYearInputRefs.current[edu.id]?.showPicker()}
                              >
                                <Image src="/calendar_icon.png" alt="Calendar" width={16} height={16} className="h-4 w-4" />
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
                                className={`px-4 pb-2 pl-14 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear) ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "calc(100% - 24px)",
                                  marginLeft: "12px",
                                  marginRight: "12px",
                                  height: "42px",
                                  borderRadius: "8px",
                                  border: "1px solid #F3F4F6",
                                  backgroundColor: "#F9FAFB",
                                  color: startYearValue[edu.id] || edu.startYear ? "#1e293b" : "transparent",
                                  boxShadow: undefined,
                                }}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear)
                                  ? "left-14 -top-2.5 text-xs font-medium bg-white px-1"
                                  : "left-14 top-1/2 -translate-y-1/2 text-sm"
                                  }`}
                                style={
                                  startYearFocused[edu.id] || (startYearValue[edu.id] || edu.startYear)
                                    ? { color: "#239CD2" }
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
                                className="absolute left-7 top-1/2 -translate-y-1/2 z-10 cursor-pointer flex items-center justify-center"
                                onClick={() => endYearInputRefs.current[edu.id]?.showPicker()}
                              >
                                <Image src="/calendar_icon.png" alt="Calendar" width={16} height={16} className="h-4 w-4" />
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
                                className={`px-4 pb-2 pl-14 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear) ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "calc(100% - 24px)",
                                  marginLeft: "12px",
                                  marginRight: "12px",
                                  height: "42px",
                                  borderRadius: "8px",
                                  border: "1px solid #F3F4F6",
                                  backgroundColor: "#F9FAFB",
                                  color: endYearValue[edu.id] || edu.endYear ? "#1e293b" : "transparent",
                                  boxShadow: undefined,
                                }}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear)
                                  ? "left-14 -top-2.5 text-xs font-medium bg-white px-1"
                                  : "left-14 top-1/2 -translate-y-1/2 text-sm"
                                  }`}
                                style={
                                  endYearFocused[edu.id] || (endYearValue[edu.id] || edu.endYear)
                                    ? { color: "#239CD2" }
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

                    {/* Actions */}
                    <div className="flex justify-end gap-3 items-center" style={{ marginRight: "48px", marginTop: "26px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }}>
                      <button
                        type="button"
                        onClick={addEducation}
                        className="flex items-center justify-center transition hover:opacity-70 px-2"
                        title="Add More Education"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 6V18M6 12H18" stroke="#239CD2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrevForm(activeForm);
                          setTimeout(() => setActiveForm('personal'), 50);
                        }}
                        className="transition"
                        style={{
                          width: "181.53px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FFFFFF",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          borderColor: "#239CD2",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "500",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#239CD2",
                        }}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="text-white transition hover:opacity-90"
                        style={{
                          width: "161px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FF8C00",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "700",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#FFFFFF",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Skills Form */}
                  <div
                    className={`form-slide ${activeForm === 'skills' ? 'active' : prevForm === 'skills' ? 'inactive' : ''}`}
                    style={{
                      position: 'absolute',
                      top: '0px',
                      left: '0px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      height: 'fit-content',
                      minHeight: '100%',
                      gap: '26px',
                      paddingRight: '12px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                      marginTop: '0px',
                      opacity: activeForm === 'skills' ? 1 : 0,
                      pointerEvents: activeForm === 'skills' ? 'auto' : 'none',
                      zIndex: activeForm === 'skills' ? 10 : 0,
                    }}
                  >
                    <div className="flex items-center sticky bg-white z-20" style={{ top: '0px', marginTop: '0px', paddingTop: '0px', marginBottom: '20px', paddingBottom: '0px' }}>
                      <h2
                        className="font-medium text-slate-900"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "32.12px",
                          lineHeight: "40.2px",
                          letterSpacing: "0%",
                        }}
                      >
                        Manage Your Skills
                      </h2>
                    </div>
                    <div
                      className="glassy-badge"
                      style={{
                        position: 'absolute',
                        top: '0px',
                        right: '12px',
                        padding: "1.5px",
                        borderRadius: "16px",
                        background: "linear-gradient(to right, #0EA5E9, #FF8C00)",
                        display: "inline-block",
                        boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        zIndex: 30,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0EA5E9",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          backgroundColor: "#FFFFFF",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        Auto-filled by AI
                      </div>
                    </div>

                    {/* Your Skills Section */}
                    <div className="w-full">
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
                            className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${skillInputFocused || skillInput.length > 0 ? "pt-5" : "pt-3"
                              }`}
                            style={{
                              width: "calc(100% - 24px)",
                              marginLeft: "12px",
                              marginRight: "12px",
                              height: "42px",
                              borderRadius: "8px",
                              border: "1px solid #F3F4F6",
                              backgroundColor: "#F9FAFB",
                              boxShadow: undefined,
                            }}
                          />
                          <label
                            className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${skillInputFocused || skillInput.length > 0
                              ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                              : "left-6 top-1/2 -translate-y-1/2 text-sm"
                              }`}
                            style={
                              skillInputFocused || skillInput.length > 0
                                ? { color: "#239CD2" }
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
                            height: "42px",
                            borderRadius: "8px",
                            minWidth: "82px",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "16px",
                          }}
                        >
                          Add
                        </button>
                      </div>

                      {/* Skills List */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {userSkills.length > 0 ? (
                          userSkills.map((skill) => (
                            <div
                              key={skill}
                              className="flex items-center gap-2 rounded-full border bg-[#F3F4F6] px-4 py-2 font-medium"
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
                          ))
                        ) : (
                          <p className="text-sm text-slate-500 italic">No skills added yet. Skills extracted from your CV will appear here.</p>
                        )}
                      </div>
                    </div>

                    {/* AI Suggested Skills Section - Only show if there are AI suggested skills */}
                    {aiSuggestedSkills.length > 0 && (
                      <div className="w-full" style={{ marginTop: "16px" }}>
                        <h3
                          className="mb-3 font-semibold text-slate-900"
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: "18px",
                            lineHeight: "1.5",
                          }}
                        >
                          AI Suggested Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestedSkills
                            .filter((skill) => !userSkills.includes(skill))
                            .map((skill) => (
                              <div
                                key={skill}
                                className="flex items-center gap-2 rounded-full border border-slate-200 bg-[#F3F4F6] px-4 py-2 font-medium text-slate-700"
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
                    )}

                    {/* Languages Known Section */}
                    <div className="w-full" style={{ marginTop: "32px" }}>
                      <LanguageProficiencyTable
                        entries={languageEntries}
                        onAddEntry={addLanguageEntry}
                        onRemoveEntry={removeLanguageEntry}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3" style={{ marginRight: "48px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPrevForm(activeForm);
                          setTimeout(() => setActiveForm('education'), 50);
                        }}
                        className="transition"
                        style={{
                          width: "181.53px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FFFFFF",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          borderColor: "#239CD2",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "500",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#239CD2",
                        }}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="text-white transition hover:opacity-90"
                        style={{
                          width: "161px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FF8C00",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "700",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#FFFFFF",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Work Experience Form */}
                  <div
                    className={`form-slide ${activeForm === 'work-exp' ? 'active' : prevForm === 'work-exp' ? 'inactive' : ''}`}
                    style={{
                      position: 'absolute',
                      top: '0px',
                      left: '0px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      height: 'fit-content',
                      minHeight: '100%',
                      gap: '26px',
                      paddingRight: '12px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                      marginTop: '0px',
                      opacity: activeForm === 'work-exp' ? 1 : 0,
                      pointerEvents: activeForm === 'work-exp' ? 'auto' : 'none',
                      zIndex: activeForm === 'work-exp' ? 10 : 0,
                    }}
                  >
                    <div className="flex items-center sticky bg-white z-20" style={{ top: '0px', marginTop: '0px', paddingTop: '0px', marginBottom: '20px', paddingBottom: '0px' }}>
                      <h2
                        className="font-medium text-slate-900"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "32.12px",
                          lineHeight: "40.2px",
                          letterSpacing: "0%",
                        }}
                      >
                        Work Experience
                      </h2>
                    </div>
                    <div
                      className="glassy-badge"
                      style={{
                        position: 'absolute',
                        top: '0px',
                        right: '12px',
                        padding: "1.5px",
                        borderRadius: "16px",
                        background: "linear-gradient(to right, #0EA5E9, #FF8C00)",
                        display: "inline-block",
                        boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        zIndex: 30,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0EA5E9",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          backgroundColor: "#FFFFFF",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        Auto-filled by AI
                      </div>
                    </div>

                    {/* Work Experience Entries */}
                    {experiences.map((exp) => (
                      <div
                        key={exp.id}
                        className="w-full"
                        style={{ marginBottom: "21px" }}
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
                              {exp.jobTitle || "Job Title"}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                            <p
                                className="text-slate-600"
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "14px",
                              }}
                              >
                                {exp.company || "Company Name"}
                              </p>
                              <span className="text-slate-400">•</span>
                              <p
                                className="text-slate-500"
                                style={{
                                  fontFamily: "Inter, sans-serif",
                                  fontSize: "13px",
                                }}
                            >
                              {exp.startDate ? formatDate(exp.startDate) : "Start Date"} -{" "}
                              {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "End Date"}
                            </p>
                            </div>
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
                                <input
                                  type="text"
                                  value={jobTitleValue[exp.id] || exp.jobTitle}
                                  onChange={(event) => {
                                    const newValue = event.target.value;
                                    setJobTitleValue({ ...jobTitleValue, [exp.id]: newValue });
                                    setExperiences((prev) =>
                                      prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, jobTitle: newValue } : expItem))
                                    );
                                  }}
                                  onFocus={() => setJobTitleFocused({ ...jobTitleFocused, [exp.id]: true })}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setJobTitleFocused((prev) => ({ ...prev, [exp.id]: false }));
                                    }, 200);
                                  }}
                                  className={`px-4 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle) ? "pt-5 pb-1" : "pt-3 pb-3"
                                    }`}
                                  style={{
                                    width: "calc(100% - 24px)",
                                    marginLeft: "12px",
                                    marginRight: "12px",
                                    height: "42px",
                                    borderRadius: "8px",
                                    border: "1px solid #F3F4F6",
                                    backgroundColor: "#F9FAFB",
                                    lineHeight: "1.5",
                                  }}
                                />
                                <label
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle)
                                    ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                    : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                    }`}
                                  style={
                                    jobTitleFocused[exp.id] || (jobTitleValue[exp.id] || exp.jobTitle)
                                      ? { color: "#239CD2" }
                                      : undefined
                                  }
                                >
                                  Job Title
                                </label>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
                                {/* Suggestions Dropdown */}
                                {jobTitleFocused[exp.id] && (
                                  <div className="absolute w-[calc(100%-24px)] ml-[12px] bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto mt-1" style={{ scrollbarWidth: 'none', zIndex: 100 }}>
                                    {jobTitles
                                      .filter(t => t.toLowerCase().includes((jobTitleValue[exp.id] || exp.jobTitle || "").toLowerCase()))
                                      .map((title) => (
                                        <div
                                          key={title}
                                          className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setJobTitleValue({ ...jobTitleValue, [exp.id]: title });
                                            setExperiences((prev) =>
                                              prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, jobTitle: title } : expItem))
                                            );
                                            setJobTitleFocused((prev) => ({ ...prev, [exp.id]: false }));
                                          }}
                                        >
                                          {title}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Company */}
                            <div className="relative">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={companyValue[exp.id] || exp.company}
                                  onChange={(event) => {
                                    const newValue = event.target.value;
                                    setCompanyValue({ ...companyValue, [exp.id]: newValue });
                                    setExperiences((prev) =>
                                      prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, company: newValue } : expItem))
                                    );
                                  }}
                                  onFocus={() => setCompanyFocused({ ...companyFocused, [exp.id]: true })}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setCompanyFocused((prev) => ({ ...prev, [exp.id]: false }));
                                    }, 200);
                                  }}
                                  className={`px-4 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${companyFocused[exp.id] || (companyValue[exp.id] || exp.company) ? "pt-5 pb-1" : "pt-3 pb-3"
                                    }`}
                                  style={{
                                    width: "calc(100% - 24px)",
                                    marginLeft: "12px",
                                    marginRight: "12px",
                                    height: "42px",
                                    borderRadius: "8px",
                                    border: "1px solid #F3F4F6",
                                    backgroundColor: "#F9FAFB",
                                    lineHeight: "1.5",
                                  }}
                                />
                                <label
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${companyFocused[exp.id] || (companyValue[exp.id] || exp.company)
                                    ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                    : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                    }`}
                                  style={
                                    companyFocused[exp.id] || (companyValue[exp.id] || exp.company)
                                      ? { color: "#239CD2" }
                                      : undefined
                                  }
                                >
                                  Company
                                </label>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
                                {/* Suggestions Dropdown */}
                                {companyFocused[exp.id] && (
                                  <div className="absolute w-[calc(100%-24px)] ml-[12px] bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto mt-1" style={{ scrollbarWidth: 'none', zIndex: 100 }}>
                                    {companies
                                      .filter(c => c.toLowerCase().includes((companyValue[exp.id] || exp.company || "").toLowerCase()))
                                      .map((company) => (
                                        <div
                                          key={company}
                                          className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setCompanyValue({ ...companyValue, [exp.id]: company });
                                            setExperiences((prev) =>
                                              prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, company: company } : expItem))
                                            );
                                            setCompanyFocused((prev) => ({ ...prev, [exp.id]: false }));
                                          }}
                                        >
                                          {company}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Work Location */}
                            <div className="relative">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={workLocationValue[exp.id] || exp.workLocation}
                                  onChange={(event) => {
                                    const newValue = event.target.value;
                                    setWorkLocationValue({ ...workLocationValue, [exp.id]: newValue });
                                    setExperiences((prev) =>
                                      prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, workLocation: newValue } : expItem))
                                    );
                                  }}
                                  onFocus={() => setWorkLocationFocused({ ...workLocationFocused, [exp.id]: true })}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setWorkLocationFocused((prev) => ({ ...prev, [exp.id]: false }));
                                    }, 200);
                                  }}
                                  className={`px-4 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation) ? "pt-5 pb-1" : "pt-3 pb-3"
                                    }`}
                                  style={{
                                    width: "calc(100% - 24px)",
                                    marginLeft: "12px",
                                    marginRight: "12px",
                                    height: "42px",
                                    borderRadius: "8px",
                                    border: "1px solid #F3F4F6",
                                    backgroundColor: "#F9FAFB",
                                    lineHeight: "1.5",
                                  }}
                                />
                                <label
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation)
                                    ? "left-6 -top-2.5 text-xs font-medium bg-white px-1"
                                    : "left-6 top-1/2 -translate-y-1/2 text-sm"
                                    }`}
                                  style={
                                    workLocationFocused[exp.id] || (workLocationValue[exp.id] || exp.workLocation)
                                      ? { color: "#239CD2" }
                                      : undefined
                                  }
                                >
                                  Work Location
                                </label>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
                                {/* Suggestions Dropdown */}
                                {workLocationFocused[exp.id] && (
                                  <div className="absolute w-[calc(100%-24px)] ml-[12px] bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto mt-1" style={{ scrollbarWidth: 'none', zIndex: 100 }}>
                                    {workLocations
                                      .filter(l => l.toLowerCase().includes((workLocationValue[exp.id] || exp.workLocation || "").toLowerCase()))
                                      .map((location) => (
                                        <div
                                          key={location}
                                          className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setWorkLocationValue({ ...workLocationValue, [exp.id]: location });
                                            setExperiences((prev) =>
                                              prev.map((expItem) => (expItem.id === exp.id ? { ...expItem, workLocation: location } : expItem))
                                            );
                                            setWorkLocationFocused((prev) => ({ ...prev, [exp.id]: false }));
                                          }}
                                        >
                                          {location}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Start Date and End Date Row */}
                            <div className="flex items-center" style={{ gap: "24px" }}>
                              <div className="relative" style={{ flex: 1 }}>
                                <div className="relative">
                                  <div
                                    className="absolute left-7 top-1/2 -translate-y-1/2 z-10 cursor-pointer flex items-center justify-center"
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
                                    className={`px-4 pl-14 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate) ? "pt-4 pb-1" : "pt-3 pb-1"
                                      }`}
                                    style={{
                                      width: "calc(100% - 24px)",
                                      marginLeft: "12px",
                                      marginRight: "12px",
                                      height: "42px",
                                      borderRadius: "8px",
                                      border: "1px solid #F3F4F6",
                                      backgroundColor: "#F9FAFB",
                                      color: startDateValue[exp.id] || exp.startDate ? "#1e293b" : "transparent",
                                      boxShadow: undefined,
                                      lineHeight: "1.5",
                                    }}
                                  />
                                  <label
                                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate)
                                      ? "left-14 -top-2.5 text-xs font-medium bg-white px-1"
                                      : "left-14 top-1/2 -translate-y-1/2 text-sm"
                                      }`}
                                    style={
                                      startDateFocused[exp.id] || (startDateValue[exp.id] || exp.startDate)
                                        ? { color: "#239CD2" }
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
                                    className="absolute left-7 top-1/2 -translate-y-1/2 z-10 cursor-pointer flex items-center justify-center"
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
                                    className={`px-4 pl-14 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate) ? "pt-4 pb-1" : "pt-3 pb-1"
                                      } ${exp.isCurrent ? "opacity-50 cursor-not-allowed" : ""}`}
                                    style={{
                                      width: "calc(100% - 24px)",
                                      marginLeft: "12px",
                                      marginRight: "12px",
                                      height: "42px",
                                      borderRadius: "8px",
                                      border: "1px solid #F3F4F6",
                                      backgroundColor: "#F9FAFB",
                                      color: endDateValue[exp.id] || exp.endDate ? "#1e293b" : "transparent",
                                      boxShadow: undefined,
                                      lineHeight: "1.5",
                                    }}
                                  />
                                  <label
                                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate)
                                      ? "left-14 -top-2.5 text-xs font-medium bg-white px-1"
                                      : "left-14 top-1/2 -translate-y-1/2 text-sm"
                                      }`}
                                    style={
                                      endDateFocused[exp.id] || (endDateValue[exp.id] || exp.endDate)
                                        ? { color: "#239CD2" }
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
                                    width: "calc(100% - 24px)",
                                    marginLeft: "12px",
                                    marginRight: "12px",
                                    minHeight: "100px",
                                    borderRadius: "8px",
                                    border: "1px solid #F3F4F6",
                                    backgroundColor: "#F9FAFB",
                                    boxShadow: undefined,
                                  }}
                                />
                                <label
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${responsibilitiesFocused[exp.id] || (responsibilitiesValue[exp.id] || exp.responsibilities)
                                    ? "left-6 top-1.5 text-xs font-medium bg-white px-1"
                                    : "left-6 top-4 text-sm"
                                    }`}
                                  style={
                                    responsibilitiesFocused[exp.id] || (responsibilitiesValue[exp.id] || exp.responsibilities)
                                      ? { color: "#239CD2" }
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

                    {/* Actions */}
                    <div className="flex justify-end gap-3 items-center" style={{ marginRight: "48px", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }}>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="flex items-center justify-center transition hover:opacity-70 px-2"
                        title="Add More Experience"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 6V18M6 12H18" stroke="#239CD2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrevForm(activeForm);
                          setTimeout(() => setActiveForm('skills'), 50);
                        }}
                        className="transition"
                        style={{
                          width: "181.53px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FFFFFF",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          borderColor: "#239CD2",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "500",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#239CD2",
                        }}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="text-white transition hover:opacity-90"
                        style={{
                          width: "161px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FF8C00",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "700",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#FFFFFF",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Salary Expectation Form */}
                  <div
                    className={`form-slide ${activeForm === 'salary-exp' ? 'active' : prevForm === 'salary-exp' ? 'inactive' : ''}`}
                    style={{
                      position: 'absolute',
                      top: '0px',
                      left: '0px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      height: 'fit-content',
                      minHeight: '100%',
                      gap: '26px',
                      paddingRight: '12px',
                      paddingTop: '0px',
                      paddingBottom: '0px',
                      marginBottom: '0px',
                      marginTop: '0px',
                      opacity: activeForm === 'salary-exp' ? 1 : 0,
                      pointerEvents: activeForm === 'salary-exp' ? 'auto' : 'none',
                      zIndex: activeForm === 'salary-exp' ? 10 : 0,
                    }}
                  >
                    <div className="flex items-center sticky bg-white z-20" style={{ top: '0px', marginTop: '0px', paddingTop: '0px', marginBottom: '20px', paddingBottom: '0px' }}>
                      <h2
                        className="font-medium text-slate-900"
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "32.12px",
                          lineHeight: "40.2px",
                          letterSpacing: "0%",
                        }}
                      >
                        Career Preferences
                      </h2>
                    </div>
                    <div
                      className="glassy-badge"
                      style={{
                        position: 'absolute',
                        top: '0px',
                        right: '12px',
                        padding: "1.5px",
                        borderRadius: "16px",
                        background: "linear-gradient(to right, #0EA5E9, #FF8C00)",
                        display: "inline-block",
                        boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        zIndex: 30,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#0EA5E9",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          backgroundColor: "#FFFFFF",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        Auto-filled by AI
                      </div>
                    </div>

                    {/* Two Column Section: Current Salary and Expected Salary */}
                    <div className="w-full flex items-stretch justify-center" style={{ width: "100%", maxWidth: "1000px", gap: "0px", flex: 1, minHeight: 0 }}>
                      {/* Current Salary Section - Left Column */}
                      <div className="flex-1 pr-6" style={{ maxWidth: "50%" }}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-white z-10 pb-1">Current Package</h3>
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
                                  className={`px-4 pb-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentCurrencyFocused || currentCurrency ? "pt-5" : "pt-3"
                                    }`}
                                  style={{
                                    width: "100%",
                                    ...salaryFieldStyle,
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
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(currentCurrencyFocused, !!currentCurrency)}`}
                                  style={salaryLabelColor(currentCurrencyFocused, !!currentCurrency)}
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
                                  className={`px-4 pb-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentSalaryTypeFocused || currentSalaryType ? "pt-5" : "pt-3"
                                    }`}
                                  style={{
                                    width: "100%",
                                    ...salaryFieldStyle,
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
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(currentSalaryTypeFocused, !!currentSalaryType)}`}
                                  style={salaryLabelColor(currentSalaryTypeFocused, !!currentSalaryType)}
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
                                className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentSalaryFocused || currentSalary ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "100%",
                                  ...salaryFieldStyle,
                                }}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(currentSalaryFocused, !!currentSalary)}`}
                                style={salaryLabelColor(currentSalaryFocused, !!currentSalary)}
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
                                className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${currentLocationFocused || currentLocation ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "100%",
                                  ...salaryFieldStyle,
                                }}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(currentLocationFocused, !!currentLocation)}`}
                                style={salaryLabelColor(currentLocationFocused, !!currentLocation)}
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
                            <div className="space-y-2.5">
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
                                    className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${newBenefit ? "pt-5" : "pt-3"
                                      }`}
                                    style={{
                                      width: "100%",
                                      ...salaryFieldStyle,
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
                                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(!!newBenefit, !!newBenefit)}`}
                                    style={salaryLabelColor(!!newBenefit, !!newBenefit)}
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
                      <div className="w-px bg-gray-300 shrink-0 self-stretch"></div>

                      {/* Expected Salary Section - Right Column */}
                      <div className="flex-1 pl-6" style={{ maxWidth: "50%" }}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-white z-10 pb-1">Preferred Package</h3>
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
                                  className={`px-4 pb-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${expectedCurrencyFocused || expectedCurrency ? "pt-5" : "pt-3"
                                    }`}
                                  style={{
                                    width: "100%",
                                    ...salaryFieldStyle,
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
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(expectedCurrencyFocused, !!expectedCurrency)}`}
                                  style={salaryLabelColor(expectedCurrencyFocused, !!expectedCurrency)}
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
                                  className={`px-4 pb-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${expectedSalaryTypeFocused || expectedSalaryType ? "pt-5" : "pt-3"
                                    }`}
                                  style={{
                                    width: "100%",
                                    ...salaryFieldStyle,
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
                                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(expectedSalaryTypeFocused, !!expectedSalaryType)}`}
                                  style={salaryLabelColor(expectedSalaryTypeFocused, !!expectedSalaryType)}
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
                                className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${preferredSalaryFocused || preferredSalary ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "100%",
                                  ...salaryFieldStyle,
                                }}
                              />
                              <label
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(preferredSalaryFocused, !!preferredSalary)}`}
                                style={salaryLabelColor(preferredSalaryFocused, !!preferredSalary)}
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
                              fieldStyle={salaryFieldStyle}
                              labelFloating={salaryLabelFloating}
                              labelColor={salaryLabelColor}
                              focused={preferredLocationFocused}
                              setFocused={setPreferredLocationFocused}
                              passportNumbersByLocation={passportNumbersByLocation}
                            />

                            {/* Passport Number Input - Show for each selected location */}
                            {selectedPreferredLocations.length > 0 && (
                              <div className="mt-4 space-y-3">
                                {selectedPreferredLocations.map((location) => (
                                  <div key={location} className="relative">
                                      <div className="relative">
                                        <input
                                        type="text"
                                        value={passportNumbersByLocation[location] || ""}
                                          onChange={(e) => {
                                          setPassportNumbersByLocation((prev) => ({
                                            ...prev,
                                            [location]: e.target.value,
                                          }));
                                          }}
                                        onFocus={() => {
                                          setPassportNumberFocused((prev) => ({
                                            ...prev,
                                            [location]: true,
                                          }));
                                        }}
                                          onBlur={() => {
                                          setPassportNumberFocused((prev) => ({
                                            ...prev,
                                            [location]: false,
                                          }));
                                          }}
                                        className={`w-full px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${passportNumberFocused[location] || passportNumbersByLocation[location] ? "pt-5" : "pt-3"
                                            }`}
                                          style={salaryFieldStyle}
                                        placeholder=""
                                        />
                                        <label
                                        className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(passportNumberFocused[location] || false, !!passportNumbersByLocation[location])}`}
                                        style={salaryLabelColor(passportNumberFocused[location] || false, !!passportNumbersByLocation[location])}
                                        >
                                        Passport Number
                                        </label>
                                      </div>
                                      </div>
                                ))}
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
                            fieldStyle={salaryFieldStyle}
                            labelFloating={salaryLabelFloating}
                            labelColor={salaryLabelColor}
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
                                className={`px-4 pb-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${preferredWorkModeFocused || preferredWorkMode ? "pt-5" : "pt-3"
                                  }`}
                                style={{
                                  width: "100%",
                                  ...salaryFieldStyle,
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
                                className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(preferredWorkModeFocused, !!preferredWorkMode)}`}
                                style={salaryLabelColor(preferredWorkModeFocused, !!preferredWorkMode)}
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
                            <div className="space-y-2.5">
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
                                    className={`px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${newBenefit ? "pt-5" : "pt-3"
                                      }`}
                                    style={{
                                      width: "100%",
                                      ...salaryFieldStyle,
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
                                    className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${salaryLabelFloating(!!newBenefit, !!newBenefit)}`}
                                    style={salaryLabelColor(!!newBenefit, !!newBenefit)}
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

                    {/* Actions */}
                    <div className="flex justify-end gap-3" style={{ marginRight: "48px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPrevForm(activeForm);
                          setTimeout(() => setActiveForm('work-exp'), 50);
                        }}
                        className="transition"
                        style={{
                          width: "181.53px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FFFFFF",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          borderColor: "#239CD2",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "500",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#239CD2",
                        }}
                      >
                        Discard Changes
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const saved = await saveProfileData('salary-exp');
                          if (saved) {
                            router.push("/completion-profile");
                          } else {
                            alert('Failed to save changes. Please try again.');
                          }
                        }}
                        className="text-white transition hover:opacity-90"
                        style={{
                          width: "161px",
                          height: "42px",
                          borderRadius: "8px",
                          backgroundColor: "#FF8C00",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: "700",
                          fontSize: "14px",
                          lineHeight: "22px",
                          letterSpacing: "0%",
                          color: "#FFFFFF",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
          {/* End White Card Container */}
        </form>
      </main>

    </div>
  );
}

// LanguageProficiencyTable component
interface LanguageProficiencyTableProps {
  entries: LanguageEntry[];
  onAddEntry: (entry: LanguageEntry) => void;
  onRemoveEntry: (name: string) => void;
}

function LanguageProficiencyTable({
  entries,
  onAddEntry,
  onRemoveEntry,
}: LanguageProficiencyTableProps) {
  const [newName, setNewName] = useState("");
  const [newProficiency, setNewProficiency] = useState("");
  const [newSpeak, setNewSpeak] = useState(false);
  const [newRead, setNewRead] = useState(false);
  const [newWrite, setNewWrite] = useState(false);

  const proficiencyLevels = ["Basic", "Conversational", "Professional", "Fluent"];
  const languages = ["English", "Spanish", "Chinese", "Hindi", "Arabic", "French", "Portuguese", "German", "Japanese", "Russian"];

  const handleAdd = () => {
    if (newName && newProficiency) {
      onAddEntry({
        name: newName,
        proficiency: newProficiency,
        speak: newSpeak,
        read: newRead,
        write: newWrite,
      });
      setNewName("");
      setNewProficiency("");
      setNewSpeak(false);
      setNewRead(false);
      setNewWrite(false);
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ borderCollapse: "separate", borderSpacing: "0 12px" }}>
          <thead>
            <tr className="text-slate-600 font-semibold" style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}>
              <th className="pb-2 px-2">Language Name</th>
              <th className="pb-2 px-2">Proficiency</th>
              <th className="pb-2 px-2 text-center">Speak</th>
              <th className="pb-2 px-2 text-center">Read</th>
              <th className="pb-2 px-2 text-center">Write</th>
              <th className="pb-2 px-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-2">
                <input
                  list="language-suggestions"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Type or select language"
                  className="w-full h-[40px] px-3 rounded-md border border-[#E5E7EB] text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <datalist id="language-suggestions">
                  {languages.map(l => <option key={l} value={l} />)}
                </datalist>
              </td>
              <td className="px-2">
                <select
                  value={newProficiency}
                  onChange={(e) => setNewProficiency(e.target.value)}
                  className="w-full h-[40px] px-3 rounded-md border border-[#E5E7EB] text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="" disabled>Select proficiency level</option>
                  {proficiencyLevels.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td className="px-2 text-center">
                <input
                  type="checkbox"
                  checked={newSpeak}
                  onChange={(e) => setNewSpeak(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  style={{
                    accentColor: "#0EA5E9",
                  }}
                />
              </td>
              <td className="px-2 text-center">
                <input
                  type="checkbox"
                  checked={newRead}
                  onChange={(e) => setNewRead(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  style={{
                    accentColor: "#0EA5E9",
                  }}
                />
              </td>
              <td className="px-2 text-center">
                <input
                  type="checkbox"
                  checked={newWrite}
                  onChange={(e) => setNewWrite(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  style={{
                    accentColor: "#0EA5E9",
                  }}
                />
              </td>
              <td className="px-2 text-center">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newName || !newProficiency}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${newName && newProficiency ? "bg-[#D1D5DB] text-slate-700 hover:bg-slate-300" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  style={{ backgroundColor: newName && newProficiency ? "#E2E8F0" : "#F3F4F6" }}
                >
                  Add
                </button>
              </td>
            </tr>

            {entries.map((entry) => (
              <tr key={entry.name} className="bg-slate-50 border-t border-slate-100">
                <td className="py-3 px-2 text-sm text-slate-900 font-medium">{entry.name}</td>
                <td className="py-3 px-2 text-sm text-slate-600">{entry.proficiency}</td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={entry.speak}
                      readOnly
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 cursor-default"
                      style={{
                        accentColor: "#0EA5E9",
                      }}
                    />
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={entry.read}
                      readOnly
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 cursor-default"
                      style={{
                        accentColor: "#0EA5E9",
                      }}
                    />
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={entry.write}
                      readOnly
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 cursor-default"
                      style={{
                        accentColor: "#0EA5E9",
                      }}
                    />
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveEntry(entry.name)}
                    className="p-1 text-slate-400 hover:text-red-500 transition"
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
                      <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// PreferredLocationFieldBlock component (from salary-expectation page)
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
  fieldStyle: Record<string, string | number>;
  labelFloating: (focused: boolean, hasValue: boolean) => string;
  labelColor: (focused: boolean, hasValue: boolean) => Record<string, string> | undefined;
  focused: boolean;
  setFocused: (val: boolean) => void;
  passportNumbersByLocation: Record<string, string>;
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
  passportNumbersByLocation,
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
          className={`w-full px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${focused || value ? "pt-5" : "pt-3"
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
      <div className="space-y-2">
        {selectedChips.map((chip) => (
            <div key={chip} className="flex items-center gap-2 flex-wrap">
              <div
                className="flex items-center gap-1.5 rounded-full border bg-[#F3F4F6] px-3 py-1 font-medium"
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
            </div>
        ))}
      </div>
    </div>
  );
}

// PreferredRoleFieldBlock component (from salary-expectation page)
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
  fieldStyle: Record<string, string | number>;
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
          className={`w-full px-4 pb-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${focused || value ? "pt-5" : "pt-3"
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
      </div>
    </div>
  );
}
