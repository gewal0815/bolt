// customContextMenu.tsx

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals if needed
import '~/styles/components/customContextMenu.css';

interface CustomContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  file: string | null;
  onAnalyze: (file: string | null) => void;
  onKeepHistory: (file: string | null) => void;
  onClose: () => void;
  onAnalyzeAllInFolder: (folder: string | null) => void;
}

const CustomContextMenu: React.FC<CustomContextMenuProps> = ({
  visible,
  position,
  file,
  onAnalyze,
  onKeepHistory,
  onClose,
}) => {
  const contextMenuRef = useRef<HTMLUListElement>(null);

  const handleClickOutside = (e: MouseEvent) => {
    if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    if (visible) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [visible]);

  if (!visible || !file) return null;

  // Optional: Adjust position to prevent overflow
  const menuStyle: React.CSSProperties = {
    top: position.y,
    left: position.x,
    position: 'absolute', // Ensure absolute positioning
  };

  function onAnalyzeAllInFolder(file: string) {
    throw new Error('Function not implemented.');
  }

  return ReactDOM.createPortal(
    <ul className="custom-context-menu" ref={contextMenuRef} style={menuStyle}>
      <li
        onClick={() => {
          onAnalyze(file);
          onClose();
        }}
      >
        Analyze
      </li>{' '}
      <li
        onClick={() => {
          onAnalyzeAllInFolder(file);
          onClose();
        }}
      >
        Analyze Folder
      </li>
      <li
        onClick={() => {
          onKeepHistory(file);
          onClose();
        }}
      >
        Keep History
      </li>
    </ul>,
    document.body, // Render the context menu at the root of the DOM
  );
};

export default CustomContextMenu;
