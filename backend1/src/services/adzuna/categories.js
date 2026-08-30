/**
 * Maps internal jobCategory / industry / department strings to Adzuna category IDs.
 * Adzuna IDs: https://www.adzuna.co.uk/jobs/xml-specification.html
 * Internal categories are not modified.
 */

const ADZUNA_CATEGORIES = Object.freeze([
  { id: '1', label: 'Accounting & Finance Jobs', keywords: ['account', 'finance', 'audit', 'tax', 'bookkeep', 'cfo', 'ca '] },
  { id: '2', label: 'IT Jobs', keywords: ['it', 'software', 'developer', 'engineer', 'programming', 'qa', 'devops', 'data', 'cloud', 'cyber', 'information technology', 'sde', 'frontend', 'backend', 'full stack'] },
  { id: '3', label: 'Sales Jobs', keywords: ['sales', 'business development', 'bde', 'bdm', 'account executive'] },
  { id: '4', label: 'Customer Services Jobs', keywords: ['customer', 'support', 'call centre', 'call center', 'helpdesk', 'help desk'] },
  { id: '5', label: 'Engineering Jobs', keywords: ['mechanical', 'civil', 'electrical', 'electronics', 'industrial engineer'] },
  { id: '6', label: 'HR & Recruitment Jobs', keywords: ['hr', 'human resource', 'recruit', 'talent', 'people ops'] },
  { id: '7', label: 'Healthcare & Nursing Jobs', keywords: ['health', 'nurse', 'doctor', 'medical', 'pharma', 'clinic', 'hospital'] },
  { id: '8', label: 'Hospitality & Catering Jobs', keywords: ['hospitality', 'hotel', 'chef', 'catering', 'restaurant', 'fnb'] },
  { id: '9', label: 'PR, Advertising & Marketing Jobs', keywords: ['market', 'brand', 'advertis', 'pr ', 'public relation', 'content', 'seo', 'social media'] },
  { id: '10', label: 'Logistics & Warehouse Jobs', keywords: ['logistics', 'warehouse', 'supply chain', 'procurement', 'fleet'] },
  { id: '11', label: 'Teaching Jobs', keywords: ['teach', 'tutor', 'professor', 'lecturer', 'education'] },
  { id: '12', label: 'Trade & Construction Jobs', keywords: ['construction', 'plumber', 'electrician', 'carpenter', 'site engineer'] },
  { id: '13', label: 'Admin Jobs', keywords: ['admin', 'office', 'secretary', 'receptionist', 'operations assistant'] },
  { id: '14', label: 'Legal Jobs', keywords: ['legal', 'lawyer', 'advocate', 'counsel', 'compliance'] },
  { id: '15', label: 'Creative & Design Jobs', keywords: ['design', 'graphic', 'ui', 'ux', 'creative', 'animator'] },
  { id: '16', label: 'Graduate Jobs', keywords: ['graduate', 'fresher', 'campus', 'trainee'] },
  { id: '17', label: 'Retail Jobs', keywords: ['retail', 'store', 'merchandis', 'shop'] },
  { id: '18', label: 'Consultancy Jobs', keywords: ['consult'] },
  { id: '19', label: 'Manufacturing Jobs', keywords: ['manufactur', 'production', 'plant', 'factory'] },
  { id: '20', label: 'Scientific & QA Jobs', keywords: ['scientist', 'research', 'lab', 'quality assurance', 'quality control'] },
  { id: '21', label: 'Social work Jobs', keywords: ['social work', 'ngo', 'counsellor', 'counselor'] },
  { id: '22', label: 'Travel Jobs', keywords: ['travel', 'tourism', 'airline'] },
  { id: '23', label: 'Energy, Oil & Gas Jobs', keywords: ['oil', 'gas', 'energy', 'petroleum', 'renewable'] },
  { id: '24', label: 'Property Jobs', keywords: ['property', 'real estate', 'realtor'] },
  { id: '25', label: 'Charity & Voluntary Jobs', keywords: ['charity', 'volunteer', 'non profit', 'nonprofit'] },
  { id: '26', label: 'Domestic help & Cleaning Jobs', keywords: ['domestic', 'cleaning', 'housekeep'] },
  { id: '27', label: 'Maintenance Jobs', keywords: ['maintenance', 'facility', 'technician'] },
  { id: '28', label: 'Part time Jobs', keywords: ['part time', 'part-time'] },
  { id: '29', label: 'Other/General Jobs', keywords: ['other', 'general'] },
]);

function normalizeHaystack(job) {
  return [
    job?.jobCategory,
    job?.industry,
    job?.department,
    job?.title,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' | ');
}

function keywordMatches(haystack, keyword) {
  const needle = String(keyword || '').trim().toLowerCase();
  if (!needle) return false;
  if (needle.length <= 3) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(needle);
}

function mapAdzunaCategory(job) {
  const haystack = normalizeHaystack(job);
  if (!haystack.trim()) {
    return { mapped: false, id: null, label: null, source: null, reason: 'no_category_source' };
  }

  for (const category of ADZUNA_CATEGORIES) {
    if (category.keywords.some((keyword) => keywordMatches(haystack, keyword))) {
      return {
        mapped: true,
        id: category.id,
        label: category.label,
        source: job.jobCategory || job.industry || job.department || job.title,
      };
    }
  }

  return {
    mapped: false,
    id: null,
    label: null,
    source: job.jobCategory || job.industry || job.department || null,
    reason: 'unmapped_category',
  };
}

module.exports = {
  ADZUNA_CATEGORIES,
  mapAdzunaCategory,
};
