import { useState } from 'react';

type ModalName =
  | 'schedule'
  | 'feedback'
  | 'reschedule'
  | 'cancel'
  | 'panel'
  | 'noShow'
  | 'uploadRecording'
  | null;

export function useInterviewModals() {
  const [openModal, setOpenModal] = useState<ModalName>(null);

  return {
    openModal,
    isModalOpen: (name: Exclude<ModalName, null>) => openModal === name,
    open: (name: Exclude<ModalName, null>) => setOpenModal(name),
    close: () => setOpenModal(null),
  };
}
