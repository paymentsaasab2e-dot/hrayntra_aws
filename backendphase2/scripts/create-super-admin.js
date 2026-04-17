import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const email = 'admin@gmail.com';
const password = 'Admin@123';
const name = 'Super Admin';
const firstName = 'Super';
const lastName = 'Admin';

async function createSuperAdmin() {
  try {
    console.log('ðŸš€ Creating/updating super admin user with full permissions...\n');
    
    // Step 1: Create or get all permissions
    console.log('ðŸ“‹ Step 1: Ensuring all permissions exist...');
    const allPermissions = [
      'create_job', 'edit_job', 'delete_job', 'assign_job', 'view_jobs',
      'add_candidate', 'edit_candidate', 'delete_candidate', 'view_all_candidates', 'view_assigned_candidates', 'submit_candidate', 'move_pipeline',
      'schedule_interview', 'submit_feedback', 'cancel_interview',
      'mark_placement', 'create_offer', 'view_placement_revenue',
      'access_billing', 'create_invoice', 'record_payment',
      'view_reports', 'export_reports', 'view_revenue_reports',
      'add_team_member', 'edit_team_member', 'generate_credentials', 'assign_roles', 'manage_targets', 'manage_commission',
      'manage_settings', 'access_integrations', 'export_data',
    ];

    const permissionModules = {
      'create_job': 'Jobs', 'edit_job': 'Jobs', 'delete_job': 'Jobs', 'assign_job': 'Jobs', 'view_jobs': 'Jobs',
      'add_candidate': 'Candidates', 'edit_candidate': 'Candidates', 'delete_candidate': 'Candidates',
      'view_all_candidates': 'Candidates', 'view_assigned_candidates': 'Candidates', 'submit_candidate': 'Candidates', 'move_pipeline': 'Candidates',
      'schedule_interview': 'Interviews', 'submit_feedback': 'Interviews', 'cancel_interview': 'Interviews',
      'mark_placement': 'Placements', 'create_offer': 'Placements', 'view_placement_revenue': 'Placements',
      'access_billing': 'Billing', 'create_invoice': 'Billing', 'record_payment': 'Billing',
      'view_reports': 'Reports', 'export_reports': 'Reports', 'view_revenue_reports': 'Reports',
      'add_team_member': 'Team', 'edit_team_member': 'Team', 'generate_credentials': 'Team', 'assign_roles': 'Team', 'manage_targets': 'Team', 'manage_commission': 'Team',
      'manage_settings': 'System', 'access_integrations': 'System', 'export_data': 'System',
    };

    const createdPermissions = {};
    for (const permName of allPermissions) {
      const perm = await prisma.permission.upsert({
        where: { permissionName: permName },
        update: {},
        create: {
          permissionName: permName,
          module: permissionModules[permName] || 'System',
          description: permName.replace(/_/g, ' ') + ' permission',
        },
      });
      createdPermissions[permName] = perm;
    }
    console.log('âœ… ' + allPermissions.length + ' permissions ready\n');

    // Step 2: Create or get Super Admin SystemRole
    console.log('ðŸ‘¤ Step 2: Creating/updating Super Admin role...');
    const superAdminRole = await prisma.systemRole.upsert({
      where: { roleName: 'Super Admin' },
      update: {},
      create: {
        roleName: 'Super Admin',
        description: 'Full system access with all permissions',
      },
    });
    console.log('âœ… Super Admin role ready (ID: ' + superAdminRole.id + ')\n');

    // Step 3: Assign all permissions to Super Admin role
    console.log('ðŸ” Step 3: Assigning all permissions to Super Admin role...');
    await prisma.rolePermission.deleteMany({
      where: { roleId: superAdminRole.id },
    });

    for (const permName of allPermissions) {
      const permission = createdPermissions[permName];
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: superAdminRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        });
      }
    }
    console.log('âœ… All ' + allPermissions.length + ' permissions assigned to Super Admin role\n');

    // Step 4: Create or get a default department
    console.log('ðŸ¢ Step 4: Creating/updating default department...');
    let department = await prisma.department.findFirst({ where: { name: 'Administration' } }); if (!department) { department = await prisma.department.create({ data: { name: 'Administration', description: 'Administrative department' } }); }
    console.log('âœ… Department ready (ID: ' + department.id + ')\n');

    // Step 5: Create or update the super admin user
    console.log('ðŸ‘¨â€ðŸ’¼ Step 5: Creating/updating super admin user...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { email },
        data: {
          name,
          firstName,
          lastName,
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          status: 'ACTIVE',
          roleId: superAdminRole.id,
          departmentId: department.id,
        },
      });
      console.log('âœ… Super admin user updated successfully!');
    } else {
      user = await prisma.user.create({
        data: {
          name,
          firstName,
          lastName,
          email,
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
          status: 'ACTIVE',
          roleId: superAdminRole.id,
          departmentId: department.id,
        },
      });
      console.log('âœ… Super admin user created successfully!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('ðŸŽ‰ SUPER ADMIN SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nðŸ“ Login Credentials:');
    console.log('   Email: ' + email);
    console.log('   Password: ' + password);
    console.log('\nðŸ‘¤ User Details:');
    console.log('   Name: ' + user.name);
    console.log('   Email: ' + user.email);
    console.log('   Role: ' + user.role);
    console.log('   System Role: Super Admin');
    console.log('   Department: ' + department.name);
    console.log('   Status: ' + user.status);
    console.log('\nðŸ” Permissions: ALL (' + allPermissions.length + ' permissions)');
    console.log('\nâœ¨ This user can now:');
    console.log('   â€¢ Create and manage team members');
    console.log('   â€¢ Assign roles and permissions');
    console.log('   â€¢ Create and manage departments');
    console.log('   â€¢ Access all system features');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('âŒ Error creating super admin:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
        await prisma.$disconnect();
  }
}

createSuperAdmin();

