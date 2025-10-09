import React from 'react';

interface HotbarProps {
  currentWeaponIndex: number | null;
  onWeaponSelect: (index: number | null) => void;
}

const gunNames = ["Pistol", "SMG", "Shotgun", "Rifle", "Sniper", "Revolver", "LMG", "Golden Gun", "Blaster"];

const Hotbar: React.FC<HotbarProps> = ({ currentWeaponIndex, onWeaponSelect }) => {
  const handleSlotClick = (index: number) => {
    if (currentWeaponIndex === index) {
      onWeaponSelect(null); // Deselect if clicking the active weapon
    } else {
      onWeaponSelect(index);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex justify-center gap-1.5 p-1.5 bg-black/40 backdrop-blur-sm rounded-lg pointer-events-auto"
        aria-label="Weapon selection hotbar"
    >
      {gunNames.map((name, index) => (
        <button
          key={index}
          onClick={() => handleSlotClick(index)}
          className={`w-16 h-16 border-2 rounded-md flex flex-col items-center justify-center transition-all duration-200
            ${currentWeaponIndex === index ? 'bg-white/30 border-cyan-400 scale-110' : 'bg-black/30 border-gray-500 hover:bg-white/20'}`}
          aria-label={`Select ${name}. Press key ${index + 1}. ${currentWeaponIndex === index ? 'Currently selected.' : ''}`}
        >
          <span className="text-white font-bold text-2xl">{index + 1}</span>
          <span className="text-gray-300 text-[10px] uppercase tracking-wider">{name}</span>
        </button>
      ))}
    </div>
  );
};

export default Hotbar;
