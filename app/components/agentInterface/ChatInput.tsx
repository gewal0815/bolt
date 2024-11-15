// frontend/src/components/agentInterface/ChatInput.tsx

import React, { useState, useCallback } from 'react';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import Tooltip from '@mui/material/Tooltip';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = React.memo(({ onSend, onStop, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (inputValue.trim()) {
          onSend(inputValue.trim());
          setInputValue('');
        }
      }
    },
    [inputValue, onSend]
  );

  const handleSendClick = useCallback(() => {
    if (inputValue.trim()) {
      onSend(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, onSend]);

  const handleStopClick = useCallback(() => {
    onStop();
  }, [onStop]);

  return (
    <div className="chat-input-area">
      <textarea
        className="chat-input"
        placeholder="Type your message..."
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />
      {isLoading ? (
        <Tooltip title="Stop" placement="top" arrow>
          <button onClick={handleStopClick} className="chat-send-button stop-button" aria-label="Stop">
            <StopIcon />
          </button>
        </Tooltip>
      ) : (
        <Tooltip title="Send" placement="top" arrow>
          <button onClick={handleSendClick} className="chat-send-button" disabled={isLoading} aria-label="Send">
            <SendIcon />
          </button>
        </Tooltip>
      )}
    </div>
  );
});

export default ChatInput;
