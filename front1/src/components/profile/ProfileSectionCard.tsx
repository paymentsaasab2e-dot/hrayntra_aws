'use client';

import { useState } from 'react';

interface ProfileSectionItem {
  name: string;
  status: string;
  hasInfo: boolean;
  data?: any; // Optional data to display when expanded
}

interface ProfileSectionCardProps {
  category: string;
  items: ProfileSectionItem[];
  onEditClick: (category: string, itemName: string) => void;
  getStatusColor: (status: string) => string;
}

export default function ProfileSectionCard({
  category,
  items,
  onEditClick,
  getStatusColor,
}: ProfileSectionCardProps) {
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const renderItemContent = (item: ProfileSectionItem) => {
    // Render different content based on item name and category
    if (!item.hasInfo || !item.data) {
      return (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">No detailed information available.</p>
        </div>
      );
    }

    // Render based on item type
    switch (item.name) {
      case 'Basic Information':
        return (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-2">
            {item.data.firstName && (
              <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {item.data.firstName} {item.data.lastName}</p>
            )}
            {item.data.email && (
              <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {item.data.email}</p>
            )}
            {item.data.phone && (
              <p className="text-sm text-gray-700"><span className="font-medium">Phone:</span> {item.data.phone}</p>
            )}
            {item.data.city && (
              <p className="text-sm text-gray-700"><span className="font-medium">Location:</span> {item.data.city}, {item.data.country}</p>
            )}
          </div>
        );
      case 'Summary':
        return (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.data}</p>
          </div>
        );
      case 'Work Experience':
        return (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
            {Array.isArray(item.data) ? item.data.map((exp: any, idx: number) => (
              <div key={idx} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                <p className="text-sm font-medium text-gray-900">{exp.jobTitle} at {exp.companyName}</p>
                <p className="text-xs text-gray-600">{exp.startDate} - {exp.currentlyWorkHere ? 'Present' : exp.endDate}</p>
                {exp.workLocation && <p className="text-xs text-gray-600">{exp.workLocation}</p>}
              </div>
            )) : (
              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm font-medium text-gray-900">{item.data.jobTitle} at {item.data.companyName}</p>
                <p className="text-xs text-gray-600">{item.data.startDate} - {item.data.currentlyWorkHere ? 'Present' : item.data.endDate}</p>
                {item.data.workLocation && <p className="text-xs text-gray-600">{item.data.workLocation}</p>}
              </div>
            )}
          </div>
        );
      case 'Internships':
        return (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
            {Array.isArray(item.data) ? item.data.map((intern: any, idx: number) => (
              <div key={idx} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                <p className="text-sm font-medium text-gray-900">{intern.internshipTitle} at {intern.companyName}</p>
                <p className="text-xs text-gray-600">{intern.startDate} - {intern.currentlyWorking ? 'Present' : intern.endDate}</p>
                {intern.location && <p className="text-xs text-gray-600">{intern.location}</p>}
              </div>
            )) : (
              <div className="border-b border-gray-200 pb-3">
                <p className="text-sm font-medium text-gray-900">{item.data.internshipTitle} at {item.data.companyName}</p>
                <p className="text-xs text-gray-600">{item.data.startDate} - {item.data.currentlyWorking ? 'Present' : item.data.endDate}</p>
                {item.data.location && <p className="text-xs text-gray-600">{item.data.location}</p>}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Information available. Click Edit to view or update details.</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
      <div className="space-y-4">
        {items.map((item, itemIndex) => {
          const isExpanded = expandedItems[item.name] || false;
          return (
            <div
              key={itemIndex}
              className="border-b border-gray-200 pb-4 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  {!item.hasInfo && (
                    <p className="text-sm text-gray-500">
                      No information added yet. Add details
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditClick(category, item.name)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1"
                  >
                    Edit
                  </button>
                  {item.hasInfo && (
                    <button
                      onClick={() => toggleExpand(item.name)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-transform"
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && item.hasInfo && renderItemContent(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
