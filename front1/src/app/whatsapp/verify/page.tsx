"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function VerifyOTP() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(29);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [countryCode, setCountryCode] = useState("");

  useEffect(() => {
    // Get WhatsApp number from sessionStorage
    const storedNumber = sessionStorage.getItem("whatsappNumber");
    const storedCountryCode = sessionStorage.getItem("countryCode");
    const storedFullNumber = sessionStorage.getItem("fullWhatsAppNumber");

    if (storedNumber && storedCountryCode) {
      setWhatsappNumber(storedNumber);
      setCountryCode(storedCountryCode);
    } else {
      // If no stored data, redirect back to WhatsApp page
      router.push("/whatsapp");
    }
  }, [router]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setIsResendDisabled(false);
    }
  }, [timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleResend = async () => {
    setError("");
    setTimer(29);
    setIsResendDisabled(true);

    if (!whatsappNumber || !countryCode) {
      setError("Missing WhatsApp number. Please go back and enter your number again.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsappNumber: whatsappNumber,
          countryCode: countryCode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to resend OTP");
      }

      // In development, show OTP on screen
      if (data.data.otp) {
        alert(`Development Mode - New OTP: ${data.data.otp}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP. Please try again.");
      console.error("Error resending OTP:", err);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    if (!whatsappNumber || !countryCode) {
      setError("Missing WhatsApp number. Please go back and enter your number again.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsappNumber: whatsappNumber,
          countryCode: countryCode,
          otp: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid OTP. Please try again.");
      }

      // Store candidate ID in sessionStorage for future use
      if (data.data.candidateId) {
        sessionStorage.setItem("candidateId", data.data.candidateId);
      }

      // Clear OTP-related session data
      sessionStorage.removeItem("whatsappNumber");
      sessionStorage.removeItem("countryCode");
      sessionStorage.removeItem("fullWhatsAppNumber");

      // Returning users (number already in DB / onboarded before): go straight to dashboard — no CV step
      const skipCv = data.data.skipCvUpload === true;
      router.push(skipCv ? "/candidate-dashboard" : "/uploadcv");
    } catch (err: any) {
      setError(err.message || "Verification failed. Please try again.");
      console.error("Error verifying OTP:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const maskPhoneNumber = (number: string) => {
    if (number.length <= 4) return number;
    const visible = number.slice(-4);
    const masked = "•".repeat(number.length - 4);
    return `${masked}${visible}`;
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
      <main className="flex min-h-[calc(100vh-140px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Verification card */}
          <div
            className="border border-teal-200 bg-white p-8 shadow-lg"
            style={{
              width: "456px",
              height: "468px",
              borderRadius: "3px",
            }}
          >
            <div className="mb-6 text-center">
              <h1
                className="font-medium text-slate-900"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "22.73px",
                  lineHeight: "30.4px",
                  letterSpacing: "0%",
                  marginBottom: "13px",
                }}
              >
                Verify your WhatsApp Number
              </h1>
              <p
                className="font-normal text-slate-600"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11.94px",
                  lineHeight: "17.1px",
                  letterSpacing: "0px",
                }}
              >
                We have sent a 6-digit verification code to your email address
                <br />
                <span style={{ fontSize: "10px", color: "#239CD2" }}>ghodehimanshu453@gmail.com</span>
              </p>
            </div>

            {/* Phone number display */}
            <div className="text-center" style={{ marginBottom: "30px" }}>
              <p
                className="font-normal text-slate-800"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  lineHeight: "15.2px",
                  letterSpacing: "0px",
                }}
              >
                {countryCode && whatsappNumber
                  ? `${countryCode} ${maskPhoneNumber(whatsappNumber)}`
                  : "+91 •••••• 1234"}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* OTP input with floating label */}
            <div className="relative mb-4">
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className={`w-full rounded-md border border-slate-200 px-4 pb-2 text-center text-lg tracking-widest text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                    isFocused || otp.length > 0 ? "pt-5" : "pt-3"
                  }`}
                  style={{ color: "#000000" }}
                />
                <label
                  className={`pointer-events-none absolute text-slate-500 transition-all duration-200 ${
                    isFocused || otp.length > 0
                      ? "left-1/2 -top-2.5 -translate-x-1/2 text-xs font-medium bg-white px-1"
                      : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm"
                  }`}
                  style={
                    isFocused || otp.length > 0
                      ? {
                          color: "#239CD2",
                        }
                      : undefined
                  }
                >
                  Verification Code
                </label>
              </div>
            </div>

            {/* Resend code */}
            <div className="mb-6 text-center">
              <p
                className="font-normal text-slate-600"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11.94px",
                  lineHeight: "17.1px",
                  letterSpacing: "0px",
                }}
              >
                Didn&apos;t receive the code?{" "}
                {isResendDisabled ? (
                  <span className="text-slate-500">
                    Resend code in {formatTime(timer)}
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="text-sky-600 hover:text-sky-700"
                  >
                    Resend code
                  </button>
                )}
              </p>
            </div>

            {/* Verify button */}
            <button
              type="button"
              className="text-sm font-semibold text-white shadow-sm transition block mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleVerifyOTP}
              disabled={isLoading || otp.length !== 6}
              style={{
                width: "332px",
                height: "31px",
                borderRadius: "3px",
                backgroundColor: "#239CD2",
                marginBottom: "21px",
              }}
            >
              {isLoading ? "Verifying..." : "Verify OTP"}
            </button>

            {/* Change number link */}
            <div className="mb-4 text-center">
              <button
                onClick={() => router.push("/whatsapp")}
                className="text-sky-600 hover:text-sky-700"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11.94px",
                  lineHeight: "17.1px",
                  letterSpacing: "0px",
                }}
              >
                Change WhatsApp number
              </button>
            </div>

            {/* Explanation text */}
            <p
              className="text-center font-normal text-slate-500"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11.94px",
                lineHeight: "17.1px",
                letterSpacing: "0px",
                marginTop: "33px",
              }}
            >
              Check your email (ghodehimanshu453@gmail.com) for the verification code.
              <br />
              This verification helps us protect your account and enable job alerts.
            </p>
          </div>
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

