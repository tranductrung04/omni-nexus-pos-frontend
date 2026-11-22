import React from 'react';

interface MaterialIconProps {
  name: string;
  filled?: boolean;
  className?: string;
}

export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  filled = false,
  className = '',
}) => {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
};
