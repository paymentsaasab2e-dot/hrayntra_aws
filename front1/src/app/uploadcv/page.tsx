"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

import { API_BASE_URL } from '@/lib/api-base';

export default function UploadCV() {
  const router = useRouter();
  const [candidateId, setCandidateId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get candidate ID from sessionStorage
    const storedCandidateId = sessionStorage.getItem("candidateId");
    if (storedCandidateId) {
      setCandidateId(storedCandidateId);
    } else {
      // If no candidate ID, redirect to WhatsApp verification
      router.push("/whatsapp");
    }
  }, [router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload a PDF, DOC, or DOCX file.");
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError("File size exceeds 5MB limit. Please upload a smaller file.");
        return;
      }

      setSelectedFile(file);
      setError("");
      setSuccess("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !candidateId) {
      setError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");
    setUploadProgress(0);

    // Store candidateId in sessionStorage for extract page
    sessionStorage.setItem("candidateId", candidateId);
    sessionStorage.setItem("uploadStatus", "processing");

    try {
      const formData = new FormData();
      formData.append("cv", selectedFile);
      formData.append("candidateId", candidateId);

      // Start the upload and redirect to extract page
      const xhr = new XMLHttpRequest();

      // Track upload progress (for reference)
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Handle upload completion/errors
      xhr.addEventListener("load", () => {
        // Upload completed - extract page will handle status checking
        if (xhr.status !== 200) {
          // If upload fails, store error in sessionStorage
          try {
            const response = JSON.parse(xhr.responseText);
            sessionStorage.setItem("uploadError", response.message || "Upload failed");
          } catch (e) {
            sessionStorage.setItem("uploadError", "Upload failed. Please try again.");
          }
        }
      });

      xhr.addEventListener("error", () => {
        sessionStorage.setItem("uploadError", "Network error. Please check your connection and try again.");
      });

      // Open and send the request
      xhr.open("POST", `${API_BASE_URL}/cv/upload`);
      xhr.send(formData);

      // Redirect to extract page immediately after starting upload
      // The extract page will poll for completion status
      setTimeout(() => {
        router.push("/extract");
      }, 100); // Small delay to ensure request is sent
    } catch (err: any) {
      sessionStorage.setItem("uploadError", err.message || "Upload failed. Please try again.");
      router.push("/extract");
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
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
        <div
          style={{
            width: "539px",
            height: "535px",
            borderRadius: "6px",
            border: "1px solid #28A8E1",
            backgroundColor: "#F8F9FA",
          }}
        >
          <div className="px-10 py-12 text-center">
            <h1
              className="font-semibold text-slate-900"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "27px",
                lineHeight: "30.4px",
                letterSpacing: "0%",
              }}
            >
              Upload Your CV
            </h1>
            <p
              className="mt-2 text-center font-normal text-slate-600"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "15.95px",
                lineHeight: "24.8px",
                letterSpacing: "0px",
              }}
            >
              SAASA B2E will analyze your CV and auto-fill your profile using AI.
              <br />
              This saves time and boosts accuracy.
            </p>

            {/* Cards */}
            <div className="mt-8 flex gap-6 justify-center">
              {/* Upload from computer */}
              <div
                className="flex flex-col rounded-lg border border-slate-200 px-6 py-6"
                style={{
                  width: "203.79px",
                  height: "228.6px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <div className="mb-3 flex justify-center">
                  <Image
                    src="/desktop_icon.png"
                    alt="Desktop"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </div>
                <p
                  className="text-center font-medium text-slate-900"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "15.95px",
                    lineHeight: "24.8px",
                    letterSpacing: "0px",
                  }}
                >
                  Upload from your computer
                </p>
                <p className="mt-2 text-center text-sm text-slate-600">
                  Browse your local files
                  <br />
                  to upload your CV.
                </p>
                <div className="mt-5 flex justify-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx"
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={handleChooseFile}
                    disabled={isUploading}
                    className="text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                    style={{
                      width: "173.07px",
                      height: "35.44px",
                      borderRadius: "5px",
                      backgroundColor: "#239CD2",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      fontWeight: "500",
                      lineHeight: "normal",
                    }}
                  >
                    {selectedFile ? "Change File" : "Choose File"}
                  </button>
                </div>
                {selectedFile && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-slate-600">
                      Selected: {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              {/* Send via WhatsApp */}
              <div
                className="flex flex-col rounded-lg border border-slate-200 px-6 py-6"
                style={{
                  width: "203.79px",
                  height: "228.6px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <div className="mb-3 flex justify-center">
                  <Image
                    src="/chat_icon.png"
                    alt="WhatsApp"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </div>
                <p
                  className="text-center font-medium text-slate-900"
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "15.95px",
                    lineHeight: "24.8px",
                    letterSpacing: "0px",
                  }}
                >
                  Send via WhatsApp
                </p>
                <p className="mt-2 text-center text-sm text-slate-600">
                  Easily share your CV from your phone via WhatsApp.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    className="text-white shadow-sm transition hover:opacity-90"
                    style={{
                      width: "173.07px",
                      height: "35.44px",
                      borderRadius: "5px",
                      backgroundColor: "#239CD2",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      fontWeight: "500",
                      lineHeight: "normal",
                    }}
                  >
                    Open WhatsApp
                  </button>
                </div>
              </div>
            </div>

            {/* Upload Button */}
            {selectedFile && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{
                    width: "200px",
                    height: "40px",
                    borderRadius: "5px",
                    backgroundColor: isUploading ? "#94a3b8" : "#239CD2",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "14px",
                    fontWeight: "600",
                    lineHeight: "normal",
                  }}
                >
                  {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Upload & Process CV"}
                </button>
              </div>
            )}

            {/* Progress Bar */}
            {isUploading && (
              <div className="mt-4 px-10">
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 px-10">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600 text-center">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mt-4 px-10">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-600 text-center">{success}</p>
                </div>
              </div>
            )}

            {/* Note */}
            <div className="mt-10 space-y-2 text-center text-sm text-slate-600">
              <p>
                <span className="text-sky-500">ℹ</span> Supported formats: PDF, DOC, DOCX. Max size:
                5 MB.
              </p>
              <p>
                Our AI will intelligently extract and analyze your CV data using Gemini AI.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-6 mt-8 text-xs text-slate-500">
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

