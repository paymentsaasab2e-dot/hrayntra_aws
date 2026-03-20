'use client';

import { useState, useEffect } from 'react';

interface PortfolioLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PortfolioLinksData) => void;
  onAddLink?: (link: PortfolioLink) => void; // Callback to save individual link immediately
  initialData?: PortfolioLinksData;
}

export interface PortfolioLink {
  id: string;
  linkType: string;
  url: string;
  title?: string;
  description?: string;
}

export interface PortfolioLinksData {
  links: PortfolioLink[];
}

const LINK_TYPES = [
  'Portfolio Website',
  'GitHub',
  'LinkedIn',
  'Behance',
  'Dribbble',
  'Medium',
  'Personal Blog',
  'YouTube',
  'Other'
];

const getLinkIcon = (linkType: string) => {
  const type = linkType.toLowerCase();
  if (type.includes('github')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    );
  } else if (type.includes('linkedin')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    );
  } else if (type.includes('behance')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22 7h-7v-2h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.542 1.211 5.088 2.533h-3.544c-.048-1.197-.785-2.033-2.342-2.033-2.005 0-2.608 1.807-2.608 3.031 0 1.893.957 3.305 2.869 3.305 1.209 0 2.007-.726 2.493-1.686h-2.443v-2.031h5.977c.081.67.081 1.352-.001 2.041zm-7.006 0H9.861c.094 1.583 1.159 2.466 2.807 2.466 1.573 0 2.754-.782 2.754-2.466v-.001zm-2.269-5.354h-2.686c.094 1.583 1.033 2.466 2.754 2.466 1.506 0 2.259-.782 2.259-2.466-.009-1.582-.761-2.466-2.327-2.466zM5.809 9.243C4.569 9.243 3.5 10.213 3.5 11.574s1.069 2.331 2.309 2.331c1.24 0 2.309-1.08 2.309-2.331s-1.069-2.331-2.309-2.331zm-5.809 11.918V0h11.522v21.161H0z"/>
      </svg>
    );
  } else if (type.includes('dribbble')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm9.885 11.441c-2.575-.422-4.198-.995-6.495-1.9.012-.294.012-.588.012-.883 0-3.206-1.184-6.072-3.169-8.26 2.239 1.38 4.78 2.241 7.359 2.538a11.5 11.5 0 0 1 2.293 8.505zM9.27 2.5c1.984 2.188 3.169 5.054 3.169 8.26 0 .294 0 .588-.012.883-2.297.905-3.92 1.478-6.495 1.9a11.5 11.5 0 0 1-2.293-8.505c2.579-.297 5.12-1.158 7.359-2.538zm-3.75 11.441c2.575.422 4.198.995 6.495 1.9-.012.294-.012.588-.012.883 0 3.206 1.184 6.072 3.169 8.26-2.239-1.38-4.78-2.241-7.359-2.538a11.5 11.5 0 0 1-2.293-8.505zm13.23 8.505c-1.984-2.188-3.169-5.054-3.169-8.26 0-.294 0-.588.012-.883 2.297-.905 3.92-1.478 6.495-1.9a11.5 11.5 0 0 1 2.293 8.505c-2.579.297-5.12 1.158-7.359 2.538z"/>
      </svg>
    );
  } else if (type.includes('medium')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
      </svg>
    );
  } else if (type.includes('youtube')) {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    );
  }
  // Default globe icon
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
};

const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function PortfolioLinksModal({
  isOpen,
  onClose,
  onSave,
  onAddLink,
  initialData,
}: PortfolioLinksModalProps) {
  const [links, setLinks] = useState<PortfolioLink[]>(initialData?.links || []);
  const [linkType, setLinkType] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (initialData) {
      setLinks(initialData.links || []);
    } else {
      setLinks([]);
    }
    // Reset form when modal opens
    if (isOpen) {
      setLinkType('');
      setUrl('');
      setTitle('');
      setDescription('');
      setEditingLinkId(null);
      setUrlError('');
    }
  }, [initialData, isOpen]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !isValidUrl(value)) {
      setUrlError('Please enter a valid URL starting with http:// or https://');
    } else {
      setUrlError('');
    }
  };

  const handleSaveLink = async () => {
    if (!linkType.trim() || !url.trim()) {
      return;
    }

    if (!isValidUrl(url)) {
      setUrlError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    if (editingLinkId) {
      // Update existing link
      const updatedLink: PortfolioLink = {
        id: editingLinkId,
        linkType,
        url,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      };
      const updatedLinks = links.map(link => 
        link.id === editingLinkId ? updatedLink : link
      );
      setLinks(updatedLinks);
      
      // Save updated links to database
      if (onAddLink) {
        await onAddLink(updatedLink);
      }
      
      setEditingLinkId(null);
    } else {
      // Add new link and save immediately
      const newLink: PortfolioLink = {
        id: Date.now().toString(),
        linkType,
        url,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      };
      
      // Add to local state
      const updatedLinks = [...links, newLink];
      setLinks(updatedLinks);
      
      // Save to database immediately
      if (onAddLink) {
        await onAddLink(newLink);
      }
    }

    // Reset form
    setLinkType('');
    setUrl('');
    setTitle('');
    setDescription('');
    setUrlError('');
  };

  const handleEditLink = (link: PortfolioLink) => {
    setLinkType(link.linkType);
    setUrl(link.url);
    setTitle(link.title || '');
    setDescription(link.description || '');
    setEditingLinkId(link.id);
    setUrlError('');
  };

  const handleDeleteLink = (linkId: string) => {
    setLinks(links.filter(link => link.id !== linkId));
  };

  const handleCancelEdit = () => {
    setLinkType('');
    setUrl('');
    setTitle('');
    setDescription('');
    setEditingLinkId(null);
    setUrlError('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Add Portfolio Link</h2>
            <button
              onClick={onClose}
              className="text-[#9095A1] hover:text-gray-600"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Link Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Link Type</option>
                  {LINK_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="Enter full URL (https://…)"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    urlError ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {urlError && (
                  <p className="mt-1 text-sm text-red-600">{urlError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Only valid URLs accepted.</p>
              </div>

              {/* Link Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link Title / Label <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Personal Portfolio, Design Case Study, GitHub Projects"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this link showcases…"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Cancel Edit Button (only shown when editing) */}
              {editingLinkId && (
                <div>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* Existing Links */}
              {links.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Existing Links</h3>
                  <div className="space-y-3">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-shrink-0 mt-1 text-gray-600">
                          {getLinkIcon(link.linkType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {link.title || link.linkType}
                          </h4>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all"
                          >
                            {link.url}
                            <svg
                              className="w-4 h-4 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                          {link.description && (
                            <p className="text-xs text-gray-600 mt-1">{link.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditLink(link)}
                            className="p-2 text-[#9095A1] hover:text-blue-600"
                            title="Edit"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            className="p-2 text-[#9095A1] hover:text-red-600"
                            title="Delete"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLink}
                disabled={!linkType.trim() || !url.trim() || !!urlError}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingLinkId ? 'Update Link' : 'Save Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
