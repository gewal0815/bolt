// frontend/src/components/agentInterface/ChatInterface.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import Switch from '@mui/material/Switch';
import ChatInput from '~/components/agentInterface/ChatInput';
import MessageItem from '~/components/agentInterface/MessageItem';
import ExtensionHandle from '~/components/agentInterface/ExtensionHandle';
import LoadingIndicator from '~/components/agentInterface/LoadingIndicator';


// Define and export the stages of loading
export type LoadingStage = 'idle' | 'thinking' | 'preparing';

// Export interfaces
export interface Part {
  type: 'text' | 'code';
  id: string;
  content: string;
  language?: string;
  messageId: string;
}

export interface Message {
  id: string; // Changed to string to accommodate temporary UUIDs
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  parts: Part[];
}

export interface SelectedCodeBlock {
  messageId: string;
  partId: string;
  code: string;
}

interface ChatInterfaceProps {
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [aiResponseWidth, setAiResponseWidth] = useState<number>(60);
  const originalWidth = 60;
  const [showResetButton, setShowResetButton] = useState<boolean>(false);
  const [selectedCodeBlocks, setSelectedCodeBlocks] = useState<SelectedCodeBlock[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isStreamMode, setIsStreamMode] = useState<boolean>(true); // Toggle for Stream Mode
  const abortControllerRef = useRef<AbortController | null>(null); // Reference to AbortController
  const isStoppedRef = useRef<boolean>(false); // Ref to indicate if the process is stopped

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

  /**
   * Parses message text into parts, distinguishing between text and code blocks.
   */
  const parseMessageText = useCallback((text: string, messageId: string): Part[] => {
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
  }, []);

