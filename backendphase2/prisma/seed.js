import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // NOTE:
  // This seed script historically seeded sample data (users/clients/candidates/jobs/etc.)
  // before seeding system roles + permissions.
  //
  // If sample-data seeding fails due to schema drift, we still want to create roles
  // and permissions so the new DB is usable.
  let sampleDataError = null;
  try {
    // Create Users
    const superAdmin = await prisma.user.upsert({
      where: { email: 'admin@saasa.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@saasa.com',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'SUPER_ADMIN',
        department: 'IT',
        isActive: true,
      },
    });

  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@saasa.com' },
    update: {},
    create: {
      name: 'John Recruiter',
      email: 'recruiter@saasa.com',
      passwordHash: await bcrypt.hash('recruiter123', 10),
      role: 'RECRUITER',
      department: 'Recruitment',
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@saasa.com' },
    update: {},
    create: {
      name: 'Jane Manager',
      email: 'manager@saasa.com',
      passwordHash: await bcrypt.hash('manager123', 10),
      role: 'MANAGER',
      department: 'Operations',
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Create Clients
  const client1 = await prisma.client.create({
    data: {
      companyName: 'Tech Corp',
      industry: 'Technology',
      website: 'https://techcorp.com',
      status: 'ACTIVE',
      assignedToId: recruiter.id,
      address: {
        street: '123 Tech Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'USA',
      },
    },
  });

  const client2 = await prisma.client.create({
    data: {
      companyName: 'Finance Inc',
      industry: 'Finance',
      website: 'https://financeinc.com',
      status: 'PROSPECT',
      assignedToId: recruiter.id,
      address: {
        street: '456 Finance Ave',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      },
    },
  });

  console.log('✅ Clients created');

  // Create Contacts
  await prisma.contact.create({
    data: {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@techcorp.com',
      phone: '+1-555-0101',
      title: 'HR Manager',
      type: 'CLIENT',
      clientId: client1.id,
    },
  });

  await prisma.contact.create({
    data: {
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@financeinc.com',
      phone: '+1-555-0102',
      title: 'Hiring Manager',
      type: 'CLIENT',
      clientId: client2.id,
    },
  });

  console.log('✅ Contacts created');

  // Create Candidates
  const candidate1 = await prisma.candidate.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'sarah.williams@email.com',
      phone: '+1-555-0201',
      linkedIn: 'https://linkedin.com/in/sarahwilliams',
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      experience: 5,
      currentTitle: 'Senior Developer',
      currentCompany: 'Previous Corp',
      location: 'San Francisco, CA',
      status: 'ACTIVE',
      source: 'LinkedIn',
      assignedToId: recruiter.id,
      rating: 5,
      noticePeriod: '2 weeks',
      salary: {
        current: '120000',
        expected: '140000',
        currency: 'USD',
      },
    },
  });

  const candidate2 = await prisma.candidate.create({
    data: {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@email.com',
      phone: '+1-555-0202',
      skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
      experience: 7,
      currentTitle: 'Backend Engineer',
      currentCompany: 'Tech Startup',
      location: 'Austin, TX',
      status: 'ACTIVE',
      source: 'Referral',
      assignedToId: recruiter.id,
      rating: 4,
      noticePeriod: '1 month',
      salary: {
        current: '130000',
        expected: '150000',
        currency: 'USD',
      },
    },
  });

  const candidate3 = await prisma.candidate.create({
    data: {
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.davis@email.com',
      phone: '+1-555-0203',
      skills: ['Java', 'Spring Boot', 'Microservices', 'Kubernetes'],
      experience: 6,
      currentTitle: 'Software Engineer',
      location: 'Seattle, WA',
      status: 'ACTIVE',
      source: 'Website',
      assignedToId: recruiter.id,
      rating: 5,
      noticePeriod: '2 weeks',
    },
  });

  const candidate4 = await prisma.candidate.create({
    data: {
      firstName: 'David',
      lastName: 'Miller',
      email: 'david.miller@email.com',
      phone: '+1-555-0204',
      skills: ['C#', '.NET', 'SQL Server', 'Azure'],
      experience: 4,
      currentTitle: 'Full Stack Developer',
      location: 'Chicago, IL',
      status: 'NEW',
      source: 'LinkedIn',
      assignedToId: recruiter.id,
      rating: 4,
    },
  });

  const candidate5 = await prisma.candidate.create({
    data: {
      firstName: 'Lisa',
      lastName: 'Anderson',
      email: 'lisa.anderson@email.com',
      phone: '+1-555-0205',
      skills: ['Vue.js', 'Nuxt', 'GraphQL', 'Docker'],
      experience: 3,
      currentTitle: 'Frontend Developer',
      location: 'Boston, MA',
      status: 'ACTIVE',
      source: 'Referral',
      assignedToId: recruiter.id,
      rating: 4,
      noticePeriod: '1 month',
    },
  });

  console.log('✅ Candidates created');

  // Create Jobs
  const job1 = await prisma.job.create({
    data: {
      title: 'Senior Full Stack Developer',
      description: 'We are looking for an experienced full stack developer...',
      requirements: ['5+ years experience', 'React and Node.js expertise'],
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'MongoDB'],
      location: 'San Francisco, CA',
      type: 'FULL_TIME',
      status: 'OPEN',
      clientId: client1.id,
      assignedToId: recruiter.id,
      openings: 2,
      salary: {
        min: 130000,
        max: 160000,
        currency: 'USD',
      },
    },
  });

  const job2 = await prisma.job.create({
    data: {
      title: 'Backend Engineer',
      description: 'Join our backend team...',
      requirements: ['3+ years experience', 'Python/Django'],
      skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
      location: 'Remote',
      type: 'FULL_TIME',
      status: 'OPEN',
      clientId: client1.id,
      assignedToId: recruiter.id,
      openings: 1,
      salary: {
        min: 120000,
        max: 150000,
        currency: 'USD',
      },
    },
  });

  const job3 = await prisma.job.create({
    data: {
      title: 'Software Engineer',
      description: 'We need a skilled software engineer...',
      requirements: ['4+ years experience', 'Java/Spring'],
      skills: ['Java', 'Spring Boot', 'Microservices'],
      location: 'New York, NY',
      type: 'FULL_TIME',
      status: 'OPEN',
      clientId: client2.id,
      assignedToId: recruiter.id,
      openings: 1,
      salary: {
        min: 110000,
        max: 140000,
        currency: 'USD',
      },
    },
  });

  console.log('✅ Jobs created');

  // Create Pipeline Stages for each job
  const stages = [
    { name: 'Applied', order: 1, color: '#3b82f6' },
    { name: 'Shortlisted', order: 2, color: '#8b5cf6' },
    { name: 'Interview', order: 3, color: '#f59e0b' },
    { name: 'Offer', order: 4, color: '#10b981' },
    { name: 'Joined', order: 5, color: '#059669' },
  ];

  for (const job of [job1, job2, job3]) {
    for (const stage of stages) {
      await prisma.pipelineStage.create({
        data: {
          ...stage,
          jobId: job.id,
        },
      });
    }
  }

  console.log('✅ Pipeline stages created');

  // Create Leads
  await prisma.lead.create({
    data: {
      firstName: 'Tom',
      lastName: 'Wilson',
      email: 'tom@newcompany.com',
      phone: '+1-555-0301',
      company: 'New Company Inc',
      title: 'CEO',
      source: 'LINKEDIN',
      status: 'NEW',
      assignedToId: recruiter.id,
      priority: 'High',
      interestedNeeds: 'Looking for recruitment services',
    },
  });

  await prisma.lead.create({
    data: {
      firstName: 'Anna',
      lastName: 'Taylor',
      email: 'anna@startup.io',
      phone: '+1-555-0302',
      company: 'Startup.io',
      title: 'CTO',
      source: 'WEBSITE',
      status: 'CONTACTED',
      assignedToId: recruiter.id,
      priority: 'Medium',
    },
  });

  await prisma.lead.create({
    data: {
      firstName: 'Chris',
      lastName: 'Martinez',
      email: 'chris@enterprise.com',
      phone: '+1-555-0303',
      company: 'Enterprise Solutions',
      title: 'HR Director',
      source: 'REFERRAL',
      status: 'QUALIFIED',
      assignedToId: manager.id,
      priority: 'High',
    },
  });

  console.log('✅ Leads created');

  // Create Interviews
  const interview1 = await prisma.interview.create({
    data: {
      candidateId: candidate1.id,
      jobId: job1.id,
      clientId: client1.id,
      interviewerId: recruiter.id,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      duration: 60,
      type: 'VIDEO',
      status: 'SCHEDULED',
      location: 'Virtual',
      meetingLink: 'https://meet.example.com/interview-1',
    },
  });

  const interview2 = await prisma.interview.create({
    data: {
      candidateId: candidate2.id,
      jobId: job2.id,
      clientId: client1.id,
      interviewerId: recruiter.id,
      scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      duration: 90,
      type: 'ONSITE',
      status: 'SCHEDULED',
      location: 'San Francisco Office',
    },
  });

  console.log('✅ Interviews created');

  // Create Placement
  const placement = await prisma.placement.create({
    data: {
      candidateId: candidate3.id,
      jobId: job3.id,
      clientId: client2.id,
      recruiterId: recruiter.id,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      salary: 135000,
      salaryOffered: 135000,
      fee: 27000,
      placementFee: 27000,
      revenue: 27000,
      feeType: 'PERCENTAGE',
      status: 'PENDING',
      notes: 'Placement confirmed, awaiting start date',
    },
  });

  console.log('✅ Placement created');

  // Create Billing Record
  await prisma.billingRecord.create({
    data: {
      clientId: client2.id,
      placementId: placement.id,
      amount: 27000,
      currency: 'USD',
      status: 'DRAFT',
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      notes: 'Placement fee for candidate placement',
    },
  });

  console.log('✅ Billing record created');

  // Create Tasks
  await prisma.task.create({
    data: {
      title: 'Follow up with candidate Sarah',
      description: 'Schedule follow-up call',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      status: 'TODO',
      assignedToId: recruiter.id,
      createdById: manager.id,
      linkedEntityType: 'CANDIDATE',
      linkedEntityId: candidate1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Prepare interview questions for Tech Corp',
      description: 'Create technical interview questions',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      assignedToId: recruiter.id,
      createdById: recruiter.id,
      linkedEntityType: 'JOB',
      linkedEntityId: job1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Send contract to Finance Inc',
      description: 'Prepare and send placement contract',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      priority: 'URGENT',
      status: 'TODO',
      assignedToId: manager.id,
      createdById: recruiter.id,
      linkedEntityType: 'CLIENT',
      linkedEntityId: client2.id,
    },
  });

  console.log('✅ Tasks created');

  // Create Team
  const team = await prisma.team.create({
    data: {
      name: 'Recruitment Team A',
      department: 'Recruitment',
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: recruiter.id,
      teamId: team.id,
      role: 'LEAD',
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: manager.id,
      teamId: team.id,
      role: 'MEMBER',
    },
  });

  console.log('✅ Team created');

  // Create Activities
  await prisma.activity.create({
    data: {
      action: 'Created',
      description: 'New candidate added to system',
      performedById: recruiter.id,
      entityType: 'CANDIDATE',
      entityId: candidate1.id,
      metadata: { candidateName: `${candidate1.firstName} ${candidate1.lastName}` },
    },
  });

  await prisma.activity.create({
    data: {
      action: 'Updated',
      description: 'Job status changed to OPEN',
      performedById: recruiter.id,
      entityType: 'JOB',
      entityId: job1.id,
      metadata: { status: 'OPEN' },
    },
  });

  console.log('✅ Activities created');

  // Create Matches
  await prisma.match.create({
    data: {
      candidateId: candidate1.id,
      jobId: job1.id,
      score: 95.5,
      status: 'SHORTLISTED',
      notes: 'Excellent match - high score',
      createdById: recruiter.id,
    },
  });

  await prisma.match.create({
    data: {
      candidateId: candidate2.id,
      jobId: job2.id,
      score: 92.0,
      status: 'REVIEWED',
      notes: 'Good match for backend position',
      createdById: recruiter.id,
    },
  });

  console.log('✅ Matches created');
  } catch (error) {
    sampleDataError = error;
    console.error('❌ Sample data seeding failed (continuing with roles/permissions):', error);
  }

  // ── SEED ROLES AND PERMISSIONS ──
  console.log('🌱 Seeding roles and permissions...');

  // Create all permissions
  const permissions = [
    // Jobs
    { permissionName: 'create_job', module: 'Jobs', description: 'Create new job postings' },
    { permissionName: 'edit_job', module: 'Jobs', description: 'Edit existing job postings' },
    { permissionName: 'delete_job', module: 'Jobs', description: 'Delete job postings' },
    { permissionName: 'assign_job', module: 'Jobs', description: 'Assign jobs to recruiters' },
    { permissionName: 'view_jobs', module: 'Jobs', description: 'View all jobs' },
    
    // Candidates
    { permissionName: 'add_candidate', module: 'Candidates', description: 'Add new candidates' },
    { permissionName: 'edit_candidate', module: 'Candidates', description: 'Edit candidate profiles' },
    { permissionName: 'delete_candidate', module: 'Candidates', description: 'Delete candidates' },
    { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates' },
    { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View assigned candidates only' },
    { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidates to clients' },
    { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move candidates through pipeline stages' },
    
    // Interviews
    { permissionName: 'schedule_interview', module: 'Interviews', description: 'Schedule candidate interviews' },
    { permissionName: 'submit_feedback', module: 'Interviews', description: 'Submit interview feedback' },
    { permissionName: 'cancel_interview', module: 'Interviews', description: 'Cancel scheduled interviews' },
    
    // Placements
    { permissionName: 'mark_placement', module: 'Placements', description: 'Mark candidates as placed' },
    { permissionName: 'create_offer', module: 'Placements', description: 'Create offer letters' },
    { permissionName: 'view_placement_revenue', module: 'Placements', description: 'View placement revenue data' },
    
    // Billing
    { permissionName: 'access_billing', module: 'Billing', description: 'Access billing module' },
    { permissionName: 'create_invoice', module: 'Billing', description: 'Create invoices' },
    { permissionName: 'record_payment', module: 'Billing', description: 'Record payment transactions' },
    
    // Reports
    { permissionName: 'view_reports', module: 'Reports', description: 'View reports' },
    { permissionName: 'export_reports', module: 'Reports', description: 'Export reports' },
    { permissionName: 'view_revenue_reports', module: 'Reports', description: 'View revenue reports' },
    
    // Team
    { permissionName: 'add_team_member', module: 'Team', description: 'Add new team members' },
    { permissionName: 'edit_team_member', module: 'Team', description: 'Edit team member details' },
    { permissionName: 'generate_credentials', module: 'Team', description: 'Generate login credentials' },
    { permissionName: 'assign_roles', module: 'Team', description: 'Assign roles to team members' },
    { permissionName: 'manage_targets', module: 'Team', description: 'Manage team targets and KPIs' },
    { permissionName: 'manage_commission', module: 'Team', description: 'Manage commission settings' },
    
    // System
    { permissionName: 'manage_settings', module: 'System', description: 'Manage system settings' },
    { permissionName: 'access_integrations', module: 'System', description: 'Access integrations' },
    { permissionName: 'export_data', module: 'System', description: 'Export system data' },
  ];

  const createdPermissions = {};
  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { permissionName: perm.permissionName },
      update: {},
      create: perm,
    });
    createdPermissions[perm.permissionName] = created;
  }

  console.log(`✅ ${permissions.length} permissions created`);

  // Create roles
  const roles = [
    { roleName: 'Super Admin', description: 'Full system access', color: 'purple' },
    { roleName: 'Admin', description: 'Administrative access', color: 'blue' },
    { roleName: 'Senior Recruiter', description: 'Senior recruitment role', color: 'indigo' },
    { roleName: 'Recruiter', description: 'Standard recruitment role', color: 'green' },
    { roleName: 'Account Manager', description: 'Client account management', color: 'orange' },
    { roleName: 'Finance', description: 'Finance and billing access', color: 'emerald' },
    { roleName: 'Viewer', description: 'Read-only access', color: 'slate' },
  ];

  const createdRoles = {};
  for (const role of roles) {
    const created = await prisma.systemRole.upsert({
      where: { roleName: role.roleName },
      update: {},
      create: role,
    });
    createdRoles[role.roleName] = created;
  }

  console.log(`✅ ${roles.length} roles created`);

  // Assign permissions to roles
  const rolePermissions = {
    'Super Admin': Object.keys(createdPermissions), // All permissions
    
    'Admin': [
      'create_job', 'edit_job', 'delete_job', 'assign_job', 'view_jobs',
      'add_candidate', 'edit_candidate', 'delete_candidate', 'view_all_candidates', 'view_assigned_candidates', 'submit_candidate', 'move_pipeline',
      'schedule_interview', 'submit_feedback', 'cancel_interview',
      'mark_placement', 'create_offer', 'view_placement_revenue',
      'access_billing', 'create_invoice', 'record_payment',
      'view_reports', 'export_reports', 'view_revenue_reports',
      'add_team_member', 'edit_team_member', 'generate_credentials', 'assign_roles', 'manage_targets',
      'access_integrations', 'export_data',
    ],
    
    'Senior Recruiter': [
      'create_job', 'edit_job', 'assign_job', 'view_jobs',
      'add_candidate', 'edit_candidate', 'view_all_candidates', 'view_assigned_candidates', 'submit_candidate', 'move_pipeline',
      'schedule_interview', 'submit_feedback', 'cancel_interview',
      'mark_placement', 'create_offer', 'view_placement_revenue',
      'view_reports', 'export_reports', 'view_revenue_reports',
      'export_data',
    ],
    
    'Recruiter': [
      'create_job', 'edit_job', 'view_jobs',
      'add_candidate', 'edit_candidate', 'view_assigned_candidates', 'submit_candidate', 'move_pipeline',
      'schedule_interview', 'submit_feedback', 'cancel_interview',
      'view_reports',
    ],
    
    'Account Manager': [
      'create_job', 'view_jobs',
      'view_all_candidates', 'view_assigned_candidates',
      'schedule_interview', 'cancel_interview',
      'mark_placement', 'create_offer', 'view_placement_revenue',
      'access_billing', 'create_invoice',
      'view_reports', 'export_reports', 'view_revenue_reports',
      'export_data',
    ],
    
    'Finance': [
      'view_jobs',
      'view_assigned_candidates',
      'view_placement_revenue',
      'access_billing', 'create_invoice', 'record_payment',
      'view_reports', 'export_reports', 'view_revenue_reports',
      'export_data',
    ],
    
    'Viewer': [
      'view_jobs',
      'view_assigned_candidates',
      'view_reports',
    ],
  };

  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const role = createdRoles[roleName];
    if (!role) continue;

    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    // Create new role permissions
    for (const permName of permNames) {
      const permission = createdPermissions[permName];
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
    console.log(`✅ Permissions assigned to ${roleName}`);
  }

  console.log('✅ Roles and permissions seeded');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
