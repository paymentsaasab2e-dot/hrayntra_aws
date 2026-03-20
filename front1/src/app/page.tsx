"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/common/Footer";

const PRIMARY = "#28A8E1";
const BORDER = "#E5E7EB";
const BODY_COLOR = "#6B7280";

const JOBSEEKER_STEPS = [
  { step: "1", title: "Create Your Profile", description: "Build a comprehensive profile highlighting your skills and experience." },
  { step: "2", title: "Upload Your CV", description: "Let our AI analyze and optimize your resume for best results." },
  { step: "3", title: "Explore Matched Jobs", description: "Receive personalized job recommendations tailored to your profile." },
  { step: "4", title: "Apply & Track", description: "Effortlessly apply to jobs and monitor your application status." },
];

const EMPLOYER_STEPS = [
  { step: "1", title: "Recruitment System", description: "Post job openings, manage applicants, and discover the best candidates using AI-powered recruitment tools." },
  { step: "2", title: "AI Candidate Matching", description: "Our intelligent matching system identifies the most relevant candidates based on skills, experience, and job requirements." },
  { step: "3", title: "Employee Management", description: "Manage employee records, roles, and team information through a centralized employee management dashboard." },
  { step: "4", title: "Payroll Management", description: "Automate payroll processing, manage compensation, and ensure accurate salary distribution for your workforce." },
];

