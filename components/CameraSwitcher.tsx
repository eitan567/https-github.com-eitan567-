import React from 'react';
import { CameraMode } from '../App';

interface CameraSwitcherProps {
  onToggle: () => void;
  cameraMode: CameraMode;
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const CameraSwitcher: React.FC<CameraSwitcherProps> = ({ onToggle, cameraMode }) => {
  if (!isMobile) {
    return null;
  }

  return (
    <button
      onClick={onToggle}
      className="absolute top-4 right-4 bg-gray-700/60 backdrop-blur-sm text-white font-semibold py-2 px-4 rounded-lg border border-gray-600/80 hover:bg-gray-600/80 transition-colors duration-200 select-none"
      aria-label={`Switch to ${cameraMode === 'third-person' ? 'first-person' : 'third-person'} view`}
    >
      {cameraMode === 'third-person' ? 'First-Person' : 'Third-Person'}
    </button>
  );
};

export default CameraSwitcher;
