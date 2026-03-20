'use client';

import Link from 'next/link';
import Image from 'next/image';

const currentYear = new Date().getFullYear();

const PRIMARY = '#28A8E1';

export default function Footer() {
  return (
    <footer
      className="border-t border-slate-200 text-black"
      style={{ fontFamily: 'Inter, sans-serif', background: '#F3F4F6' }}
    >
      {/* Top section */}
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Brand + Connect with us */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="inline-flex transition-opacity hover:opacity-90">
              <Image src="/SAASA%20Logo.png" alt="SAASA B2E" width={130} height={38} className="h-9 w-auto" />
            </Link>
            <p className="text-sm font-medium text-black">Connect with us</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-black hover:text-black/80 transition-colors" aria-label="Facebook">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="#" className="text-black hover:text-black/80 transition-colors" aria-label="Instagram">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" className="text-black hover:text-black/80 transition-colors" aria-label="X (Twitter)">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="text-black hover:text-black/80 transition-colors" aria-label="LinkedIn">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Middle: Link columns */}
          <div className="flex flex-wrap gap-x-14 gap-y-6 sm:gap-x-16">
            <div className="flex flex-col gap-3">
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                About us
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Careers
              </Link>
              <Link href="/explore-jobs" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Employer home
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Sitemap
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Credits
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/help" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Help center
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Summons / Notices
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Grievances
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Report issue
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Privacy policy
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Terms & conditions
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Fraud alert
              </Link>
              <Link href="#" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Trust & safety
              </Link>
            </div>
          </div>

          {/* Right: Apply on the go */}
          <div className="shrink-0 w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-black mb-1">Apply on the go</h3>
            <p className="text-sm text-black mb-4">Get real-time job updates on our App</p>
            <div className="flex flex-col gap-2">
              <a
                href="#"
                className="flex items-center gap-3 rounded-lg bg-[#1a1a1a] px-4 py-3 text-sm font-medium hover:bg-[#333] transition-colors"
                style={{ color: '#e5e5e5' }}
              >
                <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="#e5e5e5">
                  <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5h15c.83 0 1.5.67 1.5 1.5v17c0 .83-.67 1.5-1.5 1.5h-15c-.83 0-1.5-.67-1.5-1.5z" />
                  <path d="M12 7.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" />
                </svg>
                <span style={{ color: '#e5e5e5' }}>GET IT ON Google Play</span>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 rounded-lg bg-[#1a1a1a] px-4 py-3 text-sm font-medium hover:bg-[#333] transition-colors"
                style={{ color: '#e5e5e5' }}
              >
                <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="#e5e5e5">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <span style={{ color: '#e5e5e5' }}>Download on the App Store</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-slate-200" />

      {/* Bottom: Copyright + Our businesses */}
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-black">SAASA B2E</span>
            <p className="text-xs text-black max-w-md">
              All trademarks are the property of their respective owners. All rights reserved © {currentYear} SAASA B2E.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-xs text-black">Our products</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/explore-jobs" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Jobs
              </Link>
              <Link href="/courses" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Courses
              </Link>
              <Link href="/applications" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Applications
              </Link>
              <Link href="/profile" className="text-sm font-medium text-black transition-colors hover:text-[#28A8E1]">
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