export default function Home() {
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [howItWorksMode, setHowItWorksMode] = useState<"jobseekers" | "employers">("jobseekers");

  const stats =
    role === "candidate"
      ? [
          { label: "Satisfied users globally", value: "75K+" },
          { label: "Beneficial User Cashback", value: "92%" },
        ]
      : [
          { label: "Trusted recruiters", value: "18K+" },
          { label: "Avg. qualified matches", value: "94%" },
        ];

  return (
    <div
      className="min-h-screen text-slate-900 [font-family:var(--font-inter),sans-serif]"
      style={{ background: "#F9FAFB" }}
    >
      <header className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/SAASA%20Logo.png"
              alt="SAASA B2E logo"
              width={110}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-600">
            <a className="transition hover:text-slate-900" href="#jobseeker">
              For Jobseeker
            </a>
            <a className="transition hover:text-slate-900" href="#recruiter">
              For Recruiter
            </a>
            <a className="transition hover:text-slate-900" href="#pricing">
              Pricing
            </a>
            <a
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-md"
              style={{ backgroundColor: PRIMARY }}
              href="#cta"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-6 md:grid-cols-2 md:gap-12">
            <div className="flex flex-col justify-center text-left">
              <h1 className="font-bold leading-[1.2] text-slate-900" style={{ fontSize: "44px", marginBottom: "20px" }}>
                Are you here to find a job or hire talent ?
              </h1>
              <p
                className="text-slate-600"
                style={{
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: BODY_COLOR,
                  marginBottom: "30px",
                }}
              >
                SAASA B2E connects jobseekers with their dream roles and empowers employers to find the perfect talent effortlessly,
                leveraging advanced AI-driven tools.
              </p>
              <div className="space-y-4" style={{ marginBottom: "24px" }}>
                <p className="text-sm font-semibold text-slate-700">I am a...</p>
                <div className="flex gap-4">
                  <button
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      role === "candidate" ? "border-transparent text-white" : "bg-white text-slate-700"
                    }`}
                    style={role === "candidate" ? { backgroundColor: PRIMARY } : { borderColor: "#D1D5DB" }}
                    aria-pressed={role === "candidate"}
                    onClick={() => setRole("candidate")}
                  >
                    Candidate
                  </button>
                  <button
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      role === "recruiter" ? "border-transparent text-white" : "bg-white text-slate-700"
                    }`}
                    style={role === "recruiter" ? { backgroundColor: PRIMARY } : { borderColor: "#D1D5DB" }}
                    aria-pressed={role === "recruiter"}
                    onClick={() => setRole("recruiter")}
                  >
                    Recruiter
                  </button>
                </div>
                <Link
                  href="/whatsapp"
                  className="inline-flex w-full items-center justify-center rounded-lg font-semibold text-white transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)]"
                  style={{
                    backgroundColor: PRIMARY,
                    padding: "12px 26px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  {role === "candidate" ? "Continue as Candidate" : "Continue as Recruiter"}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border bg-white py-5 text-center transition-all duration-200"
                    style={{ borderColor: BORDER }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold md:text-3xl" style={{ color: PRIMARY }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div
                className="overflow-hidden rounded-2xl transition-all duration-200"
                style={{
                  boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                  borderRadius: "16px",
                }}
              >
                <Image
                  src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80"
                  alt="Person in vehicle"
                  width={600}
                  height={600}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Why people prefer SAASA B2E */}
        <section className="py-20" style={{ background: "#F9FAFB" }}>
          <div className="relative mx-auto max-w-[1200px] px-6">
            <div className="mb-12 text-center">
              <h2 className="font-semibold text-slate-900" style={{ fontSize: "30px", marginBottom: "12px" }}>
                Why people prefer SAASA B2E
              </h2>
              <p className="mx-auto max-w-xl" style={{ fontSize: "16px", lineHeight: 1.6, color: BODY_COLOR }}>
                Built for both jobseekers and hiring teams, our platform revolutionizes the recruitment process with intelligent tools and a
                seamless experience.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Faster, Smarter Matches",
                  description:
                    "Our AI algorithms connect jobseekers with ideal roles and employers with top talent in record time.",
                },
                {
                  title: "CV & JD Superpowers",
                  description:
                    "Intelligent analysis and generation tools transform resumes and job descriptions for optimal impact.",
                },
                {
                  title: "Transparent Workflows",
                  description:
                    "Real-time tracking and clear communication channels ensure everyone stays informed and aligned.",
                },
                {
                  title: "Skill Growth & Insights",
                 description:
                    "Personalized recommendations and analytics help jobseekers upskill and employers identify skill gaps.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border bg-white transition-all duration-200 ease-out hover:-translate-y-[3px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                  style={{
                    borderColor: BORDER,
                    padding: "28px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "#EFF6FF" }}>
                    <span className="text-lg" style={{ color: PRIMARY }}>
                      ●
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY_COLOR }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Unleash the Power of AI */}
        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-6 md:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-900" style={{ fontSize: "30px" }}>
                Unleash the Power of AI in Hiring
              </h2>
              <p style={{ fontSize: "16px", lineHeight: 1.6, color: BODY_COLOR }}>
                Our cutting-edge AI transforms every stage of your recruitment journey, from intelligent matching to automated feedback,
                ensuring optimal results and efficiency.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                "AI CV Analyzer: Optimize resumes for success",
                "AI Job Matching: Precision talent-to-role connections",
                "AI JD Generator: Craft compelling job descriptions",
                "AI Feedback Loop: Continuous improvement for applications",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-lg transition-colors duration-200 hover:bg-[#F9FAFB]"
                  style={{ padding: "12px 16px", gap: "12px" }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    ✓
                  </span>
                  <p className="text-sm" style={{ color: BODY_COLOR, lineHeight: 1.5 }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI CV Maker */}
        <section className="py-20" style={{ background: "#F9FAFB" }}>
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="mb-12 text-center">
              <h2 className="font-semibold text-slate-900" style={{ fontSize: "30px", marginBottom: "8px" }}>
                AI CV Maker
              </h2>
              <p style={{ fontSize: "16px", lineHeight: 1.6, color: BODY_COLOR }}>
                Create professional resumes with AI-powered tools
              </p>
            </div>
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12 lg:justify-start">
              <div className="relative flex h-[340px] w-full items-center justify-center lg:ml-0 lg:h-[420px] lg:w-[48%] lg:max-w-[480px] lg:justify-start">
                <div
                  className="absolute left-0 z-10 hidden rounded-[14px] lg:block"
                  style={{ width: "140px", boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}
                >
                  <div className="overflow-hidden rounded-[14px] bg-white">
                    <Image src="/cv_2.jpg" alt="CV Example 1" width={140} height={190} className="h-[190px] w-full object-cover" />
                  </div>
                </div>

                <div className="relative z-20 w-full max-w-[280px] rounded-[14px] sm:max-w-[320px] md:max-w-[340px]" style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}>
                  <div className="overflow-hidden rounded-[14px] bg-white">
                    <Image
                      src="/cv_main.jpg"
                      alt="AI CV Maker - Main"
                      width={340}
                      height={420}
                      className="h-[300px] w-full object-cover sm:h-[340px] md:h-[360px] lg:h-[400px]"
                      style={{ objectPosition: "center 20%" }}
                    />
                    <div className="absolute bottom-3 right-3 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-tight text-white shadow">
                      New
                      <span>Feature</span>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute right-0 z-10 hidden rounded-[14px] lg:block"
                  style={{ width: "140px", boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}
                >
                  <div className="overflow-hidden rounded-[14px] bg-white">
                    <Image src="/cv_1.jpg" alt="CV Example 2" width={140} height={190} className="h-[190px] w-full object-cover" />
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-5">
                {[
                  {
                    title: "AI CV Analyzer",
                    description: "Instantly scan your CV for keywords, formatting, and relevance against industry standards.",
                  },
                  {
                    title: "AI Job Match Score",
                    description: "Understand how well your skills align with specific job postings before you apply, saving time.",
                  },
                  {
                    title: "AI Missing Keyword Suggestions",
                    description: "Identify crucial keywords missing from your CV that could improve your chances with ATS.",
                  },
                  {
                    title: "AI Rejection Feedback & Course Recommendations",
                    description:
                      "Receive constructive feedback on past rejections and get personalized course suggestions to fill skill gaps.",
                  },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg transition-colors duration-200 hover:bg-white hover:shadow-sm"
                    style={{ padding: "12px 16px", gap: "12px" }}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      ✓
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{feature.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: BODY_COLOR }}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How SAASA B2E Works */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="mb-10 text-center">
              <h2 className="font-semibold text-slate-900" style={{ fontSize: "30px", marginBottom: "16px" }}>
                How SAASA B2E Works
              </h2>
            </div>
            <div className="mb-10 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setHowItWorksMode("jobseekers")}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200"
                style={{
                  backgroundColor: howItWorksMode === "jobseekers" ? PRIMARY : "transparent",
                  color: howItWorksMode === "jobseekers" ? "white" : "#374151",
                  border: howItWorksMode === "jobseekers" ? "none" : "1px solid #D1D5DB",
                }}
              >
                For Jobseekers
              </button>
              <button
                type="button"
                onClick={() => setHowItWorksMode("employers")}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                style={{
                  backgroundColor: howItWorksMode === "employers" ? PRIMARY : "white",
                  color: howItWorksMode === "employers" ? "white" : "#374151",
                  border: howItWorksMode === "employers" ? "none" : "1px solid #D1D5DB",
                }}
              >
                For Employers
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {(howItWorksMode === "jobseekers" ? JOBSEEKER_STEPS : EMPLOYER_STEPS).map((item, index) => (
                <div
                  key={`${howItWorksMode}-${item.step}`}
                  className="how-it-works-card-enter rounded-xl border bg-white text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                  style={{
                    borderColor: BORDER,
                    padding: "24px",
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div
                    className="mb-4 flex h-[30px] w-[30px] items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: BODY_COLOR }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
