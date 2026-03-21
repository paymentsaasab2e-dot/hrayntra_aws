"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Header from "../../components/common/Header";
import ProfileCompletionDrawer from "@/components/profile/ProfileCompletionDrawer";
import Footer from "@/components/common/Footer";
import {
  API_BASE_URL,
  fetchProfileCompleteness,
  ProfileCompletenessResponse,
} from "@/lib/profile-completion";

interface DashboardData {
  profile: {
    fullName: string;
    email: string;
    profilePhotoUrl: string | null;
    profileCompleteness: number;
    whatsappNumber?: string;
    countryCode?: string;
  };
  stats: {
    totalApplications: number;
    activeApplications: number;
    interviews: number;
    savedJobs: number;
    profileCompleteness: number;
    cvScore: number;
    marketFit: number;
    offersReceived?: number;
    rejected?: number;
  };
  /** Prisma ApplicationStatus enum → count (for charts/tiles) */
  applicationCounts?: {
    SUBMITTED: number;
    UNDER_REVIEW: number;
    SHORTLISTED: number;
    ASSESSMENT: number;
    INTERVIEW: number;
    FINAL_DECISION: number;
    SELECTED: number;
    REJECTED: number;
  };
  applicationStatus: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  notifications: Array<{
    id: string;
    text: string;
    time: string;
    type: string;
  }>;
  /** Job IDs the candidate has an application for (full list, not only recent). */
  appliedJobIds?: string[];
  recentApplications: Array<{
    id: string;
    jobId?: string;
    jobTitle: string;
    company: string;
    status: string;
    appliedAt: string;
    matchScore: number | null;
  }>;
  topSkills: Array<{
    name: string;
    proficiency: string;
  }>;
  savedJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    savedAt: string;
  }>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  const s = asString(value);
  return s ?? null;
}

function asNullableNumber(value: unknown): number | null {
  const n = asNumber(value);
  return n ?? null;
}

/** Map Prisma applicationCounts → pie chart rows (fixed order, include zeros). */
function applicationCountsToChartRows(
  counts: NonNullable<DashboardData["applicationCounts"]>
) {
  return [
    { label: "Applied", value: counts.SUBMITTED, color: "#FACC15" },
    { label: "Under Review", value: counts.UNDER_REVIEW, color: "#3B82F6" },
    { label: "Shortlisted", value: counts.SHORTLISTED, color: "#EC4899" },
    { label: "Assessment", value: counts.ASSESSMENT, color: "#8B5CF6" },
    { label: "Interview", value: counts.INTERVIEW, color: "#10B981" },
    { label: "Final Decision", value: counts.FINAL_DECISION, color: "#F59E0B" },
  ];
}

