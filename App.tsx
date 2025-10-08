import React, { useState, useCallback } from 'react';
import MinecraftScene from './components/MinecraftScene';
import Header from './components/Header';
import Footer from './components/Footer';
import Controls from './components/Controls';
import CameraSwitcher from './components/CameraSwitcher';
import CharacterCustomizer from './components/CharacterCustomizer';
import CustomizerToggle from './components/CustomizerToggle';


export interface MoveVector {
  x: number;
  y: number;
  magnitude: number;
}

export type CameraMode = 'third-person' | 'first-person';

export interface CharacterAppearance {
  skinColor: string;
  hairStyle: 'standard' | 'long' | 'bald';
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
}

const App: React.FC = () => {
  const [move, setMove] = useState<MoveVector>({ x: 0, y: 0, magnitude: 0 });
  const [isJumping, setIsJumping] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third-person');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [characterAppearance, setCharacterAppearance] = useState<CharacterAppearance>({
    skinColor: '#D2A679',
    hairStyle: 'standard',
    hairColor: '#5C4033',
    shirtColor: '#00CED1',
    pantsColor: '#3B5998',
  });

  const handleJump = useCallback(() => {
    setIsJumping(true);
  }, []);
  
  const handleJumpEnd = useCallback(() => {
    setIsJumping(false);
  }, []);

  const handleCameraToggle = useCallback(() => {
    setCameraMode(prev => prev === 'third-person' ? 'first-person' : 'third-person');
  }, []);

  const handleAppearanceChange = useCallback((newAppearance: Partial<CharacterAppearance>) => {
    setCharacterAppearance(prev => ({ ...prev, ...newAppearance }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full h-[calc(100vh-144px)] relative bg-black rounded-lg overflow-hidden shadow-2xl shadow-cyan-500/20">
          <MinecraftScene 
            move={move} 
            isJumping={isJumping} 
            onJumpEnd={handleJumpEnd} 
            cameraMode={cameraMode}
            characterAppearance={characterAppearance}
            onCameraToggle={handleCameraToggle}
          />
          <Controls onMove={setMove} onJump={handleJump} />
          <CameraSwitcher onToggle={handleCameraToggle} cameraMode={cameraMode} />
          <CustomizerToggle onClick={() => setIsCustomizerOpen(prev => !prev)} />
          <CharacterCustomizer 
            isOpen={isCustomizerOpen} 
            onClose={() => setIsCustomizerOpen(false)} 
            appearance={characterAppearance} 
            onAppearanceChange={handleAppearanceChange}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;