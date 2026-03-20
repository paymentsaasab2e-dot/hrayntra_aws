"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  askProfileQuestion,
  ChatMessage,
  extractProfileData,
  fetchProfileCompleteness,
  ProfileCompletenessResponse,
  ProfileSectionKey,
  ProfileSectionStatus,
  saveSectionDraft,
} from "@/lib/profile-completion";

type DraftMap = Partial<Record<ProfileSectionKey, unknown>>;

interface ProfileCompletionDrawerProps {
  candidateId: string;
  isOpen: boolean;
  initialCompleteness?: ProfileCompletenessResponse | null;
  onClose: () => void;
  onCompletionUpdated: (data: ProfileCompletenessResponse) => void;
}

function getFirstIncompleteSection(sections: ProfileSectionStatus[]): ProfileSectionStatus | null {
  return sections.find((section) => !section.isComplete) || null;
}

function getNextIncompleteSection(
  sections: ProfileSectionStatus[],
  currentKey: ProfileSectionKey | null
): ProfileSectionStatus | null {
  if (!currentKey) {
    return getFirstIncompleteSection(sections);
  }

  const currentIndex = sections.findIndex((section) => section.key === currentKey);
  for (let index = currentIndex + 1; index < sections.length; index += 1) {
    if (!sections[index].isComplete) {
      return sections[index];
    }
  }

  return getFirstIncompleteSection(sections);
}

function mergeDraft(current: unknown, incoming: unknown): unknown {
  if (Array.isArray(current) || Array.isArray(incoming)) {
    return incoming;
  }

  if (
    current &&
    incoming &&
    typeof current === "object" &&
    typeof incoming === "object" &&
    !(current instanceof File) &&
    !(incoming instanceof File)
  ) {
    return { ...(current as Record<string, unknown>), ...(incoming as Record<string, unknown>) };
  }

  return incoming;
}

