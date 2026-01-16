/**
 * TypingAnimation Component - Usage Examples
 * 
 * This component provides a typewriter effect for text.
 * No external dependencies required - works with plain React!
 */

import React from 'react';
import TypingAnimation from './TypingAnimation';
import { Typography, Box } from '@mui/material';

// Example 1: Basic Usage
export function BasicExample() {
    return (
        <TypingAnimation text="Welcome to Luna - Your Reflective AI Wellness Companion" />
    );
}

// Example 2: With Custom Speed
export function CustomSpeedExample() {
    return (
        <TypingAnimation
            text="This types faster!"
            duration={30}  // 30ms per character (faster)
        />
    );
}

// Example 3: With MUI Typography
export function MUIExample() {
    return (
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
            <TypingAnimation
                text="Welcome to Luna"
                duration={50}
            />
            <Box component="span" sx={{ fontWeight: 400 }}>
                {" - Your Reflective AI Wellness Companion"}
            </Box>
        </Typography>
    );
}

// Example 4: With Callback
export function CallbackExample() {
    const handleComplete = () => {
        console.log('Typing animation completed!');
    };

    return (
        <TypingAnimation
            text="This will trigger a callback when done"
            onComplete={handleComplete}
        />
    );
}

// Example 5: With Custom Styling
export function StyledExample() {
    return (
        <TypingAnimation
            text="Styled typing animation"
            style={{
                color: '#2b1a11',
                fontSize: '2rem',
                fontWeight: 600,
            }}
        />
    );
}

/**
 * HOW TO USE IN ChatScreenMui.jsx:
 * 
 * 1. Import the component:
 *    import TypingAnimation from './components/TypingAnimation';
 * 
 * 2. Replace the welcome text (around line 1531):
 * 
 *    <Typography variant="h4" ...>
 *        <TypingAnimation text="Welcome to Luna" duration={50} />
 *        <Box component="span" sx={{ fontWeight: 400 }}>
 *             - Your Reflective AI Wellness Companion
 *        </Box>
 *    </Typography>
 * 
 * Props:
 * - text: string (required) - The text to animate
 * - duration: number (default: 50) - Milliseconds per character
 * - onComplete: function - Callback when animation finishes
 * - className: string - CSS class name
 * - style: object - Inline styles
 */
