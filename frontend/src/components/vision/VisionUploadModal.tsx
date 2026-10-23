import React from 'react';
import { Modal } from '../common/Modal';
import { TrafficIntelligenceWorkspace } from './TrafficIntelligenceWorkspace';

interface VisionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisionUploadModal: React.FC<VisionUploadModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Traffic Intelligence & Road Safety Vision AI Command Center"
      subtitle="P3 Release — Playback-Synchronized Live Video Detection, IoU Tracking & Ground-Truth Validation"
      maxWidth="max-w-6xl"
    >
      <TrafficIntelligenceWorkspace initialSubsection="live_detection" />
    </Modal>
  );
};
