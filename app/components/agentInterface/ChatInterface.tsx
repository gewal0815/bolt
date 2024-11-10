// ChatInterface.tsx
import React, { useState, useEffect, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import Switch from '@mui/material/Switch';

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

  // Position state for Draggable
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });


  // Calculate initial position based on actual element size and viewport
  useEffect(() => {
    const calculateInitialPosition = () => {
      if (chatRef.current) {
        const chatWidth = chatRef.current.offsetWidth;
        const chatHeight = chatRef.current.offsetHeight;
        const initialX = (window.innerWidth - chatWidth) / 2;
        const initialY = (window.innerHeight - chatHeight) / 2;
        return { x: initialX, y: initialY };
      }
      return { x: 0, y: 0 };
    };

    // Delay calculation to ensure the element is rendered and dimensions are available
    const timer = setTimeout(() => {
      const initialPosition = calculateInitialPosition();
      setPosition(initialPosition);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Scroll to the latest message whenever messages update
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
      const response = await fetch(
        'http://localhost:5678/webhook-test/9ba11544-5c4e-4f91-818a-08a4ecb596c5',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { sessionId: sessionId, chatInput: chatInput } }),
        }
      );
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

  // Handle drag to update position state
  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    setPosition({ x: data.x, y: data.y });
  };

  return (
    <Draggable
      handle=".chat-header"
      position={position}
      onDrag={handleDrag}
      nodeRef={chatRef}
    >
      <div
        className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        ref={chatRef} // Attach ref to the chat interface
      >
        <div className="chat-header">
          <h1 className="chat-title">Chat Interface</h1>
          <div className="chat-header-controls">
            <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            <Switch checked={isDarkMode} onChange={toggleDarkMode} />
            <button onClick={onClose} className="chat-close-button">
              &times;
            </button>
          </div>
        </div>
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${
                message.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'
              }`}
            >
              <div className="chat-message-text">{message.text}</div>
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
