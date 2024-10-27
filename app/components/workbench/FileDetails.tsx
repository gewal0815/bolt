// FileDetails.tsx
import React from 'react';
import type {FileData}  from '../../lib/stores/types'; // Adjust the import path according to your directory structure


// Props interface for FileDetails
interface FileDetailsProps {
    fileData: FileData | null; // Nullable for initial state
  }
  
  // FileDetails component
  const FileDetails: React.FC<FileDetailsProps> = ({ fileData }) => {
    if (!fileData) {
      return <div>Select a file to see its details.</div>; // Placeholder when no file is selected
    }
  
    return (
      <div>
        <h2>File Details</h2>
        <p><strong>Path:</strong> {fileData.fullPath}</p>
        <p><strong>Code:</strong></p>
        <pre>{fileData.code}</pre>
      </div>
    );
  };
  
  export default FileDetails;