export default function CandidateDashboardPage() {
  const router = useRouter();
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    text: string;
    time: string;
    type: string;
  }>>([]);
  const [jobs, setJobs] = useState<Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    employmentType?: string;
    workMode?: string;
    postedAt: string;
    matchScore?: number | null;
  }>>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [recommendedCourses, setRecommendedCourses] = useState<Array<{
    id: string;
    title: string;
    provider: string;
    duration: string;
    level: string;
    rating?: number;
    imageUrl?: string;
  }>>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  
  // Dynamic Hiring Signals State
  const [hiringSignals, setHiringSignals] = useState({
    roles: ["Frontend Developer", "React Engineer", "UI Engineer"],
    locations: ["Remote", "Bangalore", "Berlin"],
    skills: ["React Hooks", "System Design", "AWS Basics"],
    marketFit: 78,
    bgColor: "#333333",
  });
  const [showHiringSignals, setShowHiringSignals] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState<{
    cv_score: number;
    skills_level: string;
    experience_level: string;
    education_level: string;
  } | null>(null);
  const [profileCompleteness, setProfileCompleteness] = useState<{
    percentage: number;
    completedSections: string[];
    missingSections: string[];
  }>({
    percentage: 0,
    completedSections: [],
    missingSections: [],
  });
  const [profileCompletionDetails, setProfileCompletionDetails] =
    useState<ProfileCompletenessResponse | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Hydrate candidate id from session; stop full-page loading early if missing
  useEffect(() => {
    const id = sessionStorage.getItem("candidateId");
    setCandidateId(id);
    if (!id) setLoading(false);
  }, []);

  useEffect(() => {
    const fetchCvAnalysis = async () => {
      if (!candidateId) return;

      try {
        let response = await fetch(`${API_BASE_URL}/cv-analysis/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // If analysis doesn't exist yet, generate it once and retry.
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
            // Update dashboard stats with CV score
            setDashboardData(prev => {
              if (prev) {
                return {
                  ...prev,
                  stats: {
                    ...prev.stats,
                    cvScore: result.data.cv_score,
                  },
                };
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error("Error fetching CV analysis:", error);
      }
    };

    fetchCvAnalysis();
  }, [candidateId]);

  const refreshProfileCompleteness = useCallback(
    async (id?: string) => {
      const resolvedCandidateId = id || candidateId || sessionStorage.getItem("candidateId");
      if (!resolvedCandidateId) return null;

      try {
        const details = await fetchProfileCompleteness(resolvedCandidateId);
        setProfileCompletionDetails(details);
        setProfileCompleteness({
          percentage: details.percentage,
          completedSections: details.completedSections,
          missingSections: details.missingSections,
        });
        return details;
      } catch (error) {
        console.error("Error fetching profile completeness:", error);
        return null;
      }
    },
    [candidateId]
  );

  useEffect(() => {
    if (!candidateId) return;
    void refreshProfileCompleteness(candidateId);
  }, [candidateId, refreshProfileCompleteness]);

  useEffect(() => {
    if (!candidateId || !profileCompletionDetails) return;

    if (profileCompletionDetails.percentage >= 100) {
      setIsProfileDrawerOpen(false);
      return;
    }

    const dismissKey = `profileDrawerDismissed_${candidateId}`;
    const currentSignature = profileCompletionDetails.sections
      .filter((section) => !section.isComplete)
      .map((section) => `${section.key}:${section.missingFields.join(",")}`)
      .join("|");

    const dismissedSignature = localStorage.getItem(dismissKey);
    if (dismissedSignature !== currentSignature) {
      setIsProfileDrawerOpen(true);
    }
  }, [candidateId, profileCompletionDetails]);

  // Fetch application status counts (fallback if dashboard payload has no applicationCounts)
  const fetchApplicationStatusFallback = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/applications/${id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
        const result: unknown = await response.json();
        const data = (result as { success?: unknown; data?: unknown })?.data;
        const success = Boolean((result as { success?: unknown })?.success);
        if (success && Array.isArray(data)) {
          const applications: Array<{ status?: string | null }> = data as Array<{ status?: string | null }>;

          const statusCounts: { [key: string]: number } = {
            Submitted: 0,
            "Under Review": 0,
            Shortlisted: 0,
            Assessment: 0,
            Interview: 0,
            "Final Decision": 0,
            Selected: 0,
            Rejected: 0,
          };

          applications.forEach((app) => {
            const status = String(app?.status || "");
            if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
              statusCounts[status]++;
            }
          });

          setApplicationStatus([
            { label: "Applied", value: statusCounts.Submitted || 0, color: "#FACC15" },
            { label: "Under Review", value: statusCounts["Under Review"] || 0, color: "#3B82F6" },
            { label: "Shortlisted", value: statusCounts.Shortlisted || 0, color: "#EC4899" },
            { label: "Assessment", value: statusCounts.Assessment || 0, color: "#8B5CF6" },
            { label: "Interview", value: statusCounts.Interview || 0, color: "#10B981" },
            { label: "Final Decision", value: statusCounts["Final Decision"] || 0, color: "#F59E0B" },
          ]);
        }
        }
      } catch (error) {
      console.error("Error fetching application status:", error);
      }
  }, []);

  // Fetch dashboard when candidateId is available (fixes race with sessionStorage hydration)
  useEffect(() => {
    if (!candidateId) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/cv/dashboard/${candidateId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
          if (!cancelled && result.success && result.data) {
            const data = result.data as DashboardData;
            setDashboardData(data);
            if (data.notifications?.length) {
              setNotifications(data.notifications);
            }
            if (data.applicationCounts) {
              setApplicationStatus(applicationCountsToChartRows(data.applicationCounts));
            } else {
              void fetchApplicationStatusFallback(candidateId);
            }
          }
        } else {
          console.error("Failed to fetch dashboard data");
      }
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [candidateId, fetchApplicationStatusFallback]);

  // Handle profile photo upload
  const handlePhotoUpload = async (file: File) => {
    const candidateId = sessionStorage.getItem("candidateId");
    if (!candidateId) {
      console.error("No candidate ID found");
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
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
          // Refresh dashboard data to show new photo
          const dashboardResponse = await fetch(`${API_BASE_URL}/cv/dashboard/${candidateId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (dashboardResponse.ok) {
            const dashboardResult = await dashboardResponse.json();
            if (dashboardResult.success && dashboardResult.data) {
              const d = dashboardResult.data as DashboardData;
              setDashboardData(d);
              if (d.applicationCounts) {
                setApplicationStatus(applicationCountsToChartRows(d.applicationCounts));
              }
            }
          }
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

  // Fetch jobs and seed if needed
  useEffect(() => {
    const fetchJobs = async () => {
      setJobsLoading(true);
      try {
        // Fetch jobs
        console.log("Fetching jobs from:", `${API_BASE_URL}/jobs?limit=100`);
        const response = await fetch(`${API_BASE_URL}/jobs?limit=100`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log("Jobs API response status:", response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log("Jobs API response data:", result);
          
          if (result.success && result.data) {
            // Handle both response formats: { data: { jobs: [...] } } or { data: { jobs: [...], count: ... } }
            const jobsArray = result.data.jobs || [];
            
            if (jobsArray.length > 0) {
              // Format jobs to match expected structure
              const formattedJobs = (jobsArray as Array<Record<string, unknown>>).map((job, index) => {
                const companyObj = (job as { company?: unknown }).company;
                let companyName = "Unknown Company";
                if (companyObj && typeof companyObj === "object") {
                  companyName = asString((companyObj as { name?: unknown }).name) ?? companyName;
                } else {
                  companyName = asString(companyObj) ?? companyName;
                }

                return {
                  id: asString((job as { id?: unknown }).id) ?? `job-${index + 1}`,
                  title: asString((job as { title?: unknown }).title) ?? "Job Title",
                  company: companyName,
                  location: asNullableString((job as { location?: unknown }).location),
                  salaryMin: asNullableNumber((job as { salaryMin?: unknown }).salaryMin),
                  salaryMax: asNullableNumber((job as { salaryMax?: unknown }).salaryMax),
                  salaryCurrency: asString((job as { salaryCurrency?: unknown }).salaryCurrency),
                  employmentType: asString((job as { employmentType?: unknown }).employmentType) ?? undefined,
                  workMode: asString((job as { workMode?: unknown }).workMode) ?? undefined,
                  postedAt: asString((job as { postedAt?: unknown }).postedAt) ?? new Date().toISOString(),
                  matchScore: asNullableNumber((job as { matchScore?: unknown }).matchScore),
                };
              });
              
              console.log("Setting jobs:", formattedJobs);
              setJobs(formattedJobs);
            } else {
              console.warn("No jobs in response, attempting to seed...");
              // If no jobs found, try to seed
              try {
                const seedResponse = await fetch(`${API_BASE_URL}/jobs/seed`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });
                if (seedResponse.ok) {
                  const seedResult = await seedResponse.json();
                  console.log("Seed result:", seedResult);
                  // Retry fetching jobs after seeding
                  const retryResponse = await fetch(`${API_BASE_URL}/jobs?limit=100`);
                  if (retryResponse.ok) {
                    const retryResult = await retryResponse.json();
                    if (retryResult.success && retryResult.data?.jobs) {
                      const formattedJobs = (retryResult.data.jobs as Array<Record<string, unknown>>).map((job, index) => {
                        const companyObj = (job as { company?: unknown }).company;
                        let companyName = "Unknown Company";
                        if (companyObj && typeof companyObj === "object") {
                          companyName = asString((companyObj as { name?: unknown }).name) ?? companyName;
                        } else {
                          companyName = asString(companyObj) ?? companyName;
                        }

                        return {
                          id: asString((job as { id?: unknown }).id) ?? `job-${index + 1}`,
                          title: asString((job as { title?: unknown }).title) ?? "Job Title",
                          company: companyName,
                          location: asNullableString((job as { location?: unknown }).location),
                          salaryMin: asNullableNumber((job as { salaryMin?: unknown }).salaryMin),
                          salaryMax: asNullableNumber((job as { salaryMax?: unknown }).salaryMax),
                          salaryCurrency: asString((job as { salaryCurrency?: unknown }).salaryCurrency),
                          employmentType: asString((job as { employmentType?: unknown }).employmentType) ?? undefined,
                          workMode: asString((job as { workMode?: unknown }).workMode) ?? undefined,
                          postedAt: asString((job as { postedAt?: unknown }).postedAt) ?? new Date().toISOString(),
                          matchScore: asNullableNumber((job as { matchScore?: unknown }).matchScore),
                        };
                      });
                      setJobs(formattedJobs);
                    }
                  }
                }
              } catch (seedError) {
                console.log("Seed endpoint not available:", seedError);
                setJobs([]);
              }
            }
          } else {
            console.warn("No jobs in response:", result);
            setJobs([]);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to fetch jobs:", response.status, errorData);
          setJobs([]);
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
        setJobs([]);
      } finally {
        setJobsLoading(false);
      }
    };

    fetchJobs();
  }, [candidateId]);

  // Fetch recommended courses
  useEffect(() => {
    const fetchRecommendedCourses = async () => {
      setCoursesLoading(true);
      try {
        // For now, use mock data. Later, replace with actual API call
        // const response = await fetch(`${API_BASE_URL}/courses/recommended?candidateId=${candidateId}`);
        
        // Mock recommended courses data
        const mockCourses = [
          {
            id: "1",
            title: "Advanced React Development",
            provider: "Udemy",
            duration: "12 hours",
            level: "Intermediate",
            rating: 4.8,
          },
          {
            id: "2",
            title: "Node.js Backend Mastery",
            provider: "Coursera",
            duration: "8 weeks",
            level: "Advanced",
            rating: 4.6,
          },
          {
            id: "3",
            title: "AWS Cloud Practitioner",
            provider: "AWS Training",
            duration: "20 hours",
            level: "Beginner",
            rating: 4.9,
          },
          {
            id: "4",
            title: "Docker & Kubernetes",
            provider: "Pluralsight",
            duration: "15 hours",
            level: "Intermediate",
            rating: 4.7,
          },
          {
            id: "5",
            title: "TypeScript Fundamentals",
            provider: "FreeCodeCamp",
            duration: "10 hours",
            level: "Beginner",
            rating: 4.5,
          },
        ];

        // Simulate API delay
        setTimeout(() => {
          setRecommendedCourses(mockCourses);
          setCoursesLoading(false);
        }, 500);
      } catch (error) {
        console.error("Error fetching recommended courses:", error);
        setCoursesLoading(false);
      }
    };

    fetchRecommendedCourses();
  }, []);

  // Dynamic Hiring Signals and Courses - Alternate every 5 seconds with slide animation
  useEffect(() => {
    // Data sets for rotation
    const rolesSets = [
      ["Frontend Developer", "React Engineer", "UI Engineer"],
      ["Full Stack Developer", "Node.js Developer", "Vue.js Engineer"],
      ["Backend Engineer", "Python Developer", "DevOps Engineer"],
      ["Mobile Developer", "iOS Developer", "Android Developer"],
      ["Data Scientist", "ML Engineer", "AI Specialist"],
      ["Product Manager", "Technical Lead", "Architecture Engineer"],
    ];

    const locationsSets = [
      ["Remote", "Bangalore", "Berlin"],
      ["San Francisco", "New York", "London"],
      ["Toronto", "Sydney", "Singapore"],
      ["Dubai", "Mumbai", "Tokyo"],
      ["Amsterdam", "Paris", "Stockholm"],
      ["Austin", "Seattle", "Boston"],
    ];

    const skillsSets = [
      ["React Hooks", "System Design", "AWS Basics"],
      ["TypeScript", "GraphQL", "Docker"],
      ["Kubernetes", "Microservices", "CI/CD"],
      ["Machine Learning", "Data Analytics", "Python"],
      ["Agile", "Scrum", "Product Management"],
      ["Cloud Architecture", "Security", "Performance"],
    ];

    const marketFitValues = [78, 82, 85, 79, 88, 75, 83, 87, 80, 86];

    const bgColors = [
      "#333333", // Dark gray
      "#1E3A5F", // Dark blue
      "#2D1B3D", // Dark purple
      "#1A2E1A", // Dark green
      "#3D1F1F", // Dark red
      "#2D2D1A", // Dark yellow-green
      "#1F3D3D", // Dark teal
      "#3D2D1F", // Dark brown
      "#2D1F3D", // Dark indigo
      "#1F2D3D", // Dark navy
    ];

    const toggleInterval: NodeJS.Timeout = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setShowHiringSignals((prev) => !prev);
        setIsAnimating(false);
      }, 300); // Half of animation duration
    }, 5000); // Switch every 5 seconds

    const dataUpdateInterval: NodeJS.Timeout = setInterval(() => {
      const rolesIndex = Math.floor(Math.random() * rolesSets.length);
      const locationsIndex = Math.floor(Math.random() * locationsSets.length);
      const skillsIndex = Math.floor(Math.random() * skillsSets.length);
      const marketFitIndex = Math.floor(Math.random() * marketFitValues.length);
      const bgColorIndex = Math.floor(Math.random() * bgColors.length);

      setHiringSignals({
        roles: rolesSets[rolesIndex],
        locations: locationsSets[locationsIndex],
        skills: skillsSets[skillsIndex],
        marketFit: marketFitValues[marketFitIndex],
        bgColor: bgColors[bgColorIndex],
      });
    }, 1000); // Change data every second

    return () => {
      clearInterval(toggleInterval);
      clearInterval(dataUpdateInterval);
    };
  }, [showHiringSignals]);

  // Rotate notifications only if there are notifications
  useEffect(() => {
    if (notifications.length === 0) return;

    const interval = setInterval(() => {
      setIsRotating(true);
      setTimeout(() => {
        setNotifications((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const first = next.shift();
          if (first) next.push(first);
          return next;
        });
        setIsRotating(false);
      }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, [notifications.length]);

  // Application status state
  const [applicationStatus, setApplicationStatus] = useState([
    { label: "Applied", value: 0, color: "#FACC15" }, // Yellow
    { label: "Under Review", value: 0, color: "#3B82F6" }, // Blue
    { label: "Shortlisted", value: 0, color: "#EC4899" }, // Pink
    { label: "Assessment", value: 0, color: "#8B5CF6" }, // Purple
    { label: "Interview", value: 0, color: "#10B981" }, // Green
    { label: "Final Decision", value: 0, color: "#F59E0B" }, // Orange
  ]);

  /** Wait for dashboard so we know which job IDs are already applied (avoid flash of wrong rows). */
  const awaitingAppliedFilter =
    Boolean(candidateId) && loading && dashboardData === null;

  /** Open listings only: jobs from API minus roles the candidate already applied to. */
  const topOpenJobMatches = useMemo(() => {
    if (awaitingAppliedFilter) return [];
    const applied = new Set<string>(dashboardData?.appliedJobIds ?? []);
    // Fallback if older API payload has no appliedJobIds: infer from recent applications’ jobId
    (dashboardData?.recentApplications ?? []).forEach((a) => {
      if (a.jobId) applied.add(a.jobId);
    });
    return jobs.filter((j) => j.id && !applied.has(j.id));
  }, [
    awaitingAppliedFilter,
    jobs,
    dashboardData?.appliedJobIds,
    dashboardData?.recentApplications,
  ]);

  const showTopMatchesLoading =
    jobsLoading || awaitingAppliedFilter;

  const totalApplications = applicationStatus.reduce((sum, item) => sum + item.value, 0);
  const applicationsSentTile =
    dashboardData?.stats?.totalApplications ?? totalApplications;

  const applicationSegments = (() => {
    const segments: {
      label: string;
      value: number;
      color: string;
      dashArray: string;
      offset: number;
    }[] = [];
    
    // If no applications, return empty segments array to avoid division by zero
    if (totalApplications === 0) {
      return segments;
    }
    
    const gapSize = 0.8; // White gap size between segments - increased for better visibility
    const totalGaps = applicationStatus.length * gapSize; // Include gap after last segment (wrap-around)
    const availablePercentage = 100 - totalGaps;
    let accum = 0;

    applicationStatus.forEach((item, index) => {
      const basePercentage = (item.value / totalApplications) * 100;
      const adjustedPercentage = (basePercentage / 100) * availablePercentage;

      segments.push({
        ...item,
        dashArray: `${adjustedPercentage} ${100 - adjustedPercentage}`,
        offset: -accum,
      });

      accum += adjustedPercentage + gapSize; // Always add gap after each segment
    });

    return segments;
  })();

  // Create white gap segments for separation (including wrap-around gap between last and first)
  const whiteGaps = (() => {
    const gaps: { dashArray: string; offset: number }[] = [];
    
    // If no applications, return empty gaps array to avoid division by zero
    if (totalApplications === 0) {
      return gaps;
    }
    
    const gapSize = 0.8; // Match the gap size used in segments - increased for better visibility
    const totalGaps = applicationStatus.length * gapSize; // Include wrap-around gap
    const availablePercentage = 100 - totalGaps;
    let accum = 0;

    // Calculate all segment end positions first (matching applicationSegments calculation)
    const segmentEnds: number[] = [];
    applicationStatus.forEach((item) => {
      const basePercentage = (item.value / totalApplications) * 100;
      const adjustedPercentage = (basePercentage / 100) * availablePercentage;
      accum += adjustedPercentage;
      segmentEnds.push(accum);
      accum += gapSize; // Add gap after segment
    });

    // Create gaps after each segment
    segmentEnds.forEach((segmentEnd, index) => {
      if (index < segmentEnds.length - 1) {
        // Regular gaps between segments - positioned right after each segment ends
        gaps.push({
          dashArray: `${gapSize} ${100 - gapSize}`,
          offset: -segmentEnd,
        });
      } else {
        // Last gap (wrap-around between yellow and green) - must be visible at 12 o'clock
        // Yellow (last segment) ends at segmentEnd
        // Green (first segment) starts at offset 0 (12 o'clock after -90° rotation)
        // Gap should be positioned to end exactly at 0, so it appears between yellow's end and green's start
        // Using offset = -(100 - gapSize) positions the gap to end at 0
        const wrapAroundOffset = -(100 - gapSize);

        gaps.push({
          dashArray: `${gapSize} ${100 - gapSize}`,
          offset: wrapAroundOffset,
        });
      }
    });

    return gaps;
  })();

  const openProfileDrawer = () => {
    setIsProfileDrawerOpen(true);
  };

  const dismissProfileDrawer = () => {
    if (candidateId && profileCompletionDetails) {
      const dismissKey = `profileDrawerDismissed_${candidateId}`;
      const signature = profileCompletionDetails.sections
        .filter((section) => !section.isComplete)
        .map((section) => `${section.key}:${section.missingFields.join(",")}`)
        .join("|");
      localStorage.setItem(dismissKey, signature);
    }

    setIsProfileDrawerOpen(false);
  };

  const welcomeFirstName = (() => {
    const n = dashboardData?.profile?.fullName?.trim();
    if (n) return n.split(/\s+/)[0] ?? "there";
    const wa = dashboardData?.profile?.whatsappNumber?.replace(/\D/g, "");
    if (wa && wa.length >= 4) return `…${wa.slice(-4)}`;
    return "there";
  })();

  // Show loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #fde9d4, #fafbfb, #bddffb)",
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "16px", color: "#6B7280" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!candidateId) {
  return (
    <div
      className="min-h-screen"
      style={{
          background:
            "linear-gradient(135deg, #e0f2fe 0%, #ecf7fd 12%, #fafbfb 30%, #fdf6f0 55%, #fef5ed 85%, #fef5ed 100%)",
        }}
      >
      <Header />
        <main className="mx-auto max-w-[1320px] px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to your dashboard</h1>
          <p className="mt-2 text-gray-600">Verify your WhatsApp number to load your applications and profile.</p>
          <button
            type="button"
            onClick={() => router.push("/whatsapp/verify")}
            className="mt-6 rounded-xl bg-[#28A8DF] px-6 py-3 text-sm font-semibold text-white hover:opacity-95 transition"
          >
            Continue with WhatsApp
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
          style={{
        background:
          "linear-gradient(135deg, #e0f2fe 0%, #ecf7fd 12%, #fafbfb 30%, #fdf6f0 55%, #fef5ed 85%, #fef5ed 100%)",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
        }}
      />
      {/* Header */}
      <Header />
      {/* Main Content */}
      <main className="mx-auto max-w-[1320px] px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="space-y-5">
          {/* PageHeader */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Welcome {welcomeFirstName} 👋
              </h1>
              <p className="text-gray-500 font-medium">{"Here's your career dashboard"}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
              onClick={() => router.push("/explore-jobs")}
                className="h-10 w-10 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 ease-out grid place-items-center"
                aria-label="Explore jobs"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
              </svg>
              </button>
              <button
                type="button"
              onClick={() => router.push("/applications")}
                className="h-10 w-10 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 ease-out grid place-items-center"
                aria-label="Applications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              </button>
              <button
                type="button"
              onClick={() => router.push("/courses")}
                className="h-10 w-10 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 ease-out grid place-items-center"
                aria-label="Courses"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              </button>
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="h-10 w-10 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 ease-out grid place-items-center"
                aria-label="Profile"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              </button>
            </div>
          </div>

          {/* Optional profile completion banner (keeps existing drawer behavior) */}
          {profileCompleteness.percentage < 100 ? (
            <div className="rounded-2xl border border-sky-100 bg-white/80 shadow-sm p-5 transition-all duration-300 ease-out">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Your profile is {profileCompleteness.percentage}% complete
                </p>
                <p className="mt-1 text-sm text-gray-500">
                    Finish the remaining sections and improve your dashboard visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={openProfileDrawer}
                  className="rounded-xl bg-[#28A8DF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition"
              >
                Complete Profile
              </button>
            </div>
            </div>
          ) : null}

          {/* Dashboard grid */}
          <div className="grid grid-cols-12 gap-5">
            {/* Profile card */}
            <section className="col-span-12 lg:col-span-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-6">
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-14 w-14 rounded-full bg-gray-100 overflow-hidden shrink-0"
                    aria-label="Upload profile photo"
                    title="Click to upload profile photo"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                      className="hidden"
                    />
                    {dashboardData?.profile?.profilePhotoUrl ? (() => {
                      const photoUrl = dashboardData.profile.profilePhotoUrl;
                      let imageSrc: string | null = null;
                      if (photoUrl && photoUrl.trim()) {
                        if (photoUrl.startsWith("data:") || photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
                        imageSrc = photoUrl;
                      } else {
                          const baseUrl = API_BASE_URL.replace("/api", "");
                          const cleanPath = photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`;
                        imageSrc = `${baseUrl}${cleanPath}`;
                      }
                      }
                      return imageSrc ? (
                        <Image src={imageSrc} alt="Profile" fill className="object-cover" unoptimized />
                      ) : null;
                    })() : null}

                    <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-[#28A8DF] border-2 border-white grid place-items-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </span>
                    {isUploadingPhoto ? (
                      <span className="absolute inset-0 bg-black/40 grid place-items-center">
                        <span className="h-5 w-5 rounded-full border-2 border-white border-b-transparent animate-spin" />
                      </span>
                    ) : null}
                  </button>

                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {dashboardData?.profile?.fullName || "Candidate"}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {dashboardData?.profile?.email || "Add email in profile"}
                    </p>
                    {dashboardData?.profile?.whatsappNumber ? (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        WhatsApp:{" "}
                        {dashboardData.profile.whatsappNumber.startsWith("+")
                          ? dashboardData.profile.whatsappNumber
                          : `${dashboardData.profile.countryCode || ""}${dashboardData.profile.whatsappNumber}`}
                      </p>
                    ) : null}
                    <span className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      Job Seeker
                      </span>
                    </div>
                  </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Profile strength</span>
                    <span className="text-sm font-semibold text-gray-900">{profileCompleteness.percentage}%</span>
                </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#28A8DF] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, profileCompleteness.percentage))}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push("/profile")}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
                  >
                    Update Profile
                  </button>
                      </div>
                      </div>
            </section>

            {/* Top job matches */}
            <section className="col-span-12 lg:col-span-8 lg:row-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Top job matches</h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Open roles — excludes jobs you’ve already applied to
                    </p>
                    </div>
                  <button
                    type="button"
                    onClick={() => router.push("/explore-jobs")}
                    className="rounded-xl bg-[#28A8DF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition"
                  >
                    View all
                  </button>
            </div>

                <div className="mt-5 max-h-[min(520px,55vh)] overflow-y-auto pr-1 space-y-3">
                  {!showTopMatchesLoading
                    ? topOpenJobMatches.map((job) => {
                        const loc = job.location?.trim() || "Location not specified";
                        const extra = [job.employmentType, job.workMode]
                          .filter(Boolean)
                          .join(" · ");
                        const subtitle = extra ? `${loc} · ${extra}` : loc;
                        const rawScore = job.matchScore;
                        const matchPct =
                          rawScore != null && Number.isFinite(rawScore)
                            ? Math.round(Math.min(100, Math.max(0, rawScore)))
                            : null;
                      return (
                      <button
                          key={job.id}
                        type="button"
                        onClick={() => router.push("/explore-jobs")}
                        className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:shadow-md transition-all duration-300 ease-out"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-sky-50 border border-sky-100 grid place-items-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                            </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
                            <p className="text-sm text-gray-500 truncate">{job.company}</p>
                            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                                  </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {matchPct != null ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-xs font-bold">
                                {matchPct}% match
                                  </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-50 text-gray-600 border border-gray-100 px-2.5 py-1 text-xs font-semibold">
                                Open role
                                  </span>
                                )}
                            <span className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
                              Apply
                            </span>
                              </div>
                                </div>
                      </button>
                        );
                      })
                    : null}

                  {showTopMatchesLoading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
                      Loading top matches…
                    </div>
                  ) : topOpenJobMatches.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
                      {jobs.length === 0
                        ? "No open jobs loaded yet. Try again later or use View all to browse."
                        : "You’ve applied to all jobs in this list. Use View all to find more openings."}
                </div>
                  ) : null}
              </div>
            </div>
            </section>

            {/* Application status */}
            <section className="col-span-12 lg:col-span-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-6">
                <div className="flex items-center justify-between">
                      <div>
                    <h2 className="text-lg font-semibold text-gray-900">Application status</h2>
                    <p className="text-sm text-gray-500 font-medium">Quick snapshot</p>
                      </div>
                      <button
                    type="button"
                    onClick={() => router.push("/applications")}
                    className="text-sm font-semibold text-gray-700 hover:text-gray-900"
                  >
                    View
                      </button>
                    </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  {[
                    { label: "Applications sent", value: applicationsSentTile },
                    { label: "Interviews scheduled", value: dashboardData?.stats?.interviews ?? 0 },
                    {
                      label: "Offers received",
                      value: dashboardData?.stats?.offersReceived ?? 0,
                    },
                    { label: "Rejected", value: dashboardData?.stats?.rejected ?? 0 },
                  ].map((tile) => (
                    <div
                      key={tile.label}
                      className="rounded-xl border border-gray-100 bg-white p-4"
                    >
                      <p className="text-xs font-medium text-gray-500">{tile.label}</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">{tile.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
            </section>

            {/* Recommended courses (carousel) */}
            <section className="col-span-12">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Recommended courses</h2>
                    <p className="text-sm text-gray-500 font-medium">Level up your skills</p>
                      </div>
                      <button
                    type="button"
                        onClick={() => router.push("/courses")}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
                  >
                    Browse all
                      </button>
                    </div>

                <div className="mt-5 flex gap-4 overflow-x-auto hide-scrollbar pb-1 scroll-smooth">
                  {(coursesLoading ? [] : recommendedCourses).slice(0, 8).map((course) => (
                        <div
                          key={course.id}
                      className="w-64 shrink-0 rounded-xl border border-gray-100 bg-white p-4 hover:shadow-md transition-all duration-300 ease-out"
                    >
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{course.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{course.provider}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">{course.duration}</span>
                        {course.rating ? (
                          <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-1 font-semibold text-amber-700">
                            ★ {course.rating}
                            </span>
                        ) : null}
                          </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/courses/${course.id}`)}
                        className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
                      >
                        Enroll
                      </button>
                        </div>
                      ))}

                  {coursesLoading ? (
                    <div className="w-64 shrink-0 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
                      Loading courses…
                    </div>
                  ) : recommendedCourses.length === 0 ? (
                    <div className="w-64 shrink-0 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
                      No recommendations yet.
                                </div>
                  ) : null}
                          </div>
                        </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />

      {candidateId && profileCompletionDetails ? (
        <ProfileCompletionDrawer
          candidateId={candidateId}
          isOpen={isProfileDrawerOpen}
          initialCompleteness={profileCompletionDetails}
          onClose={dismissProfileDrawer}
          onCompletionUpdated={(details) => {
            setProfileCompletionDetails(details);
            setProfileCompleteness({
              percentage: details.percentage,
              completedSections: details.completedSections,
              missingSections: details.missingSections,
            });
          }}
        />
      ) : null}
    </div>
  );
}
