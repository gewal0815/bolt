import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { toast } from 'react-toastify';

interface UploadPanelProps {
  onFileUpload: (file: File) => void;
  onProjectUpload: (file: File) => void;
  onFileSelect: (filePath: string) => void; // Added onFileSelect prop
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onFileUpload, onProjectUpload, onFileSelect }) => {
  const onDropFile = useCallback((acceptedFiles: File[]) => {
    const devFile = acceptedFiles[0];
    if (devFile) {
      if (
        [
          '.js', '.ts', '.jsx', '.tsx', '.json', '.java', '.py', '.html', '.css', '.scss', 
          '.cpp', '.c', '.cs', '.go', '.rb', '.php', '.xml', '.sql', '.sh', '.md'
        ].some(ext => devFile.name.endsWith(ext))
      ) {
        onFileUpload(devFile);
        onFileSelect(devFile.name); // Call onFileSelect with the selected file path
      } else {
        toast.error('Invalid file type. Please upload a development file (e.g., .js, .ts, .java, .py, etc.).');
      }
    }
  }, [onFileUpload, onFileSelect]);

  const onDropProject = useCallback((acceptedFiles: File[]) => {
    const projectFile = acceptedFiles[0];
    if (projectFile) {
      if (['.zip', '.rar'].some(ext => projectFile.name.endsWith(ext))) {
        onProjectUpload(projectFile);
      } else {
        toast.error('Invalid file type. Please upload a project archive (.zip, .rar).');
      }
    }
  }, [onProjectUpload]);

  const { getRootProps: getRootPropsFile, getInputProps: getInputPropsFile } = useDropzone({
    onDrop: onDropFile,
    accept: {
      'application/javascript': ['.js'],
      'application/json': ['.json'],
      'text/typescript': ['.ts', '.tsx'],
      'text/jsx': ['.jsx'],
      'text/html': ['.html'],
      'text/css': ['.css', '.scss'],
      'text/x-c': ['.c', '.cpp'],
      'text/x-java-source': ['.java'],
      'text/x-python': ['.py'],
      'text/x-csharp': ['.cs'],
      'text/x-go': ['.go'],
      'text/x-ruby': ['.rb'],
      'application/x-httpd-php': ['.php'],
      'application/xml': ['.xml'],
      'application/sql': ['.sql'],
      'application/x-sh': ['.sh'],
      'text/markdown': ['.md'],
    },
  });
  
  const { getRootProps: getRootPropsProject, getInputProps: getInputPropsProject } = useDropzone({
    onDrop: onDropProject,
    accept: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
    },
  });
  
  return (
    <div className="upload-panel">
      <div className="upload-button" {...getRootPropsFile()}>
        <input {...getInputPropsFile()} />
        <PanelHeaderButton className="mr-1 text-sm">
          <div className="i-ph:upload" />
          Upload File (Dev)
        </PanelHeaderButton>
      </div>
      <div className="upload-button" {...getRootPropsProject()}>
        <input {...getInputPropsProject()} />
        <PanelHeaderButton className="mr-1 text-sm">
          <div className="i-ph:upload" />
          Upload Project (Zip/Rar)
        </PanelHeaderButton>
      </div>
    </div>
  );
};
