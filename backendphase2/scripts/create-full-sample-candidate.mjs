import { prisma, runWithTenantContext } from '../src/config/prisma.js';

function nameSearch(firstName, lastName) {
  const nameNormalized = [firstName, lastName]
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  const grams = new Set();
  for (const token of nameNormalized.split(' ')) {
    for (const size of [2, 3]) {
      if (token.length < size) continue;
      for (let i = 0; i <= token.length - size; i += 1) grams.add(token.slice(i, i + size));
    }
  }
  return { nameNormalized, nameSearchGrams: [...grams] };
}

const careerPreferences = {
  currentRole: 'Project Manager',
  currentSalary: 1850000,
  currentCurrency: 'INR',
  currentSalaryType: 'Annual',
  currentLocation: 'Pune, India',
  currentBenefits: ['Health insurance', 'Provident fund', 'Annual bonus'],
  preferredJobTitles: ['Project Manager', 'Program Manager'],
  preferredRoles: ['Project Manager', 'Program Manager'],
  preferredIndustries: ['Information Technology', 'Product companies'],
  preferredIndustry: 'Information Technology',
  functionalAreas: ['Project management', 'Software delivery'],
  functionalArea: 'Project management',
  jobTypes: ['Full-time', 'Permanent'],
  workModes: ['Hybrid', 'Remote'],
  preferredWorkMode: 'Hybrid',
  preferredLocations: ['Pune', 'Bengaluru', 'Hyderabad'],
  relocationPreference: 'Open to relocate within India',
  openToRelocation: true,
  preferredCurrency: 'INR',
  preferredSalary: 2400000,
  preferredSalaryType: 'Annual',
  salaryCurrency: 'INR',
  salaryAmount: 2400000,
  salaryFrequency: 'Annual',
  preferredBenefits: ['Health insurance', 'Flexible hours', 'Performance bonus'],
  availabilityToStart: '30 days',
  noticePeriod: '30 days',
  noticePeriodDays: 30,
};

const workExperience = [
  {
    jobTitle: 'Project Manager',
    title: 'Project Manager',
    companyName: 'AITIK SOFTWARE PVT. LTD.',
    company: 'AITIK SOFTWARE PVT. LTD.',
    startDate: '2024-02',
    endDate: 'Present',
    currentlyWorkHere: true,
    workLocation: 'Pune, India',
    industryDomain: 'Information Technology',
    keyResponsibilities:
      'Lead a 12-person delivery team across web and mobile releases.\nOwn client status, sprint planning, and release risk.',
    responsibilities: [
      'Lead a 12-person delivery team across web and mobile releases.',
      'Own client status, sprint planning, and release risk.',
    ],
  },
  {
    jobTitle: 'Software Development Engineer',
    title: 'Software Development Engineer',
    companyName: 'KALKI DIGITAL INFORMATION TECHNOLOGIES',
    company: 'KALKI DIGITAL INFORMATION TECHNOLOGIES',
    startDate: '2022-01',
    endDate: '2024-01',
    currentlyWorkHere: false,
    workLocation: 'Pune, India',
    industryDomain: 'Information Technology',
    keyResponsibilities: 'Built full-stack features and mentored two junior developers.',
    responsibilities: ['Built full-stack features and mentored two junior developers.'],
  },
];

const education = [
  {
    degreeProgram: 'B.E. Computer Engineering',
    degree: 'B.E. Computer Engineering',
    institutionName: 'Savitribai Phule Pune University',
    institution: 'Savitribai Phule Pune University',
    fieldOfStudy: 'Computer Engineering',
    startYear: '2016',
    endYear: '2020',
    grade: '8.4 CGPA',
  },
];

const snapshot = {
  personalInfo: {
    firstName: 'Aarav',
    middleName: 'R',
    lastName: 'Mehta',
    email: 'aarav.mehta.profile@example.com',
    phoneCode: '+91',
    phone: '9876543210',
    dob: '1998-06-15',
    gender: 'Male',
    nationality: 'Indian',
    city: 'Pune',
    country: 'India',
    address: 'Baner, Pune, Maharashtra 411045',
    employment: 'Employed',
    passportNumber: 'Z1234567',
    linkedinUrl: 'https://www.linkedin.com/in/aarav-mehta-profile',
  },
  summaryText:
    'Project manager with 5 years in software delivery. Comfortable running agile teams, client communication, and full-stack delivery from discovery through release.',
  workExperience,
  education,
  skills: [
    { name: 'Project management', proficiency: 'Expert' },
    { name: 'Agile', proficiency: 'Expert' },
    { name: 'Stakeholder communication', proficiency: 'Advanced' },
    { name: 'Jira', proficiency: 'Advanced' },
  ],
  languages: [
    { name: 'English', proficiency: 'Fluent' },
    { name: 'Hindi', proficiency: 'Native' },
    { name: 'Marathi', proficiency: 'Fluent' },
  ],
  certifications: [{ certificationName: 'PMP', issuingOrganization: 'PMI', issueYear: '2024' }],
  accomplishments: [
    {
      title: 'On-time product launch',
      description: 'Shipped a client portal on schedule with a 12-person team and no critical post-release defects.',
    },
  ],
  careerPreferences,
  visaWorkAuthorization: {
    requiresVisa: 'No',
    additionalRemarks: 'Authorized to work in India.',
  },
  _phase1SnapshotSavedAt: new Date().toISOString(),
};

