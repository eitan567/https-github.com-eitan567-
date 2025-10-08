
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm shadow-md p-4 h-16 flex items-center border-b border-gray-700">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cyan-400 font-mono">3D Minecraft World</h1>
        <p className="text-gray-400 hidden sm:block">Built with React, Three.js & TailwindCSS</p>
      </div>
    </header>
  );
};

export default Header;
