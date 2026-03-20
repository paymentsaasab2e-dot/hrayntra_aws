import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding team data (roles, permissions, role-permissions)...');

  // Step 1: Seed Roles
  console.log('📋 Creating roles...');
  const roles = [
    { roleName: 'Super Admin', color: 'purple', description: 'Full platform control' },
    { roleName: 'Admin', color: 'blue', description: 'Operational administrator' },
    { roleName: 'Senior Recruiter', color: 'teal', description: 'Experienced recruiter' },
    { roleName: 'Recruiter', color: 'green', description: 'Day-to-day sourcing' },
    { roleName: 'Account Manager', color: 'amber', description: 'Client relationship management' },
    { roleName: 'Finance', color: 'orange', description: 'Billing and invoicing' },
    { roleName: 'Viewer', color: 'gray', description: 'Read-only access' },
  ];

  const createdRoles: Record<string, any> = {};
  for (const role of roles) {
    const created = await prisma.systemRole.upsert({
      where: { roleName: role.roleName },
      update: {
        color: role.color,
        description: role.description,
      },
      create: role,
    });
    createdRoles[role.roleName] = created;
    console.log(`  ✓ ${role.roleName}`);
  }

  // Step 2: Seed Permissions
  console.log('\n🔐 Creating permissions...');
  const permissions = [
    // Jobs
    { permissionName: 'create_job', module: 'Jobs', description: 'Create new job postings' },
    { permissionName: 'edit_job', module: 'Jobs', description: 'Edit existing job postings' },
    { permissionName: 'delete_job', module: 'Jobs', description: 'Delete job postings' },
    { permissionName: 'assign_job', module: 'Jobs', description: 'Assign jobs to team members' },
    { permissionName: 'view_jobs', module: 'Jobs', description: 'View all jobs' },
    // Candidates
    { permissionName: 'add_candidate', module: 'Candidates', description: 'Add new candidates' },
    { permissionName: 'edit_candidate', module: 'Candidates', description: 'Edit candidate information' },
    { permissionName: 'delete_candidate', module: 'Candidates', description: 'Delete candidates' },
    { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates' },
    { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View assigned candidates' },
    { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidates for jobs' },
    { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move candidates through pipeline' },
    // Interviews
    { permissionName: 'schedule_interview', module: 'Interviews', description: 'Schedule interviews' },
    { permissionName: 'edit_interview', module: 'Interviews', description: 'Edit interview details' },
    { permissionName: 'submit_feedback', module: 'Interviews', description: 'Submit interview feedback' },
    { permissionName: 'cancel_interview', module: 'Interviews', description: 'Cancel interviews' },
    // Placements
    { permissionName: 'mark_placement', module: 'Placements', description: 'Mark candidate as placed' },
    { permissionName: 'create_offer', module: 'Placements', description: 'Create job offers' },
    { permissionName: 'confirm_joining', module: 'Placements', description: 'Confirm candidate joining' },
    { permissionName: 'view_placement_revenue', module: 'Placements', description: 'View placement revenue' },
    // Billing
    { permissionName: 'access_billing', module: 'Billing', description: 'Access billing module' },
    { permissionName: 'create_invoice', module: 'Billing', description: 'Create invoices' },
    { permissionName: 'record_payment', module: 'Billing', description: 'Record payments' },
    { permissionName: 'edit_invoice', module: 'Billing', description: 'Edit invoices' },
    // Reports
    { permissionName: 'view_reports', module: 'Reports', description: 'View reports' },
    { permissionName: 'export_reports', module: 'Reports', description: 'Export reports' },
    { permissionName: 'view_team_performance', module: 'Reports', description: 'View team performance reports' },
    { permissionName: 'view_revenue_reports', module: 'Reports', description: 'View revenue reports' },
    // Team
    { permissionName: 'add_team_member', module: 'Team', description: 'Add new team members' },
    { permissionName: 'edit_team_member', module: 'Team', description: 'Edit team member information' },
    { permissionName: 'deactivate_team_member', module: 'Team', description: 'Deactivate team members' },
    { permissionName: 'generate_credentials', module: 'Team', description: 'Generate user credentials' },
    { permissionName: 'assign_roles', module: 'Team', description: 'Assign roles to team members' },
    { permissionName: 'manage_targets', module: 'Team', description: 'Manage team targets' },
    { permissionName: 'manage_commission', module: 'Team', description: 'Manage commission settings' },
    // System
    { permissionName: 'manage_settings', module: 'System', description: 'Manage system settings' },
    { permissionName: 'access_integrations', module: 'System', description: 'Access integrations' },
    { permissionName: 'export_data', module: 'System', description: 'Export system data' },
  ];

  const createdPermissions: Record<string, any> = {};
  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { permissionName: perm.permissionName },
      update: {
        module: perm.module,
        description: perm.description,
      },
      create: perm,
    });
    createdPermissions[perm.permissionName] = created;
  }
  console.log(`  ✓ Created ${permissions.length} permissions`);

  // Step 3: Assign Permissions to Roles
  console.log('\n🔗 Assigning permissions to roles...');

  // Helper function to assign permissions to a role
  const assignPermissions = async (roleName: string, permissionNames: string[]) => {
    const role = createdRoles[roleName];
    if (!role) {
      console.error(`  ✗ Role ${roleName} not found`);
      return;
    }

    for (const permName of permissionNames) {
      const permission = createdPermissions[permName];
      if (!permission) {
        console.error(`  ✗ Permission ${permName} not found`);
        continue;
      }

      // Check if the role-permission relationship already exists
      const existing = await prisma.rolePermission.findFirst({
        where: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
    console.log(`  ✓ ${roleName}: ${permissionNames.length} permissions`);
  };

  // Super Admin - all permissions
  await assignPermissions('Super Admin', Object.keys(createdPermissions));

  // Admin - all except manage_settings, manage_commission
  const adminPermissions = Object.keys(createdPermissions).filter(
    (p) => p !== 'manage_settings' && p !== 'manage_commission'
  );
  await assignPermissions('Admin', adminPermissions);

  // Senior Recruiter
  await assignPermissions('Senior Recruiter', [
    'create_job',
    'edit_job',
    'assign_job',
    'view_jobs',
    'add_candidate',
    'edit_candidate',
    'view_all_candidates',
    'view_assigned_candidates',
    'submit_candidate',
    'move_pipeline',
    'schedule_interview',
    'edit_interview',
    'submit_feedback',
    'cancel_interview',
    'mark_placement',
    'create_offer',
    'confirm_joining',
    'view_placement_revenue',
    'view_reports',
    'export_reports',
    'view_team_performance',
    'view_revenue_reports',
    'export_data',
  ]);

  // Recruiter
  await assignPermissions('Recruiter', [
    'create_job',
    'edit_job',
    'view_jobs',
    'add_candidate',
    'edit_candidate',
    'view_assigned_candidates',
    'submit_candidate',
    'move_pipeline',
    'schedule_interview',
    'edit_interview',
    'submit_feedback',
    'cancel_interview',
    'view_reports',
  ]);

  // Account Manager
  await assignPermissions('Account Manager', [
    'create_job',
    'view_jobs',
    'view_all_candidates',
    'view_assigned_candidates',
    'schedule_interview',
    'cancel_interview',
    'mark_placement',
    'create_offer',
    'confirm_joining',
    'view_placement_revenue',
    'access_billing',
    'create_invoice',
    'edit_invoice',
    'view_reports',
    'export_reports',
    'view_revenue_reports',
    'export_data',
  ]);

  // Finance
  await assignPermissions('Finance', [
    'view_jobs',
    'view_assigned_candidates',
    'view_placement_revenue',
    'access_billing',
    'create_invoice',
    'record_payment',
    'edit_invoice',
    'view_reports',
    'export_reports',
    'view_revenue_reports',
    'export_data',
  ]);

  // Viewer
  await assignPermissions('Viewer', [
    'view_jobs',
    'view_assigned_candidates',
    'view_reports',
  ]);

  console.log('\n✅ Team seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding team data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
