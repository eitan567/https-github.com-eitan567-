import React from 'react';
import { CharacterAppearance } from '../App';

const SKIN_COLORS = ['#D2A679', '#C68642', '#8D5524', '#614332', '#F1C27D'];
const HAIR_COLORS = ['#5C4033', '#000000', '#B8860B', '#C0C0C0', '#A52A2A', '#F0E68C'];
const SHIRT_COLORS = ['#00CED1', '#DC143C', '#32CD32', '#FFD700', '#9370DB', '#FFFFFF'];
const PANTS_COLORS = ['#3B5998', '#2F4F4F', '#8B4513', '#1C1C1C', '#696969'];
const HAIR_STYLES: { id: CharacterAppearance['hairStyle'], name: string }[] = [
    { id: 'standard', name: 'Standard' },
    { id: 'long', name: 'Long' },
    { id: 'bald', name: 'Bald' },
];

interface CustomizerSectionProps {
    title: string;
    children: React.ReactNode;
}

const CustomizerSection: React.FC<CustomizerSectionProps> = ({ title, children }) => (
    <div className="mb-4">
        <h3 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-600 pb-1">{title}</h3>
        {children}
    </div>
);

interface ColorSwatchProps {
    colors: string[];
    selectedColor: string;
    onColorChange: (color: string) => void;
}

const ColorSwatches: React.FC<ColorSwatchProps> = ({ colors, selectedColor, onColorChange }) => (
    <div className="flex flex-wrap gap-2">
        {colors.map(color => (
            <button
                key={color}
                onClick={() => onColorChange(color)}
                className={`w-9 h-9 rounded-full border-2 transition-transform transform hover:scale-110 ${selectedColor.toLowerCase() === color.toLowerCase() ? 'border-cyan-400 scale-110' : 'border-gray-500'}`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
            />
        ))}
    </div>
);

interface CharacterCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  appearance: CharacterAppearance;
  onAppearanceChange: (newAppearance: Partial<CharacterAppearance>) => void;
}

const CharacterCustomizer: React.FC<CharacterCustomizerProps> = ({ isOpen, onClose, appearance, onAppearanceChange }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`fixed top-0 left-0 h-full bg-gray-800/80 backdrop-blur-md shadow-2xl text-white p-4 w-64 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400">Customize</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-4rem)] pr-2">
            <CustomizerSection title="Skin Tone">
                <ColorSwatches colors={SKIN_COLORS} selectedColor={appearance.skinColor} onColorChange={color => onAppearanceChange({ skinColor: color })} />
            </CustomizerSection>

            <CustomizerSection title="Hair">
                 <div className="flex flex-wrap gap-2 mb-3">
                    {HAIR_STYLES.map(style => (
                        <button
                            key={style.id}
                            onClick={() => onAppearanceChange({ hairStyle: style.id })}
                            className={`px-3 py-1 text-sm rounded-md border ${appearance.hairStyle === style.id ? 'bg-cyan-500 border-cyan-400' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
                        >
                            {style.name}
                        </button>
                    ))}
                </div>
                <ColorSwatches colors={HAIR_COLORS} selectedColor={appearance.hairColor} onColorChange={color => onAppearanceChange({ hairColor: color })} />
            </CustomizerSection>

            <CustomizerSection title="Shirt Color">
                <ColorSwatches colors={SHIRT_COLORS} selectedColor={appearance.shirtColor} onColorChange={color => onAppearanceChange({ shirtColor: color })} />
            </CustomizerSection>

            <CustomizerSection title="Pants Color">
                <ColorSwatches colors={PANTS_COLORS} selectedColor={appearance.pantsColor} onColorChange={color => onAppearanceChange({ pantsColor: color })} />
            </CustomizerSection>
        </div>
      </div>
    </>
  );
};

export default CharacterCustomizer;
