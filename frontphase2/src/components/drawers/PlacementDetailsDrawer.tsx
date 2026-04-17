import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, MapPin, DollarSign, Calendar, Briefcase, User, Download, ExternalLink } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';

interface PlacementDetailsProps {
  placement: any | null;
  onClose: () => void;
}

export const PlacementDetailsDrawer = ({ placement, onClose }: PlacementDetailsProps) => {
  if (!placement) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto"
        />
        
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute right-0 top-0 h-full w-[500px] bg-white shadow-2xl pointer-events-auto border-l border-slate-200 flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Placement Details</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Candidate Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-100">
                <ImageWithFallback src={placement.avatar} alt={placement.candidateName} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{placement.candidateName}</h3>
                <p className="text-slate-500 font-medium">{placement.jobTitle}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                <span className="text-sm font-semibold text-blue-600">{placement.status}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Billing</p>
                <span className="text-sm font-semibold text-emerald-600">{placement.billingStatus}</span>
              </div>
            </div>

            {/* Details Sections */}
            <div className="space-y-8">
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 border-b pb-2">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  Employment Information
                </h4>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-slate-500 mb-0.5">Client Company</p>
                    <p className="font-medium text-slate-900">{placement.company}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Employment Type</p>
                    <p className="font-medium text-slate-900">{placement.employmentType}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Location</p>
                    <p className="flex items-center gap-1 font-medium text-slate-900">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Remote / New York
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Guarantee Period</p>
                    <p className="font-medium text-slate-900">90 Days</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 border-b pb-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  Financial & Billing
                </h4>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-slate-500 mb-0.5">Offer Salary / CTC</p>
                    <p className="font-bold text-slate-900">$165,000 / year</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Placement Fee (20%)</p>
                    <p className="font-bold text-emerald-600">$33,000</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 border-b pb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Documents
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Offer_Letter_Jenkins.pdf</p>
                        <p className="text-xs text-slate-500">Uploaded Jan 16, 2026</p>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Employment_Contract.docx</p>
                        <p className="text-xs text-slate-500">Uploaded Jan 18, 2026</p>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors">
              Raise Invoice
            </button>
            <button className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md font-medium text-sm hover:bg-slate-50 transition-colors">
              Edit
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
