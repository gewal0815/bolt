// frontend/src/components/agentInterface/ExtensionHandle.tsx

import React, { useState, useEffect, useCallback } from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestoreIcon from '@mui/icons-material/Restore';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import Tooltip from '@mui/material/Tooltip';

interface ExtensionHandleProps {
  onExtend: (newWidthPercentage: number) => void;
  isDarkMode: boolean;
  showResetButton: boolean;
  onReset: () => void;
  selectedCount: number;
  onSubmit: () => void;
  onDeleteSelected: () => void;
}

const ExtensionHandle: React.FC<ExtensionHandleProps> = React.memo(
  ({
    onExtend,
    isDarkMode,
    showResetButton,
    onReset,
    selectedCount,
    onSubmit,
    onDeleteSelected,
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState<number | null>(null);
    const [currentWidthPercentage, setCurrentWidthPercentage] = useState<number>(60);

    /**
     * Handles the mouse down event to initiate dragging.
     */
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setStartX(e.clientX);
    }, []);

    /**
     * Handles the mouse move event to update the width percentage.
     */
    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (isDragging && startX !== null) {
          const deltaX = e.clientX - startX;
          const deltaPercentage = (deltaX / window.innerWidth) * 100;
          let newWidthPercentage = currentWidthPercentage + deltaPercentage;
          newWidthPercentage = Math.min(Math.max(newWidthPercentage, 30), 90);
          onExtend(newWidthPercentage);
          setCurrentWidthPercentage(newWidthPercentage);
          setStartX(e.clientX);
        }
      },
      [isDragging, startX, currentWidthPercentage, onExtend]
    );

    /**
     * Handles the mouse up event to stop dragging.
     */
    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      setStartX(null);
    }, []);

    /**
     * Adds and cleans up event listeners for mouse movements during dragging.
     */
    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
      } else {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'auto';
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'auto';
      };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
      <div className="extension-handle-container">
        <span className="extension-handle-label">Drag</span>

        {showResetButton && (
          <Tooltip title="Reset to Default" placement="left" arrow>
            <button
              className="reset-width-button"
              onClick={onReset}
              aria-label="Reset AI Response Width"
            >
              <RestoreIcon />
            </button>
          </Tooltip>
        )}

        <Tooltip title="Drag to Resize" placement="left" arrow>
          <button
            className="extension-handle-button"
            onMouseDown={handleMouseDown}
            aria-label="Drag to Resize AI Response"
          >
            <DragIndicatorIcon />
          </button>
        </Tooltip>

        <div className="extension-handle-grey-line"></div>

        <Tooltip title="Insert Image" placement="left" arrow>
          <button className="placeholder-button" aria-label="Insert Image">
            <InsertPhotoIcon />
          </button>
        </Tooltip>
        <Tooltip title="Insert Emoji" placement="left" arrow>
          <button className="placeholder-button" aria-label="Insert Emoji">
            <InsertEmoticonIcon />
          </button>
        </Tooltip>

        <div className="extension-handle-grey-line-bottom"></div>

        {selectedCount > 0 && (
          <>
            <Tooltip title="Submit selected code blocks" placement="left" arrow>
              <button
                className="submit-button"
                onClick={onSubmit}
                aria-label="Submit selected code blocks"
              >
                <SendIcon />
              </button>
            </Tooltip>

            <Tooltip title="Delete selected code blocks" placement="left" arrow>
              <button
                className="delete-selected-button"
                onClick={onDeleteSelected}
                aria-label="Delete selected code blocks"
              >
                <DeleteIcon />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    );
  }
);

export default ExtensionHandle;