export default function ProfileCompletionDrawer({
  candidateId,
  isOpen,
  initialCompleteness,
  onClose,
  onCompletionUpdated,
}: ProfileCompletionDrawerProps) {
  const [completeness, setCompleteness] = useState<ProfileCompletenessResponse | null>(
    initialCompleteness || null
  );
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [currentSectionKey, setCurrentSectionKey] = useState<ProfileSectionKey | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const currentSection = useMemo(
    () => completeness?.sections.find((section) => section.key === currentSectionKey) || null,
    [completeness, currentSectionKey]
  );

  const hasDrafts = Object.keys(drafts).length > 0;

  const loadCompleteness = useCallback(async () => {
    const freshData = await fetchProfileCompleteness(candidateId);
    setCompleteness(freshData);
    onCompletionUpdated(freshData);
    return freshData;
  }, [candidateId, onCompletionUpdated]);

  const requestQuestion = useCallback(
    async (
      section: ProfileSectionStatus,
      history: ChatMessage[],
      userMessage?: string
    ) => {
      setLoadingQuestion(true);
      setDrawerError(null);

      try {
        const message = await askProfileQuestion({
          currentSection: section.key,
          missingFields: section.missingFields,
          conversationHistory: history,
          userMessage,
        });

        setConversation((prev) => [...prev, { role: "assistant", content: message }]);
        setCurrentSectionKey(section.key);
        setShowFallback(false);
      } catch (error) {
        console.error("Failed to get AI question:", error);
        setShowFallback(true);
        setDrawerError(
          error instanceof Error
            ? error.message
            : "AI is unavailable right now. You can still complete these sections manually."
        );
      } finally {
        setLoadingQuestion(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }

    const initialize = async () => {
      try {
        const data = initialCompleteness || (await loadCompleteness());
        if (initializedRef.current) return;

        initializedRef.current = true;
        const firstSection = getFirstIncompleteSection(data.sections);

        if (!firstSection) {
          setSuccessMessage("Your profile is already complete.");
          return;
        }

        setCurrentSectionKey(firstSection.key);
        await requestQuestion(firstSection, []);
      } catch (error) {
        console.error("Failed to initialize profile drawer:", error);
        setShowFallback(true);
        setDrawerError(
          error instanceof Error ? error.message : "Unable to load profile completion details."
        );
      }
    };

    void initialize();
  }, [initialCompleteness, isOpen, loadCompleteness, requestQuestion]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    inputRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || !currentSection) return;

    const updatedHistory = [...conversation, { role: "user" as const, content: message }];
    setConversation(updatedHistory);
    setInputValue("");

    if (currentSection.key !== "resume") {
      try {
        const extracted = await extractProfileData<Record<string, unknown>>({
          currentSection: currentSection.key,
          userMessage: message,
        });

        setDrafts((prev) => ({
          ...prev,
          [currentSection.key]: mergeDraft(prev[currentSection.key], extracted),
        }));
      } catch (error) {
        console.error("Failed to extract profile data:", error);
        setShowFallback(true);
        setDrawerError(
          error instanceof Error
            ? error.message
            : "I could not extract structured data from that answer."
        );
      }
    }

    const nextSection = completeness
      ? getNextIncompleteSection(completeness.sections, currentSection.key)
      : null;

    if (nextSection && nextSection.key !== currentSection.key) {
      await requestQuestion(nextSection, updatedHistory, message);
      return;
    }

    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Thanks, I’ve captured that. Use Save & Continue when you’re ready and I’ll keep guiding you through the remaining sections.",
      },
    ]);
  };

  const handleResumeSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setDrafts((prev) => ({
      ...prev,
      resume: { file },
    }));
    setSuccessMessage(`Selected resume: ${file.name}`);
  };

  const handleSave = async (continueAfterSave: boolean) => {
    if (!hasDrafts) return;

    setSaving(true);
    setDrawerError(null);
    setSuccessMessage(null);

    try {
      for (const [sectionKey, draft] of Object.entries(drafts) as Array<[ProfileSectionKey, unknown]>) {
        await saveSectionDraft(candidateId, sectionKey, draft);
      }

      const refreshed = await loadCompleteness();
      setDrafts({});
      setSuccessMessage("Progress saved successfully.");

      if (refreshed.percentage >= 100) {
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Congratulations, your profile is now complete. I’ll close this drawer in a moment.",
          },
        ]);
        setTimeout(() => onClose(), 2000);
        return;
      }

      if (continueAfterSave) {
        const nextSection = getFirstIncompleteSection(refreshed.sections);
        if (nextSection) {
          await requestQuestion(nextSection, conversation);
        }
      }
    } catch (error) {
      console.error("Failed to save profile drafts:", error);
      setDrawerError(error instanceof Error ? error.message : "Failed to save progress.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close profile completion drawer"
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI profile completion drawer"
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl sm:w-[560px]"
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#0EA5E9]">AI Profile Completion</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">Complete your profile faster</h2>
              <p className="mt-1 text-sm text-gray-500">
                I&apos;ll guide you through the missing sections one at a time.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Dismiss profile completion drawer"
            >
              ✕
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Profile completion</span>
              <span className="font-semibold text-gray-900">{completeness?.percentage ?? 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#0EA5E9] transition-all"
                style={{ width: `${completeness?.percentage ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F9FAFB] px-5 py-4">
          {drawerError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {drawerError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          {showFallback && completeness ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Missing sections</h3>
              <p className="mt-1 text-sm text-gray-500">
                AI is temporarily unavailable, but you can still complete these fields manually.
              </p>
              <div className="mt-3 space-y-3">
                {completeness.sections
                  .filter((section) => !section.isComplete)
                  .map((section) => (
                    <div key={section.key} className="rounded-lg bg-gray-50 p-3">
                      <p className="text-sm font-medium text-gray-900">{section.label}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {section.missingFields.length > 0
                          ? `Missing: ${section.missingFields.join(", ")}`
                          : section.completionRule}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {conversation.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "assistant"
                        ? "bg-white text-gray-800"
                        : "bg-[#0EA5E9] text-white"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loadingQuestion ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                    Thinking...
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white px-5 py-4">
          {currentSection ? (
            <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">{currentSection.label}</span>
              {currentSection.missingFields.length > 0 ? `: ${currentSection.missingFields.join(", ")}` : ""}
            </div>
          ) : null}

          {currentSectionKey === "resume" ? (
            <label className="mb-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-600 transition hover:border-[#0EA5E9] hover:text-[#0EA5E9]">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleResumeSelected}
              />
              Upload your resume here
            </label>
          ) : null}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loadingQuestion) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                currentSectionKey === "resume"
                  ? "Optional note for your resume upload"
                  : "Type your answer..."
              }
              className="h-12 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-500 outline-none ring-0 transition focus:border-[#0EA5E9]"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={loadingQuestion || (!inputValue.trim() && currentSectionKey !== "resume")}
              className="h-12 rounded-xl bg-[#111827] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={!hasDrafts || saving}
              className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Progress"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              disabled={!hasDrafts || saving}
              className="h-11 rounded-xl bg-[#0EA5E9] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
