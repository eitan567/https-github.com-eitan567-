import React, { useEffect, useRef } from 'react';
import { MoveVector } from '../App';

declare const nipplejs: any;

interface ControlsProps {
  onMove: (vector: MoveVector) => void;
  onJump: () => void;
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const Controls: React.FC<ControlsProps> = ({ onMove, onJump }) => {
  const joystickContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobile && joystickContainerRef.current) {
      const options = {
        zone: joystickContainerRef.current,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100, // Made the joystick smaller
      };

      const manager = nipplejs.create(options);

      manager.on('move', (_event: any, data: any) => {
        const { vector, distance } = data;
        const magnitude = distance / (options.size / 2); // Normalize magnitude to 0-1
        onMove({ x: vector.x, y: vector.y, magnitude });
      });

      manager.on('end', () => {
        onMove({ x: 0, y: 0, magnitude: 0 });
      });

      return () => {
        manager.destroy();
      };
    }
  }, [onMove]);

  const handleJumpPress = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); // Prevent zoom on mobile
    onJump();
  };

  if (!isMobile) {
    return null;
  }

  return (
    <>
      <div
        ref={joystickContainerRef}
        className="absolute bottom-2.5 left-2.5 w-36 h-36"
        aria-label="Movement joystick"
      ></div>
      <button
        onMouseDown={handleJumpPress}
        onTouchStart={handleJumpPress}
        className="absolute bottom-8 right-8 w-24 h-24 bg-cyan-500/50 backdrop-blur-sm rounded-full text-white font-bold text-lg border-2 border-cyan-400/80 active:bg-cyan-400/70 select-none"
        aria-label="Jump button"
      >
        JUMP
      </button>
    </>
  );
};

export default Controls;
