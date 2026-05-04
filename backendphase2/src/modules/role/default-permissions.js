export const DEFAULT_PERMISSIONS = [
  { permissionName: 'leads_create', module: 'Leads', description: 'Create leads' },
  { permissionName: 'leads_read', module: 'Leads', description: 'Read leads' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Update leads' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Delete leads' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'View all leads (tenant)' },

  { permissionName: 'clients_create', module: 'Clients', description: 'Create clients' },
  { permissionName: 'clients_read', module: 'Clients', description: 'Read clients' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Update clients' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Delete clients' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'View all clients (tenant)' },

  { permissionName: 'jobs_create', module: 'Jobs', description: 'Create jobs' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'Read jobs' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Update jobs' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Delete jobs' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Assign job' },
  { permissionName: 'create_job', module: 'Jobs', description: 'Create job' },
  { permissionName: 'delete_job', module: 'Jobs', description: 'Delete job' },
  { permissionName: 'edit_job', module: 'Jobs', description: 'Edit job' },
  { permissionName: 'view_jobs', module: 'Jobs', description: 'View jobs' },

  { permissionName: 'candidates_create', module: 'Candidates', description: 'Create candidates' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'Read candidates' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Update candidates' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Delete candidates' },
  { permissionName: 'add_candidate', module: 'Candidates', description: 'Add candidate' },
  { permissionName: 'delete_candidate', module: 'Candidates', description: 'Delete candidate' },
  { permissionName: 'edit_candidate', module: 'Candidates', description: 'Edit candidate' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move pipeline' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidate' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View assigned candidates' },

  { permissionName: 'interviews_create', module: 'Interviews', description: 'Create interviews' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'Read interviews' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Update interviews' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Delete interviews' },

  { permissionName: 'placements_create', module: 'Placements', description: 'Create placements' },
  { permissionName: 'placements_read', module: 'Placements', description: 'Read placements' },
  { permissionName: 'placements_update', module: 'Placements', description: 'Update placements' },
  { permissionName: 'placements_delete', module: 'Placements', description: 'Delete placements' },

  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Create reports' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'Read reports' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Update reports' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Delete reports' },

  { permissionName: 'access_billing', module: 'Billing', description: 'Access billing' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Create invoice' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Record payment' },

  { permissionName: 'add_team_member', module: 'Team', description: 'Add team member' },
  { permissionName: 'assign_roles', module: 'Team', description: 'Assign roles' },
  { permissionName: 'edit_team_member', module: 'Team', description: 'Edit team member' },
  { permissionName: 'generate_credentials', module: 'Team', description: 'Generate credentials' },
  { permissionName: 'manage_commission', module: 'Team', description: 'Manage commission' },
  { permissionName: 'manage_targets', module: 'Team', description: 'Manage targets' },

  { permissionName: 'system_select_all', module: 'System', description: 'Select all' },
  { permissionName: 'access_integrations', module: 'System', description: 'Access integrations' },
  { permissionName: 'export_data', module: 'System', description: 'Export data' },
  { permissionName: 'manage_settings', module: 'System', description: 'Manage settings' },
];

export const DEFAULT_PERMISSION_NAMES = DEFAULT_PERMISSIONS.map((permission) => permission.permissionName);

export const DEFAULT_SYSTEM_ROLES = [
  { roleName: 'Super Admin', description: 'Full system access', color: 'red' },
  { roleName: 'Admin', description: 'Administrative access', color: 'blue' },
  { roleName: 'Senior Recruiter', description: 'Senior recruitment role', color: 'teal' },
  { roleName: 'Recruiter', description: 'Recruitment operations access', color: 'green' },
  { roleName: 'Account Manager', description: 'Client account management', color: 'amber' },
  { roleName: 'Finance', description: 'Finance and billing access', color: 'orange' },
  { roleName: 'Manager', description: 'Team management access', color: 'purple' },
  { roleName: 'Viewer', description: 'Read-only access', color: 'gray' },
];