const extraData = {
  phase1ProfileSnapshot: snapshot,
  careerPreferences,
  pipeline: {
    personal: {
      state: 'Maharashtra',
      currentAddress: 'Baner, Pune, Maharashtra 411045',
      zip: '411045',
      nationality: 'Indian',
      gender: 'Male',
      birthDate: '1998-06-15',
      passportNumber: 'Z1234567',
    },
    professional: {
      remarks: 'Strong client-facing project manager. Available after 30 days notice.',
      currentBenefits: 'Health insurance; Provident fund; Annual bonus',
      expectedBenefits: 'Health insurance; Flexible hours; Performance bonus',
      currentSalaryCurrency: 'INR',
      expectedSalaryCurrency: 'INR',
    },
    social: {
      linkedIn: 'https://www.linkedin.com/in/aarav-mehta-profile',
    },
  },
};

async function main() {
  const tenantDbName = process.env.SAMPLE_TENANT_DB || 'adm01';
  const created = await runWithTenantContext(tenantDbName, async () => {
    const user =
      (await prisma.user.findFirst({
        where: { email: 'sha@gmail.com' },
        select: { id: true, email: true },
      })) ||
      (await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { lastLogin: 'desc' },
        select: { id: true, email: true },
      }));
    if (!user?.id) throw new Error(`No user found in tenant ${tenantDbName}`);

    const recent = await prisma.candidate.findFirst({
      where: { isDeleted: { not: true } },
      orderBy: { updatedAt: 'desc' },
      select: { orgUnitId: true },
    });

    const email = 'aarav.mehta.profile@example.com';
    const existing = await prisma.candidate.findFirst({
      where: { email, isDeleted: { not: true } },
      select: { id: true },
    });
    if (existing?.id) {
      return { id: existing.id, email, reused: true, owner: user.email };
    }

    const names = nameSearch('Aarav', 'Mehta');
    const row = await prisma.candidate.create({
      data: {
        firstName: 'Aarav',
        middleName: 'R',
        lastName: 'Mehta',
        ...names,
        email,
        phone: '+91 9876543210',
        linkedIn: 'https://www.linkedin.com/in/aarav-mehta-profile',
        skills: ['Project management', 'Agile', 'Stakeholder communication', 'Jira'],
        experience: 5,
        experienceYears: 5,
        currentTitle: 'Project Manager',
        designation: 'Project Manager',
        currentCompany: 'AITIK SOFTWARE PVT. LTD.',
        location: 'Pune, India',
        address: 'Baner, Pune, Maharashtra 411045',
        city: 'Pune',
        country: 'India',
        status: 'ACTIVE',
        source: 'Manual',
        stage: 'New',
        availability: '30 days',
        noticePeriod: '30 days',
        gender: 'Male',
        dateOfBirth: new Date('1998-06-15T00:00:00.000Z'),
        expectedSalary: 2400000,
        currentSalary: 1850000,
        education: 'B.E. Computer Engineering — Savitribai Phule Pune University',
        certifications: ['PMP'],
        languages: ['English', 'Hindi', 'Marathi'],
        website: 'https://aarav-mehta.example.com',
        preferredLocation: 'Pune; Bengaluru; Hyderabad',
        notes: 'Sample candidate created with a full profile for the candidate drawer.',
        cvSummary: snapshot.summaryText,
        cvEducationEntries: education,
        cvWorkExperienceEntries: workExperience,
        salary: { currency: 'INR', min: 1850000, max: 2400000 },
        extraData,
        createdById: user.id,
        assignedToId: user.id,
        participantIds: [user.id],
        orgUnitId: recent?.orgUnitId || undefined,
        lastActivity: new Date(),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return { ...row, reused: false, owner: user.email };
  });
  console.log(JSON.stringify(created));
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
