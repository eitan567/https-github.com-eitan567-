import React, { useState, useCallback } from 'react';
import MinecraftScene from './components/MinecraftScene';
import Controls from './components/Controls';
import CameraSwitcher from './components/CameraSwitcher';
import CharacterCustomizer from './components/CharacterCustomizer';
import CustomizerToggle from './components/CustomizerToggle';
import SettingsToggle from './components/SettingsToggle';
import Settings from './components/Settings';
import Hotbar from './components/Hotbar';


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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [characterAppearance, setCharacterAppearance] = useState<CharacterAppearance>({
    skinColor: '#D2A679',
    hairStyle: 'standard',
    hairColor: '#5C4033',
    shirtColor: '#00CED1',
    pantsColor: '#3B5998',
  });
  const [interacted, setInteracted] = useState(false);

  const [sfxVolume, setSfxVolume] = useState(0.7);
  const [musicVolume, setMusicVolume] = useState(0.2);
  const [isMuted, setIsMuted] = useState(false);
  const [currentWeaponIndex, setCurrentWeaponIndex] = useState<number | null>(null);
  const [showDebugView, setShowDebugView] = useState(false);

  const handleInteraction = useCallback(() => {
    if (!interacted) {
      setInteracted(true);
    }
  }, [interacted]);

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

  const handleVolumeChange = useCallback((type: 'sfx' | 'music', volume: number) => {
    if (type === 'sfx') {
      setSfxVolume(volume);
    } else {
      setMusicVolume(volume);
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handleToggleDebugView = useCallback(() => {
    setShowDebugView(prev => !prev);
  }, []);

  const handleWeaponSwitch = useCallback((index: number | null) => {
    setCurrentWeaponIndex(index);
  }, []);


  return (
    <div 
      className="w-screen h-screen relative bg-black text-white"
      onClick={handleInteraction}
    >
      <MinecraftScene 
        move={move} 
        isJumping={isJumping} 
        onJumpEnd={handleJumpEnd} 
        cameraMode={cameraMode}
        characterAppearance={characterAppearance}
        onCameraToggle={handleCameraToggle}
        interacted={interacted}
        sfxVolume={sfxVolume}
        musicVolume={musicVolume}
        isMuted={isMuted}
        currentWeaponIndex={currentWeaponIndex}
        onWeaponSwitch={handleWeaponSwitch}
        showDebugView={showDebugView}
        onToggleDebugView={handleToggleDebugView}
      />
      <Controls onMove={setMove} onJump={handleJump} />
      <CameraSwitcher onToggle={handleCameraToggle} cameraMode={cameraMode} />
       <div className="absolute top-4 left-4 flex gap-2 z-10">
          <CustomizerToggle onClick={() => setIsCustomizerOpen(prev => !prev)} />
          <SettingsToggle onClick={() => setIsSettingsOpen(prev => !prev)} />
       </div>
      <CharacterCustomizer 
        isOpen={isCustomizerOpen} 
        onClose={() => setIsCustomizerOpen(false)} 
        appearance={characterAppearance} 
        onAppearanceChange={handleAppearanceChange}
      />
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sfxVolume={sfxVolume}
        musicVolume={musicVolume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        showDebugView={showDebugView}
        onToggleDebugView={handleToggleDebugView}
      />
      <Hotbar
        currentWeaponIndex={currentWeaponIndex}
        onWeaponSelect={handleWeaponSwitch}
      />
    </div>
  );
};

export default App;