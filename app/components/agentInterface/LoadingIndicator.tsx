// frontend/src/components/agentInterface/LoadingIndicator.tsx

import React from 'react';
//import './LoadingIndicator.css'; // Ensure you create this CSS file

interface LoadingIndicatorProps {
  stage: 'thinking' | 'preparing';
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = React.memo(({ stage }) => {
  return (
    <div className={`loading-indicator ${stage === 'preparing' ? 'preparing' : ''}`}>
      <span>{stage === 'preparing' ? 'Preparing response...' : 'Thinking'}</span>
      <div className="loading-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
});

export default LoadingIndicator;