  /**
   * Fetches the message history from the backend.
   */
  const fetchMessageHistory = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages?time_period=1 month`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
      });

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
  }, [sessionId, parseMessageText]);

  useEffect(() => {
    fetchMessageHistory();
  }, [sessionId, fetchMessageHistory]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Simulates streaming by revealing the AI response one chunk at a time during 'preparing' phase.
   * @param messageId The ID of the AI message to update.
   * @param fullText (Optional) The full AI response text for non-streaming scenarios.
   */
  const simulateStreamingSimultaneous = useCallback(
    async (messageId: string, fullText?: string) => {
      const text = fullText || messages.find((msg) => msg.id === messageId)?.text || '';
      const chunkSize = 15; // Number of characters per interval

      for (let i = 0; i < text.length && !isStoppedRef.current; i += chunkSize) {
        // Determine the end index for the current chunk
        const end = Math.min(i + chunkSize, text.length);
        const currentText = text.substring(0, end);
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
        // Adjust delay as needed for a faster streaming effect
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    },
    [messages, parseMessageText]
  );

  /**
   * Refactored getAIResponse function to handle streaming and simulated streaming.
   */
  const getAIResponse = useCallback(
    async (chatInput: string) => {
      // Set loading stage to 'thinking' when AI response starts
      setLoadingStage('thinking');

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
          signal: abortControllerRef.current?.signal, // Attach the signal for aborting
        });

        if (!response.ok) throw new Error(`AI Webhook error: ${response.statusText}`);

        const contentType = response.headers.get('Content-Type') || '';
        const isStream = response.body && response.headers.get('Transfer-Encoding') === 'chunked';

        if (isStream && response.body) {
          // Handle streaming response
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let done = false;

          while (!done && !isStoppedRef.current) {
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

          if (!isStoppedRef.current) {
            // Set loading stage to 'preparing' after streaming completes
            setLoadingStage('preparing');

            // Start streaming simulation during 'preparing' phase
            await simulateStreamingSimultaneous(tempAiMessageId);

            // After preparing phase, set to 'idle'
            setLoadingStage('idle');
            setIsLoading(false);
          }
        } else {
          // If streaming is not supported or 'No Stream' mode is active
          const data: any = await response.json();
          const aiFullText = data.output || 'No response from AI.';

          if (!isStreamMode) {
            // In 'No Stream' mode, display the full response instantly
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === tempAiMessageId
                  ? {
                      ...msg,
                      text: aiFullText,
                      parts: parseMessageText(aiFullText, msg.id),
                    }
                  : msg
              )
            );

            // Set loading stage to 'preparing' and simulate delay
            setLoadingStage('preparing');
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // After preparing phase, set to 'idle'
            setLoadingStage('idle');
            setIsLoading(false);
          } else {
            // In 'Stream' mode without actual streaming, simulate streaming during 'preparing' phase
            setLoadingStage('preparing');
            await simulateStreamingSimultaneous(tempAiMessageId, aiFullText);

            // After preparing phase, set to 'idle'
            setLoadingStage('idle');
            setIsLoading(false);
          }
        }
      } catch (error) {
        if ((error as any).name === 'AbortError') {
          console.log('AI response fetching aborted.');
          // Remove the temporary AI message if aborted
          setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== tempAiMessageId));
        } else {
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
        }

        // Set loading stage to 'idle' in case of error
        setLoadingStage('idle');
        setIsLoading(false);
        return;
      }

      if (!isStoppedRef.current && loadingStage !== 'idle') {
        // Ensure that loadingStage is set to 'idle' only if not stopped
        setLoadingStage('idle');
        setIsLoading(false);
      }
    },
    [isStreamMode, sessionId, simulateStreamingSimultaneous, parseMessageText]
  );

  /**
   * Handles sending of user messages.
   */
  const handleSend = useCallback(
    async (inputValue: string) => {
      if (!inputValue.trim()) return;

      setIsLoading(true);
      setLoadingStage('thinking'); // Start with 'thinking' phase
      isStoppedRef.current = false; // Reset the stopped flag
      abortControllerRef.current = new AbortController(); // Initialize AbortController

      try {
        const response = await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Session-ID': sessionId,
          },
          body: JSON.stringify({ text: inputValue }),
          signal: abortControllerRef.current.signal, // Attach the signal for aborting
        });

        if (!response.ok) throw new Error(`Message send error: ${response.statusText}`);

        const data: any = await response.json();

        const userMessage: Message = {
          id: String(data.messageId), // Ensure ID is a string
          sender: 'user',
          text: inputValue,
          timestamp: new Date().toISOString(),
          parts: parseMessageText(inputValue, String(data.messageId)),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Fetch AI response
        await getAIResponse(inputValue);
      } catch (error) {
        if ((error as any).name === 'AbortError') {
          console.log('Message sending aborted.');
        } else {
          console.error('Error sending message:', error);
          // Optionally, display an error message to the user
        }
        setLoadingStage('idle');
        setIsLoading(false);
      }
    },
    [sessionId, getAIResponse, parseMessageText]
  );

  /**
   * Handles stopping the ongoing AI response fetching or streaming.
   */
  const handleStop = useCallback(() => {
    isStoppedRef.current = true; // Set the stopped flag to true
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the fetch request
    }
    setLoadingStage('idle');
    setIsLoading(false);
  }, []);

  /**
   * Toggles dark mode.
   */
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  /**
   * Handles dragging of the chat interface.
   */
  const handleDrag = useCallback((e: DraggableEvent, data: DraggableData) => {
    const newPosition = { x: data.x, y: data.y };
    setPosition(newPosition);
    localStorage.setItem('chatPosition', JSON.stringify(newPosition));
  }, []);

  /**
   * Extends the AI response area width.
   */
  const handleExtendAIResponse = useCallback((newWidthPercentage: number) => {
    setAiResponseWidth(newWidthPercentage);
    setShowResetButton(true);
  }, []);

  /**
   * Resets the AI response area width to its original value.
   */
  const resetAIResponseWidth = useCallback(() => {
    setAiResponseWidth(originalWidth);
    setShowResetButton(false);
  }, [originalWidth]);

  /**
   * Toggles the selection of a code block.
   */
  const toggleCodeBlockSelection = useCallback((selectedBlock: SelectedCodeBlock) => {
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
  }, []);

  /**
   * Handles deletion of individual code blocks.
   */
  const handleDeleteCodeBlock = useCallback(
    async (messageId: string, partId: string) => {
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
          const errorData: any = await response.json();
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
    },
    [messages, fetchMessageHistory, sessionId]
  );

  /**
   * Handles submission of selected code blocks.
   */
  const handleSubmitSelected = useCallback(() => {
    console.log('Submitting selected code blocks:', selectedCodeBlocks);
    // Implement submission logic as needed
  }, [selectedCodeBlocks]);

  /**
   * Handles deletion of all selected code blocks.
   */
  const handleDeleteSelectedCodeBlocks = useCallback(async () => {
    setIsLoading(true);
    setLoadingStage('preparing'); // Start 'preparing' phase for deletion
    isStoppedRef.current = false; // Reset the stopped flag
    abortControllerRef.current = new AbortController(); // Initialize AbortController

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
      setLoadingStage('idle');
      setIsLoading(false);
    }
  }, [selectedCodeBlocks, handleDeleteCodeBlock, fetchMessageHistory]);

  /**
   * Renders the loading indicator based on the current loading stage.
   */
  const renderLoadingIndicator = useCallback(() => {
    if (loadingStage === 'idle') return null;
    return <LoadingIndicator stage={loadingStage} />;
  }, [loadingStage]);

  return (
    <Draggable handle=".chat-header" position={position} onDrag={handleDrag} nodeRef={chatRef}>
      <div
        className={`chat-interface ${isDarkMode ? 'dark-mode' : 'light-mode'} ${
          showResetButton ? 'show-reset' : ''
        } ${selectedCodeBlocks.length > 0 ? 'has-selection' : ''}`}
        ref={chatRef}
      >
        <div className="chat-header">
          <div className="chat-header-left">
            <span>Stream Mode</span>
            <Switch checked={isStreamMode} onChange={() => setIsStreamMode((prev) => !prev)} />
          </div>
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
            <MessageItem
              key={message.id}
              message={message}
              isDarkMode={isDarkMode}
              aiResponseWidth={aiResponseWidth}
              showResetButton={showResetButton}
              selectedCodeBlocks={selectedCodeBlocks}
              toggleCodeBlockSelection={toggleCodeBlockSelection}
              handleDeleteCodeBlock={handleDeleteCodeBlock}
            />
          ))}
          {isLoading && renderLoadingIndicator()}
          <div ref={messageEndRef} />
        </div>

        <ChatInput onSend={handleSend} onStop={handleStop} isLoading={isLoading} />

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
