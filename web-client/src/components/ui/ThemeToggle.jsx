import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * ThemeToggle Button Component
 * A reusable button to toggle between light and dark modes
 */
const ThemeToggle = ({
    className = '',
    size = 'md',
    showLabel = false
}) => {
    const { isDarkMode, toggleTheme } = useTheme();

    const sizeClasses = {
        sm: 'p-1.5',
        md: 'p-2',
        lg: 'p-3'
    };

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 22
    };

    return (
        <button
            onClick={toggleTheme}
            className={`
                inline-flex items-center gap-2 rounded-lg transition-all duration-200
                ${sizeClasses[size]}
                ${isDarkMode
                    ? 'bg-slate-700 hover:bg-slate-600 text-yellow-400'
                    : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
                }
                ${className}
            `}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
            {isDarkMode ? (
                <Sun size={iconSizes[size]} />
            ) : (
                <Moon size={iconSizes[size]} />
            )}
            {showLabel && (
                <span className="text-sm font-medium">
                    {isDarkMode ? 'Light' : 'Dark'}
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;
