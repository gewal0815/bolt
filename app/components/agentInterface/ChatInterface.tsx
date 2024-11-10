// ChatInterface.tsx

import React, { useState, useEffect, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import Switch from '@mui/material/Switch';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Dark theme for code blocks
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Light theme for code blocks

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
  const [sessionId] = useState<string>(() => uuidv4());
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
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      sender: 'user',
      text: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    getAIResponse(inputValue);
  };

  const getAIResponse = async (chatInput: string) => {
    try {
      const response = await fetch('http://localhost:5678/webhook-test/c10ee4b0-da83-493c-99ad-fa81e7a0b4b7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { sessionId: sessionId, chatInput: chatInput } }),
      });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      const aiMessage: Message = {
        sender: 'ai',
        text: data.output || 'No response from AI.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Error processing your request.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    const codeRegex = /```([\s\S]+?)```/g;
    const parts = message.text.split(codeRegex);

    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <SyntaxHighlighter
          key={index}
          language="javascript" // Adjust the language as needed or detect it dynamically if possible
          style={isDarkMode ? darcula : materialLight}
          wrapLongLines
          customStyle={{
            borderRadius: '8px',
            padding: '10px',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#2e3440' : '#f5f5f5',
          }}
        >
          {part}
        </SyntaxHighlighter>
      ) : (
        <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
          {part}
        </span>
      )
    );
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
              <div className="chat-message-timestamp">{message.timestamp}</div>
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

export default ChatInterface;
