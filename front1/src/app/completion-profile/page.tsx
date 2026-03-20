"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Header from "../../components/common/Header";

export default function CompletionProfilePage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#F8FAFC",
      }}
    >
      {/* Header */}
      <Header showNav={false} />

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 min-h-[calc(100vh-140px)] flex items-center justify-center" style={{ paddingBottom: "64px" }}>
        <div className="mx-auto flex w-full flex-col items-center">
          {/* Completion Card - matches provided design */}
          <div
            className="w-full bg-white shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden"
            style={{
              width: "1000px",
              border: "1.5px solid #38BDF8",
              borderRadius: "20px",
              padding: "24px 40px",
            }}
          >
            {/* Header Section - Minimal */}
            <div className="mb-4">
              <h1
                className="text-slate-900"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "24px",
                  lineHeight: "28px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em"
                }}
              >
                Profile Completion Summary
              </h1>
              <p
                className="mt-0.5"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  color: "#64748b",
                  fontWeight: 500
                }}
              >
                Congratulations, John! Your profile is almost complete.
              </p>
            </div>

            <div className="flex gap-8 items-center">
              {/* Left Side: Illustration - Scaled Down */}
              <div className="w-[32%] shrink-0">
                <div className="relative bg-slate-50/20 rounded-xl p-2.5 border border-slate-100">
                  <Image
                    src="/profile%20completionnn.jpg"
                    alt="Profile completion illustration"
                    width={320}
                    height={230}
                    className="h-auto w-full rounded-lg mix-blend-multiply"
                  />
                </div>
              </div>

              {/* Right Side: Progress and Checklist */}
              <div className="flex-1">
                {/* Progress Bar Section - Ultra Compact */}
                <div className="bg-slate-50/40 rounded-xl p-4 border border-slate-100 mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="font-bold uppercase tracking-wider"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "10px",
                        color: "#64748b",
                      }}
                    >
                      Overall Completion
                    </span>
                    <span
                      className="font-black text-sky-600"
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "15px",
                      }}
                    >
                      88%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/40">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 shadow-sm relative"
                      style={{
                        width: "88%",
                      }}
                    />
                  </div>
                </div>

                {/* Milestones Checklist - Tight Grid */}
                <div>
                  <h2
                    className="mb-2"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Your Milestones
                  </h2>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                    {[
                      "WhatsApp Verification",
                      "Personal Details",
                      "Education History",
                      "Work Experience",
                      "Skill Identification",
                      "Career Preferences",
                      "Salary Expectations",
                      "Location & Eligibility",
                      "Additional Details",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 group"
                      >
                        <Image
                          src="/circle-check-big.svg"
                          alt="Completed"
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 text-emerald-500 group-hover:text-sky-500 shrink-0"
                        />
                        <span
                          className="flex-1 text-slate-600 group-hover:text-slate-900 font-medium"
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: "12px",
                          }}
                        >
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer text and Action - Minimal Height */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  color: "#64748b",
                  fontWeight: 500
                }}
              >
                You&apos;re all set! Explore job opportunities on your dashboard.
              </p>
              <button
                type="button"
                onClick={() => router.push("/candidate-dashboard")}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-md shadow-sky-600/5"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Go To Dashboard
              </button>
            </div>
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


