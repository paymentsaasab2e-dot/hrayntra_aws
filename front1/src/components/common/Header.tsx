'use client';

import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const API_BASE_URL = "http://localhost:5000/api";
const PRIMARY = '#28A8DF';
const JOBS_PATH = '/explore-jobs';

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  retries = 2,
  retryDelayMs = 500
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Network error while calling API');
}

export default function Header({ showNav = true }: { showNav?: boolean }) {
  const router = useRouter();
    const pathname = usePathname();
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navRef = useRef<HTMLElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [showJobSearch, setShowJobSearch] = useState(false);
    const [jobSearchValue, setJobSearchValue] = useState('');

    // Fetch profile data (photo, name, email)
    useEffect(() => {
        const fetchProfileData = async () => {
            const candidateId = sessionStorage.getItem("candidateId");
            if (!candidateId) return;

            try {
                const response = await fetchWithRetry(`${API_BASE_URL}/cv/dashboard/${candidateId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data?.profile) {
                        const profile = result.data.profile;
                        
                        // Set user name and email
                        if (profile.fullName) {
                            // Show only first name
                            const firstName = profile.fullName.split(' ')[0];
                            setUserName(firstName);
                        }
                        if (profile.email) {
                            setUserEmail(profile.email);
                        }
                        
                        // Handle profile photo
                        if (profile.profilePhotoUrl) {
                            const photoUrl = profile.profilePhotoUrl;
                            
                            if (photoUrl && photoUrl.trim() !== '') {
                                let imageSrc: string;
                                
                                // Handle data URLs (base64 images) - use directly without modification
                                if (photoUrl.startsWith('data:')) {
                                    imageSrc = photoUrl;
                                    setProfilePhotoUrl(imageSrc);
                                } else if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
                                    imageSrc = photoUrl;
                                    setProfilePhotoUrl(imageSrc);
                                } else {
                                    // Construct full URL for relative paths
                                    const baseUrl = API_BASE_URL.replace('/api', '');
                                    const cleanPath = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
                                    imageSrc = `${baseUrl}${cleanPath}`;
                                    
                                    // Validate URL before setting (skip validation for data URLs)
                                    try {
                                        new URL(imageSrc);
                                        setProfilePhotoUrl(imageSrc);
                                    } catch (e) {
                                        console.error('Invalid profile photo URL:', imageSrc, e);
                                        setProfilePhotoUrl(null);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching profile data:", error);
            }
        };

        fetchProfileData();
    }, []);

    // Close modals when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.notification-modal') && !target.closest('.notification-button')) {
                setIsNotificationsModalOpen(false);
            }
            if (!target.closest('.profile-modal') && !target.closest('.profile-button')) {
                setIsProfileModalOpen(false);
            }
            if (!target.closest('.mobile-menu') && !target.closest('.hamburger-button')) {
                setIsMobileMenuOpen(false);
            }
            if (showJobSearch) {
                const navEl = navRef.current;
                if (navEl && !navEl.contains(target)) {
                    setShowJobSearch(false);
                }
            }
        };

        if (isNotificationsModalOpen || isProfileModalOpen || isMobileMenuOpen || showJobSearch) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isNotificationsModalOpen, isProfileModalOpen, isMobileMenuOpen, showJobSearch]);

    // Determine active page
    const isActive = useCallback(
        (path: string) => {
            if (path === '/candidate-dashboard') {
                return pathname === path || pathname === '/';
            }
            if (path === '/applications') {
                return pathname?.startsWith('/applications') || pathname?.startsWith('/interviews');
            }
            return pathname?.startsWith(path);
        },
        [pathname]
    );

    const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; height: number; top: number } | null>(null);
    const [isInitial, setIsInitial] = useState(true);
    const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

    // Load last position from sessionStorage on mount
    useEffect(() => {
        const saved = sessionStorage.getItem('navIndicatorStyle');
        if (saved) {
            setIndicatorStyle(JSON.parse(saved));
            setIsInitial(false); // Allow immediate transition from saved position
        }
    }, []);

    useEffect(() => {
        const updateIndicator = () => {
            const activeIndex = navItems.findIndex(item => isActive(item.path));
            if (activeIndex !== -1 && itemsRef.current[activeIndex]) {
                const activeElement = itemsRef.current[activeIndex];
                if (activeElement) {
                    const newStyle = {
                        left: activeElement.offsetLeft,
                        width: activeElement.offsetWidth,
                        height: activeElement.offsetHeight,
                        top: activeElement.offsetTop,
                    };
                    setIndicatorStyle(newStyle);
                    sessionStorage.setItem('navIndicatorStyle', JSON.stringify(newStyle));

                    if (isInitial) {
                        // If we didn't have a saved position, snap first then enable transitions
                        setTimeout(() => setIsInitial(false), 50);
                    }
                }
            }
        };

        updateIndicator();
        const timer = setTimeout(updateIndicator, 100);

        window.addEventListener('resize', updateIndicator);
        return () => {
            window.removeEventListener('resize', updateIndicator);
            clearTimeout(timer);
        };
    }, [pathname, isActive, isInitial]);

    // Close the expanded Jobs search if we leave the Jobs page
    useEffect(() => {
        if (!pathname?.startsWith(JOBS_PATH)) {
            setShowJobSearch(false);
        }
    }, [pathname]);

    // Autofocus after the Jobs search animates in
    useEffect(() => {
        if (!showJobSearch) return;
        const t = setTimeout(() => searchInputRef.current?.focus(), 120);
        return () => clearTimeout(t);
    }, [showJobSearch]);

    const navItems = [
        { label: 'Dashboard', path: '/candidate-dashboard' },
        { label: 'Jobs', path: '/explore-jobs' },
        { label: 'Applications', path: '/applications' },
        { label: 'Courses', path: '/courses' },
        { label: 'Profile', path: '/profile' },
    ];

    const handleTabClick = (path: string) => {
        setShowJobSearch(false);
        router.push(path);
    };

    const handleJobsToggleSearch = () => {
        if (pathname?.startsWith(JOBS_PATH)) {
            setShowJobSearch((prev) => !prev);
        } else {
            setShowJobSearch(false);
            router.push(JOBS_PATH);
        }
    };

    const handleSearchJobsButtonClick = () => {
        if (pathname?.startsWith(JOBS_PATH)) {
            setShowJobSearch(true);
        } else {
            router.push(JOBS_PATH);
        }
    };

    const handleSearch = () => {
        const q = jobSearchValue.trim();
        if (!q) return;
        router.push(`${JOBS_PATH}?q=${encodeURIComponent(q)}`);
    };

    const isJobsPage = pathname?.startsWith(JOBS_PATH) ?? false;

    return (
        <header className="bg-transparent px-4 sm:px-6 py-5">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
                {/* Left: Logo and Hamburger */}
                <div className="flex items-center gap-4">
                    {/* Hamburger Button - Mobile only */}
                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="hamburger-button p-2 text-slate-600 hover:text-slate-800 lg:hidden transition-colors"
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
                            {isMobileMenuOpen ? (
                                <path d="M18 6L6 18M6 6l12 12" />
                            ) : (
                                <path d="M4 12h16M4 6h16M4 18h16" />
                            )}
                        </svg>
                    </button>

                    <Image
                        src="/SAASA%20Logo.png"
                        alt="SAASA B2E"
                        width={110}
                        height={32}
                        className="h-8 w-auto cursor-pointer"
                        onClick={() => router.push('/candidate-dashboard')}
                    />
                </div>

                {/* Navigation Container - Desktop only */}
                {showNav ? (
                    <nav
                        ref={navRef}
                        className="relative hidden lg:flex items-center justify-center gap-1 px-4 py-2.5 rounded-full min-w-0 max-w-[900px] overflow-visible"
                        style={{
                            background: '#FFFFFF',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                        }}
                    >
                        {/* ── Tabs row + Search trigger pill ──────────────────────────────── */}
                        <div className="flex items-center w-full">
                            <div className="relative flex-1 flex items-center justify-center gap-1">
                                {/* Sliding Indicator */}
                                {indicatorStyle && navItems.some(item => isActive(item.path)) && (
                                    <div
                                        className={`absolute rounded-full ${isInitial ? '' : 'transition-all duration-500 ease-in-out'}`}
                                        style={{
                                            left: `${indicatorStyle.left}px`,
                                            width: `${indicatorStyle.width}px`,
                                            height: `${indicatorStyle.height}px`,
                                            top: `${indicatorStyle.top}px`,
                                            backgroundColor: PRIMARY,
                                        }}
                                    />
                                )}

                                {navItems.map((item, index) => {
                                    const active = isActive(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            ref={(el) => { itemsRef.current[index] = el; }}
                                            type="button"
                                            onClick={() => {
                                                if (item.path === JOBS_PATH && active) {
                                                    handleJobsToggleSearch();
                                                } else {
                                                    handleTabClick(item.path);
                                                }
                                            }}
                                            className={`relative z-10 min-w-[80px] flex items-center justify-center gap-1 rounded-full text-sm font-medium transition-colors duration-300 ${active
                                                ? 'text-white'
                                                : 'text-slate-600 hover:text-slate-800 bg-transparent'
                                                }`}
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                padding: '10px 16px',
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search Jobs trigger — Framer Motion width + fade */}
                            <AnimatePresence>
                                {isJobsPage && !showJobSearch && (
                                    <motion.div
                                        key="search-trigger"
                                        initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                                        animate={{ width: 148, opacity: 1, marginLeft: 16 }}
                                        exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                                        transition={{
                                            width: { duration: 0.38, ease: [0.4, 0, 0.2, 1], delay: 0.08 },
                                            opacity: { duration: 0.22, ease: 'easeOut', delay: 0.14 },
                                            marginLeft: { duration: 0.38, ease: [0.4, 0, 0.2, 1], delay: 0.08 },
                                        }}
                                        className="overflow-hidden"
                                        style={{ flexShrink: 0 }}
                                    >
                                        <motion.button
                                            type="button"
                                            onClick={handleSearchJobsButtonClick}
                                            aria-label="Search jobs"
                                            initial={{ scale: 0.9, y: -6 }}
                                            animate={{ scale: 1, y: 0 }}
                                            exit={{ scale: 0.9, y: -6 }}
                                            transition={{ duration: 0.22, ease: 'easeOut', delay: 0.18 }}
                                            className="flex items-center gap-2 text-xs xl:text-sm font-medium text-gray-500 hover:text-gray-900 whitespace-nowrap shrink-0 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
                                        >
                                            <motion.span
                                                initial={{ opacity: 0, rotate: -15 }}
                                                animate={{ opacity: 1, rotate: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2, delay: 0.22 }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>
                                            </motion.span>
                                            <span className="hidden xl:inline">Search Jobs</span>
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* ── Expanded search overlay — drops down below the nav pill ──────── */}
                        <AnimatePresence>
                            {showJobSearch && (
                                <motion.div
                                    key="search-overlay"
                                    initial={{ opacity: 0, y: -10, scaleY: 0.94 }}
                                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                    exit={{ opacity: 0, y: -10, scaleY: 0.94 }}
                                    transition={{ duration: 0.26, ease: [0.34, 1.3, 0.64, 1] }}
                                    style={{ transformOrigin: 'top center' }}
                                    className="absolute left-0 right-0 top-full mt-3 z-40"
                                >
                                    <div className="w-full max-w-3xl mx-auto px-4">
                                        <motion.div
                                            className="relative rounded-full"
                                            initial={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
                                            animate={{ boxShadow: '0 0 0 3px rgba(40,168,225,0.18), 0 14px 36px rgba(0,0,0,0.13)' }}
                                            transition={{ duration: 0.3, ease: 'easeOut' }}
                                        >
                                            {/* Icon inside input — fades in with slight delay */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.75 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.75 }}
                                                transition={{ duration: 0.18, delay: 0.12 }}
                                                className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>
                                            </motion.div>

                                            <input
                                                ref={searchInputRef}
                                                type="text"
                                                value={jobSearchValue}
                                                onChange={(e) => setJobSearchValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
                                                    if (e.key === 'Escape') { setShowJobSearch(false); }
                                                }}
                                                placeholder="I am looking for the Data Analyst role in Yaoundé"
                                                className="w-full rounded-full border bg-white pl-12 pr-14 py-4 text-base focus:outline-none focus:ring-2 focus:ring-offset-0"
                                                style={{
                                                    borderColor: 'var(--border-color)',
                                                    fontFamily: 'Inter, sans-serif',
                                                    ['--tw-ring-color' as string]: 'rgba(40,168,225,0.35)',
                                                }}
                                            />

                                            {/* Submit button — pops in */}
                                            <motion.button
                                                type="button"
                                                onClick={handleSearch}
                                                aria-label="Search jobs"
                                                initial={{ opacity: 0, scale: 0.7 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.7 }}
                                                transition={{ duration: 0.18, delay: 0.14 }}
                                                whileHover={{ scale: 1.08 }}
                                                whileTap={{ scale: 0.93 }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-white"
                                                style={{ backgroundColor: PRIMARY }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <path d="m21 21-4.35-4.35" />
                                                </svg>
                                            </motion.button>
                                        </motion.div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </nav>
                ) : null}

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="mobile-menu fixed inset-0 z-10002 lg:hidden">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />

                        {/* Menu Content */}
                        <nav className="absolute left-0 top-0 h-full w-64 bg-white shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-left duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <Image
                                    src="/SAASA%20Logo.png"
                                    alt="SAASA B2E"
                                    width={100}
                                    height={28}
                                    className="h-6 w-auto"
                                />
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {navItems.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => {
                                                router.push(item.path);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`flex items-center px-4 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${active
                                                ? 'bg-slate-800 text-white shadow-md'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                                }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>
                    </div>
                )}

                {/* Right side icons - Settings, Notifications, Profile */}
                <div className="flex items-center gap-3">

                    {/* Notifications Icon with Modal */}
                    <div className="relative notification-button">
                        <button
                            type="button"
                            onClick={() => {
                                setIsNotificationsModalOpen(!isNotificationsModalOpen);
                                setIsProfileModalOpen(false);
                            }}
                            className="relative p-2 text-slate-600 hover:text-slate-800 transition-colors"
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
                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>

                        {/* Notifications Dropdown */}
                        {isNotificationsModalOpen && (
                            <div
                                className="notification-modal absolute right-0 top-full mt-2 bg-white rounded-lg shadow-2xl overflow-hidden z-10001 transition-all duration-300 ease-out"
                                style={{
                                    width: "270px",
                                    fontFamily: "Inter, sans-serif",
                                    animation: "slideDown 0.3s ease-out",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="px-3.5 pt-3 pb-2 border-b border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 700,
                                                color: "#111827",
                                            }}
                                        >
                                            Notifications
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="text-gray-700 hover:text-gray-900"
                                                style={{
                                                    fontSize: "11px",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Mark all as read
                                            </button>
                                            <button
                                                onClick={() => setIsNotificationsModalOpen(false)}
                                                className="text-gray-700 hover:text-gray-900"
                                            >
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p
                                        style={{
                                            fontSize: "10px",
                                            fontWeight: 400,
                                            color: "#6B7280",
                                        }}
                                    >
                                        Recent updates related to your jobs and profile
                                    </p>
                                </div>

                                {/* Notifications Content */}
                                <div>
                                    <div className="px-3.5 pt-3 pb-2.5">
                                        <h4
                                            style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                color: "#6B7280",
                                                marginBottom: "7px",
                                            }}
                                        >
                                            Today
                                        </h4>
                                        <div className="space-y-3">
                                            {/* Notification 1 - Blue */}
                                            <div className="flex items-start gap-2.5">
                                                <div className="mt-0.5 shrink-0">
                                                    <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="text-sky-500"
                                                        >
                                                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            fontWeight: 500,
                                                            color: "#111827",
                                                            marginBottom: "2px",
                                                        }}
                                                    >
                                                        3 new jobs match your profile
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "10px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        Jobs based on your profile
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span
                                                        style={{
                                                            fontSize: "9px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        2h ago
                                                    </span>
                                                    <div
                                                        className="h-1.5 w-1.5 rounded-full bg-sky-500"
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Notification 2 - Green */}
                                            <div className="flex items-start gap-2.5">
                                                <div className="mt-0.5 shrink-0">
                                                    <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center">
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            style={{ color: "#22C55E" }}
                                                        >
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                            <polyline points="14 2 14 8 20 8"></polyline>
                                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            fontWeight: 500,
                                                            color: "#111827",
                                                            marginBottom: "2px",
                                                        }}
                                                    >
                                                        Your application for Data Analyst is under
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "10px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        Application updated
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span
                                                        style={{
                                                            fontSize: "9px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        8h ago
                                                    </span>
                                                    <div
                                                        className="h-1.5 w-1.5 rounded-full"
                                                        style={{ backgroundColor: "#22C55E" }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Notification 3 - Red */}
                                            <div className="flex items-start gap-2.5">
                                                <div className="mt-0.5 shrink-0">
                                                    <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center">
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            style={{ color: "#EF4444" }}
                                                        >
                                                            <path d="M9 11l3 3L22 4"></path>
                                                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            fontWeight: 500,
                                                            color: "#111827",
                                                            marginBottom: "2px",
                                                        }}
                                                    >
                                                        You've been shortlisted for Frontend Deve
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "10px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        Interview invitation
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span
                                                        style={{
                                                            fontSize: "9px",
                                                            fontWeight: 400,
                                                            color: "#6B7280",
                                                        }}
                                                    >
                                                        1d ago
                                                    </span>
                                                    <div
                                                        className="h-1.5 w-1.5 rounded-full"
                                                        style={{ backgroundColor: "#EF4444" }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-3.5 py-2.5 border-t border-gray-200">
                                    <button
                                        onClick={() => {
                                            router.push('/notification');
                                            setIsNotificationsModalOpen(false);
                                        }}
                                        className="w-full text-center text-blue-600 hover:text-blue-700 font-medium"
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 500,
                                        }}
                                    >
                                        View all notifications
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile Icon with Modal */}
                    <div className="relative profile-button">
                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileModalOpen(!isProfileModalOpen);
                                setIsNotificationsModalOpen(false);
                            }}
                            className="profile-button h-8 w-8 overflow-hidden rounded-full bg-slate-300 cursor-pointer"
                        >
                            {(() => {
                                if (!profilePhotoUrl) {
                                    return (
                                        <Image
                                            src="/Gemini_Generated_Image_xxo7twxxo7twxxo7.png"
                                            alt="User avatar"
                                            width={32}
                                            height={32}
                                            className="h-8 w-8 object-cover"
                                        />
                                    );
                                }
                                
                                // Data URLs don't need validation, use directly
                                if (profilePhotoUrl.startsWith('data:')) {
                                    return (
                                        <Image
                                            src={profilePhotoUrl}
                                            alt="User avatar"
                                            width={32}
                                            height={32}
                                            className="h-8 w-8 object-contain"
                                            unoptimized
                                        />
                                    );
                                }
                                
                                // Validate URL before using (only for http/https URLs)
                                try {
                                    new URL(profilePhotoUrl);
                                    return (
                                        <Image
                                            src={profilePhotoUrl}
                                            alt="User avatar"
                                            width={32}
                                            height={32}
                                            className="h-8 w-8 object-contain"
                                            unoptimized
                                        />
                                    );
                                } catch (e) {
                                    console.error('Invalid profile photo URL:', profilePhotoUrl, e);
                                    return (
                                        <Image
                                            src="/Gemini_Generated_Image_xxo7twxxo7twxxo7.png"
                                            alt="User avatar"
                                            width={32}
                                            height={32}
                                            className="h-8 w-8 object-contain"
                                        />
                                    );
                                }
                            })()}
                        </button>

                        {/* Profile Dropdown */}
                        {isProfileModalOpen && (
                            <div
                                className="profile-modal absolute right-0 top-full mt-2 bg-white rounded-lg shadow-2xl overflow-hidden z-10001 transition-all duration-300 ease-out"
                                style={{
                                    width: "280px",
                                    fontFamily: "Inter, sans-serif",
                                    animation: "slideDown 0.3s ease-out",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* User Information Section */}
                                <div className="px-3 pt-3 pb-2">
                                    <div className="flex items-start gap-2.5">
                                        <div className="h-10 w-10 rounded-full bg-gray-200 shrink-0 flex items-center justify-center overflow-hidden relative">
                                            {profilePhotoUrl ? (
                                                <Image
                                                    src={profilePhotoUrl}
                                                    alt="User avatar"
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            ) : (
                                                <svg
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ color: "#9CA3AF" }}
                                                >
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3
                                                style={{
                                                    fontSize: "15px",
                                                    fontWeight: 700,
                                                    color: "#111827",
                                                    marginBottom: "2px",
                                                }}
                                            >
                                                {userName || 'User'}
                                            </h3>
                                            <p
                                                style={{
                                                    fontSize: "11px",
                                                    fontWeight: 400,
                                                    color: "#6B7280",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                {userEmail || 'No email'}
                                            </p>
                                            <span
                                                className="inline-block px-1.5 py-0.5 rounded-full"
                                                style={{
                                                    fontSize: "10px",
                                                    fontWeight: 500,
                                                    color: "#111827",
                                                    backgroundColor: "#F3F4F6",
                                                }}
                                            >
                                                Job Seeker
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-200 mx-3"></div>

                                {/* Primary Navigation Options */}
                                <div className="px-3 py-2">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/personal-details");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            View Profile
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/uploadcv");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Edit CV
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/applications");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            My Applications
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/assessments");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M9 11l3 3L22 4"></path>
                                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Assessments
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/saved-jobs");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Saved Jobs
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/courses");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Courses & Learning
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-200 mx-3"></div>

                                {/* Preferences Section */}
                                <div className="px-3 py-2">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/notification-preferences");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Notification Preferences
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/settings");
                                            setIsProfileModalOpen(false);
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
                                            style={{ color: "#6B7280" }}
                                        >
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-4.242 0l-4.243 4.243m8.485 0l-4.243-4.243m-4.242 0l-4.243 4.243"></path>
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Settings
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-200 mx-3"></div>

                                {/* Support Section */}
                                <div className="px-3 py-2 pb-3">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                                        onClick={() => {
                                            router.push("/help");
                                            setIsProfileModalOpen(false);
                                        }}
                                    >
                                        <div
                                            className="flex items-center justify-center rounded-full"
                                            style={{
                                                width: "16px",
                                                height: "16px",
                                                backgroundColor: "#6B7280",
                                            }}
                                        >
                                            <svg
                                                width="9"
                                                height="9"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: "13px",
                                                fontWeight: 400,
                                                color: "#111827",
                                            }}
                                        >
                                            Help & Support
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}