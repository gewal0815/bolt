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

interface Message {
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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

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

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const savedPosition = localStorage.getItem('chatPosition');
    return savedPosition ? JSON.parse(savedPosition) : { x: 0, y: 0 };
  });

  useEffect(() => {
    if (!localStorage.getItem('chatPosition')) {
      const initialX = (window.innerWidth - 400) / 2; // Approximate center
      const initialY = (window.innerHeight - 600) / 2;
      setPosition({ x: initialX, y: initialY });
    }
  }, []);

  useEffect(() => {
    // Fetch message history on component mount
    const fetchMessageHistory = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/messages?session_id=${sessionId}&time_period=1 month`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

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
      const response = await fetch('http://localhost:5678/webhook/e4498659-6af2-480b-9578-0382d998f73a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { sessionId: sessionId, chatInput: chatInput } }),
      });
      if (!response.ok) throw new Error(`AI Webhook error: ${response.statusText}`);

      const data = await response.json();
      const aiMessage: Message = {
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

  const renderMessage = (message: Message) => {
    console.log('Rendering Message:', message);

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
      <div className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'}`} ref={chatRef}>
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
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${message.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'}`}
            >
              <div>{renderMessage(message)}</div>
              <div className="chat-message-timestamp">{new Date(message.timestamp).toLocaleString()}</div>
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

  const handleCopyCode = () => {
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
      <Tooltip title={copySuccess ? 'Copied!' : 'Copy'} placement="top" arrow>
        <button
          onClick={handleCopyCode}
          className="copy-code-button"
          aria-label="Copy code"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: isDarkMode ? '#fff' : '#000',
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </button>
      </Tooltip>
    </div>
  );
};

export default ChatInterface;
