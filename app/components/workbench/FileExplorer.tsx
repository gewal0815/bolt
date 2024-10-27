// src/components/FileExplorer.tsx
// src/components/FileExplorer.tsx

import React from 'react';
import FileTree from './FileTree';
import type { FileMap } from '~/lib/stores/files'; // Adjust the path as needed
import type { FileData } from '~/lib/stores/types'; // Import the FileData interface

interface FileExplorerProps {
  files: FileMap;
  onFileSelect: (filePath: string) => void; // Add this line to include onFileSelect
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect }) => {
  const handleFileSelect = (filePath: string) => {
    // Optionally retrieve the file content here if needed
    // Call the onFileSelect prop to notify the parent component
    onFileSelect(filePath);
  };

  return (
    <div className="file-explorer">
      <FileTree files={files} onFileSelect={handleFileSelect} />
    </div>
  );
};

export default FileExplorer;

