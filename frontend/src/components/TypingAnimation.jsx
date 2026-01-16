import React, { useState, useEffect } from 'react';

/**
 * TypingAnimation Component (MagicUI-style)
 * Mimics the MagicUI typing animation without requiring Tailwind CSS
 * 
 * Usage: <TypingAnimation>Your text here</TypingAnimation>
 */
export default function TypingAnimation({
    children,
    duration = 200,
    className = '',
    style = {},
    ...props
}) {
    const text = typeof children === 'string' ? children : '';
    const [displayedText, setDisplayedText] = useState('');
    const [i, setI] = useState(0);

    useEffect(() => {
        const typingEffect = setInterval(() => {
            if (i < text.length) {
                setDisplayedText(text.substring(0, i + 1));
                setI(i + 1);
            } else {
                clearInterval(typingEffect);
            }
        }, duration);

        return () => {
            clearInterval(typingEffect);
        };
    }, [duration, i, text]);

    return (
        <span className={className} style={style} {...props}>
            {displayedText || ''}
        </span>
    );
}

export { TypingAnimation };
