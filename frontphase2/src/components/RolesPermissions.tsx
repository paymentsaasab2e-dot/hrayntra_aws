import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, User, Users, Info, Settings, Lock } from 'lucide-react';
import { ROLES, PERMISSIONS, Badge } from './TeamComponents';
import { motion } from 'motion/react';

export const RolesPermissionsView = () => {
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: Math.random() > 0.4 }), {})
  );

  const togglePermission = (perm: string) => {
    setPermissions(prev => ({ ...prev, [perm]: !prev[perm] }));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Role Cards List */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2">System Roles</h3>
        <div className="flex flex-col gap-2">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedRole === role 
                  ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100' 
                  : 'bg-white border-slate-100 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedRole === role ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {role.includes('Admin') ? (
                    <ShieldCheck className={`size-4 ${selectedRole === role ? 'text-white' : 'text-blue-600'}`} />
                  ) : (
                    <User className={`size-4 ${selectedRole === role ? 'text-white' : 'text-slate-500'}`} />
                  )}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${selectedRole === role ? 'text-white' : 'text-slate-900'}`}>{role}</h4>
                  <p className={`text-xs ${selectedRole === role ? 'text-blue-100' : 'text-slate-500'}`}>
                    {role === 'Super Admin' ? 'Full system access' : 'Restricted access'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Permissions for {selectedRole}</h3>
            <p className="text-sm text-slate-500">Define what users in this role can see and do.</p>
          </div>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
            Save Changes
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERMISSIONS.map((perm) => (
              <div 
                key={perm} 
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">{perm}</span>
                  <span className="text-xs text-slate-500">Allow users to {perm.toLowerCase()} in the system.</span>
                </div>
                <button 
                  onClick={() => togglePermission(perm)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${permissions[perm] ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <motion.div 
                    animate={{ x: permissions[perm] ? 24 : 4 }}
                    className="absolute top-1 size-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <Info className="size-5 text-blue-600" />
          </div>
          <p className="text-sm text-slate-600">
            Changes to role permissions will apply to all team members assigned to the <strong>{selectedRole}</strong> role immediately.
          </p>
        </div>
      </div>
    </div>
  );
};
