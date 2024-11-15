// frontend/src/components/agentInterface/CodeBlockWithCopy.tsx

import React, { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import Tooltip from '@mui/material/Tooltip';

interface CodeBlockWithCopyProps {
  id: string;
  code: string;
  language: string;
  isDarkMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const CodeBlockWithCopy: React.FC<CodeBlockWithCopyProps> = React.memo(
  ({ id, code, language, isDarkMode, isSelected, onSelect, onDelete }) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyCode = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        navigator.clipboard.writeText(code).then(
          () => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
          },
          (err) => {
            console.error('Could not copy text: ', err);
          }
        );
      },
      [code]
    );

    const handleSelectCode = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onSelect();
      },
      [onSelect]
    );

    return (
      <div className={`code-block-container ${isSelected ? 'selected' : ''}`}>
        <SyntaxHighlighter
          language={language}
          style={isDarkMode ? darcula : materialLight}
          wrapLongLines
          customStyle={{
            borderRadius: '10px',
            padding: '15px',
            fontSize: '16px',
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
            border: isSelected ? '2px solid green' : '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {code}
        </SyntaxHighlighter>

        <div className="code-block-buttons-top">
          <Tooltip title={isSelected ? 'Deselect' : 'Select'} placement="top" arrow>
            <button
              onClick={handleSelectCode}
              className={`select-code-button ${isSelected ? 'selected' : ''}`}
              aria-label="Select code for submission"
            >
              <BookmarkAddedIcon />
            </button>
          </Tooltip>

          <Tooltip title={copySuccess ? 'Copied!' : 'Copy'} placement="top" arrow>
            <button onClick={handleCopyCode} className="copy-code-button" aria-label="Copy code">
              <ContentCopyIcon />
            </button>
          </Tooltip>

          <Tooltip title="Delete" placement="top" arrow>
            <button onClick={onDelete} className="delete-code-button" aria-label="Delete code block">
              <DeleteIcon />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }
);

export default CodeBlockWithCopy;
