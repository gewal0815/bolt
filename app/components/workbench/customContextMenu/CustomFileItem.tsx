import React from 'react';

interface CustomFileItemProps {
  file: string;
  onContextMenu?: (e: React.MouseEvent, file: string) => void; // Optional context menu handler
  onClick?: () => void; // Optional click handler
  selected?: boolean;
  unsavedChanges?: boolean;
  name: string; // File name for display
  style?: React.CSSProperties; // Optional custom styling (added to adjust alignment)
}

export const CustomFileItem: React.FC<CustomFileItemProps> = ({
  file, // Full path for context menu
  name, // The name of the file for display
  onContextMenu,
  onClick,
  selected = false,
  unsavedChanges = false,
  style, // Custom styling prop for alignment
}) => {
  return (
    <div
      onClick={onClick} // Trigger onClick if it's provided
      onContextMenu={(e) => onContextMenu?.(e, file)} // Full path passed here for context menu
      className={`file-item cursor-pointer p-2 hover:bg-gray-100 ${selected ? 'bg-blue-200' : ''}`}
      style={{ ...style, paddingLeft: '100px' }} // Add padding or margin for alignment, override if provided
    >
      <div className="flex items-center">
        <span className="truncate">{name}</span> {/* Display only the file name */}
        {unsavedChanges && <span className="ml-2 text-orange-500">*</span>}
      </div>
    </div>
  );
};

export default CustomFileItem;
