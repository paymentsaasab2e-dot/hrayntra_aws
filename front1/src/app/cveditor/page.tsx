'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import CVEditor from '@/components/cveditor/CVEditor';

import { API_BASE_URL } from '@/lib/api-base';
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export default function CVEditorPage() {
  const router = useRouter();
  const [resumeHtml, setResumeHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load resume HTML on mount
  useEffect(() => {
    const loadResume = async () => {
      const candidateId = sessionStorage.getItem('candidateId');
      if (!candidateId) {
        alert('Please login first');
        router.push('/login');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/cveditor/resume/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // Handle 404 (no resume found) gracefully
          if (response.status === 404) {
            console.log('No resume found, using default template');
            setResumeHtml('<h1>Your Name</h1><p>Professional Title</p><h2>Summary</h2><p>Your professional summary...</p>');
            return;
          }
          // For other errors, try to get error message from response
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.success && result.data && result.data.resume_html) {
          setResumeHtml(result.data.resume_html);
        } else {
          // Default empty resume
          setResumeHtml('<h1>Your Name</h1><p>Professional Title</p><h2>Summary</h2><p>Your professional summary...</p>');
        }
      } catch (error) {
        console.error('Error loading CV:', error);
        // Only show alert for non-404 errors
        const errorMessage = getErrorMessage(error);
        if (errorMessage && !errorMessage.includes('404')) {
          console.warn('Failed to load CV data:', errorMessage);
        }
        // Set default content on error
        setResumeHtml('<h1>Your Name</h1><p>Professional Title</p><h2>Summary</h2><p>Your professional summary...</p>');
      } finally {
        setIsLoading(false);
      }
    };

    loadResume();
  }, [router]);

  // Handle editor content update
  const handleEditorUpdate = (html: string) => {
    setResumeHtml(html);
  };

  // Save resume HTML
  const saveResume = async () => {
    const candidateId = sessionStorage.getItem('candidateId');
    if (!candidateId) {
      alert('Please login first');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`${API_BASE_URL}/cveditor/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          resume_html: resumeHtml,
        }),
      });

      if (!response.ok) throw new Error('Failed to save CV');
      
      const result = await response.json();
      if (result.success) {
        alert('CV saved successfully!');
      }
    } catch (error) {
      console.error('Error saving CV:', error);
      alert('Failed to save CV');
    } finally {
      setIsSaving(false);
    }
  };

  // Export resume as PDF
  const exportToPDF = async () => {
    const candidateId = sessionStorage.getItem('candidateId');
    if (!candidateId) {
      alert('Please login first');
      return;
    }

    try {
      setIsExporting(true);
      const response = await fetch(`${API_BASE_URL}/cveditor/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          resume_html: resumeHtml,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to export PDF');
      }

      // Get PDF blob
      const blob = await response.blob();
      
      // Check if response is actually a PDF
      if (blob.type !== 'application/pdf' && blob.size > 0) {
        // If not PDF, might be JSON error
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Failed to export PDF');
        } catch {
          // If not JSON, treat as PDF anyway
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('CV exported as PDF successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Improve text with AI
  const improveTextWithAI = async (text: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/cveditor/ai-improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Failed to improve text';
        throw new Error(errorMessage);
      }
      
      if (result.success && result.data?.improvedText) {
        return result.data.improvedText;
      }
      
      throw new Error(result.message || 'No improved text returned');
    } catch (error) {
      console.error('Error improving text:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading CV editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header with Save and Export buttons */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">CV Editor</h1>
          <div className="flex gap-3">
            <button
              onClick={saveResume}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save CV'}
            </button>
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* TipTap Editor */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <CVEditor
            content={resumeHtml}
            onUpdate={handleEditorUpdate}
            onImproveText={improveTextWithAI}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Click anywhere in the CV to start editing</li>
            <li>Use the toolbar to format text (bold, italic, headings, etc.)</li>
            <li>Select text and click "Improve with AI" to enhance it</li>
            <li>Click "+ Add Section" to insert new sections</li>
            <li>Click "Save CV" to save your changes</li>
            <li>Click "Export PDF" to download your CV</li>
          </ul>
        </div>
      </main>

      <Footer />
    </div>
  );
}
