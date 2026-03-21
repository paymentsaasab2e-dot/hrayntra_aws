'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '../../components/common/Header';
import Footer from '@/components/common/Footer';
import BasicInfoModal, { BasicInfoData } from '../../components/modals/BasicInfoModal';
import SummaryModal from '../../components/modals/SummaryModal';
import GapExplanationModal, { GapExplanationData } from '../../components/modals/GapExplanationModal';
import WorkExperienceModal, { WorkExperienceData } from '../../components/modals/WorkExperienceModal';
import InternshipModal, { InternshipData } from '../../components/modals/InternshipModal';
import EducationModal, { EducationData as EducationEntryData } from '../../components/modals/EducationModal';

// Education data structure for profile page (array of entries)
interface EducationData {
  educations: (EducationEntryData & { documents?: string[] })[];
}
import AcademicAchievementModal, { AcademicAchievementData } from '../../components/modals/AcademicAchievementModal';
import CompetitiveExamsModal, { CompetitiveExamsData } from '../../components/modals/CompetitiveExamsModal';
import SkillsModal, { SkillsData } from '../../components/modals/SkillsModal';
import LanguagesModal, { LanguagesData } from '../../components/modals/LanguagesModal';
import ProjectModal, { ProjectData } from '../../components/modals/ProjectModal';
import PortfolioLinksModal, { PortfolioLinksData } from '../../components/modals/PortfolioLinksModal';
import CertificationModal, { CertificationsData } from '../../components/modals/CertificationModal';
import AccomplishmentModal, { AccomplishmentsData } from '../../components/modals/AccomplishmentModal';
import CareerPreferencesModal, { CareerPreferencesData } from '../../components/modals/CareerPreferencesModal';
import VisaWorkAuthorizationModal, { VisaWorkAuthorizationData } from '../../components/modals/VisaWorkAuthorizationModal';
import VaccinationModal, { VaccinationData } from '../../components/modals/VaccinationModal';
import ResumeModal, { ResumeData as BaseResumeData } from '../../components/modals/ResumeModal';
import { API_BASE_URL } from '@/lib/api-base';

