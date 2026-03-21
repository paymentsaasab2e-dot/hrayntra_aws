"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from '@/lib/api-base';

export default function ExtractPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Starting CV analysis...");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const redirectToDashboard = () => {
    router.push("/candidate-dashboard");
  };

  useEffect(() => {
    // Get candidate ID from sessionStorage
    const storedCandidateId = sessionStorage.getItem("candidateId");
    if (!storedCandidateId) {
      // If no candidate ID, redirect back to upload
      router.push("/uploadcv");
      return;
    }
    setCandidateId(storedCandidateId);

    // Status messages that cycle during processing
    const statusMessages = [
      "Parsing PDF document...",
      "Extracting text from CV...",
      "Cleaning and normalizing text...",
      "Sending to AI for analysis...",
      "Extracting personal information...",
      "Analyzing work experience...",
      "Processing education details...",
      "Identifying skills and languages...",
      "Validating extracted data...",
      "Finalizing profile data...",
    ];

    let statusIndex = 0;
    let progressValue = 0;
    let statusInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    let checkStatusInterval: NodeJS.Timeout;

    // Update status messages
    statusInterval = setInterval(() => {
      if (statusIndex < statusMessages.length - 1) {
        statusIndex++;
        setStatus(statusMessages[statusIndex]);
      }
    }, 3000);

    // Simulate progress (will be overridden by actual completion)
    progressInterval = setInterval(() => {
      if (progressValue < 90 && isProcessing) {
        progressValue += 1;
        setProgress(progressValue);
      }
    }, 200);

    // Check backend status periodically
    const checkProcessingStatus = async () => {
      if (!storedCandidateId) return;

      try {
        // Check if resume exists and is processed
        const response = await fetch(`${API_BASE_URL}/cv/status/${storedCandidateId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.processed && data.aiAnalyzed) {
            // Processing complete
            setIsProcessing(false);
            setProgress(100);
            setStatus("CV analysis complete! Redirecting to dashboard...");
            clearInterval(statusInterval);
            clearInterval(progressInterval);
            clearInterval(checkStatusInterval);
            
            // Clear upload status from sessionStorage
            sessionStorage.removeItem("uploadStatus");
            sessionStorage.removeItem("uploadError");
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              redirectToDashboard();
            }, 1500);
          } else if (data.hasResume && !data.aiAnalyzed) {
            // Resume exists but not yet analyzed - still processing
            setStatus("Processing CV with AI...");
          }
        }
      } catch (error) {
        // If status check fails, check for upload error
        const uploadError = sessionStorage.getItem("uploadError");
        if (uploadError) {
          // Upload failed
          setIsProcessing(false);
          setStatus("Upload failed. Please try again.");
          clearInterval(statusInterval);
          clearInterval(progressInterval);
          clearInterval(checkStatusInterval);
          
          setTimeout(() => {
            router.push("/uploadcv");
          }, 3000);
          return;
        }
        // Otherwise continue checking
      }
    };

    // Check status every 2 seconds
    checkStatusInterval = setInterval(checkProcessingStatus, 2000);
    // Initial check after 1 second (give upload time to start)
    setTimeout(checkProcessingStatus, 1000);
    
    // Fallback: After 60 seconds, redirect anyway (in case of issues)
    setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setProgress(100);
        setStatus("Processing complete! Redirecting to dashboard...");
        clearInterval(statusInterval);
        clearInterval(progressInterval);
        clearInterval(checkStatusInterval);
        
        setTimeout(() => {
          redirectToDashboard();
        }, 1500);
      }
    }, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(progressInterval);
      clearInterval(checkStatusInterval);
    };
  }, [router, isProcessing]);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 800px 600px at bottom left, #bae6fd 0%, #dbeafe 30%, transparent 70%), radial-gradient(ellipse 800px 600px at 80% 60%, #fed7aa 0%, #fde2e4 30%, transparent 70%), white",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/SAASA%20Logo.png"
            alt="SAASA B2E"
            width={110}
            height={32}
            className="h-8 w-auto"
          />
        </div>
        <a href="#" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
          Help
        </a>
      </header>

      {/* Main content */}
      <main className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl text-center">
          {/* Loading circle */}
          <div className="mb-8 flex justify-center">
            <div
              className="animate-spin rounded-full border-4 border-t-transparent"
              style={{
                width: "80px",
                height: "80px",
                borderColor: "#bae6fd",
                borderTopColor: "#239CD2",
              }}
            />
          </div>

          {/* Main message */}
          <h1
            className="mb-4 text-center font-medium text-slate-800"
            style={{
              fontFamily: "Poppins, sans-serif",
              fontSize: "30px",
              lineHeight: "36px",
              letterSpacing: "0px",
            }}
          >
            Analyzing your CV using SAASA B2E AI...
          </h1>

          {/* Descriptive text */}
          <p
            className="mb-8 text-center font-normal text-slate-600"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "17.5px",
              lineHeight: "28px",
              letterSpacing: "0px",
            }}
          >
            This usually takes a few seconds. We&apos;re extracting your skills, experience,
            education, and more.
          </p>

          {/* Progress bar */}
          <div className="mb-4">
            <div
              className="h-2 rounded-full"
              style={{
                backgroundColor: "#e0f2fe",
                width: "100%",
                maxWidth: "500px",
                margin: "0 auto",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: "#239CD2",
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {/* Status message */}
          <p
            className="text-center font-medium text-slate-700"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "18px",
              lineHeight: "24px",
            }}
          >
            {status}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
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

