'use client';

import { Building2, CalendarClock, Package, Target, Users, Briefcase, Wallet, Swords } from 'lucide-react';
import { AddLeadFieldLabel, ADD_LEAD_INPUT, AddLeadSelectDropdown } from '@/components/drawers/drawerFormUi';

export const HQ_COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'];
export const HQ_PACKAGE_OPTIONS = ['Starter', 'Professional', 'Enterprise', 'Custom'];
export const HQ_TIMELINE_OPTIONS = [
  'Immediate (< 30 days)',
  '1–3 months',
  '3–6 months',
  '6+ months',
  'Not sure',
];
export const HQ_PIPELINE_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Demo',
  'Proposal',
  'Trial',
  'Converted',
  'Lost',
] as const;

export type HqLeadCrmBusinessValues = {
  companySize?: string;
  interestedPackage?: string;
  expectedUsers?: string;
  expectedJobs?: string;
  budget?: string;
  timeline?: string;
  decisionMaker?: string;
  competitor?: string;
  lostReason?: string;
};

type Props = {
  values: HqLeadCrmBusinessValues;
  onChange: (patch: Partial<HqLeadCrmBusinessValues>) => void;
  /** When status is Lost, show lost reason on business step too. */
  status?: string;
  showLostReason?: boolean;
};

export function HqLeadCrmBusinessFields({ values, onChange, status, showLostReason }: Props) {
  const isLost = String(status || '').toLowerCase() === 'lost' || showLostReason;

  return (
    <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">HQ CRM qualification</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AddLeadFieldLabel label="Company size" icon={Building2} iconClassName="text-indigo-500" />
          <AddLeadSelectDropdown
            value={values.companySize || ''}
            placeholder="Select size"
            options={HQ_COMPANY_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(companySize) => onChange({ companySize })}
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Interested package" icon={Package} iconClassName="text-indigo-500" />
          <AddLeadSelectDropdown
            value={values.interestedPackage || ''}
            placeholder="Select package"
            options={HQ_PACKAGE_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(interestedPackage) => onChange({ interestedPackage })}
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Expected users" icon={Users} iconClassName="text-indigo-500" />
          <input
            type="number"
            min={0}
            className={ADD_LEAD_INPUT}
            value={values.expectedUsers || ''}
            onChange={(e) => onChange({ expectedUsers: e.target.value })}
            placeholder="e.g. 25"
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Expected jobs" icon={Briefcase} iconClassName="text-indigo-500" />
          <input
            type="number"
            min={0}
            className={ADD_LEAD_INPUT}
            value={values.expectedJobs || ''}
            onChange={(e) => onChange({ expectedJobs: e.target.value })}
            placeholder="e.g. 10"
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Budget" icon={Wallet} iconClassName="text-indigo-500" />
          <input
            type="text"
            className={ADD_LEAD_INPUT}
            value={values.budget || ''}
            onChange={(e) => onChange({ budget: e.target.value })}
            placeholder="e.g. ₹50,000 / month"
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Buying timeline" icon={CalendarClock} iconClassName="text-indigo-500" />
          <AddLeadSelectDropdown
            value={values.timeline || ''}
            placeholder="Select timeline"
            options={HQ_TIMELINE_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(timeline) => onChange({ timeline })}
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Decision maker" icon={Target} iconClassName="text-indigo-500" />
          <input
            type="text"
            className={ADD_LEAD_INPUT}
            value={values.decisionMaker || ''}
            onChange={(e) => onChange({ decisionMaker: e.target.value })}
            placeholder="Name / role"
          />
        </div>
        <div>
          <AddLeadFieldLabel label="Competitor" icon={Swords} iconClassName="text-indigo-500" />
          <input
            type="text"
            className={ADD_LEAD_INPUT}
            value={values.competitor || ''}
            onChange={(e) => onChange({ competitor: e.target.value })}
            placeholder="Current tool / competitor"
          />
        </div>
      </div>

      {isLost ? (
        <div>
          <AddLeadFieldLabel label="Lost reason" icon={Swords} iconClassName="text-rose-500" required />
          <input
            type="text"
            className={ADD_LEAD_INPUT}
            value={values.lostReason || ''}
            onChange={(e) => onChange({ lostReason: e.target.value })}
            placeholder="Why was this lead lost?"
          />
        </div>
      ) : null}
    </div>
  );
}