// Extended ResumeData interface for profile page
interface ResumeData extends BaseResumeData {
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  atsScore?: number;
  aiAnalyzed?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [isBasicInfoModalOpen, setIsBasicInfoModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isGapExplanationModalOpen, setIsGapExplanationModalOpen] = useState(false);
  const [isWorkExperienceModalOpen, setIsWorkExperienceModalOpen] = useState(false);
  const [isInternshipModalOpen, setIsInternshipModalOpen] = useState(false);
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [isAcademicAchievementModalOpen, setIsAcademicAchievementModalOpen] = useState(false);
  const [isCompetitiveExamsModalOpen, setIsCompetitiveExamsModalOpen] = useState(false);
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  const [isLanguagesModalOpen, setIsLanguagesModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isPortfolioLinksModalOpen, setIsPortfolioLinksModalOpen] = useState(false);
  const [isCertificationModalOpen, setIsCertificationModalOpen] = useState(false);
  const [isAccomplishmentModalOpen, setIsAccomplishmentModalOpen] = useState(false);
  const [isCareerPreferencesModalOpen, setIsCareerPreferencesModalOpen] = useState(false);
  const [isVisaWorkAuthorizationModalOpen, setIsVisaWorkAuthorizationModalOpen] = useState(false);
  const [isVaccinationModalOpen, setIsVaccinationModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  // Sidebar expansion state
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    'PERSONAL DETAILS': false, // Default to collapsed
    'WORK HISTORY': false,
    'EDUCATION': false,
    'SKILLS': false,
    'PROJECTS': false,
    'CERTIFICATIONS': false,
    'PREFERENCES': false,
    'GLOBAL ELIGIBILITY': false,
    'RESUME': false,
  });

  // Selected sidebar item state
  const [selectedItem, setSelectedItem] = useState<{ category: string; itemName: string } | null>({
    category: 'PERSONAL DETAILS',
    itemName: 'Basic Information'
  });

  // Summary form state
  const [summaryText, setSummaryText] = useState('');

  // Loading state
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Profile completeness state
  const [profileCompleteness, setProfileCompleteness] = useState({
    percentage: 0,
    completedSections: [] as string[],
    missingSections: [] as string[],
  });

  // Data storage for modals - Initialize with empty/undefined to allow auto-population
  const [basicInfoData, setBasicInfoData] = useState<BasicInfoData | undefined>(undefined);
  const [gapExplanationData, setGapExplanationData] = useState<GapExplanationData | undefined>();
  const [workExperienceData, setWorkExperienceData] = useState<WorkExperienceData | undefined>();
  const [internshipData, setInternshipData] = useState<InternshipData | undefined>();
  const [educationData, setEducationData] = useState<EducationData | undefined>();
  const [academicAchievementData, setAcademicAchievementData] = useState<AcademicAchievementData | undefined>();
  const [competitiveExamsData, setCompetitiveExamsData] = useState<CompetitiveExamsData | undefined>();
  const [skillsData, setSkillsData] = useState<SkillsData | undefined>();
  const [languagesData, setLanguagesData] = useState<LanguagesData | undefined>();
  const [projectData, setProjectData] = useState<ProjectData | undefined>();
  const [portfolioLinksData, setPortfolioLinksData] = useState<PortfolioLinksData | undefined>();
  const [certificationsData, setCertificationsData] = useState<CertificationsData | undefined>();
  const [accomplishmentsData, setAccomplishmentsData] = useState<AccomplishmentsData | undefined>();
  const [careerPreferencesData, setCareerPreferencesData] = useState<CareerPreferencesData | undefined>();
  const [visaWorkAuthorizationData, setVisaWorkAuthorizationData] = useState<VisaWorkAuthorizationData | undefined>();
  const [vaccinationData, setVaccinationData] = useState<VaccinationData | undefined>();
  const [resumeData, setResumeData] = useState<ResumeData | undefined>(undefined);
  const [cvAnalysis, setCvAnalysis] = useState<{
    cv_score: number;
    skills_level: string;
    experience_level: string;
    education_level: string;
  } | null>(null);

  // Work experience cards collapse/expand state
  const [expandedWorkExperienceCards, setExpandedWorkExperienceCards] = useState<{ [key: string]: boolean }>({});
  
  // Work experience edit state - track which entry is being edited
  const [editingWorkExperienceId, setEditingWorkExperienceId] = useState<string | null>(null);

  // Education cards collapse/expand state
  const [expandedEducationCards, setExpandedEducationCards] = useState<{ [key: string]: boolean }>({});
  
  // Education edit state - track which entry is being edited
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);

  // Internship card collapse/expand state
  const [isInternshipCardExpanded, setIsInternshipCardExpanded] = useState<boolean>(false);

  // Gap explanation card collapse/expand state
  const [isGapExplanationCardExpanded, setIsGapExplanationCardExpanded] = useState<boolean>(false);

  // Card collapse/expand states for all modals
  const [isProjectCardExpanded, setIsProjectCardExpanded] = useState<boolean>(false);
  const [isAcademicAchievementCardExpanded, setIsAcademicAchievementCardExpanded] = useState<boolean>(false);
  const [isCompetitiveExamCardExpanded, setIsCompetitiveExamCardExpanded] = useState<boolean>(false);
  const [isSkillsCardExpanded, setIsSkillsCardExpanded] = useState<boolean>(false);
  const [isLanguagesCardExpanded, setIsLanguagesCardExpanded] = useState<boolean>(false);
  const [isCertificationCardExpanded, setIsCertificationCardExpanded] = useState<{ [key: string]: boolean }>({});
  const [editingCertificationId, setEditingCertificationId] = useState<string | null>(null);
  const [isAccomplishmentCardExpanded, setIsAccomplishmentCardExpanded] = useState<{ [key: string]: boolean }>({});
  const [editingAccomplishmentId, setEditingAccomplishmentId] = useState<string | null>(null);
  const [isCareerPreferencesCardExpanded, setIsCareerPreferencesCardExpanded] = useState<boolean>(false);
  const [isVisaCardExpanded, setIsVisaCardExpanded] = useState<boolean>(false);
  const [isVaccinationCardExpanded, setIsVaccinationCardExpanded] = useState<boolean>(false);
  const [isResumeCardExpanded, setIsResumeCardExpanded] = useState<boolean>(false);
  const [isPortfolioLinksCardExpanded, setIsPortfolioLinksCardExpanded] = useState<boolean>(false);

  // API base URL

  const isPersistedId = (value?: string) => Boolean(value && /^[a-f\d]{24}$/i.test(value));

  // Helper function to format enum values for display
  const formatEnumValue = (value: string | null | undefined): string => {
    if (!value) return '—';
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getDocumentUrl = (doc: any): string =>
    typeof doc === 'string' ? doc : doc?.url || '';

  const getDocumentName = (doc: any): string => {
    if (typeof doc === 'string') {
      return doc.split('/').pop() || 'Document';
    }
    return doc?.name || doc?.url?.split('/').pop() || 'Document';
  };

  const getApiDocumentHref = (doc: any): string => {
    const url = getDocumentUrl(doc);
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const serializeMaybeFile = (value?: File | string) => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value.name;
  };

  const serializeVisaData = (data: VisaWorkAuthorizationData) => ({
    ...data,
    visaDetailsInitial: data.visaDetailsInitial
      ? {
          ...data.visaDetailsInitial,
          documents: data.visaDetailsInitial.documents?.map((doc) => ({
            ...doc,
            file: serializeMaybeFile(doc.file),
          })) || [],
        }
      : undefined,
    visaDetailsExpected: data.visaDetailsExpected
      ? {
          ...data.visaDetailsExpected,
          documents: data.visaDetailsExpected.documents?.map((doc) => ({
            ...doc,
            file: serializeMaybeFile(doc.file),
          })) || [],
        }
      : undefined,
    visaEntries: data.visaEntries?.map((entry) => ({
      ...entry,
      visaDetails: {
        ...entry.visaDetails,
        documents: entry.visaDetails.documents?.map((doc) => ({
          ...doc,
          file: serializeMaybeFile(doc.file),
        })) || [],
      },
    })) || [],
  });

  const refreshProfileData = async (candidateId: string) => {
    try {
      const url = `${API_BASE_URL}/profile/${candidateId}`;
      console.log('🔄 Fetching profile data from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((fetchError) => {
        console.error('❌ Network error fetching profile:', fetchError);
        console.error('⚠️ Check if backend server is running at:', API_BASE_URL);
        console.error('⚠️ Make sure the backend server is started with: npm start or node server.js');
        // Return null instead of throwing to prevent breaking the save flow
        return null;
      });

      // If fetch failed (network error), return null
      if (!response) {
        console.warn('⚠️ Failed to fetch profile data - network error. Preserving existing state.');
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('❌ Profile fetch error:', errorMessage);
        // Don't throw error, just log it and preserve existing state
        console.warn('⚠️ Failed to refresh profile data, preserving existing state');
        return null;
      }

    const result = await response.json();
    if (!result.success || !result.data) {
      console.warn('⚠️ Invalid profile data response, preserving existing state');
      return null;
    }

    const profileData = result.data;

    // Only update state if data exists in response, otherwise preserve existing state
    if (profileData.personalInfo !== undefined) {
      setBasicInfoData(profileData.personalInfo || undefined);
    }
    // Preserve existing basicInfoData if not in response

    if (profileData.summaryText !== undefined) {
      setSummaryText(profileData.summaryText || '');
    }

    if (profileData.gapExplanation !== undefined) {
      setGapExplanationData(profileData.gapExplanation || undefined);
    }
    // Preserve existing gapExplanationData if not in response

    if (profileData.internship !== undefined) {
      setInternshipData(profileData.internship || undefined);
    }
    // Preserve existing internshipData if not in response

    if (profileData.portfolioLinks !== undefined) {
      setPortfolioLinksData(profileData.portfolioLinks || undefined);
    }
    // Preserve existing portfolioLinksData if not in response

    if (profileData.education !== undefined) {
      if (Array.isArray(profileData.education)) {
        setEducationData({
          educations: profileData.education,
        });
      } else {
        setEducationData(undefined);
      }
    }
    // Preserve existing educationData if not in response

    if (profileData.workExperience !== undefined) {
      if (Array.isArray(profileData.workExperience)) {
        setWorkExperienceData({
          workExperiences: profileData.workExperience,
        });
      } else {
        setWorkExperienceData(undefined);
      }
    }
    // Preserve existing workExperienceData if not in response

    if (profileData.skills !== undefined) {
      if (Array.isArray(profileData.skills)) {
        setSkillsData({
          skills: profileData.skills,
          additionalNotes: profileData.skillsAdditionalNotes || '',
        });
      } else {
        setSkillsData(undefined);
      }
    }
    // Preserve existing skillsData if not in response

    if (profileData.languages !== undefined) {
      if (Array.isArray(profileData.languages)) {
        setLanguagesData({
          languages: profileData.languages,
        });
      } else {
        setLanguagesData(undefined);
      }
    }
    // Preserve existing languagesData if not in response

    if (profileData.resume !== undefined) {
      setResumeData(profileData.resume || undefined);
    }
    // Preserve existing resumeData if not in response

    // Fetch CV Analysis (use the candidateId parameter passed to the function)
    if (candidateId) {
      fetch(`${API_BASE_URL}/cv-analysis/${candidateId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(async (response) => {
          if (response.ok) return response.json();

          if (response.status === 404) {
            await fetch(`${API_BASE_URL}/cv-analysis/analyze`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ candidateId }),
            });

            const retry = await fetch(`${API_BASE_URL}/cv-analysis/${candidateId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            if (retry.ok) return retry.json();
          }
          return null;
        })
        .then((result) => {
          if (result && result.success && result.data) {
            setCvAnalysis(result.data);
          }
        })
        .catch((error) => {
          console.error('Error fetching CV analysis:', error);
        });
    }

    if (profileData.project !== undefined) {
      setProjectData(profileData.project || undefined);
    }
    // Preserve existing projectData if not in response

    if (profileData.academicAchievement !== undefined) {
      setAcademicAchievementData(profileData.academicAchievement || undefined);
    }
    // Preserve existing academicAchievementData if not in response

    if (profileData.competitiveExam !== undefined) {
      setCompetitiveExamsData(profileData.competitiveExam || undefined);
    }
    // Preserve existing competitiveExamsData if not in response

    if (profileData.certifications !== undefined) {
      setCertificationsData(profileData.certifications || undefined);
    }
    // Preserve existing certificationsData if not in response

    if (profileData.accomplishments !== undefined) {
      setAccomplishmentsData(profileData.accomplishments || undefined);
    }
    // Preserve existing accomplishmentsData if not in response

    if (profileData.careerPreferences !== undefined) {
      setCareerPreferencesData(profileData.careerPreferences || undefined);
    }
    // Preserve existing careerPreferencesData if not in response

    if (profileData.visaWorkAuthorization !== undefined) {
      setVisaWorkAuthorizationData(profileData.visaWorkAuthorization || undefined);
    }
    // Preserve existing visaWorkAuthorizationData if not in response

    if (profileData.vaccination !== undefined) {
      setVaccinationData(profileData.vaccination || undefined);
    }
    // Preserve existing vaccinationData if not in response

      return profileData;
    } catch (error) {
      console.error('❌ Error in refreshProfileData:', error);
      // Don't throw error, just log it and preserve existing state
      console.warn('⚠️ Error refreshing profile data, preserving existing state');
      return null;
    }
  };

  // Fetch and populate profile data on component mount
  useEffect(() => {
    const fetchProfileData = async () => {
      const candidateId = sessionStorage.getItem('candidateId');
      if (!candidateId) {
        console.warn('No candidate ID found in session storage');
        setIsLoadingProfile(false);
        return;
      }

      try {
        setIsLoadingProfile(true);
        if (await refreshProfileData(candidateId)) {
          console.log('✅ Profile data loaded from database');
        } else {
          console.error('Failed to fetch profile data');
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, []);

  // Fetch CV Analysis on component mount
  useEffect(() => {
    const fetchCvAnalysis = async () => {
      const candidateId = sessionStorage.getItem('candidateId');
      if (!candidateId) return;

      try {
        let response = await fetch(`${API_BASE_URL}/cv-analysis/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 404) {
          await fetch(`${API_BASE_URL}/cv-analysis/analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ candidateId }),
          });

          response = await fetch(`${API_BASE_URL}/cv-analysis/${candidateId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setCvAnalysis(result.data);
            console.log('✅ CV Analysis loaded:', result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching CV analysis:', error);
      }
    };

    fetchCvAnalysis();
  }, []);

  // Recalculate completeness whenever relevant data changes
  useEffect(() => {
    calculateProfileCompleteness();
  }, [
    basicInfoData,
    summaryText,
    educationData,
    skillsData,
    languagesData,
    projectData,
    portfolioLinksData,
    careerPreferencesData,
    visaWorkAuthorizationData,
    vaccinationData,
    resumeData,
  ]);

  const toggleSection = (category: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Function to open the first missing modal
  const openFirstMissingModal = () => {
    if (profileCompleteness.missingSections.length === 0) {
      // If no missing sections, just scroll to profile
      return;
    }

    const firstMissingSection = profileCompleteness.missingSections[0];
    
    // Map section names to their modal openers
    const modalMap: { [key: string]: () => void } = {
      'Basic Information': () => setIsBasicInfoModalOpen(true),
      'Summary': () => setIsSummaryModalOpen(true),
      'Education': () => setIsEducationModalOpen(true),
      'Skills': () => setIsSkillsModalOpen(true),
      'Languages': () => setIsLanguagesModalOpen(true),
      'Projects': () => setIsProjectModalOpen(true),
      'Portfolio Links': () => setIsPortfolioLinksModalOpen(true),
      'Career Preferences': () => setIsCareerPreferencesModalOpen(true),
      'Visa & Work Authorization': () => setIsVisaWorkAuthorizationModalOpen(true),
      'Vaccination': () => setIsVaccinationModalOpen(true),
      'Resume': () => setIsResumeModalOpen(true),
    };

    // Open the modal for the first missing section
    if (modalMap[firstMissingSection]) {
      modalMap[firstMissingSection]();
    }
  };

  // Calculate profile completeness based on mandatory fields
  const calculateProfileCompleteness = () => {
    const mandatorySections = [
      { key: 'basicInformation', name: 'Basic Information', check: () => basicInfoData && basicInfoData.firstName && basicInfoData.lastName && basicInfoData.email },
      { key: 'summary', name: 'Summary', check: () => summaryText && summaryText.trim().length > 0 },
      { key: 'education', name: 'Education', check: () => educationData && educationData.educations && educationData.educations.length > 0 },
      { key: 'skills', name: 'Skills', check: () => skillsData && skillsData.skills && skillsData.skills.length > 0 },
      { key: 'languages', name: 'Languages', check: () => languagesData && languagesData.languages && languagesData.languages.length > 0 },
      { key: 'projects', name: 'Projects', check: () => Boolean(projectData?.projectTitle?.trim()) },
      { key: 'portfolioLinks', name: 'Portfolio Links', check: () => portfolioLinksData && portfolioLinksData.links && portfolioLinksData.links.length > 0 },
      { key: 'careerPreferences', name: 'Career Preferences', check: () => careerPreferencesData !== undefined && careerPreferencesData !== null },
      { key: 'visaAuthorization', name: 'Visa & Work Authorization', check: () => visaWorkAuthorizationData !== undefined && visaWorkAuthorizationData !== null },
      { key: 'vaccination', name: 'Vaccination', check: () => vaccinationData !== undefined && vaccinationData !== null },
      { key: 'resume', name: 'Resume', check: () => resumeData && resumeData.fileUrl },
    ];

    const completedSections: string[] = [];
    const missingSections: string[] = [];

    mandatorySections.forEach(section => {
      if (section.check()) {
        completedSections.push(section.name);
      } else {
        missingSections.push(section.name);
      }
    });

    const completionPercentage = Math.round((completedSections.length / mandatorySections.length) * 100);

    setProfileCompleteness({
      percentage: completionPercentage,
      completedSections,
      missingSections,
    });

    return { completionPercentage, completedSections, missingSections };
  };

  // Check if a section is mandatory and missing
  const isMandatorySectionMissing = (category: string, itemName: string): boolean => {
    const mandatoryMap: { [key: string]: string[] } = {
      'PERSONAL DETAILS': ['Basic Information', 'Summary'],
      'EDUCATION': ['Education'],
      'SKILLS': ['Skills', 'Languages'],
      'PROJECTS': ['Projects', 'Portfolio Links'],
      'PREFERENCES': ['Career Preferences'],
      'GLOBAL ELIGIBILITY': ['Visa & Work Authorization', 'Vaccination'],
      'RESUME': ['Resume'],
    };

    const mandatoryItems = mandatoryMap[category] || [];
    if (!mandatoryItems.includes(itemName)) {
      return false; // Not a mandatory field
    }

    // Check if the section is actually missing
    if (itemName === 'Basic Information') {
      return !(basicInfoData && basicInfoData.firstName && basicInfoData.lastName && basicInfoData.email);
    }
    if (itemName === 'Summary') {
      return !(summaryText && summaryText.trim().length > 0);
    }
    if (itemName === 'Education') {
      return !(educationData && educationData.educations && educationData.educations.length > 0);
    }
    if (itemName === 'Skills') {
      return !(skillsData && skillsData.skills && skillsData.skills.length > 0);
    }
    if (itemName === 'Languages') {
      return !(languagesData && languagesData.languages && languagesData.languages.length > 0);
    }
    if (itemName === 'Projects') {
      return !projectData?.projectTitle?.trim();
    }
    if (itemName === 'Portfolio Links') {
      return !(portfolioLinksData && portfolioLinksData.links && portfolioLinksData.links.length > 0);
    }
    if (itemName === 'Career Preferences') {
      return !(careerPreferencesData !== undefined && careerPreferencesData !== null);
    }
    if (itemName === 'Visa & Work Authorization') {
      return !(visaWorkAuthorizationData !== undefined && visaWorkAuthorizationData !== null);
    }
    if (itemName === 'Vaccination') {
      return !(vaccinationData !== undefined && vaccinationData !== null);
    }
    if (itemName === 'Resume') {
      return !(resumeData && resumeData.fileUrl);
    }

    return false;
  };

  // Create profile sections with data
  const profileSections = [
    {
      category: 'PERSONAL DETAILS',
      items: [
        {
          name: 'Basic Information',
          status: 'Completed',
          hasInfo: true,
          data: basicInfoData || {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '123-456-7890',
            city: 'New York',
            country: 'United States'
          }
        },
        {
          name: 'Summary',
          status: summaryText ? 'Partially Completed' : 'Missing Info',
          hasInfo: !!summaryText || true, // Always show as hasInfo since we have default text
          data: summaryText || 'No summary added yet.'
        }
      ]
    },
    {
      category: 'WORK HISTORY',
      items: [
        {
          name: 'Work Experience',
          status: 'Completed',
          hasInfo: true,
          data: workExperienceData || {
            workExperiences: [{
              id: '1',
              jobTitle: 'Software Developer',
              companyName: 'Tech Corp',
              employmentType: 'Full-time',
              industryDomain: 'Technology',
              numberOfReportees: '',
              startDate: '2020-01-01',
              endDate: '2023-12-31',
              currentlyWorkHere: false,
              workLocation: 'San Francisco, USA',
              workMode: 'On-site',
              companyProfile: '',
              companyTurnover: '',
              keyResponsibilities: '',
              achievements: '',
              workSkills: []
            }]
          }
        },
        {
          name: 'Internships',
          status: internshipData ? 'Completed' : 'Missing Info',
          hasInfo: !!internshipData,
          data: internshipData
        },
        {
          name: 'Gap Explanation',
          status: gapExplanationData ? 'Completed' : 'Missing Info',
          hasInfo: !!gapExplanationData,
          data: gapExplanationData
        }
      ]
    },
    {
      category: 'EDUCATION',
      items: [
        { name: 'Education', status: 'Completed', hasInfo: true },
        { name: 'Academic Achievements', status: 'Partially Completed', hasInfo: true },
        { name: 'Competitive Exams', status: 'Missing Info', hasInfo: false }
      ]
    },
    {
      category: 'SKILLS',
      items: [
        { name: 'Skills', status: 'Completed', hasInfo: true },
        { name: 'Languages', status: 'Completed', hasInfo: true }
      ]
    },
    {
      category: 'PROJECTS',
      items: [
        { name: 'Projects', status: 'Partially Completed', hasInfo: true },
        { name: 'Portfolio Links', status: 'Missing Info', hasInfo: false }
      ]
    },
    {
      category: 'CERTIFICATIONS',
      items: [
        { name: 'Certifications', status: 'Completed', hasInfo: true },
        { name: 'Accomplishments', status: 'Missing Info', hasInfo: false }
      ]
    },
    {
      category: 'PREFERENCES',
      items: [
        { name: 'Career Preferences', status: 'Completed', hasInfo: true }
      ]
    },
    {
      category: 'GLOBAL ELIGIBILITY',
      items: [
        { name: 'Visa & Work Authorization', status: 'Missing Info', hasInfo: false },
        { name: 'Vaccination', status: 'Missing Info', hasInfo: false }
      ]
    },
    {
      category: 'RESUME',
      items: [
        { name: 'Resume', status: 'Completed', hasInfo: true }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'text-green-600';
    if (status === 'Partially Completed') return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEditClick = (category: string, itemName: string) => {
    if (category === 'PERSONAL DETAILS' && itemName === 'Basic Information') {
      setIsBasicInfoModalOpen(true);
    } else if (category === 'PERSONAL DETAILS' && itemName === 'Summary') {
      setIsSummaryModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Gap Explanation') {
      setIsGapExplanationModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Work Experience') {
      setIsWorkExperienceModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Internships') {
      setIsInternshipModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Education') {
      setIsEducationModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Academic Achievements') {
      setIsAcademicAchievementModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Competitive Exams') {
      setIsCompetitiveExamsModalOpen(true);
    } else if (category === 'SKILLS' && itemName === 'Skills') {
      setIsSkillsModalOpen(true);
    } else if (category === 'SKILLS' && itemName === 'Languages') {
      setIsLanguagesModalOpen(true);
    } else if (category === 'PROJECTS' && itemName === 'Projects') {
      setIsProjectModalOpen(true);
    } else if (category === 'PROJECTS' && itemName === 'Portfolio Links') {
      setIsPortfolioLinksModalOpen(true);
    } else if (category === 'CERTIFICATIONS' && itemName === 'Certifications') {
      setIsCertificationModalOpen(true);
    } else if (category === 'CERTIFICATIONS' && itemName === 'Accomplishments') {
      setIsAccomplishmentModalOpen(true);
    } else if (category === 'PREFERENCES' && itemName === 'Career Preferences') {
      setIsCareerPreferencesModalOpen(true);
    } else if (category === 'GLOBAL ELIGIBILITY' && itemName === 'Visa & Work Authorization') {
      setIsVisaWorkAuthorizationModalOpen(true);
    } else if (category === 'GLOBAL ELIGIBILITY' && itemName === 'Vaccination') {
      setIsVaccinationModalOpen(true);
    } else if (category === 'RESUME' && itemName === 'Resume') {
      setIsResumeModalOpen(true);
    }
  };

  const handleAddClick = (category: string, itemName: string) => {
    // Open modal without clearing existing state - modals will handle empty initialData
    // This preserves the UI display while allowing new data entry
    if (category === 'PERSONAL DETAILS' && itemName === 'Basic Information') {
      setIsBasicInfoModalOpen(true);
    } else if (category === 'PERSONAL DETAILS' && itemName === 'Summary') {
      setIsSummaryModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Gap Explanation') {
      setIsGapExplanationModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Work Experience') {
      setEditingWorkExperienceId(null); // Clear edit ID for new entry
      setIsWorkExperienceModalOpen(true);
    } else if (category === 'WORK HISTORY' && itemName === 'Internships') {
      setIsInternshipModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Education') {
      setEditingEducationId(null); // Clear edit ID for new entry
      setIsEducationModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Academic Achievements') {
      setIsAcademicAchievementModalOpen(true);
    } else if (category === 'EDUCATION' && itemName === 'Competitive Exams') {
      setIsCompetitiveExamsModalOpen(true);
    } else if (category === 'SKILLS' && itemName === 'Skills') {
      setIsSkillsModalOpen(true);
    } else if (category === 'SKILLS' && itemName === 'Languages') {
      setIsLanguagesModalOpen(true);
    } else if (category === 'PROJECTS' && itemName === 'Projects') {
      setIsProjectModalOpen(true);
    } else if (category === 'PROJECTS' && itemName === 'Portfolio Links') {
      setIsPortfolioLinksModalOpen(true);
    } else if (category === 'CERTIFICATIONS' && itemName === 'Certifications') {
      setEditingCertificationId(null); // Clear edit ID for new entry
      setIsCertificationModalOpen(true);
    } else if (category === 'CERTIFICATIONS' && itemName === 'Accomplishments') {
      setEditingAccomplishmentId(null); // Clear edit ID for new entry
      setIsAccomplishmentModalOpen(true);
    } else if (category === 'PREFERENCES' && itemName === 'Career Preferences') {
      setIsCareerPreferencesModalOpen(true);
    } else if (category === 'GLOBAL ELIGIBILITY' && itemName === 'Visa & Work Authorization') {
      setIsVisaWorkAuthorizationModalOpen(true);
    } else if (category === 'GLOBAL ELIGIBILITY' && itemName === 'Vaccination') {
      setIsVaccinationModalOpen(true);
    } else if (category === 'RESUME' && itemName === 'Resume') {
      setIsResumeModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #fde9d4, #fafbfb, #bddffb)" }}>
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>

        {/* Main Title Area */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Profile</h1>
            <p className="text-gray-600">View and update all sections of your SAASA profile.</p>
          </div>
        </div>

        {/* Top Section - Three Cards */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Your CV/Resume Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your CV/Resume</h3>
            <div className="flex flex-col items-center mb-4">
              <div className="relative w-24 h-24 mb-3">
                <svg viewBox="0 0 100 100" className="w-24 h-24">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="#28A8DF"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(Math.round(cvAnalysis?.cv_score || resumeData?.atsScore || 0) * 2.83)} 283`}
                    strokeLinecap="round"
                    className="-rotate-90 origin-center"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">
                    {Math.round(cvAnalysis?.cv_score || resumeData?.atsScore || 0)}%
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {resumeData?.fileName || resumeData?.fileUrl?.split('/').pop() || 'No resume uploaded'}
              </p>
              {(cvAnalysis || resumeData?.aiAnalyzed) && (
              <span className="text-xs text-blue-600">AI Analyzed</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsResumeModalOpen(true)}
                className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
              >
                Upload/Replace Resume
              </button>
              <button className="w-full text-sm font-medium text-blue-600 hover:text-blue-700">
                View ATS Score
              </button>
            </div>
          </div>

          {/* AI Profile Insights Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Profile Insights</h3>
            <ul className="space-y-2 mb-4">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-1">•</span>
                <span>Improve your summary to highlight leadership skills.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-1">•</span>
                <span>Add quantifiable achievements to your work experience.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-1">•</span>
                <span>Consider certifications in cloud computing for better matching.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-1">•</span>
                <span>Include a project demonstrating full-stack development expertise.</span>
              </li>
            </ul>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View Insights
            </button>
          </div>

          {/* Your Profile Strength Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="mb-3">
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                profileCompleteness.percentage >= 80 
                  ? 'bg-green-100 text-green-800' 
                  : profileCompleteness.percentage >= 60 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {profileCompleteness.percentage >= 80 
                  ? 'High' 
                  : profileCompleteness.percentage >= 60 
                  ? 'Moderate' 
                  : 'Low'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Based on your current profile completeness and relevance to industry standards.
            </p>
            {profileCompleteness.missingSections.length > 0 ? (
            <ul className="space-y-2 mb-4">
                {profileCompleteness.missingSections.map((section, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-1">•</span>
                    <span>Complete '{section}' section to improve your profile.</span>
              </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 mb-4">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-green-700">All mandatory sections are completed! Your profile is 100% complete.</span>
              </li>
            </ul>
            )}
            <button 
              onClick={openFirstMissingModal}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Improve My Profile
            </button>
          </div>
        </div>

        {/* Bottom Section - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Menu */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <nav className="space-y-6 overflow-y-auto max-h-[calc(100vh-300px)] pr-2 profile-sidebar-scroll">
                {profileSections.map((section, sectionIndex) => {
                  const isExpanded = expandedSections[section.category] ?? false;
                  return (
                    <div key={sectionIndex}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-gray-900 text-sm">{section.category}</h4>
                        <button
                          onClick={() => toggleSection(section.category)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-transform"
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease-in-out'
                          }}
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
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      </div>
                      {isExpanded && (
                        <ul className="space-y-1">
                          {section.items.map((item, itemIndex) => {
                            const isSelected = selectedItem?.category === section.category && selectedItem?.itemName === item.name;
                            const isMissing = isMandatorySectionMissing(section.category, item.name);
                            return (
                              <li key={itemIndex}>
                                <button
                                  onClick={() => setSelectedItem({ category: section.category, itemName: item.name })}
                                  className={`w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-600'
                                      : isMissing
                                      ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                                      : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                  <span>{item.name}</span>
                                    {isMissing && (
                                      <span className="text-xs font-semibold text-red-600" title="Required field">⚠️</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!isMissing && item.hasInfo && (
                                      <span className="text-xs text-green-600">✓</span>
                                    )}
                                    {isMissing && (
                                      <span className="text-xs text-red-600 font-semibold">Required</span>
                                    )}
                                  <span className="text-gray-400">→</span>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Right Column - Profile Details */}
          <div className="lg:col-span-2">
            {selectedItem && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                {/* Header with Edit and Add buttons */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">{selectedItem.itemName}</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditClick(selectedItem.category, selectedItem.itemName)}
                      className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleAddClick(selectedItem.category, selectedItem.itemName)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Content based on selected item */}
                {selectedItem.itemName === 'Basic Information' && basicInfoData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">First Name</label>
                        <p className="text-base text-gray-900">{basicInfoData.firstName || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Email Address</label>
                        <div className="flex items-center gap-2">
                          <p className="text-base text-gray-900">{basicInfoData.email || '—'}</p>
                          {basicInfoData.email && (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">Verified</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Phone Number</label>
                        <p className="text-base text-gray-900">
                          {basicInfoData.phoneCode && basicInfoData.phone 
                            ? `${basicInfoData.phoneCode} ${basicInfoData.phone}` 
                            : basicInfoData.phone || '—'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Date of Birth</label>
                        <p className="text-base text-gray-900">{basicInfoData.dob || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Current City</label>
                        <p className="text-base text-gray-900">{basicInfoData.city || '—'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Middle Name</label>
                        <p className="text-base text-gray-900">{basicInfoData.middleName || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Last Name</label>
                        <p className="text-base text-gray-900">{basicInfoData.lastName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Gender</label>
                        <p className="text-base text-gray-900">{basicInfoData.gender || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Current Country</label>
                        <p className="text-base text-gray-900">{basicInfoData.country || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Employment Status</label>
                        <p className="text-base text-gray-900">{basicInfoData.employment || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">Passport Number</label>
                        <p className="text-base text-gray-900">{basicInfoData.passportNumber || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.itemName === 'Summary' && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Professional Summary</label>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">{summaryText || 'No summary added yet.'}</p>
                  </div>
                )}

                {selectedItem.itemName === 'Gap Explanation' && (
                  <div>
                    {gapExplanationData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        {/* Blue vertical accent bar */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          {/* Header: Gap Category (bold) with Action Buttons */}
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Gap Explanation</h3>
                              <p className="text-base font-semibold text-blue-600">{gapExplanationData.gapCategory || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setIsGapExplanationModalOpen(true);
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit gap explanation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete Button */}
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this gap explanation?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found. Please refresh the page.');
                                      return;
                                    }

                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/gap-explanation/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: {
                                          'Content-Type': 'application/json',
                                        },
                                      });

                                      if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}));
                                        throw new Error(errorData.message || 'Failed to delete gap explanation');
                                      }

                                      // Refresh profile data
                                      await refreshProfileData(candidateId);
                                      alert('Gap explanation deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting gap explanation:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting gap explanation');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete gap explanation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              {/* Collapse Button */}
                              <button
                                onClick={() => setIsGapExplanationCardExpanded(!isGapExplanationCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isGapExplanationCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isGapExplanationCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Content */}
                          {isGapExplanationCardExpanded && (
                      <div className="space-y-4">
                              {/* Gap Category and Reason Badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.gapCategory ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                  Category: {gapExplanationData.gapCategory || '—'}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.reasonForGap ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                  {gapExplanationData.reasonForGap ? formatEnumValue(gapExplanationData.reasonForGap) : 'Reason: —'}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.gapDuration ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                  Duration: {gapExplanationData.gapDuration || '—'}
                                </span>
                        </div>

                              {/* Reason for Gap Section - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Reason for Gap
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed pl-6">{gapExplanationData.reasonForGap ? formatEnumValue(gapExplanationData.reasonForGap) : '—'}</p>
                        </div>

                              {/* Skills Continued Section - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  Skills You Continued During the Gap
                                </h4>
                                <div className="flex flex-wrap gap-2 pl-6">
                                  {gapExplanationData.selectedSkills && gapExplanationData.selectedSkills.length > 0 ? (
                                    gapExplanationData.selectedSkills.map((skill, skillIndex) => (
                                      <span key={skillIndex} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                                        {skill}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-sm text-gray-400">—</span>
                                  )}
                        </div>
                              </div>

                              {/* Courses/Trainings Section - Always show */}
                          <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                  Courses, Trainings, or Certifications
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{gapExplanationData.coursesText || '—'}</p>
                          </div>

                              {/* Preferred Support Section - Always show */}
                              <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Preferred Support When Returning to Work
                                </h4>
                                <div className="space-y-2 pl-6">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.preferredSupport?.flexibleRole ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                      {gapExplanationData.preferredSupport?.flexibleRole ? '✓' : '✗'} Flexible role
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.preferredSupport?.hybridRemote ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                      {gapExplanationData.preferredSupport?.hybridRemote ? '✓' : '✗'} Hybrid / Remote
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.preferredSupport?.midLevelReEntry ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                      {gapExplanationData.preferredSupport?.midLevelReEntry ? '✓' : '✗'} Mid-level re-entry roles
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${gapExplanationData.preferredSupport?.skillRefresher ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                      {gapExplanationData.preferredSupport?.skillRefresher ? '✓' : '✗'} Skill refresher recommendations
                                    </span>
                                  </div>
                                  {(!gapExplanationData.preferredSupport?.flexibleRole && 
                                    !gapExplanationData.preferredSupport?.hybridRemote && 
                                    !gapExplanationData.preferredSupport?.midLevelReEntry && 
                                    !gapExplanationData.preferredSupport?.skillRefresher) && (
                                    <span className="text-sm text-gray-400">—</span>
                                  )}
                                </div>
                              </div>
                          </div>
                        )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No gap explanation added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your gap explanation</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.itemName === 'Work Experience' && (
                  <div>
                    {workExperienceData?.workExperiences?.length ? (
                      <div className="space-y-4">
                        {workExperienceData.workExperiences.map((entry, index) => {
                          const cardKey = entry.id ?? `work-${index}`;
                          const isExpanded = expandedWorkExperienceCards[cardKey] === true; // Default to collapsed
                          const toggleCard = () => {
                            setExpandedWorkExperienceCards(prev => ({
                              ...prev,
                              [cardKey]: !isExpanded
                            }));
                          };

                          return (
                            <div key={cardKey} className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              {/* Blue vertical accent bar */}
                              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                              
                              <div className="pl-6 pr-6 pt-5 pb-5">
                                {/* Header: Job Title (bold) and Company Name (blue) with Action Buttons */}
                                <div className="mb-3 flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{entry.jobTitle || '—'}</h3>
                                    <p className="text-base font-semibold text-blue-600">{entry.companyName || '—'}</p>
                            </div>
                                  <div className="flex items-center gap-2">
                                    {/* Edit Button */}
                                    <button
                                      onClick={() => {
                                        setEditingWorkExperienceId(entry.id ?? null);
                                        setIsWorkExperienceModalOpen(true);
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                      aria-label="Edit work experience"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {/* Delete Button */}
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Are you sure you want to delete this work experience: ${entry.jobTitle} at ${entry.companyName}?`)) {
                                          const candidateId = sessionStorage.getItem('candidateId');
                                          if (!candidateId) {
                                            alert('Candidate ID not found. Please refresh the page.');
                                            return;
                                          }

                                          try {
                                            const response = await fetch(`${API_BASE_URL}/profile/work-experience/${entry.id}`, {
                                              method: 'DELETE',
                                              headers: {
                                                'Content-Type': 'application/json',
                                              },
                                            });

                                            if (!response.ok) {
                                              const errorData = await response.json().catch(() => ({}));
                                              throw new Error(errorData.message || 'Failed to delete work experience');
                                            }

                                            // Refresh profile data
                                            await refreshProfileData(candidateId);
                                            alert('Work experience deleted successfully');
                                          } catch (error) {
                                            console.error('Error deleting work experience:', error);
                                            alert(error instanceof Error ? error.message : 'Error deleting work experience');
                                          }
                                        }
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                      aria-label="Delete work experience"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    {/* Collapse Button */}
                                    <button
                                      onClick={toggleCard}
                                      className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                      <svg
                                        className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Collapsible Content */}
                                {isExpanded && (
                                  <div className="space-y-4">
                                    {/* Metadata Row: Date, Location, Industry with icons */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>
                                          {entry.startDate ? new Date(entry.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'} - {entry.currentlyWorkHere ? 'Present' : (entry.endDate ? new Date(entry.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—')}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{entry.workLocation || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span>{entry.industryDomain || '—'}</span>
                                      </div>
                                    </div>

                                    {/* Employment Type and Work Mode Badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.employmentType ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.employmentType ? formatEnumValue(entry.employmentType) : 'Employment Type: —'}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.workMode ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.workMode ? formatEnumValue(entry.workMode) : 'Work Mode: —'}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.currentlyWorkHere ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.currentlyWorkHere ? 'Current' : 'Not Current'}
                                      </span>
                                    </div>

                                    {/* Additional Info Grid - Always show */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Number of Reportees</p>
                                        <p className="text-sm font-semibold text-gray-900">{entry.numberOfReportees || '—'}</p>
                                      </div>
                                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Company Turnover</p>
                                        <p className="text-sm font-semibold text-gray-900">{entry.companyTurnover || '—'}</p>
                                      </div>
                                    </div>

                                    {/* Key Responsibilities Section - Always show */}
                            <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Key Responsibilities
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{entry.keyResponsibilities || '—'}</p>
                            </div>

                                    {/* Achievements Section - Always show */}
                            <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                        </svg>
                                        Achievements
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{entry.achievements || '—'}</p>
                            </div>

                                    {/* Company Profile - Always show */}
                            <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Company Profile
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{entry.companyProfile || '—'}</p>
                            </div>

                                    {/* Skills - Always show */}
                              <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        Skills Used
                                      </h4>
                                      <div className="flex flex-wrap gap-2 pl-6">
                                        {entry.workSkills && entry.workSkills.length > 0 ? (
                                          entry.workSkills.map((skill, skillIndex) => (
                                            <span key={skillIndex} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                                              {skill}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-sm text-gray-400">—</span>
                                        )}
                              </div>
                                    </div>

                                    {/* Documents - Always show */}
                                    <div className="pt-4 border-t border-gray-200">
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Certificates & Documents ({entry.documents && entry.documents.length > 0 ? entry.documents.length : 0})
                                      </h4>
                                      {entry.documents && entry.documents.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {entry.documents.map((doc, docIndex) => {
                                            const docUrl = getDocumentUrl(doc);
                                            const docName = getDocumentName(doc);
                                            const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                            return (
                                              <a
                                                key={docIndex}
                                                href={fullUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                              >
                                                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                              </a>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-400 pl-6">—</p>
                            )}
                          </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No work experience added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first work experience</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.itemName === 'Internships' && (
                  <div>
                    {internshipData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        {/* Blue vertical accent bar */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          {/* Header: Internship Title (bold) and Company Name (blue) with Action Buttons */}
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">{internshipData.internshipTitle || '—'}</h3>
                              <p className="text-base font-semibold text-blue-600">{internshipData.companyName || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setIsInternshipModalOpen(true);
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit internship"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete Button */}
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete this internship: ${internshipData.internshipTitle} at ${internshipData.companyName}?`)) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found. Please refresh the page.');
                                      return;
                                    }

                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/internship/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: {
                                          'Content-Type': 'application/json',
                                        },
                                      });

                                      if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}));
                                        throw new Error(errorData.message || 'Failed to delete internship');
                                      }

                                      // Refresh profile data
                                      await refreshProfileData(candidateId);
                                      alert('Internship deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting internship:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting internship');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete internship"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              {/* Collapse Button */}
                              <button
                                onClick={() => setIsInternshipCardExpanded(!isInternshipCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isInternshipCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isInternshipCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Content */}
                          {isInternshipCardExpanded && (
                      <div className="space-y-4">
                            {/* Metadata Row: Date, Location, Type with icons */}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>
                                  {internshipData.startDate ? new Date(internshipData.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'} - {internshipData.currentlyWorking ? 'Present' : (internshipData.endDate ? new Date(internshipData.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{internshipData.location || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{internshipData.domainDepartment || '—'}</span>
                              </div>
                            </div>

                            {/* Internship Type and Work Mode Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${internshipData.internshipType ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                {internshipData.internshipType ? formatEnumValue(internshipData.internshipType) : 'Internship Type: —'}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${internshipData.workMode ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                {internshipData.workMode ? formatEnumValue(internshipData.workMode) : 'Work Mode: —'}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${internshipData.currentlyWorking ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                {internshipData.currentlyWorking ? 'Current' : 'Not Current'}
                              </span>
                            </div>

                            {/* Responsibilities Section - Always show */}
                        <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Responsibilities / Tasks Performed
                              </h4>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{internshipData.responsibilities || '—'}</p>
                        </div>

                            {/* Learnings Section - Always show */}
                        <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                                Learnings or Outcomes
                              </h4>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{internshipData.learnings || '—'}</p>
                        </div>

                            {/* Skills - Always show */}
                        <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                Skills Used
                              </h4>
                              <div className="flex flex-wrap gap-2 pl-6">
                                {internshipData.skills && internshipData.skills.length > 0 ? (
                                  internshipData.skills.map((skill, skillIndex) => (
                                    <span key={skillIndex} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                                      {skill}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                        </div>
                            </div>

                            {/* Documents - Always show */}
                            <div className="pt-4 border-t border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Certificates & Documents ({internshipData.documents && internshipData.documents.length > 0 ? internshipData.documents.length : 0})
                              </h4>
                              {internshipData.documents && internshipData.documents.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {internshipData.documents.map((doc, docIndex) => {
                                    const docUrl = getDocumentUrl(doc);
                                    const docName = getDocumentName(doc);
                                    const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                    return (
                                      <a
                                        key={docIndex}
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                      >
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    );
                                  })}
                      </div>
                    ) : (
                                <p className="text-sm text-gray-400 pl-6">—</p>
                              )}
                            </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No internship added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your internship</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.itemName === 'Education' && (
                  <div>
                    {educationData?.educations?.length ? (
                      <div className="space-y-4">
                        {educationData.educations.map((entry, index) => {
                          const cardKey = entry.id ?? `education-${index}`;
                          const isCardExpanded = expandedEducationCards[cardKey] === true; // Default to collapsed
                          const toggleCard = () => {
                            setExpandedEducationCards(prev => ({
                              ...prev,
                              [cardKey]: !isCardExpanded
                            }));
                          };

                          return (
                            <div key={cardKey} className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              {/* Blue vertical accent bar */}
                              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>

                              <div className="pl-6 pr-6 pt-5 pb-5">
                                {/* Header: Degree (bold) and Institution (blue) with Action Buttons */}
                                <div className="mb-3 flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{entry.degreeProgram || '—'}</h3>
                                    <p className="text-base font-semibold text-blue-600">{entry.institutionName || '—'}</p>
                        </div>
                                  <div className="flex items-center gap-2">
                                    {/* Edit Button */}
                                    <button
                                      onClick={() => {
                                        setEditingEducationId(entry.id ?? null);
                                        setIsEducationModalOpen(true);
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                      aria-label="Edit education"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {/* Delete Button */}
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Are you sure you want to delete this education: ${entry.degreeProgram} at ${entry.institutionName}?`)) {
                                          const candidateId = sessionStorage.getItem('candidateId');
                                          if (!candidateId) {
                                            alert('Candidate ID not found. Please refresh the page.');
                                            return;
                                          }

                                          try {
                                            const response = await fetch(`${API_BASE_URL}/profile/education/${entry.id}`, {
                                              method: 'DELETE',
                                              headers: {
                                                'Content-Type': 'application/json',
                                              },
                                            });

                                            if (!response.ok) {
                                              const errorData = await response.json().catch(() => ({}));
                                              throw new Error(errorData.message || 'Failed to delete education');
                                            }

                                            // Refresh profile data
                                            await refreshProfileData(candidateId);
                                            alert('Education deleted successfully');
                                          } catch (error) {
                                            console.error('Error deleting education:', error);
                                            alert(error instanceof Error ? error.message : 'Error deleting education');
                                          }
                                        }
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                      aria-label="Delete education"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    {/* Collapse Button */}
                                    <button
                                      onClick={toggleCard}
                                      className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                      aria-label={isCardExpanded ? 'Collapse' : 'Expand'}
                                    >
                                      <svg
                                        className={`w-5 h-5 transition-transform duration-200 ${isCardExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Collapsible Content */}
                                {isCardExpanded && (
                                  <div className="space-y-4">
                                    {/* Metadata Row: Education Level, Duration with icons */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <span>{entry.educationLevel || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>
                                          {entry.startYear || '—'} - {entry.currentlyStudying ? 'Present' : (entry.endYear || '—')}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.educationLevel ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.educationLevel || 'Education Level: —'}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.modeOfStudy ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.modeOfStudy || 'Mode: —'}
                                      </span>
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${entry.currentlyStudying ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                        {entry.currentlyStudying ? 'Currently Studying' : 'Completed'}
                                      </span>
                                    </div>

                                    {/* Field of Study - Always show */}
                        <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Field of Study / Major
                                      </h4>
                                      <p className="text-sm text-gray-700 pl-6">{entry.fieldOfStudy || '—'}</p>
                        </div>

                                    {/* Academic Details Grid - Always show */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Grade / Percentage / GPA</p>
                                        <p className="text-sm font-semibold text-gray-900">{entry.grade || '—'}</p>
                                      </div>
                                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Course Duration</p>
                                        <p className="text-sm font-semibold text-gray-900">{entry.courseDuration || '—'}</p>
                                      </div>
                                    </div>

                                    {/* Documents - Always show */}
                                    <div className="pt-4 border-t border-gray-200">
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Certificates & Documents ({entry.documents && entry.documents.length > 0 ? entry.documents.length : 0})
                                      </h4>
                                      {entry.documents && entry.documents.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {entry.documents.map((doc, docIndex) => {
                                            const docUrl = getDocumentUrl(doc);
                                            const docName = getDocumentName(doc);
                                            const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                            return (
                                              <a
                                                key={docIndex}
                                                href={fullUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                              >
                                                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                              </a>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-400 pl-6">—</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No education added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first education</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.itemName === 'Academic Achievements' && (
                        <div>
                    {academicAchievementData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">{academicAchievementData.achievementTitle || '—'}</h3>
                              <p className="text-base font-semibold text-blue-600">{academicAchievementData.awardedBy || '—'}</p>
                        </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsAcademicAchievementModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit academic achievement"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this academic achievement?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) { alert('Candidate ID not found.'); return; }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/academic-achievement/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                      if (!response.ok) throw new Error('Failed to delete academic achievement');
                                      await refreshProfileData(candidateId);
                                      alert('Academic achievement deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting academic achievement:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting academic achievement');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete academic achievement"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsAcademicAchievementCardExpanded(!isAcademicAchievementCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isAcademicAchievementCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isAcademicAchievementCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isAcademicAchievementCardExpanded && (
                            <div className="space-y-4">
                              {/* Year Received - Always show */}
                          <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Year Received
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{academicAchievementData.yearReceived || '—'}</p>
                          </div>

                              {/* Category Type - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  Category Type
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{academicAchievementData.categoryType || '—'}</p>
                        </div>

                              {/* Description - Always show */}
                          <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Description
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{academicAchievementData.description || '—'}</p>
                          </div>

                              {/* Documents - Always show */}
                              <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  Certificates & Documents ({academicAchievementData.documents && academicAchievementData.documents.length > 0 ? academicAchievementData.documents.length : 0})
                                </h4>
                                {academicAchievementData.documents && academicAchievementData.documents.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {academicAchievementData.documents.map((doc, docIndex) => {
                                      const docUrl = getDocumentUrl(doc);
                                      const docName = getDocumentName(doc);
                                      const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                      return (
                                        <a
                                          key={docIndex}
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                        >
                                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 pl-6">—</p>
                                )}
                              </div>
                          </div>
                        )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No academic achievements added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first academic achievement</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Projects Card Display */}
                {selectedItem.itemName === 'Projects' && (
                          <div>
                    {projectData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">{projectData.projectTitle || '—'}</h3>
                              <p className="text-base font-semibold text-blue-600">{projectData.projectType || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setIsProjectModalOpen(true)} className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={async () => {
                                if (confirm('Are you sure you want to delete this project?')) {
                                  const candidateId = sessionStorage.getItem('candidateId');
                                  if (!candidateId) { alert('Candidate ID not found.'); return; }
                                  try {
                                    const response = await fetch(`${API_BASE_URL}/profile/project/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                    if (!response.ok) throw new Error('Failed to delete project');
                                    await refreshProfileData(candidateId);
                                    alert('Project deleted successfully');
                                  } catch (error) {
                                    console.error('Error deleting project:', error);
                                    alert(error instanceof Error ? error.message : 'Error deleting project');
                                  }
                                }
                              }} className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                              <button onClick={() => setIsProjectCardExpanded(!isProjectCardExpanded)} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                                <svg className={`w-5 h-5 transition-transform duration-200 ${isProjectCardExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </div>
                          </div>
                          {isProjectCardExpanded && (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  <span>{projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'} - {projectData.currentlyWorking ? 'Present' : (projectData.endDate ? new Date(projectData.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—')}</span>
                                </div>
                                <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                  <span>{projectData.organizationClient || '—'}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${projectData.projectType ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{projectData.projectType || 'Type: —'}</span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${projectData.currentlyWorking ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{projectData.currentlyWorking ? 'Current' : 'Completed'}</span>
                              </div>
                              <div><h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Project Description</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{projectData.projectDescription || '—'}</p></div>
                              <div><h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Responsibilities</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{projectData.responsibilities || '—'}</p></div>
                              <div><h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>Technologies</h4><div className="flex flex-wrap gap-2 pl-6">{projectData.technologies && projectData.technologies.length > 0 ? projectData.technologies.map((tech, idx) => <span key={idx} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">{tech}</span>) : <span className="text-sm text-gray-500">—</span>}</div></div>
                              <div><h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>Project Outcome</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{projectData.projectOutcome || '—'}</p></div>
                              <div className="pt-4 border-t border-gray-200"><h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>Project Link</h4><div className="pl-6">{projectData.projectLink ? <a href={projectData.projectLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700">{projectData.projectLink}</a> : <span className="text-sm text-gray-500">—</span>}</div></div>
                              {projectData.documents && projectData.documents.length > 0 && (
                                <div className="pt-4 border-t border-gray-200">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Documents
                                  </h4>
                                  <div className="flex flex-wrap gap-2 pl-6">
                                    {projectData.documents.map((doc, docIndex) => (
                                      <a
                                        key={docIndex}
                                        href={getApiDocumentHref(doc)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>{getDocumentName(doc)}</span>
                                      </a>
                                    ))}
                                  </div>
                          </div>
                        )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12"><svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><p className="mt-4 text-base font-medium text-gray-900">No projects added yet</p><p className="mt-2 text-sm text-gray-500">Click "Add" to add your first project</p></div>
                    )}
                  </div>
                )}

                {/* Competitive Exams Card Display */}
                {selectedItem.itemName === 'Competitive Exams' && (
                  <div>
                    {competitiveExamsData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">{competitiveExamsData.examName || '—'}</h3>
                              <p className="text-base font-semibold text-blue-600">{competitiveExamsData.resultStatus || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setIsCompetitiveExamsModalOpen(true)} className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={async () => {
                                if (confirm('Are you sure you want to delete this competitive exam?')) {
                                  const candidateId = sessionStorage.getItem('candidateId');
                                  if (!candidateId) { alert('Candidate ID not found.'); return; }
                                  try {
                                    const response = await fetch(`${API_BASE_URL}/profile/competitive-exam/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                    if (!response.ok) throw new Error('Failed to delete competitive exam');
                                    await refreshProfileData(candidateId);
                                    alert('Competitive exam deleted successfully');
                                  } catch (error) {
                                    console.error('Error deleting competitive exam:', error);
                                    alert(error instanceof Error ? error.message : 'Error deleting competitive exam');
                                  }
                                }
                              }} className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                              <button onClick={() => setIsCompetitiveExamCardExpanded(!isCompetitiveExamCardExpanded)} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                                <svg className={`w-5 h-5 transition-transform duration-200 ${isCompetitiveExamCardExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </div>
                          </div>
                          {isCompetitiveExamCardExpanded && (
                      <div className="space-y-4">
                              {/* Year Taken - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Year Taken
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{competitiveExamsData.yearTaken || '—'}</p>
                        </div>

                              {/* Score / Marks - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  Score / Marks
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{competitiveExamsData.scoreMarks || '—'}</p>
                        </div>

                              {/* Score Type - Always show */}
                        <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  Score Type
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{competitiveExamsData.scoreType || '—'}</p>
                        </div>

                              {/* Valid Until - Always show */}
                          <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Valid Until
                                </h4>
                                <p className="text-sm text-gray-700 pl-6">{competitiveExamsData.validUntil || '—'}</p>
                          </div>

                              {/* Additional Notes - Always show */}
                          <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Additional Notes
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{competitiveExamsData.additionalNotes || '—'}</p>
                          </div>

                              {/* Documents - Always show */}
                              <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  Certificates & Documents ({competitiveExamsData.documents && competitiveExamsData.documents.length > 0 ? competitiveExamsData.documents.length : 0})
                                </h4>
                                {competitiveExamsData.documents && competitiveExamsData.documents.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {competitiveExamsData.documents.map((doc, docIndex) => {
                                      const docUrl = getDocumentUrl(doc);
                                      const docName = getDocumentName(doc);
                                      const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                      return (
                                        <a
                                          key={docIndex}
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                        >
                                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 pl-6">—</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12"><svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p className="mt-4 text-base font-medium text-gray-900">No competitive exam information added yet</p><p className="mt-2 text-sm text-gray-500">Click "Add" to add your first competitive exam</p></div>
                    )}
                  </div>
                )}

                {/* Certifications Card Display */}
                {selectedItem.itemName === 'Certifications' && (
                  <div>
                    {certificationsData && certificationsData.certifications && certificationsData.certifications.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {certificationsData.certifications.map((cert) => {
                          const isExpanded = isCertificationCardExpanded[cert.id] || false;
                          return (
                            <div key={cert.id} className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
                              <div className="pl-6 pr-6 pt-5 pb-5">
                                <div className="mb-3 flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{cert.certificationName || '—'}</h3>
                                    <p className="text-base font-semibold text-green-600">{cert.issuingOrganization || '—'}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingCertificationId(cert.id ?? null);
                                        setIsCertificationModalOpen(true);
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm('Are you sure you want to delete this certification?')) {
                                          const candidateId = sessionStorage.getItem('candidateId');
                                          if (!candidateId) {
                                            alert('Candidate ID not found.');
                                            return;
                                          }
                                          try {
                                            const response = await fetch(`${API_BASE_URL}/profile/certifications/${cert.id}`, {
                                              method: 'DELETE',
                                              headers: { 'Content-Type': 'application/json' },
                                            });
                                            if (!response.ok) throw new Error('Failed to delete certification');
                                            await refreshProfileData(candidateId);
                                            alert('Certification deleted successfully');
                                          } catch (error) {
                                            console.error('Error deleting certification:', error);
                                            alert(error instanceof Error ? error.message : 'Error deleting certification');
                                          }
                                        }
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => setIsCertificationCardExpanded({ ...isCertificationCardExpanded, [cert.id]: !isExpanded })}
                                      className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                    >
                                      <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-6 pb-5 space-y-4 border-t border-gray-200 pt-4">
                                  {/* Issue Date */}
                        <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Issue Date
                                    </h4>
                                    <p className="text-sm text-gray-700 pl-6">{cert.issueDate || '—'}</p>
                        </div>

                                  {/* Expiry Date */}
                                  {!cert.doesNotExpire && (
                        <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Expiry Date
                                      </h4>
                                      <p className="text-sm text-gray-700 pl-6">{cert.expiryDate || '—'}</p>
                        </div>
                                  )}

                                  {/* Does Not Expire */}
                                  {cert.doesNotExpire && (
                        <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Expiry Status
                                      </h4>
                                      <p className="text-sm text-gray-700 pl-6">This certification does not expire</p>
                        </div>
                                  )}

                                  {/* Credential ID */}
                                  {cert.credentialId && (
                        <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                        </svg>
                                        Credential ID
                                      </h4>
                                      <p className="text-sm text-gray-700 pl-6">{cert.credentialId}</p>
                        </div>
                                  )}

                                  {/* Credential URL */}
                                  {cert.credentialUrl && (
                          <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        Credential URL
                                      </h4>
                                      <a
                                        href={cert.credentialUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800 pl-6 break-all"
                                      >
                                        {cert.credentialUrl}
                                      </a>
                          </div>
                        )}

                                  {/* Description */}
                                  {cert.description && (
                          <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Description
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{cert.description}</p>
                          </div>
                        )}

                                  {/* Documents */}
                                  <div className="pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      Certificates & Documents ({cert.documents && cert.documents.length > 0 ? cert.documents.length : 0})
                                    </h4>
                                    {cert.documents && cert.documents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {cert.documents.map((doc, docIndex) => {
                                          const docUrl = getDocumentUrl(doc);
                                          const docName = getDocumentName(doc);
                                          const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                          return (
                                            <a
                                              key={docIndex}
                                              href={fullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                            >
                                              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                              </svg>
                                              <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 pl-6">—</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No certifications added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first certification</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Accomplishments Card Display */}
                {selectedItem.itemName === 'Accomplishments' && (
                          <div>
                    {accomplishmentsData && accomplishmentsData.accomplishments && accomplishmentsData.accomplishments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {accomplishmentsData.accomplishments.map((acc) => {
                          const isExpanded = isAccomplishmentCardExpanded[acc.id] || false;
                          return (
                            <div key={acc.id} className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-purple-600"></div>
                              <div className="pl-6 pr-6 pt-5 pb-5">
                                <div className="mb-3 flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{acc.title || '—'}</h3>
                                    <p className="text-base font-semibold text-purple-600">{acc.category || '—'}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingAccomplishmentId(acc.id ?? null);
                                        setIsAccomplishmentModalOpen(true);
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm('Are you sure you want to delete this accomplishment?')) {
                                          const candidateId = sessionStorage.getItem('candidateId');
                                          if (!candidateId) {
                                            alert('Candidate ID not found.');
                                            return;
                                          }
                                          try {
                                            const response = await fetch(`${API_BASE_URL}/profile/accomplishments/${acc.id}`, {
                                              method: 'DELETE',
                                              headers: { 'Content-Type': 'application/json' },
                                            });
                                            if (!response.ok) throw new Error('Failed to delete accomplishment');
                                            await refreshProfileData(candidateId);
                                            alert('Accomplishment deleted successfully');
                                          } catch (error) {
                                            console.error('Error deleting accomplishment:', error);
                                            alert(error instanceof Error ? error.message : 'Error deleting accomplishment');
                                          }
                                        }
                                      }}
                                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => setIsAccomplishmentCardExpanded({ ...isAccomplishmentCardExpanded, [acc.id]: !isExpanded })}
                                      className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                    >
                                      <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-6 pb-5 space-y-4 border-t border-gray-200 pt-4">
                                  {/* Organization */}
                                  {acc.organization && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Organization / Authority
                                      </h4>
                                      <p className="text-sm text-gray-700 pl-6">{acc.organization}</p>
                          </div>
                        )}

                                  {/* Achievement Date */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Achievement Date
                                    </h4>
                                    <p className="text-sm text-gray-700 pl-6">{acc.achievementDate || '—'}</p>
                                  </div>

                                  {/* Description */}
                                  {acc.description && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Description
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{acc.description}</p>
                                    </div>
                                  )}

                                  {/* Documents */}
                                  <div className="pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      Supporting Documents ({acc.documents && acc.documents.length > 0 ? acc.documents.length : 0})
                                    </h4>
                                    {acc.documents && acc.documents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {acc.documents.map((doc, docIndex) => {
                                          const docUrl = getDocumentUrl(doc);
                                          const docName = getDocumentName(doc);
                                          const fullUrl = docUrl.startsWith('http') ? docUrl : `${API_BASE_URL.replace('/api', '')}${docUrl}`;
                                          return (
                                            <a
                                              key={docIndex}
                                              href={fullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                                            >
                                              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                              </svg>
                                              <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1 transition-colors">{docName}</span>
                                              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                            </a>
                                          );
                                        })}
                      </div>
                    ) : (
                                      <p className="text-sm text-gray-400 pl-6">—</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M6.75 15.75l-1.5-1.5a2.25 2.25 0 010-3.182l1.5-1.5m4.5 0l1.5 1.5a2.25 2.25 0 010 3.182l-1.5 1.5m-4.5 0l-1.5-1.5a2.25 2.25 0 010-3.182l1.5-1.5m4.5 0l1.5 1.5a2.25 2.25 0 010 3.182l-1.5 1.5" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No accomplishments added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first accomplishment</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Skills Card Display */}
                {selectedItem.itemName === 'Skills' && (
                  <div>
                    {skillsData && skillsData.skills && skillsData.skills.length > 0 ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Skills ({skillsData.skills.length})</h3>
                              <p className="text-sm text-gray-600">Total skills added</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsSkillsModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit skills"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete all skills?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) { alert('Candidate ID not found.'); return; }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/skills/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                      if (!response.ok) throw new Error('Failed to delete skills');
                                      await refreshProfileData(candidateId);
                                      alert('Skills deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting skills:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting skills');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete skills"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsSkillsCardExpanded(!isSkillsCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isSkillsCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isSkillsCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isSkillsCardExpanded && (
                      <div className="space-y-4">
                        {/* Group skills by category */}
                        {(['Hard Skills', 'Soft Skills', 'Tools / Technologies'] as const).map((category) => {
                          const categorySkills = skillsData.skills.filter(skill => skill.category === category);
                          if (categorySkills.length === 0) return null;
                          return (
                            <div key={category}>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                      </svg>
                                      {category} ({categorySkills.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2 pl-6">
                                {categorySkills.map((skill, index) => (
                                  <div
                                          key={`${category}-${skill.name}-${index}`}
                                    className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5"
                                  >
                                    <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                                    <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-300">
                                      {skill.proficiency}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                              {/* Additional Notes - Always show */}
                              <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Additional Notes
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-6">{skillsData.additionalNotes || '—'}</p>
                              </div>
                          </div>
                        )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No skills added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first skill</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Languages Card Display */}
                {selectedItem.itemName === 'Languages' && (
                  <div>
                    {languagesData && languagesData.languages && languagesData.languages.length > 0 ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Languages ({languagesData.languages.length})</h3>
                              <p className="text-sm text-gray-600">Total languages added</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsLanguagesModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit languages"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete all languages?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) { alert('Candidate ID not found.'); return; }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/languages/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                      if (!response.ok) throw new Error('Failed to delete languages');
                                      await refreshProfileData(candidateId);
                                      alert('Languages deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting languages:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting languages');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete languages"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsLanguagesCardExpanded(!isLanguagesCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isLanguagesCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isLanguagesCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isLanguagesCardExpanded && (
                      <div className="space-y-4">
                              {languagesData.languages.map((language, index) => (
                                <div key={language.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="text-base font-semibold text-gray-900 mb-2">{language.name || '—'}</h4>
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          {language.proficiency || '—'}
                                        </span>
                                        {language.speak && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Speak
                                          </span>
                                        )}
                                        {language.read && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            Read
                                          </span>
                                        )}
                                        {language.write && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                            Write
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Documents */}
                                  {language.documents && language.documents.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Documents:</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {language.documents.map((doc, docIndex) => (
                                          <a
                                            key={docIndex}
                                            href={getApiDocumentHref(doc)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                          >
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span>{getDocumentName(doc)}</span>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No languages added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first language</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Default content for other items */}
                {/* Portfolio Links Card Display */}
                {selectedItem.itemName === 'Portfolio Links' && (
                  <div>
                    {portfolioLinksData && portfolioLinksData.links && portfolioLinksData.links.length > 0 ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Portfolio Links ({portfolioLinksData.links.length})</h3>
                              <p className="text-sm text-gray-600">Total links added</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsPortfolioLinksModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit portfolio links"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete all portfolio links?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) { alert('Candidate ID not found.'); return; }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/portfolio-links/${candidateId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
                                      if (!response.ok) throw new Error('Failed to delete portfolio links');
                                      await refreshProfileData(candidateId);
                                      alert('Portfolio links deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting portfolio links:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting portfolio links');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete portfolio links"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsPortfolioLinksCardExpanded(!isPortfolioLinksCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isPortfolioLinksCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isPortfolioLinksCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isPortfolioLinksCardExpanded && (
                            <div className="space-y-4">
                              {portfolioLinksData.links.map((link, index) => (
                                <div key={link.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                        {link.linkType?.toLowerCase().includes('github') ? (
                                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                          </svg>
                                        ) : link.linkType?.toLowerCase().includes('linkedin') ? (
                                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-semibold text-gray-900 mb-1">{link.title || link.linkType || '—'}</h4>
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {link.linkType || '—'}
                                          </span>
                                        </div>
                                        {link.description && (
                                          <p className="text-sm text-gray-600 mb-2">{link.description}</p>
                                        )}
                                        <a
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                          <span className="truncate">{link.url}</span>
                                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No portfolio links added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your first portfolio link</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Career Preferences Card Display */}
                {selectedItem.itemName === 'Career Preferences' && (
                  <div>
                    {careerPreferencesData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Career Preferences</h3>
                              <p className="text-sm text-gray-600">Your job search preferences and requirements</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsCareerPreferencesModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit career preferences"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete your career preferences?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found.');
                                      return;
                                    }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/career-preferences/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                      });
                                      if (!response.ok) throw new Error('Failed to delete career preferences');
                                      await refreshProfileData(candidateId);
                                      alert('Career preferences deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting career preferences:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting career preferences');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete career preferences"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsCareerPreferencesCardExpanded(!isCareerPreferencesCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isCareerPreferencesCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isCareerPreferencesCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isCareerPreferencesCardExpanded && (
                            <div className="space-y-6 pt-4 border-t border-gray-200">
                              {/* SECTION 1 - ROLE & DOMAIN */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  SECTION 1 — ROLE & DOMAIN
                                </h4>
                                <div className="space-y-3 pl-6">
                                  {/* Preferred Job Titles / Roles */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Preferred Job Titles / Roles</h5>
                                    {(careerPreferencesData.preferredJobTitles || (careerPreferencesData as any).preferredRoles) && 
                                     ((careerPreferencesData.preferredJobTitles || (careerPreferencesData as any).preferredRoles || []).length > 0) ? (
                                      <div className="flex flex-wrap gap-2">
                                        {(careerPreferencesData.preferredJobTitles || (careerPreferencesData as any).preferredRoles || []).map((title: string, index: number) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-gray-900"
                                          >
                                            {title}
                                          </span>
                                        ))}
                        </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">—</p>
                                    )}
                                  </div>

                                  {/* Preferred Industry */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Preferred Industry</h5>
                                    <p className="text-sm text-gray-700">{careerPreferencesData.preferredIndustry || '—'}</p>
                                  </div>

                                  {/* Functional Area */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Functional Area / Department</h5>
                                    <p className="text-sm text-gray-700">{careerPreferencesData.functionalArea || '—'}</p>
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 2 - JOB TYPE & WORK MODE */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  SECTION 2 — JOB TYPE & WORK MODE
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                  {/* Job Types */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Job Type</h5>
                                    {careerPreferencesData.jobTypes && careerPreferencesData.jobTypes.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {careerPreferencesData.jobTypes.map((jobType, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-green-50 border border-green-200 rounded-full text-sm text-gray-900"
                                          >
                                            {jobType}
                                          </span>
                                        ))}
                      </div>
                    ) : (
                                      <p className="text-sm text-gray-400">—</p>
                    )}
                  </div>

                                  {/* Work Mode */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Work Mode</h5>
                                    {(careerPreferencesData.workModes && careerPreferencesData.workModes.length > 0) || (careerPreferencesData as any).preferredWorkMode ? (
                                      <div className="flex flex-wrap gap-2">
                                        {careerPreferencesData.workModes && careerPreferencesData.workModes.length > 0 ? (
                                          careerPreferencesData.workModes.map((mode, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-sm text-gray-900"
                                          >
                                            {mode}
                                          </span>
                                          ))
                                        ) : (careerPreferencesData as any).preferredWorkMode ? (
                                          <span className="inline-flex items-center px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-sm text-gray-900">
                                            {(careerPreferencesData as any).preferredWorkMode}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">—</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 3 - LOCATION PREFERENCES */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  SECTION 3 — LOCATION PREFERENCES
                                </h4>
                                <div className="space-y-3 pl-6">
                                  {/* Preferred Work Locations */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Preferred Work Locations</h5>
                                    {careerPreferencesData.preferredLocations && careerPreferencesData.preferredLocations.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {careerPreferencesData.preferredLocations.map((location, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-sm text-gray-900"
                                          >
                                            {location}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400">—</p>
                                    )}
                                  </div>

                                  {/* Relocation Preference */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Relocation Preference</h5>
                                    <p className="text-sm text-gray-700">{careerPreferencesData.relocationPreference || '—'}</p>
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 4 - CURRENT SALARY */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  SECTION 4 — CURRENT SALARY
                                </h4>
                                <div className="space-y-3 pl-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h5 className="text-xs font-medium text-gray-700 mb-2">Current Salary</h5>
                                  <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-700">{(careerPreferencesData as any).currentCurrency || 'USD'}</span>
                                        <span className="text-sm text-gray-700">{(careerPreferencesData as any).currentSalary || '—'}</span>
                                        {(careerPreferencesData as any).currentSalaryType && (
                                          <span className="text-sm text-gray-500">({(careerPreferencesData as any).currentSalaryType})</span>
                                    )}
                                  </div>
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-medium text-gray-700 mb-2">Current Location</h5>
                                      <p className="text-sm text-gray-700">{(careerPreferencesData as any).currentLocation || '—'}</p>
                                    </div>
                                  </div>
                                  {(careerPreferencesData as any).currentBenefits && Array.isArray((careerPreferencesData as any).currentBenefits) && (careerPreferencesData as any).currentBenefits.length > 0 && (
                                    <div>
                                      <h5 className="text-xs font-medium text-gray-700 mb-2">Current Benefits</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {(careerPreferencesData as any).currentBenefits.map((benefit: string, index: number) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-sm text-gray-900"
                                          >
                                            {benefit}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* SECTION 5 - PREFERRED SALARY */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  SECTION 5 — PREFERRED SALARY
                                </h4>
                                <div className="space-y-3 pl-6">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">{(careerPreferencesData as any).preferredCurrency || careerPreferencesData.salaryCurrency || 'USD'}</span>
                                    <span className="text-sm text-gray-700">{(careerPreferencesData as any).preferredSalary || careerPreferencesData.salaryAmount || '—'}</span>
                                    {((careerPreferencesData as any).preferredSalaryType || careerPreferencesData.salaryFrequency) && (
                                      <span className="text-sm text-gray-500">({(careerPreferencesData as any).preferredSalaryType || careerPreferencesData.salaryFrequency})</span>
                                    )}
                                  </div>
                                  {!(careerPreferencesData as any).preferredSalary && !careerPreferencesData.salaryAmount && (
                                    <p className="text-sm text-gray-400">—</p>
                                  )}
                                  {(careerPreferencesData as any).preferredBenefits && Array.isArray((careerPreferencesData as any).preferredBenefits) && (careerPreferencesData as any).preferredBenefits.length > 0 && (
                                    <div className="mt-3">
                                      <h5 className="text-xs font-medium text-gray-700 mb-2">Preferred Benefits</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {(careerPreferencesData as any).preferredBenefits.map((benefit: string, index: number) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-sm text-gray-900"
                                          >
                                            {benefit}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* SECTION 6 - AVAILABILITY */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  SECTION 6 — AVAILABILITY
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                  {/* Availability to Start */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Availability to Start</h5>
                                    <p className="text-sm text-gray-700">{careerPreferencesData.availabilityToStart || '—'}</p>
                                  </div>

                                  {/* Notice Period */}
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-700 mb-2">Notice Period</h5>
                                    <p className="text-sm text-gray-700">{careerPreferencesData.noticePeriod || '—'}</p>
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 7 - PASSPORT NUMBERS */}
                              {(careerPreferencesData as any).passportNumbersByLocation && 
                               typeof (careerPreferencesData as any).passportNumbersByLocation === 'object' &&
                               Object.keys((careerPreferencesData as any).passportNumbersByLocation).length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                    </svg>
                                    SECTION 7 — PASSPORT NUMBERS
                                  </h4>
                                  <div className="space-y-2 pl-6">
                                    {Object.entries((careerPreferencesData as any).passportNumbersByLocation).map(([location, passportNumber]: [string, any]) => (
                                      <div key={location} className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-700 w-32">{location}:</span>
                                        <span className="text-sm text-gray-700">{passportNumber || '—'}</span>
                                      </div>
                                    ))}
                              </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No career preferences added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your career preferences</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Visa & Work Authorization Card Display */}
                {selectedItem.itemName === 'Visa & Work Authorization' && (
                  <div>
                    {visaWorkAuthorizationData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Visa & Work Authorization</h3>
                              <p className="text-sm text-gray-600">Your visa and work authorization details</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsVisaWorkAuthorizationModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit visa work authorization"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete your visa & work authorization information?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found.');
                                      return;
                                    }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/visa-work-authorization/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                      });
                                      if (!response.ok) throw new Error('Failed to delete visa work authorization');
                                      await refreshProfileData(candidateId);
                                      alert('Visa & work authorization deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting visa work authorization:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting visa work authorization');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete visa work authorization"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsVisaCardExpanded(!isVisaCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isVisaCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isVisaCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isVisaCardExpanded && (
                            <div className="space-y-6 pt-4 border-t border-gray-200">
                              {/* Selected Destination */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  SELECTED DESTINATION
                                </h4>
                                <div className="pl-6">
                                  <p className="text-sm text-gray-700">{visaWorkAuthorizationData.selectedDestination || '—'}</p>
                                </div>
                              </div>

                              {/* Visa Details Expected */}
                              {visaWorkAuthorizationData.visaDetailsExpected && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    VISA DETAILS (EXPECTED)
                                  </h4>
                                  <div className="pl-6 space-y-3">
                                    <div>
                                      <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Type</h5>
                                      <p className="text-sm text-gray-700">{visaWorkAuthorizationData.visaDetailsExpected.visaType || '—'}</p>
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Status</h5>
                                      <p className="text-sm text-gray-700">{visaWorkAuthorizationData.visaDetailsExpected.visaStatus || '—'}</p>
                                    </div>
                                    {visaWorkAuthorizationData.visaDetailsExpected.visaExpiryDate && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Expiry Date</h5>
                                        <p className="text-sm text-gray-700">{new Date(visaWorkAuthorizationData.visaDetailsExpected.visaExpiryDate).toLocaleDateString() || '—'}</p>
                                      </div>
                                    )}
                                    {visaWorkAuthorizationData.visaDetailsExpected.itemFamilyNumber && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-700 mb-1">Work Permit Number</h5>
                                        <p className="text-sm text-gray-700">{visaWorkAuthorizationData.visaDetailsExpected.itemFamilyNumber || '—'}</p>
                                      </div>
                                    )}
                                    {visaWorkAuthorizationData.visaDetailsExpected.documents && Array.isArray(visaWorkAuthorizationData.visaDetailsExpected.documents) && visaWorkAuthorizationData.visaDetailsExpected.documents.length > 0 && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-700 mb-2">Documents</h5>
                                        <div className="flex flex-wrap gap-2">
                                          {visaWorkAuthorizationData.visaDetailsExpected.documents.map((doc, index) => (
                                            <a
                                              key={index}
                                              href={getApiDocumentHref(doc)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                              </svg>
                                              <span>{getDocumentName(doc)}</span>
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Visa Entries */}
                              {visaWorkAuthorizationData.visaEntries && Array.isArray(visaWorkAuthorizationData.visaEntries) && visaWorkAuthorizationData.visaEntries.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    VISA ENTRIES ({visaWorkAuthorizationData.visaEntries.length})
                                  </h4>
                                  <div className="pl-6 space-y-3">
                                    {visaWorkAuthorizationData.visaEntries.map((entry: any, index: number) => (
                                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="space-y-2">
                                          <div>
                                            <h5 className="text-xs font-medium text-gray-700 mb-1">Country</h5>
                                            <p className="text-sm text-gray-900">{entry.countryName || entry.country || '—'}</p>
                                          </div>
                                          {entry.visaDetails && (
                                            <>
                                              <div>
                                                <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Type</h5>
                                                <p className="text-sm text-gray-900">{entry.visaDetails.visaType || '—'}</p>
                                              </div>
                                              <div>
                                                <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Status</h5>
                                                <p className="text-sm text-gray-900">{entry.visaDetails.visaStatus || '—'}</p>
                                              </div>
                                              {entry.visaDetails.visaExpiryDate && (
                                                <div>
                                                  <h5 className="text-xs font-medium text-gray-700 mb-1">Visa Expiry Date</h5>
                                                  <p className="text-sm text-gray-900">{new Date(entry.visaDetails.visaExpiryDate).toLocaleDateString() || '—'}</p>
                                                </div>
                                              )}
                                              {entry.visaDetails.itemFamilyNumber && (
                                                <div>
                                                  <h5 className="text-xs font-medium text-gray-700 mb-1">Work Permit Number</h5>
                                                  <p className="text-sm text-gray-900">{entry.visaDetails.itemFamilyNumber || '—'}</p>
                                                </div>
                                              )}
                                              {entry.visaDetails.documents && Array.isArray(entry.visaDetails.documents) && entry.visaDetails.documents.length > 0 && (
                                                <div>
                                                  <h5 className="text-xs font-medium text-gray-700 mb-2">Documents</h5>
                                                  <div className="flex flex-wrap gap-2">
                                                    {entry.visaDetails.documents.map((doc: any, docIndex: number) => (
                                                      <a
                                                        key={docIndex}
                                                        href={getApiDocumentHref(doc)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                                      >
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                        </svg>
                                                        <span>{getDocumentName(doc)}</span>
                                                      </a>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Visa Workpermit Required */}
                              {visaWorkAuthorizationData.visaWorkpermitRequired && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    VISA/WORKPERMIT REQUIRED
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700">{visaWorkAuthorizationData.visaWorkpermitRequired || '—'}</p>
                                  </div>
                                </div>
                              )}

                              {/* Open For All */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  OPEN FOR ALL
                                </h4>
                                <div className="pl-6">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${visaWorkAuthorizationData.openForAll ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {visaWorkAuthorizationData.openForAll ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>

                              {/* Additional Remarks */}
                              {visaWorkAuthorizationData.additionalRemarks && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    ADDITIONAL REMARKS
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{visaWorkAuthorizationData.additionalRemarks || '—'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No visa & work authorization information added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your visa & work authorization details</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Vaccination Card Display */}
                {selectedItem.itemName === 'Vaccination' && (
                  <div>
                    {vaccinationData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Vaccination Details</h3>
                              <p className="text-sm text-gray-600">Your vaccination status and certificate</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsVaccinationModalOpen(true)}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all"
                                aria-label="Edit vaccination details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete your vaccination information?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found.');
                                      return;
                                    }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/vaccination/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                      });
                                      if (!response.ok) throw new Error('Failed to delete vaccination');
                                      await refreshProfileData(candidateId);
                                      alert('Vaccination information deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting vaccination:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting vaccination');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete vaccination details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsVaccinationCardExpanded(!isVaccinationCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isVaccinationCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isVaccinationCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isVaccinationCardExpanded && (
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                              {/* Vaccination Status */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  VACCINATION STATUS
                                </h4>
                                <div className="pl-6">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${vaccinationData.vaccineType || vaccinationData.lastVaccinationDate || vaccinationData.certificate ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {vaccinationData.vaccineType || vaccinationData.lastVaccinationDate || vaccinationData.certificate ? 'Provided' : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Vaccine Type */}
                              {vaccinationData.vaccineType && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    VACCINE TYPE
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700">{vaccinationData.vaccineType || '—'}</p>
                                  </div>
                                </div>
                              )}

                              {/* Last Vaccination Date */}
                              {vaccinationData.lastVaccinationDate && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    LAST VACCINATION DATE
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700">{new Date(vaccinationData.lastVaccinationDate).toLocaleDateString() || '—'}</p>
                                  </div>
                                </div>
                              )}

                              {/* Certificate */}
                              {vaccinationData.certificate && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    VACCINATION CERTIFICATE
                                  </h4>
                                  <div className="pl-6">
                                    <a
                                      href={typeof vaccinationData.certificate === 'string' ? `${API_BASE_URL}${vaccinationData.certificate}` : `${API_BASE_URL}${vaccinationData.certificate}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      <span>{typeof vaccinationData.certificate === 'string' ? vaccinationData.certificate.split('/').pop() : 'View Certificate'}</span>
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No vaccination information added yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to add your vaccination details</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Resume Card Display */}
                {selectedItem.itemName === 'Resume' && (
                  <div>
                    {resumeData ? (
                      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                        <div className="pl-6 pr-6 pt-5 pb-5">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-1">Resume / CV</h3>
                              <p className="text-sm text-gray-600">Your uploaded resume document</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete your resume?')) {
                                    const candidateId = sessionStorage.getItem('candidateId');
                                    if (!candidateId) {
                                      alert('Candidate ID not found.');
                                      return;
                                    }
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/profile/resume/${candidateId}`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                      });
                                      if (!response.ok) throw new Error('Failed to delete resume');
                                      await refreshProfileData(candidateId);
                                      alert('Resume deleted successfully');
                                    } catch (error) {
                                      console.error('Error deleting resume:', error);
                                      alert(error instanceof Error ? error.message : 'Error deleting resume');
                                    }
                                  }
                                }}
                                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                                aria-label="Delete resume"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setIsResumeCardExpanded(!isResumeCardExpanded)}
                                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                aria-label={isResumeCardExpanded ? 'Collapse' : 'Expand'}
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform duration-200 ${isResumeCardExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isResumeCardExpanded && (
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                              {/* File Name */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  FILE NAME
                                </h4>
                                <div className="pl-6">
                                  <p className="text-sm text-gray-700">{resumeData.fileName || '—'}</p>
                                </div>
                              </div>

                              {/* File Size */}
                              {resumeData.fileSize && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    FILE SIZE
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700">
                                      {resumeData.fileSize < 1024 
                                        ? `${resumeData.fileSize} B` 
                                        : resumeData.fileSize < 1024 * 1024 
                                        ? `${(resumeData.fileSize / 1024).toFixed(2)} KB` 
                                        : `${(resumeData.fileSize / (1024 * 1024)).toFixed(2)} MB`}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Upload Date */}
                              {resumeData.uploadedDate && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    UPLOADED DATE
                                  </h4>
                                  <div className="pl-6">
                                    <p className="text-sm text-gray-700">{new Date(resumeData.uploadedDate).toLocaleDateString() || '—'}</p>
                                  </div>
                                </div>
                              )}

                              {/* ATS Score */}
                              {resumeData.atsScore !== null && resumeData.atsScore !== undefined && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    ATS SCORE
                                  </h4>
                                  <div className="pl-6">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                                        <div 
                                          className={`h-2.5 rounded-full ${
                                            resumeData.atsScore >= 80 ? 'bg-green-600' : 
                                            resumeData.atsScore >= 60 ? 'bg-yellow-600' : 
                                            'bg-red-600'
                                          }`}
                                          style={{ width: `${resumeData.atsScore}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-sm font-medium text-gray-700">{resumeData.atsScore}/100</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* AI Analyzed Status */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  AI ANALYZED
                                </h4>
                                <div className="pl-6">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${resumeData.aiAnalyzed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {resumeData.aiAnalyzed ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>

                              {/* Download/View Resume */}
                              {resumeData.fileUrl && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    RESUME FILE
                                  </h4>
                                  <div className="pl-6">
                                    <a
                                      href={`${API_BASE_URL}${resumeData.fileUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View / Download Resume
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="mt-4 text-base font-medium text-gray-900">No resume uploaded yet</p>
                        <p className="mt-2 text-sm text-gray-500">Click "Add" to upload your resume</p>
                      </div>
                    )}
                  </div>
                )}

                {!['Basic Information', 'Summary', 'Gap Explanation', 'Work Experience', 'Internships', 'Education', 'Academic Achievements', 'Competitive Exams', 'Skills', 'Languages', 'Projects', 'Portfolio Links', 'Career Preferences', 'Visa & Work Authorization', 'Vaccination', 'Resume'].includes(selectedItem.itemName) && (
                  <div>
                    <p className="text-base text-gray-500">Content for {selectedItem.itemName} will be displayed here.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <BasicInfoModal
        isOpen={isBasicInfoModalOpen}
        onClose={() => setIsBasicInfoModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            const response = await fetch(`${API_BASE_URL}/profile/personal-info/${candidateId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Failed to save personal information');
            }

            await refreshProfileData(candidateId);
          setIsBasicInfoModalOpen(false);
          } catch (error) {
            console.error('Error saving personal info:', error);
            alert('Error saving personal information');
          }
        }}
        initialData={basicInfoData}
      />

      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryText={summaryText}
        onSummaryChange={setSummaryText}
        onSave={async () => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            const response = await fetch(`${API_BASE_URL}/profile/summary/${candidateId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ summaryText }),
            });

            if (!response.ok) {
              throw new Error('Failed to save summary');
            }

            await refreshProfileData(candidateId);
          setIsSummaryModalOpen(false);
          } catch (error) {
            console.error('Error saving summary:', error);
            alert('Error saving summary');
          }
        }}
      />

      <GapExplanationModal
        isOpen={isGapExplanationModalOpen}
        onClose={() => setIsGapExplanationModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            const response = await fetch(`${API_BASE_URL}/profile/gap-explanation/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Failed to save gap explanation');
            }

            await refreshProfileData(candidateId);
          setIsGapExplanationModalOpen(false);
          } catch (error) {
            console.error('Error saving gap explanation:', error);
            alert('Error saving gap explanation');
          }
        }}
        initialData={gapExplanationData}
      />

      <WorkExperienceModal
        isOpen={isWorkExperienceModalOpen}
        onClose={() => {
          setIsWorkExperienceModalOpen(false);
          setEditingWorkExperienceId(null);
        }}
        initialData={editingWorkExperienceId ? (() => {
          // If editing a specific entry, pass only that entry
          const entryToEdit = workExperienceData?.workExperiences?.find(e => e.id === editingWorkExperienceId);
          return entryToEdit ? { workExperiences: [entryToEdit] } : undefined;
        })() : workExperienceData}
        onAddEntry={async (entry) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return null;

          try {
            // Upload documents first if any
            let documentUrls: string[] = [];
            if (entry.documents && entry.documents.length > 0) {
              const filesToUpload = entry.documents.filter(doc => doc.file instanceof File);
              if (filesToUpload.length > 0) {
                const formData = new FormData();
                filesToUpload.forEach(doc => {
                  if (doc.file instanceof File) {
                    formData.append('documents', doc.file);
                  }
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/work-experience/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  documentUrls = uploadResult.data?.documents?.map((d: any) => d.url) || [];
                } else {
                  console.warn('Failed to upload documents, continuing without them');
                }
              }

              // Include existing URLs (from database)
              const existingUrls = entry.documents
                .filter(doc => typeof doc === 'string' || (typeof doc === 'object' && doc.url && !(doc.file instanceof File)))
                .map(doc => typeof doc === 'string' ? doc : (doc as any).url);
              documentUrls = [...documentUrls, ...existingUrls];
            }

            // Save new work experience entry with document URLs
            const entryToSave = {
              ...entry,
              documents: documentUrls,
            };

            const response = await fetch(`${API_BASE_URL}/profile/work-experience/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(entryToSave),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
              console.error('❌ Work experience save error:', errorMessage, errorData);
              throw new Error(errorMessage);
            }

            const result = await response.json();
            // Return the saved entry with database ID and document URLs
            return {
              ...entry,
              id: result.data?.id || entry.id,
              documents: documentUrls.map(url => ({ id: Date.now().toString(), url, name: url.split('/').pop() || 'document' })),
            };
          } catch (error) {
            console.error('Error saving work experience entry:', error);
            throw error;
          }
        }}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) {
            alert('Candidate ID not found. Please refresh the page.');
            return;
          }

          if (!data.workExperiences || data.workExperiences.length === 0) {
            // No entries to save, just close the modal
            setIsWorkExperienceModalOpen(false);
            return;
          }

          try {
            // Save all work experience entries
            for (const exp of data.workExperiences) {
              // Upload documents first if any new files
              let documentUrls: string[] = [];
              if (exp.documents && exp.documents.length > 0) {
                const filesToUpload = exp.documents.filter(doc => doc.file instanceof File);
                if (filesToUpload.length > 0) {
                  const formData = new FormData();
                  filesToUpload.forEach(doc => {
                    if (doc.file instanceof File) {
                      formData.append('documents', doc.file);
                    }
                  });

                  const uploadResponse = await fetch(`${API_BASE_URL}/profile/work-experience/documents/${candidateId}`, {
                    method: 'POST',
                    body: formData,
                  });

                  if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    documentUrls = uploadResult.data?.documents?.map((d: any) => d.url) || [];
                  } else {
                    console.warn('Failed to upload documents, continuing without them');
                  }
                }

                // Include existing URLs (from database)
                const existingUrls = exp.documents
                  .filter(doc => typeof doc === 'string' || (typeof doc === 'object' && doc.url && !(doc.file instanceof File)))
                  .map(doc => typeof doc === 'string' ? doc : (doc as any).url);
                documentUrls = [...documentUrls, ...existingUrls];
              }

              const expToSave = {
                ...exp,
                documents: documentUrls,
              };

              if (isPersistedId(exp.id)) {
                // Update existing entry
                const response = await fetch(`${API_BASE_URL}/profile/work-experience/${exp.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(expToSave),
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.message || 'Failed to update work experience');
                }
              } else {
                // Create new entry (in case it wasn't saved via onAddEntry)
                const response = await fetch(`${API_BASE_URL}/profile/work-experience/${candidateId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(expToSave),
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.message || 'Failed to save work experience');
                }

                // Update the entry ID with the database ID
                const result = await response.json();
                if (result.data?.id) {
                  exp.id = result.data.id;
                }
              }
            }

            // Refresh profile data to get latest from database
            await refreshProfileData(candidateId);
          setWorkExperienceData(data);
          setIsWorkExperienceModalOpen(false);
            setEditingWorkExperienceId(null);
          } catch (error) {
            console.error('❌ Error saving work experience:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error saving work experience: ${errorMessage}`);
          }
        }}
      />

      <InternshipModal
        isOpen={isInternshipModalOpen}
        onClose={() => setIsInternshipModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload documents first if any
            let documentUrls: string[] = [];
            if (data.documents && data.documents.length > 0) {
              const filesToUpload = data.documents.filter(doc => doc.file instanceof File);
              if (filesToUpload.length > 0) {
                const formData = new FormData();
                filesToUpload.forEach(doc => {
                  if (doc.file instanceof File) {
                    formData.append('documents', doc.file);
                  }
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/internship/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  documentUrls = uploadResult.data?.documents?.map((d: any) => d.url) || [];
                } else {
                  console.warn('Failed to upload documents, continuing without them');
                }
              }

              // Include existing URLs (from database)
              const existingUrls = data.documents
                .filter(doc => typeof doc === 'string' || (typeof doc === 'object' && doc.url && !(doc.file instanceof File)))
                .map(doc => typeof doc === 'string' ? doc : (doc as any).url);
              documentUrls = [...documentUrls, ...existingUrls];
            }

            // Save internship with document URLs
            const internshipToSave = {
              ...data,
              documents: documentUrls,
            };

            const response = await fetch(`${API_BASE_URL}/profile/internship/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(internshipToSave),
            });

            if (!response.ok) {
              throw new Error('Failed to save internship');
            }

            await refreshProfileData(candidateId);
          setIsInternshipModalOpen(false);
          } catch (error) {
            console.error('Error saving internship:', error);
            alert('Error saving internship');
          }
        }}
        initialData={internshipData}
      />

      <EducationModal
        isOpen={isEducationModalOpen}
        onClose={() => {
          setIsEducationModalOpen(false);
          setEditingEducationId(null);
        }}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (candidateId) {
            try {
              // Upload documents first if any
              let documentUrls: string[] = [];
              if (data.documents && data.documents.length > 0) {
                const filesToUpload = data.documents.filter(doc => doc.file instanceof File);
                if (filesToUpload.length > 0) {
                  const formData = new FormData();
                  filesToUpload.forEach(doc => {
                    if (doc.file instanceof File) {
                      formData.append('documents', doc.file);
                    }
                  });

                  const uploadResponse = await fetch(`${API_BASE_URL}/profile/education/documents/${candidateId}`, {
                    method: 'POST',
                    body: formData,
                  });

                  if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    documentUrls = uploadData.data?.documents?.map((doc: any) => doc.url) || [];
                  } else {
                    throw new Error('Failed to upload documents');
                  }
                }

                // Include existing document URLs (from database)
                const existingUrls = data.documents
                  .filter(doc => doc.url && !doc.file)
                  .map(doc => doc.url!)
                  .filter(Boolean);
                documentUrls = [...documentUrls, ...existingUrls];
              }

              // Prepare education data with document URLs
              const educationData = {
                ...data,
                documents: documentUrls,
              };

              const url = isPersistedId(data.id)
                ? `${API_BASE_URL}/profile/education/${data.id}`
                : `${API_BASE_URL}/profile/education/${candidateId}`;
              const method = isPersistedId(data.id) ? 'PUT' : 'POST';

              const response = await fetch(url, {
                method,
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(educationData),
              });

              if (response.ok) {
                setIsEducationModalOpen(false);
                setEditingEducationId(null);
                await refreshProfileData(candidateId);
              } else {
                alert('Failed to save education');
              }
            } catch (error) {
              console.error('Error saving education:', error);
              alert(error instanceof Error ? error.message : 'Error saving education');
            }
          }
        }}
        initialData={editingEducationId ? (() => {
          // If editing a specific entry, pass only that entry
          const entryToEdit = educationData?.educations?.find(e => e.id === editingEducationId);
          return entryToEdit;
        })() : undefined}
      />

      <AcademicAchievementModal
        isOpen={isAcademicAchievementModalOpen}
        onClose={() => setIsAcademicAchievementModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload documents first if any
            let documentUrls: string[] = [];
            if (data.documents && data.documents.length > 0) {
              const filesToUpload = data.documents.filter(doc => doc.file instanceof File);
              if (filesToUpload.length > 0) {
                const formData = new FormData();
                filesToUpload.forEach(doc => {
                  if (doc.file instanceof File) {
                    formData.append('documents', doc.file);
                  }
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/academic-achievement/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (uploadResponse.ok) {
                  const uploadData = await uploadResponse.json();
                  documentUrls = uploadData.data?.documents?.map((doc: any) => doc.url) || [];
                } else {
                  throw new Error('Failed to upload documents');
                }
              }

              // Include existing document URLs (from database)
              const existingUrls = data.documents
                .filter(doc => doc.url && !doc.file)
                .map(doc => doc.url!)
                .filter(Boolean);
              documentUrls = [...documentUrls, ...existingUrls];
            }

            // Prepare academic achievement data with document URLs
            const achievementData = {
              ...data,
              documents: documentUrls,
            };

            const response = await fetch(`${API_BASE_URL}/profile/academic-achievement/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(achievementData),
            });

            if (!response.ok) {
              throw new Error('Failed to save academic achievement');
            }

            await refreshProfileData(candidateId);
          setIsAcademicAchievementModalOpen(false);
          } catch (error) {
            console.error('Error saving academic achievement:', error);
            alert(error instanceof Error ? error.message : 'Error saving academic achievement');
          }
        }}
        initialData={academicAchievementData}
      />

      <CompetitiveExamsModal
        isOpen={isCompetitiveExamsModalOpen}
        onClose={() => setIsCompetitiveExamsModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload documents if there are any new files
            let documentUrls: string[] = [];
            if (data.documents && data.documents.length > 0) {
              const filesToUpload = data.documents.filter(doc => doc.file);
              const existingUrls = data.documents.filter(doc => doc.url && !doc.file).map(doc => doc.url!);

              if (filesToUpload.length > 0) {
                const formData = new FormData();
                filesToUpload.forEach(doc => {
                  if (doc.file) {
                    formData.append('documents', doc.file);
                  }
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/competitive-exam/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (!uploadResponse.ok) {
                  throw new Error('Failed to upload documents');
                }

                const uploadResult = await uploadResponse.json();
                documentUrls = [...existingUrls, ...uploadResult.files];
              } else {
                documentUrls = existingUrls;
              }
            }

            // Save the competitive exam data with document URLs
            const saveData = {
              ...data,
              documents: documentUrls,
            };

            const response = await fetch(`${API_BASE_URL}/profile/competitive-exam/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(saveData),
            });

            if (!response.ok) {
              throw new Error('Failed to save competitive exam');
            }

            await refreshProfileData(candidateId);
          setIsCompetitiveExamsModalOpen(false);
          } catch (error) {
            console.error('Error saving competitive exam:', error);
            alert('Error saving competitive exam');
          }
        }}
        initialData={competitiveExamsData}
      />

      <SkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (candidateId) {
            try {
              const response = await fetch(`${API_BASE_URL}/profile/skills/${candidateId}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              });

              if (response.ok) {
          setSkillsData(data);
          setIsSkillsModalOpen(false);
                await refreshProfileData(candidateId);
              } else {
                alert('Failed to save skills');
              }
            } catch (error) {
              console.error('Error saving skills:', error);
              alert('Error saving skills');
            }
          }
        }}
        initialData={skillsData}
      />

      <LanguagesModal
        isOpen={isLanguagesModalOpen}
        onClose={() => setIsLanguagesModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (candidateId) {
            try {
              // Upload documents for each language
              const languagesWithUploadedDocs = await Promise.all(
                data.languages.map(async (lang) => {
                  if (lang.documents && lang.documents.length > 0) {
                    const filesToUpload = lang.documents.filter(doc => doc.file);
                    if (filesToUpload.length > 0) {
                      const formData = new FormData();
                      filesToUpload.forEach(doc => {
                        if (doc.file) formData.append('documents', doc.file);
                      });

                      const uploadResponse = await fetch(`${API_BASE_URL}/profile/languages/documents/${candidateId}`, {
                        method: 'POST',
                        body: formData,
                      });

                      if (uploadResponse.ok) {
                        const uploadResult = await uploadResponse.json();
                        const existingDocs = lang.documents.filter(doc => doc.url).map(doc => typeof doc === 'string' ? doc : doc.url || '');
                        return {
                          ...lang,
                          documents: [...existingDocs, ...uploadResult.files],
                        };
                      }
                    }
                  }
                  return {
                    ...lang,
                    documents: lang.documents ? lang.documents.map(doc => typeof doc === 'string' ? doc : doc.url || '').filter(Boolean) : [],
                  };
                })
              );

              const response = await fetch(`${API_BASE_URL}/profile/languages/${candidateId}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ languages: languagesWithUploadedDocs }),
              });

              if (response.ok) {
                setLanguagesData({ languages: languagesWithUploadedDocs });
          setIsLanguagesModalOpen(false);
                await refreshProfileData(candidateId);
              } else {
                alert('Failed to save languages');
              }
            } catch (error) {
              console.error('Error saving languages:', error);
              alert('Error saving languages');
            }
          }
        }}
        initialData={languagesData}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload documents if there are any new files
            let documentUrls: string[] = [];
            if (data.documents && data.documents.length > 0) {
              const filesToUpload = data.documents.filter(doc => doc.file);
              const existingUrls = data.documents.filter(doc => doc.url && !doc.file).map(doc => doc.url!);

              if (filesToUpload.length > 0) {
                const formData = new FormData();
                filesToUpload.forEach(doc => {
                  if (doc.file) {
                    formData.append('documents', doc.file);
                  }
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/project/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  documentUrls = [...existingUrls, ...uploadResult.files];
                } else {
                  throw new Error('Failed to upload documents');
                }
              } else {
                documentUrls = existingUrls;
              }
            }

            const response = await fetch(`${API_BASE_URL}/profile/project/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...data,
                documents: documentUrls,
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to save project');
            }

            await refreshProfileData(candidateId);
          setIsProjectModalOpen(false);
          } catch (error) {
            console.error('Error saving project:', error);
            alert('Error saving project');
          }
        }}
        initialData={projectData}
      />

      <PortfolioLinksModal
        isOpen={isPortfolioLinksModalOpen}
        onClose={() => setIsPortfolioLinksModalOpen(false)}
        onSave={async (data) => {
          // This is called when closing the modal with all links
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            const response = await fetch(`${API_BASE_URL}/profile/portfolio-links/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Failed to save portfolio links');
            }

            await refreshProfileData(candidateId);
          } catch (error) {
            console.error('Error saving portfolio links:', error);
            alert('Error saving portfolio links');
          }
        }}
        onAddLink={async (link) => {
          // Save individual link immediately to database
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Get current links
            const currentLinks = portfolioLinksData?.links || [];
            const updatedLinks = link.id && currentLinks.some(l => l.id === link.id)
              ? currentLinks.map(l => l.id === link.id ? link : l)
              : [...currentLinks, link];

            const response = await fetch(`${API_BASE_URL}/profile/portfolio-links/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ links: updatedLinks }),
            });

            if (!response.ok) {
              throw new Error('Failed to save portfolio link');
            }

            // Refresh profile data to get updated links
            await refreshProfileData(candidateId);
          } catch (error) {
            console.error('Error saving portfolio link:', error);
            alert('Error saving portfolio link');
          }
        }}
        initialData={portfolioLinksData}
      />

      <CertificationModal
        isOpen={isCertificationModalOpen}
        onClose={() => {
          setIsCertificationModalOpen(false);
          setEditingCertificationId(null);
        }}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Process each certification and upload documents
            const processedCertifications = await Promise.all(
              data.certifications.map(async (cert) => {
                let documentUrls: string[] = [];
                
                // Upload new documents if any
                if (cert.documents && cert.documents.length > 0) {
                  const filesToUpload = cert.documents.filter(doc => doc.file instanceof File);
                  if (filesToUpload.length > 0) {
                    const formData = new FormData();
                    filesToUpload.forEach(doc => {
                      if (doc.file instanceof File) {
                        formData.append('documents', doc.file);
                      }
                    });

                    const uploadResponse = await fetch(`${API_BASE_URL}/profile/certification/documents/${candidateId}`, {
                      method: 'POST',
                      body: formData,
                    });

                    if (uploadResponse.ok) {
                      const uploadResult = await uploadResponse.json();
                      documentUrls = uploadResult.data?.documents?.map((d: any) => d.url) || [];
                    } else {
                      console.warn('Failed to upload documents, continuing without them');
                    }
                  }

                  // Include existing URLs (from database)
                  const existingUrls = cert.documents
                    .filter(doc => typeof doc === 'string' || (typeof doc === 'object' && doc.url && !(doc.file instanceof File)))
                    .map(doc => typeof doc === 'string' ? doc : (doc as any).url);
                  documentUrls = [...documentUrls, ...existingUrls];
                }

                return {
                  ...cert,
                  certificateFile: serializeMaybeFile(cert.certificateFile),
                  documents: documentUrls,
                };
              })
            );

            const payload = {
              certifications: processedCertifications,
            };

            const response = await fetch(`${API_BASE_URL}/profile/certifications/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error('Failed to save certifications');
            }

            await refreshProfileData(candidateId);
            setIsCertificationModalOpen(false);
            setEditingCertificationId(null);
          } catch (error) {
            console.error('Error saving certifications:', error);
            alert('Error saving certifications');
          }
        }}
        initialData={editingCertificationId ? (() => {
          // When editing, pass only the certification being edited
          const certToEdit = certificationsData?.certifications?.find(c => c.id === editingCertificationId);
          return certToEdit ? { certifications: [certToEdit] } : certificationsData;
        })() : certificationsData}
      />

      <AccomplishmentModal
        isOpen={isAccomplishmentModalOpen}
        onClose={() => {
          setIsAccomplishmentModalOpen(false);
          setEditingAccomplishmentId(null);
        }}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Process each accomplishment and upload documents
            const processedAccomplishments = await Promise.all(
              data.accomplishments.map(async (acc) => {
                let documentUrls: string[] = [];
                
                // Upload new documents if any
                if (acc.documents && acc.documents.length > 0) {
                  const filesToUpload = acc.documents.filter(doc => doc.file instanceof File);
                  if (filesToUpload.length > 0) {
                    const formData = new FormData();
                    filesToUpload.forEach(doc => {
                      if (doc.file instanceof File) {
                        formData.append('documents', doc.file);
                      }
                    });

                    const uploadResponse = await fetch(`${API_BASE_URL}/profile/accomplishment/documents/${candidateId}`, {
                      method: 'POST',
                      body: formData,
                    });

                    if (uploadResponse.ok) {
                      const uploadResult = await uploadResponse.json();
                      documentUrls = uploadResult.data?.documents?.map((d: any) => d.url) || [];
                    } else {
                      console.warn('Failed to upload documents, continuing without them');
                    }
                  }

                  // Include existing URLs (from database)
                  const existingUrls = acc.documents
                    .filter(doc => typeof doc === 'string' || (typeof doc === 'object' && doc.url && !(doc.file instanceof File)))
                    .map(doc => typeof doc === 'string' ? doc : (doc as any).url);
                  documentUrls = [...documentUrls, ...existingUrls];
                }

                return {
                  ...acc,
                  supportingDocument: serializeMaybeFile(acc.supportingDocument),
                  documents: documentUrls,
                };
              })
            );

            const payload = {
              accomplishments: processedAccomplishments,
            };

            const response = await fetch(`${API_BASE_URL}/profile/accomplishments/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error('Failed to save accomplishments');
            }

            await refreshProfileData(candidateId);
            setIsAccomplishmentModalOpen(false);
            setEditingAccomplishmentId(null);
          } catch (error) {
            console.error('Error saving accomplishments:', error);
            alert('Error saving accomplishments');
          }
        }}
        initialData={editingAccomplishmentId ? (() => {
          // When editing, pass only the accomplishment being edited
          const accToEdit = accomplishmentsData?.accomplishments?.find(a => a.id === editingAccomplishmentId);
          return accToEdit ? { accomplishments: [accToEdit] } : accomplishmentsData;
        })() : accomplishmentsData}
      />

      <CareerPreferencesModal
        isOpen={isCareerPreferencesModalOpen}
        onClose={() => setIsCareerPreferencesModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (candidateId) {
            try {
              const response = await fetch(`${API_BASE_URL}/profile/career-preferences/${candidateId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              });

              if (response.ok) {
                await refreshProfileData(candidateId);
          setIsCareerPreferencesModalOpen(false);
              } else {
                alert('Failed to save career preferences');
              }
            } catch (error) {
              console.error('Error saving career preferences:', error);
              alert('Error saving career preferences');
            }
          }
        }}
        initialData={careerPreferencesData}
      />

      <VisaWorkAuthorizationModal
        isOpen={isVisaWorkAuthorizationModalOpen}
        onClose={() => setIsVisaWorkAuthorizationModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload documents if they are File objects
            const processedData = { ...data };

            // Process visaDetailsExpected documents
            if (processedData.visaDetailsExpected?.documents) {
              const documentsToUpload = processedData.visaDetailsExpected.documents.filter((doc: any) => {
                // `documents` may contain either `File` or objects like `{ file: File|string, ... }`
                return doc instanceof File || doc?.file instanceof File;
              });
              const existingDocuments = processedData.visaDetailsExpected.documents.filter((doc: any) => {
                return !(doc instanceof File || doc?.file instanceof File);
              });

              if (documentsToUpload.length > 0) {
                const formData = new FormData();
                documentsToUpload.forEach((doc: any) => {
                  const file: File | undefined = doc instanceof File ? doc : doc?.file;
                  if (file) formData.append('documents', file);
                });

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/visa-work-authorization/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (!uploadResponse.ok) {
                  throw new Error('Failed to upload documents');
                }

                const uploadResult = await uploadResponse.json();
                processedData.visaDetailsExpected.documents = [
                  ...existingDocuments.map((doc: any) => (typeof doc === 'string' ? doc : doc.url || doc)),
                  ...uploadResult.files,
                ];
              } else {
                processedData.visaDetailsExpected.documents = existingDocuments.map((doc: any) => (typeof doc === 'string' ? doc : doc.url || doc));
              }
            }

            // Process visaEntries documents
            if (Array.isArray(processedData.visaEntries)) {
              for (const entry of processedData.visaEntries) {
                if (entry.visaDetails?.documents) {
                  const documentsToUpload = entry.visaDetails.documents.filter((doc: any) => {
                    return doc instanceof File || doc?.file instanceof File;
                  });
                  const existingDocuments = entry.visaDetails.documents.filter((doc: any) => {
                    return !(doc instanceof File || doc?.file instanceof File);
                  });

                  if (documentsToUpload.length > 0) {
                    const formData = new FormData();
                    documentsToUpload.forEach((doc: any) => {
                      const file: File | undefined = doc instanceof File ? doc : doc?.file;
                      if (file) formData.append('documents', file);
                    });

                    const uploadResponse = await fetch(`${API_BASE_URL}/profile/visa-work-authorization/documents/${candidateId}`, {
                      method: 'POST',
                      body: formData,
                    });

                    if (!uploadResponse.ok) {
                      throw new Error('Failed to upload documents');
                    }

                    const uploadResult = await uploadResponse.json();
                    entry.visaDetails.documents = [
                      ...existingDocuments.map((doc: any) => (typeof doc === 'string' ? doc : doc.url || doc)),
                      ...uploadResult.files,
                    ];
                  } else {
                    entry.visaDetails.documents = existingDocuments.map((doc: any) => (typeof doc === 'string' ? doc : doc.url || doc));
                  }
                }
              }
            }

            const response = await fetch(`${API_BASE_URL}/profile/visa-work-authorization/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(serializeVisaData(processedData)),
            });

            if (!response.ok) {
              throw new Error('Failed to save visa work authorization');
            }

            await refreshProfileData(candidateId);
          setIsVisaWorkAuthorizationModalOpen(false);
          } catch (error) {
            console.error('Error saving visa work authorization:', error);
            alert('Error saving visa work authorization');
          }
        }}
        initialData={visaWorkAuthorizationData}
      />

      <VaccinationModal
        isOpen={isVaccinationModalOpen}
        onClose={() => setIsVaccinationModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // Upload certificate if it's a File object
            let certificateUrl = null;
            if (data.certificate) {
              if (data.certificate instanceof File) {
                const formData = new FormData();
                formData.append('documents', data.certificate);

                const uploadResponse = await fetch(`${API_BASE_URL}/profile/vaccination/documents/${candidateId}`, {
                  method: 'POST',
                  body: formData,
                });

                if (!uploadResponse.ok) {
                  throw new Error('Failed to upload certificate');
                }

                const uploadResult = await uploadResponse.json();
                certificateUrl = uploadResult.files[0]; // Get the first uploaded file URL
              } else if (typeof data.certificate === 'string') {
                certificateUrl = data.certificate;
              }
            }

            const payload = {
              ...data,
              certificate: certificateUrl,
            };

            const response = await fetch(`${API_BASE_URL}/profile/vaccination/${candidateId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.message || errorData.error || 'Failed to save vaccination';
              throw new Error(errorMessage);
            }

            // Try to refresh profile data, but don't fail if it errors
            try {
            await refreshProfileData(candidateId);
            } catch (refreshError) {
              console.warn('⚠️ Failed to refresh profile data after saving vaccination:', refreshError);
              // Don't throw - the save was successful, just the refresh failed
            }
            
          setIsVaccinationModalOpen(false);
          } catch (error) {
            console.error('Error saving vaccination:', error);
            alert(`Error saving vaccination: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }}
        initialData={vaccinationData}
      />

      {/* Warning Banner for Resume */}
      {isResumeModalOpen && isMandatorySectionMissing('RESUME', 'Resume') && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-60 w-full max-w-2xl px-4">
          <div className="bg-red-50 border border-red-400 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">
                  ⚠️ Upload your resume to complete your profile.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Resume is required to reach 100% profile completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ResumeModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onSave={async (data) => {
          const candidateId = sessionStorage.getItem('candidateId');
          if (!candidateId) return;

          try {
            // If there's a file to upload, upload it first
            if (data.file && data.file instanceof File) {
              const formData = new FormData();
              formData.append('resume', data.file);

              const uploadResponse = await fetch(`${API_BASE_URL}/profile/resume/upload/${candidateId}`, {
                method: 'POST',
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to upload resume file');
              }

              // File uploaded successfully, the backend already saved the resume record
              await refreshProfileData(candidateId);
          setIsResumeModalOpen(false);
            } else if (data.fileName && !data.file) {
              // If only fileName is provided (no new file), just update metadata
              const payload = {
                fileName: data.fileName,
                uploadedDate: data.uploadedDate || new Date().toISOString(),
              };

              const response = await fetch(`${API_BASE_URL}/profile/resume/${candidateId}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                throw new Error('Failed to save resume');
              }

              await refreshProfileData(candidateId);
              setIsResumeModalOpen(false);
            } else {
              // No file and no fileName, just close the modal
              setIsResumeModalOpen(false);
            }
          } catch (error) {
            console.error('Error saving resume:', error);
            alert(error instanceof Error ? error.message : 'Error saving resume');
          }
        }}
        initialData={resumeData}
      />

      <Footer />
    </div>
  );
}

