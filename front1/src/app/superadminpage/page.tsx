"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sidenav } from "@/components/layout/Sidenav";

import { API_BASE_URL } from '@/lib/api-base';

interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  countryCode: string;
  isVerified: boolean;
  createdAt: string;
}

interface CandidateDetail {
  id: string;
  personalInformation: any;
  education: any[];
  workExperience: any[];
  skills: any[];
  languages: any[];
  careerPreferences: any;
  resume: any;
  cvAnalysis: any;
  certifications: any[];
}

export default function SuperAdminPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const limit = 10;

  // Fetch candidates
  const fetchCandidates = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/candidates?page=${page}&limit=${limit}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCandidates(result.data.candidates);
          setTotalCount(result.data.pagination.total);
          setTotalPages(result.data.pagination.totalPages);
          setCurrentPage(result.data.pagination.page);
        }
      } else {
        console.error("Failed to fetch candidates");
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates(1);
  }, []);

  // Fetch candidate details
  const fetchCandidateDetails = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/candidates/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSelectedCandidate(result.data);
          setShowDetailModal(true);
        }
      } else {
        alert("Failed to fetch candidate details");
      }
    } catch (error) {
      console.error("Error fetching candidate details:", error);
      alert("Error fetching candidate details");
    }
  };

  // Delete candidate
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this candidate?")) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`${API_BASE_URL}/candidates/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Remove from list
          setCandidates(candidates.filter((c) => c.id !== id));
          setTotalCount(totalCount - 1);
          alert("Candidate deleted successfully");
        }
      } else {
        const result = await response.json();
        alert(result.message || "Failed to delete candidate");
      }
    } catch (error) {
      console.error("Error deleting candidate:", error);
      alert("Error deleting candidate");
    } finally {
      setDeletingId(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Sidenav>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Candidates Management</h2>
          <p className="text-gray-600">Total Candidates: <span className="font-semibold text-gray-800">{totalCount}</span></p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg">
            <div className="text-gray-500">Loading candidates...</div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No candidates found</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        CANDIDATE ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        FULL NAME
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        EMAIL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        PHONE NUMBER
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        CREATED DATE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {candidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {candidate.id.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {candidate.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {candidate.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {candidate.phoneNumber || candidate.whatsappNumber || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(candidate.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => fetchCandidateDetails(candidate.id)}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(candidate.id)}
                              disabled={deletingId === candidate.id}
                              className="px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === candidate.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchCandidates(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchCandidates(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Candidate Detail Modal */}
      {showDetailModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Candidate Details</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedCandidate(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {/* Personal Information */}
              {selectedCandidate.personalInformation && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Full Name:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.fullName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Email:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.email || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Phone:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.phoneNumber || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">City:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.city || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Country:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.country || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">LinkedIn:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.personalInformation.linkedinUrl || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Education */}
              {selectedCandidate.education && selectedCandidate.education.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Education ({selectedCandidate.education.length})</h4>
                  <div className="space-y-3">
                    {selectedCandidate.education.map((edu: any, index: number) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-900">{edu.degree}</div>
                        <div className="text-sm text-gray-600">{edu.institution}</div>
                        <div className="text-xs text-gray-500">
                          {edu.startYear} - {edu.endYear || "Present"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              {selectedCandidate.workExperience && selectedCandidate.workExperience.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Work Experience ({selectedCandidate.workExperience.length})</h4>
                  <div className="space-y-3">
                    {selectedCandidate.workExperience.map((exp: any, index: number) => (
                      <div key={index} className="border-l-4 border-green-500 pl-4 py-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-900">{exp.jobTitle}</div>
                        <div className="text-sm text-gray-600">{exp.company}</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(exp.startDate)} - {exp.endDate ? formatDate(exp.endDate) : "Present"}
                        </div>
                        {exp.responsibilities && (
                          <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{exp.responsibilities}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Skills ({selectedCandidate.skills.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills.map((skill: any, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {skill.skillName} ({skill.proficiency})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages */}
              {selectedCandidate.languages && selectedCandidate.languages.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Languages ({selectedCandidate.languages.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.languages.map((lang: any, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {lang.name} ({lang.proficiency})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CV Analysis */}
              {selectedCandidate.cvAnalysis && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">CV Analysis</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">CV Score:</span>{" "}
                      <span className="text-gray-900 font-semibold">{selectedCandidate.cvAnalysis.cvScore}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">ATS Score:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.cvAnalysis.atsScore}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Grammar Score:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.cvAnalysis.grammarScore}%</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Keyword Score:</span>{" "}
                      <span className="text-gray-900">{selectedCandidate.cvAnalysis.keywordScore}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Resume Info */}
              {selectedCandidate.resume && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Resume</h4>
                  <div className="text-sm text-gray-600">
                    <div>File: {selectedCandidate.resume.fileName}</div>
                    <div>Uploaded: {formatDate(selectedCandidate.resume.uploadedAt)}</div>
                    <div>AI Analyzed: {selectedCandidate.resume.aiAnalyzed ? "Yes" : "No"}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Sidenav>
  );
}
