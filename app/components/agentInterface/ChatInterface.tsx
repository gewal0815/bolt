// ChatInterface.tsx

import React, { useState, useEffect, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import Switch from '@mui/material/Switch';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Dark theme for code blocks
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Light theme for code blocks
import ContentCopyIcon from '@mui/icons-material/ContentCopy'; // Import copy icon
import Tooltip from '@mui/material/Tooltip'; // Import Tooltip for copy feedback
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'; // Import drag handle icon
import RestoreIcon from '@mui/icons-material/Restore'; // Import reset icon
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto'; // Placeholder icon 1
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon'; // Placeholder icon 2

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface ChatInterfaceProps {
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [aiResponseWidth, setAiResponseWidth] = useState<number>(60); // Initial width percentage
  const originalWidth = 60; // Original width before resizing
  const [showResetButton, setShowResetButton] = useState<boolean>(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Persist sessionId in localStorage
  const [sessionId] = useState<string>(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      return storedSessionId;
    } else {
      const newSessionId = uuidv4();
      localStorage.setItem('sessionId', newSessionId);
      return newSessionId;
    }
  });

  useEffect(() => {
    if (!localStorage.getItem('chatPosition')) {
      const initialX = (window.innerWidth - 400) / 2; // Approximate center
      const initialY = (window.innerHeight - 600) / 2;
      setPosition({ x: initialX, y: initialY });
    } else {
      const savedPosition = localStorage.getItem('chatPosition');
      if (savedPosition) {
        setPosition(JSON.parse(savedPosition));
      }
    }
  }, []);

  useEffect(() => {
    // Fetch message history on component mount
    const fetchMessageHistory = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/messages?session_id=${sessionId}&time_period=1 month`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          throw new Error(`Backend GET error: ${response.statusText}`);
        }

        const data: Message[] = await response.json();
        setMessages(data);
        console.log('Message History:', data);
      } catch (error) {
        console.error('Error fetching message history:', error);
        // Optionally, notify the user about the fetch failure
      }
    };

    fetchMessageHistory();
  }, [sessionId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('User Message:', userMessage);

      // Fetch and display AI response
      await getAIResponse(inputValue);
    } catch (error) {
      console.error('Error processing user message:', error);
      setIsLoading(false);
      // Optionally, notify the user about the processing failure
    }
  };

  const getAIResponse = async (chatInput: string) => {
    try {
      const response = await fetch(
        'http://localhost:5678/webhook/e4498659-6af2-480b-9578-0382d998f73a',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { sessionId: sessionId, chatInput: chatInput } }),
        }
      );
      if (!response.ok) throw new Error(`AI Webhook error: ${response.statusText}`);

      const data = await response.json();
      const aiMessage: Message = {
        id: uuidv4(),
        sender: 'ai',
        text: data.output || 'No response from AI.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      console.log('AI Message:', aiMessage);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          sender: 'ai',
          text: 'Error processing your request.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    const newPosition = { x: data.x, y: data.y };
    setPosition(newPosition);
    localStorage.setItem('chatPosition', JSON.stringify(newPosition));
  };

  const handleExtendAIResponse = (newWidthPercentage: number) => {
    setAiResponseWidth(newWidthPercentage);
    setShowResetButton(true);
  };

  const resetAIResponseWidth = () => {
    setAiResponseWidth(originalWidth);
    setShowResetButton(false);
  };

  // Render individual message
  const renderMessage = (message: Message) => {
    if (!message.text || !message.sender) {
      return <span style={{ color: 'red' }}>Invalid message data.</span>;
    }

    const parts = parseMessageText(message.text);

    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <CodeBlockWithCopy
            key={index}
            code={part.content}
            language={part.language}
            isDarkMode={isDarkMode}
          />
        );
      } else {
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {part.content}
          </span>
        );
      }
    });
  };

  // Parse message text to identify code blocks
  const parseMessageText = (text: string) => {
    if (!text) {
      return [{ type: 'text', content: 'No message content available.' }];
    }

    const regex = /```(\w+)?\n([\s\S]+?)```/g;
    let match;
    let lastIndex = 0;
    const result = [];

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        // Add text before code block
        result.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }

      result.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2],
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      // Add remaining text
      result.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return result;
  };

  return (
    <Draggable handle=".chat-header" position={position} onDrag={handleDrag} nodeRef={chatRef}>
      <div
        className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'} ${
          showResetButton ? 'show-reset' : ''
        }`}
        ref={chatRef}
      >
        {/* Chat Header */}
        <div className="chat-header">
          <h1 className="chat-title">Chat Interface</h1>
          <div className="chat-header-controls">
            <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            <Switch checked={isDarkMode} onChange={toggleDarkMode} />
            <button onClick={onClose} className="chat-close-button" aria-label="Close Chat">
              &times;
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${
                message.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'
              } ${message.sender === 'ai' && showResetButton ? 'extended' : ''}`}
              style={
                message.sender === 'ai'
                  ? { maxWidth: `${aiResponseWidth}%` }
                  : {}
              }
            >
              <div>{renderMessage(message)}</div>
              <div className="chat-message-timestamp">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
          {isLoading && <div className="chat-loading-indicator">Loading...</div>}
          <div ref={messageEndRef} />
        </div>

        {/* Chat Input Area */}
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            placeholder="Type your message..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button onClick={handleSend} className="chat-send-button" disabled={isLoading}>
            Send
          </button>
        </div>

        {/* Fixed Extension Handle */}
        <ExtensionHandle
          onExtend={handleExtendAIResponse}
          isDarkMode={isDarkMode}
          showResetButton={showResetButton}
          onReset={resetAIResponseWidth}
        />
      </div>
    </Draggable>
  );
};

interface CodeBlockWithCopyProps {
  code: string;
  language: string;
  isDarkMode: boolean;
}

const CodeBlockWithCopy: React.FC<CodeBlockWithCopyProps> = ({ code, language, isDarkMode }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  const handleCopyCode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent default behavior
    navigator.clipboard.writeText(code).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000); // Clear message after 2 seconds
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  const handleSelectCode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsSelected((prev) => !prev);
  };

  const handleDeleteCode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Placeholder for delete functionality
    // You can emit an event or call a prop function to handle deletion
    console.log('Delete code snippet:', code);
    // Reset selection after deletion
    setIsSelected(false);
  };

  return (
    <div className="code-block-container" style={{ position: 'relative' }}>
      <SyntaxHighlighter
        language={language}
        style={isDarkMode ? darcula : materialLight}
        wrapLongLines
        customStyle={{
          borderRadius: '10px',
          padding: '15px',
          fontSize: '16px',
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {code}
      </SyntaxHighlighter>

      {/* Buttons Container */}
      <div className="code-block-buttons">
        {/* Select Button */}
        <Tooltip title={isSelected ? 'Deselect' : 'Select'} placement="top" arrow>
          <button onClick={handleSelectCode} className="select-code-button" aria-label="Select code for deletion">
            {/* Using a select icon, e.g., CheckBoxOutlineBlankIcon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 0 24 24"
              width="20px"
              fill={isSelected ? '#1a73e8' : 'currentColor'}
            >
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 14l-5-5 1.41-1.41L18 16.17l-7.59-7.59L9 10l6 6z" />
            </svg>
          </button>
        </Tooltip>

        {/* Copy Button */}
        <Tooltip title={copySuccess ? 'Copied!' : 'Copy'} placement="top" arrow>
          <button onClick={handleCopyCode} className="copy-code-button" aria-label="Copy code">
            <ContentCopyIcon />
          </button>
        </Tooltip>
      </div>

      {/* Delete Button - Visible Only When Selected */}
      {isSelected && (
        <Tooltip title="Delete" placement="top" arrow>
          <button onClick={handleDeleteCode} className="delete-code-button" aria-label="Delete code snippet">
            {/* Using a delete icon, e.g., DeleteIcon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 0 24 24"
              width="20px"
              fill="currentColor"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" />
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  );
};

/* ExtensionHandle Component */
interface ExtensionHandleProps {
  onExtend: (newWidthPercentage: number) => void;
  isDarkMode: boolean;
  showResetButton: boolean;
  onReset: () => void;
}

const ExtensionHandle: React.FC<ExtensionHandleProps> = ({
  onExtend,
  isDarkMode,
  showResetButton,
  onReset,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentWidthPercentage, setCurrentWidthPercentage] = useState<number>(60); // Starting with 60%

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default behavior to avoid unwanted scrolling
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && startX !== null) {
      const deltaX = e.clientX - startX;
      const deltaPercentage = (deltaX / window.innerWidth) * 100;
      let newWidthPercentage = currentWidthPercentage + deltaPercentage;
      newWidthPercentage = Math.min(Math.max(newWidthPercentage, 30), 90); // Constraints between 30% and 90%
      onExtend(newWidthPercentage);
      setCurrentWidthPercentage(newWidthPercentage);
      setStartX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setStartX(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during dragging
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
  }, [isDragging, startX, currentWidthPercentage]);

  return (
    <div className="extension-handle-container">
      {/* Reset Button with Tooltip */}
      <Tooltip title="Reset to Default" placement="left" arrow>
        <button
          className="reset-width-button"
          onClick={onReset}
          aria-label="Reset AI Response Width"
        >
          <RestoreIcon />
        </button>
      </Tooltip>

      {/* Drag Label */}
      <span className="extension-handle-label">Drag</span>

      {/* Drag Indicator with Tooltip */}
      <Tooltip title="Drag to Resize" placement="left" arrow>
        <button
          className="extension-handle-button"
          onMouseDown={handleMouseDown}
          aria-label="Drag to Resize AI Response"
        >
          <DragIndicatorIcon />
        </button>
      </Tooltip>

      {/* Grey Line */}
      <div className="extension-handle-grey-line"></div>

      {/* Placeholder Icons with Tooltips */}
      <Tooltip title="Placeholder 1" placement="left" arrow>
        <button className="placeholder-button" aria-label="Placeholder 1">
          <InsertPhotoIcon />
        </button>
      </Tooltip>
      <Tooltip title="Placeholder 2" placement="left" arrow>
        <button className="placeholder-button" aria-label="Placeholder 2">
          <InsertEmoticonIcon />
        </button>
      </Tooltip>
    </div>
  );
};

export default ChatInterface;
