// ChatInterface.tsx

import React, { useState, useEffect, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import Switch from '@mui/material/Switch';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestoreIcon from '@mui/icons-material/Restore';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';

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
  const [selectedCodeBlocks, setSelectedCodeBlocks] = useState<string[]>([]); // Tracks selected code blocks
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

  const toggleCodeBlockSelection = (id: string) => {
    setSelectedCodeBlocks((prev) => {
      if (prev.includes(id)) {
        return prev.filter((blockId) => blockId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSubmitSelected = () => {
    const selectedCodeBlocksData = [];

    messages.forEach((msg) => {
      const parts = parseMessageText(msg.text);
      parts.forEach((part) => {
        if (part.type === 'code' && selectedCodeBlocks.includes(part.id)) {
          selectedCodeBlocksData.push({
            messageId: msg.id,
            codeBlockId: part.id,
            language: part.language,
            content: part.content,
          });
        }
      });
    });

    console.log('Submitting selected code blocks:', selectedCodeBlocksData);
    // Implement actual submission logic here
  };

  const handleDeleteSelected = () => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        const parts = parseMessageText(msg.text);
        const filteredParts = parts.filter(
          (part) => !(part.type === 'code' && selectedCodeBlocks.includes(part.id))
        );
        const newText = filteredParts
          .map((part) => {
            if (part.type === 'code') {
              return `\`\`\`${part.language}\n${part.content}\`\`\``;
            } else {
              return part.content;
            }
          })
          .join('');
        return { ...msg, text: newText };
      })
    );
    setSelectedCodeBlocks([]);
    console.log('Deleted selected code blocks.');
    // Optionally, implement backend deletion logic here
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
            key={part.id}
            id={part.id}
            code={part.content}
            language={part.language}
            isDarkMode={isDarkMode}
            isSelected={selectedCodeBlocks.includes(part.id)}
            onSelect={() => toggleCodeBlockSelection(part.id)}
            onDelete={() => handleDeleteCodeBlock(part.id)}
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
        id: uuidv4(), // Assign a unique ID to each code block
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

  const handleDeleteCodeBlock = (id: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        const parts = parseMessageText(msg.text);
        const filteredParts = parts.filter(
          (part) => !(part.type === 'code' && part.id === id)
        );
        const newText = filteredParts
          .map((part) => {
            if (part.type === 'code') {
              return `\`\`\`${part.language}\n${part.content}\`\`\``;
            } else {
              return part.content;
            }
          })
          .join('');
        return { ...msg, text: newText };
      })
    );
    // Remove the code block ID from selectedCodeBlocks
    setSelectedCodeBlocks((prev) => prev.filter((blockId) => blockId !== id));
  };

  return (
    <Draggable handle=".chat-header" position={position} onDrag={handleDrag} nodeRef={chatRef}>
      <div
        className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'} ${
          showResetButton ? 'show-reset' : ''
        } ${selectedCodeBlocks.length > 0 ? 'has-selection' : ''}`}
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
              } ${message.sender === 'ai' && showResetButton ? 'extended' : ''} ${
                selectedCodeBlocks.length > 0 &&
                parseMessageText(message.text).some(
                  (part) => part.type === 'code' && selectedCodeBlocks.includes(part.id)
                )
                  ? 'selected'
                  : ''
              }`}
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
          selectedCount={selectedCodeBlocks.length}
          onSubmit={handleSubmitSelected}
          onDeleteSelected={handleDeleteSelected} // Pass the prop here
        />
      </div>
    </Draggable>
  );
};

interface CodeBlockWithCopyProps {
  id: string; // Unique identifier for the code block
  code: string;
  language: string;
  isDarkMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const CodeBlockWithCopy: React.FC<CodeBlockWithCopyProps> = ({
  id,
  code,
  language,
  isDarkMode,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

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
    onSelect();
  };

  const handleDeleteCode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onDelete();
  };

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
        }}
      >
        {code}
      </SyntaxHighlighter>

      {/* Top Buttons Container */}
      <div className="code-block-buttons-top">
        {/* Select Button */}
        <Tooltip title={isSelected ? 'Deselect' : 'Select'} placement="top" arrow>
          <button
            onClick={handleSelectCode}
            className={`select-code-button ${isSelected ? 'selected' : ''}`}
            aria-label="Select code for submission"
          >
            <BookmarkAddedIcon />
          </button>
        </Tooltip>

        {/* Copy Button */}
        <Tooltip title={copySuccess ? 'Copied!' : 'Copy'} placement="top" arrow>
          <button onClick={handleCopyCode} className="copy-code-button" aria-label="Copy code">
            <ContentCopyIcon />
          </button>
        </Tooltip>
      </div>

      {/* Bottom Buttons Container */}
      {isSelected && (
        <div className="code-block-buttons-bottom">
          {/* Delete Button */}
          <Tooltip title="Delete" placement="left" arrow>
            <button
              onClick={handleDeleteCode}
              className="delete-code-button"
              aria-label="Delete code snippet"
            >
              <DeleteIcon />
            </button>
          </Tooltip>
        </div>
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
  selectedCount: number;
  onSubmit: () => void;
  onDeleteSelected: () => void; // Added prop
}

const ExtensionHandle: React.FC<ExtensionHandleProps> = ({
  onExtend,
  isDarkMode,
  showResetButton,
  onReset,
  selectedCount,
  onSubmit,
  onDeleteSelected, // Destructure the new prop
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
      {/* Drag Label */}
      <span className="extension-handle-label">Drag</span>

      {/* Reset Button with Tooltip */}
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

      {/* Grey Line Under Placeholders */}
      <div className="extension-handle-grey-line-bottom"></div>

      {/* Submit Button with Tooltip - Visible when selectedCount > 0 */}
      {selectedCount > 0 && (
        <Tooltip title="Submit selected code blocks" placement="left" arrow>
          <button
            className="submit-button"
            onClick={onSubmit}
            aria-label="Submit selected code blocks"
          >
            <SendIcon />
          </button>
        </Tooltip>
      )}

      {/* Delete Selected Button with Tooltip */}
      {selectedCount > 0 && (
        <Tooltip title="Delete selected code blocks" placement="left" arrow>
          <button
            className="delete-selected-button"
            onClick={onDeleteSelected}
            aria-label="Delete selected code blocks"
          >
            <DeleteIcon />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default ChatInterface;
