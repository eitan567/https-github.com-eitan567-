import React, { useState, useEffect } from 'react';

interface SettingsToggleProps {
  onClick: () => void;
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const SettingsToggle: React.FC<SettingsToggleProps> = ({ onClick }) => {
  const [isPointerLocked, setIsPointerLocked] = useState(document.pointerLockElement !== null);

  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement !== null);
    };

    if (!isMobile) {
        document.addEventListener('pointerlockchange', handlePointerLockChange);
    }

    return () => {
      if (!isMobile) {
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
      }
    };
  }, []);

  const shouldShow = !isMobile && !isPointerLocked;

  if (!shouldShow) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="bg-gray-700/60 backdrop-blur-sm text-white font-semibold py-2 px-4 rounded-lg border border-gray-600/80 hover:bg-gray-600/80 transition-colors duration-200 select-none"
      aria-label="Toggle audio settings"
    >
      Settings
    </button>
  );
};

export default SettingsToggle;
