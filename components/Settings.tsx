import React from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  onVolumeChange: (type: 'sfx' | 'music', volume: number) => void;
  onMuteToggle: () => void;
  showDebugView: boolean;
  onToggleDebugView: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, sfxVolume, musicVolume, isMuted, onVolumeChange, onMuteToggle, showDebugView, onToggleDebugView }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`fixed top-0 left-0 h-full bg-gray-800/80 backdrop-blur-md shadow-2xl text-white p-4 w-64 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-cyan-400">Settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        
        <div className="space-y-6">
            <div>
                <label htmlFor="sfx-volume" className="block mb-2 text-lg font-semibold text-cyan-300">Sound Effects</label>
                <input
                    id="sfx-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sfxVolume}
                    onChange={(e) => onVolumeChange('sfx', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    aria-label="Sound effects volume"
                />
            </div>
             <div>
                <label htmlFor="music-volume" className="block mb-2 text-lg font-semibold text-cyan-300">Music/Ambience</label>
                <input
                    id="music-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={musicVolume}
                    onChange={(e) => onVolumeChange('music', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    aria-label="Music and ambience volume"
                />
            </div>

            <div className="pt-4 border-t border-gray-600 space-y-6">
                 <div className="flex items-center justify-between">
                    <label htmlFor="debug-view-toggle" className="text-lg font-semibold text-cyan-300">Show Mini-View</label>
                    <button
                        onClick={onToggleDebugView}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showDebugView ? 'bg-cyan-500' : 'bg-gray-600'}`}
                        role="switch"
                        aria-checked={showDebugView}
                        id="debug-view-toggle"
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showDebugView ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="mute-toggle" className="text-lg font-semibold text-cyan-300">Mute All</label>
                    <button
                        onClick={onMuteToggle}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isMuted ? 'bg-red-600' : 'bg-cyan-500'}`}
                        role="switch"
                        aria-checked={isMuted}
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isMuted ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default Settings;