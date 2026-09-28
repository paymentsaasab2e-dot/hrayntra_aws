'use client';



import { useAddCandidateDrawer } from '../../hooks/useAddCandidateDrawer';
import { BulkCvLeaveGuardProvider } from '../../contexts/BulkCvLeaveGuardContext';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';

function AddCandidateDrawerInner(props) {
  const {
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  initialTab = 'manual',
  defaultJobId = '',
  lockJobSelection = false,
  showMethodTabs = true,
  /** When set (e.g. from Failed resumes → Retry), opens Bulk CV with these files once. */
  pendingBulkRetryFile = null,
  pendingBulkRetryFiles = null,
  /** Server FailedBulkResume ids paired with pendingBulkRetryFiles (same order). */
  pendingBulkRetryServerIds = null,
  onBulkRetryFileConsumed,
  /** Inline bulk CV panel (e.g. /demoAi) — same parse pipeline, no drawer overlay. */
  embeddedBulkCv = false,
  /** Open Create with AI chat first, then continue to the review form. */
  createWithAi = false,
} = props;
  const { drawerActive, drawerBody, handleDrawerClose, isCenteredPopup, portalMounted } = useAddCandidateDrawer(props);

if (!drawerActive) return null;
if (embeddedBulkCv) {
    return drawerBody;
  }
if (!portalMounted) return null;
if (isCenteredPopup) {
    return createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6" dir="ltr" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          aria-label="Close"
          onClick={handleDrawerClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="relative flex h-[min(92vh,920px)] w-full max-w-6xl flex-col"
        >
          {drawerBody}
        </motion.div>
      </div>,
      document.body
    );
  }
return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <DetailsModalShell
          key="add-candidate-drawer"
          variant="main"
          dialogTitleId="add-candidate-modal-title"
          onBackdropClick={handleDrawerClose}
        >
          {drawerBody}
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}


export default function AddCandidateDrawer(props) {
  return (
    <BulkCvLeaveGuardProvider>
      <AddCandidateDrawerInner {...props} />
    </BulkCvLeaveGuardProvider>
  );
}
