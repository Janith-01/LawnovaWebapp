import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Theme Context for LAWNOVA Application
 * Manages dark/light mode across the entire application
 * Persists user preference in localStorage
 */

const ThemeContext = createContext(undefined);

// Custom hook to use theme
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

/**
 * ThemeProvider Component
 * Wrap your app with this to enable theme switching
 */
export const ThemeProvider = ({ children }) => {
    // Initialize from localStorage or system preference
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check localStorage first
        const stored = localStorage.getItem('lawnova-theme');
        if (stored) {
            return stored === 'dark';
        }
        // Fall back to system preference
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Update document class and localStorage when theme changes
    useEffect(() => {
        const root = window.document.documentElement;

        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('lawnova-theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('lawnova-theme', 'light');
        }
    }, [isDarkMode]);

    // Listen for system preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e) => {
            // Only auto-switch if user hasn't manually set a preference
            const stored = localStorage.getItem('lawnova-theme');
            if (!stored) {
                setIsDarkMode(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Toggle function
    const toggleTheme = () => {
        setIsDarkMode(prev => !prev);
    };

    // Set specific theme
    const setTheme = (theme) => {
        setIsDarkMode(theme === 'dark');
    };

    const value = {
        isDarkMode,
        toggleTheme,
        setTheme,
        theme: isDarkMode ? 'dark' : 'light'
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
