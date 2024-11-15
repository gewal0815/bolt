// frontend/src/components/ChatInterface.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface Part {
  type: 'text' | 'code';
  id: string;
  content: string;
  language?: string;
  messageId: string; // Changed to string
}

interface Message {
  id: string; // Changed to string to accommodate temporary UUIDs
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  parts: Part[];
}

interface SelectedCodeBlock {
  messageId: string;
  partId: string;
  code: string;
}

interface ChatInterfaceProps {
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [aiResponseWidth, setAiResponseWidth] = useState<number>(60);
  const originalWidth = 60;
  const [showResetButton, setShowResetButton] = useState<boolean>(false);
  const [selectedCodeBlocks, setSelectedCodeBlocks] = useState<SelectedCodeBlock[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const sessionId = localStorage.getItem('sessionId') || uuidv4();

  useEffect(() => {
    if (!localStorage.getItem('sessionId')) {
      localStorage.setItem('sessionId', sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!localStorage.getItem('chatPosition')) {
      const initialX = (window.innerWidth - 400) / 2;
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
    fetchMessageHistory();
  }, [sessionId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
        body: JSON.stringify({ text: inputValue }),
      });

      if (!response.ok) throw new Error(`Message send error: ${response.statusText}`);

      const data = await response.json();

      const userMessage: Message = {
        id: String(data.messageId), // Ensure ID is a string
        sender: 'user',
        text: inputValue,
        timestamp: new Date().toISOString(),
        parts: parseMessageText(inputValue, String(data.messageId)),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');

      // Fetch AI response after sending user message
      await getAIResponse(inputValue);
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally, display an error message to the user
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refactored getAIResponse function to handle streaming and simulated streaming.
   */
  const getAIResponse = async (chatInput: string) => {
    // Create a unique temporary ID for the AI message
    const tempAiMessageId = uuidv4();

    // Initialize a new AI message with empty content
    const initialAiMessage: Message = {
      id: tempAiMessageId,
      sender: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
      parts: [],
    };

    // Add the initial AI message to the messages state
    setMessages((prev) => [...prev, initialAiMessage]);

    try {
      const response = await fetch('http://localhost:5678/webhook/e4498659-6af2-480b-9578-0382d998f73a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
        body: JSON.stringify({ input: { sessionId: sessionId, chatInput: chatInput } }),
      });

      if (!response.ok) throw new Error(`AI Webhook error: ${response.statusText}`);

      const contentType = response.headers.get('Content-Type') || '';
      const isStream = response.body && response.headers.get('Transfer-Encoding') === 'chunked';

      if (isStream && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          if (value) {
            const chunk = decoder.decode(value, { stream: true });

            // Append the chunk to the AI message
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === tempAiMessageId
                  ? {
                      ...msg,
                      text: msg.text + chunk,
                      parts: parseMessageText(msg.text + chunk, msg.id),
                    }
                  : msg
              )
            );
          }
          done = readerDone;
        }

        // Finalize the AI message after the stream is complete
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempAiMessageId
              ? {
                  ...msg,
                  parts: parseMessageText(msg.text, msg.id),
                }
              : msg
          )
        );
      } else {
        // If streaming is not supported, simulate streaming
        const data = await response.json();
        const aiFullText = data.output || 'No response from AI.';
        await simulateStreaming(aiFullText, tempAiMessageId);
      }
    } catch (error) {
      console.error('Error fetching AI response:', error);

      // Update the AI message with an error message
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempAiMessageId
            ? {
                ...msg,
                text: 'Error processing your request.',
                parts: parseMessageText('Error processing your request.', msg.id),
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Simulates streaming by revealing the AI response one character at a time.
   * @param text The full AI response text.
   * @param messageId The ID of the AI message to update.
   */
  const simulateStreaming = async (text: string, messageId: string) => {
    for (let i = 0; i < text.length; i++) {
      // Append one character at a time
      const currentText = text.substring(0, i + 1);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                text: currentText,
                parts: parseMessageText(currentText, msg.id),
              }
            : msg
        )
      );
      // Adjust the delay as needed for a smoother typing effect
      await new Promise((resolve) => setTimeout(resolve, 20));
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

  const toggleCodeBlockSelection = (selectedBlock: SelectedCodeBlock) => {
    setSelectedCodeBlocks((prev) => {
      const exists = prev.find(
        (block) => block.partId === selectedBlock.partId && block.messageId === selectedBlock.messageId
      );
      if (exists) {
        return prev.filter(
          (block) => !(block.partId === selectedBlock.partId && block.messageId === selectedBlock.messageId)
        );
      } else {
        return [...prev, selectedBlock];
      }
    });
  };

  const fetchMessageHistory = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/messages?time_period=1 month`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Session-ID': sessionId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Backend GET error: ${response.statusText}`);
      }

      const data: any[] = await response.json();

      const messagesWithParts = data.map((msg) => ({
        ...msg,
        id: String(msg.id), // Ensure the ID is a string
        parts: parseMessageText(msg.text, String(msg.id)),
      }));
      setMessages(messagesWithParts);
    } catch (error) {
      console.error('Error fetching message history:', error);
      // Optionally, display an error message to the user
    }
  };

  const renderMessage = (message: Message) => {
    if (!message.parts || !message.sender) {
      return <span style={{ color: 'red' }}>Invalid message data.</span>;
    }

    return message.parts.map((part) => {
      if (part.type === 'code') {
        const isSelected = selectedCodeBlocks.some(
          (block) => block.partId === part.id && block.messageId === part.messageId
        );
        return (
          <CodeBlockWithCopy
            key={part.id}
            id={part.id}
            code={part.content}
            language={part.language || 'text'}
            isDarkMode={isDarkMode}
            isSelected={isSelected}
            onSelect={() =>
              toggleCodeBlockSelection({
                messageId: part.messageId,
                partId: part.id,
                code: part.content,
              })
            }
            onDelete={() => handleDeleteCodeBlock(part.messageId, part.id)}
          />
        );
      } else {
        return (
          <span key={part.id} style={{ whiteSpace: 'pre-wrap' }}>
            {part.content}
          </span>
        );
      }
    });
  };

  const parseMessageText = (text: string, messageId: string): Part[] => {
    if (!text) {
      return [{ type: 'text', id: uuidv4(), content: 'No message content available.', messageId }];
    }

    const regex = /```(\w+)?\n([\s\S]+?)```/g;
    let match;
    let lastIndex = 0;
    const result: Part[] = [];

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          id: uuidv4(),
          content: text.substring(lastIndex, match.index),
          messageId,
        });
      }

      result.push({
        type: 'code',
        id: uuidv4(),
        language: match[1] || 'text',
        content: match[2],
        messageId,
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        id: uuidv4(),
        content: text.substring(lastIndex),
        messageId,
      });
    }

    return result;
  };

  const handleDeleteCodeBlock = async (messageId: string, partId: string) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) throw new Error('Message not found');

      const part = message.parts.find((p) => p.id === partId);
      if (!part) throw new Error('Code block not found');

      const response = await fetch(`http://localhost:5000/api/code/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
        body: JSON.stringify({ selectedCode: part.content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Delete error: ${errorData.message || response.statusText}`);
      }

      // After successful deletion, reload the message history
      await fetchMessageHistory();

      // Optionally, remove the deleted code block from selectedCodeBlocks
      setSelectedCodeBlocks((prev) =>
        prev.filter((block) => !(block.messageId === messageId && block.partId === partId))
      );
    } catch (error) {
      console.error('Error deleting code block:', error);
      // Optionally, display an error message to the user
    }
  };

  const handleSubmitSelected = () => {
    console.log('Submitting selected code blocks:', selectedCodeBlocks);
    // Implement submission logic as needed
  };

  const handleDeleteSelectedCodeBlocks = async () => {
    setIsLoading(true);
    try {
      // Delete all selected code blocks sequentially
      for (const block of selectedCodeBlocks) {
        await handleDeleteCodeBlock(block.messageId, block.partId);
      }

      // After all deletions, fetch the updated message history
      await fetchMessageHistory();

      // Clear the selected code blocks
      setSelectedCodeBlocks([]);
    } catch (error) {
      console.error('Error deleting selected code blocks:', error);
      // Optionally, display an error message to the user
    } finally {
      setIsLoading(false);
    }
  };

  interface CodeBlockWithCopyProps {
    id: string;
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
    };

    const handleSelectCode = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onSelect();
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
  };

  interface ExtensionHandleProps {
    onExtend: (newWidthPercentage: number) => void;
    isDarkMode: boolean;
    showResetButton: boolean;
    onReset: () => void;
    selectedCount: number;
    onSubmit: () => void;
    onDeleteSelected: () => void;
  }

  const ExtensionHandle: React.FC<ExtensionHandleProps> = ({
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

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setStartX(e.clientX);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && startX !== null) {
        const deltaX = e.clientX - startX;
        const deltaPercentage = (deltaX / window.innerWidth) * 100;
        let newWidthPercentage = currentWidthPercentage + deltaPercentage;
        newWidthPercentage = Math.min(Math.max(newWidthPercentage, 30), 90);
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
  };

  return (
    <Draggable handle=".chat-header" position={position} onDrag={handleDrag} nodeRef={chatRef}>
      <div
        className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'} ${
          showResetButton ? 'show-reset' : ''
        } ${selectedCodeBlocks.length > 0 ? 'has-selection' : ''}`}
        ref={chatRef}
      >
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

        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${
                message.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'
              } ${message.sender === 'ai' && showResetButton ? 'extended' : ''}`}
              style={message.sender === 'ai' ? { maxWidth: `${aiResponseWidth}%` } : {}}
            >
              <div>{renderMessage(message)}</div>
              {message.sender === 'ai' && (
                <div className="chat-message-timestamp">
                  {new Date(message.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
          {isLoading && <div className="chat-loading-indicator">Loading...</div>}
          <div ref={messageEndRef} />
        </div>

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

        <ExtensionHandle
          onExtend={handleExtendAIResponse}
          isDarkMode={isDarkMode}
          showResetButton={showResetButton}
          onReset={resetAIResponseWidth}
          selectedCount={selectedCodeBlocks.length}
          onSubmit={handleSubmitSelected}
          onDeleteSelected={handleDeleteSelectedCodeBlocks}
        />
      </div>
    </Draggable>
  );
};

export default ChatInterface;
