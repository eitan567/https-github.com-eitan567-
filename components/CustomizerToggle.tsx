import React, { useState, useEffect } from 'react';

interface CustomizerToggleProps {
  onClick: () => void;
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const CustomizerToggle: React.FC<CustomizerToggleProps> = ({ onClick }) => {
  const [isPointerLocked, setIsPointerLocked] = useState(document.pointerLockElement !== null);

  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement !== null);
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  // The button should only be visible when the desktop controls overlay is.
  const shouldShow = !isMobile && !isPointerLocked;

  if (!shouldShow) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="absolute top-4 left-4 bg-gray-700/60 backdrop-blur-sm text-white font-semibold py-2 px-4 rounded-lg border border-gray-600/80 hover:bg-gray-600/80 transition-colors duration-200 select-none z-10"
      aria-label="Toggle character customizer"
    >
      Customize
    </button>
  );
};

export default CustomizerToggle;