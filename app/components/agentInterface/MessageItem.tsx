// frontend/src/components/agentInterface/MessageItem.tsx

import React from 'react';
import type { Message, SelectedCodeBlock, Part } from './ChatInterface'; // Adjust the path if necessary
import CodeBlockWithCopy from './CodeBlockWithCopy';

interface MessageItemProps {
  message: Message;
  isDarkMode: boolean;
  aiResponseWidth: number;
  showResetButton: boolean;
  selectedCodeBlocks: SelectedCodeBlock[];
  toggleCodeBlockSelection: (block: SelectedCodeBlock) => void;
  handleDeleteCodeBlock: (messageId: string, partId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(
  ({
    message,
    isDarkMode,
    aiResponseWidth,
    showResetButton,
    selectedCodeBlocks,
    toggleCodeBlockSelection,
    handleDeleteCodeBlock,
  }) => {
    const renderMessageContent = () => {
      if (!message.parts || !message.sender) {
        return <span style={{ color: 'red' }}>Invalid message data.</span>;
      }

      return message.parts.map((part: Part) => { // Explicitly typing 'part' as 'Part'
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

    return (
      <div
        className={`chat-message ${
          message.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'
        } ${message.sender === 'ai' && showResetButton ? 'extended' : ''}`}
        style={message.sender === 'ai' ? { maxWidth: `${aiResponseWidth}%` } : {}}
      >
        <div>{renderMessageContent()}</div>
        {message.sender === 'ai' && (
          <div className="chat-message-timestamp">
            {new Date(message.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    );
  }
);

export default MessageItem;
