import React, { useState } from 'react';
import { Box } from '@mui/material';

/**
 * AnimateIcon - A wrapper component that adds smooth animations to any icon
 * Usage:
 *   <AnimateIcon animateOnHover>
 *     <YourIcon />
 *   </AnimateIcon>
 */
export default function AnimateIcon({
    children,
    animateOnHover = false,
    animationType = 'rotate-scale', // 'rotate-scale', 'scale', 'bounce', 'pulse'
    sx = {},
    ...props
}) {
    const [isHovered, setIsHovered] = useState(false);

    const getAnimationStyle = () => {
        if (!animateOnHover || !isHovered) {
            return {
                transform: 'rotate(0deg) scale(1)',
            };
        }

        switch (animationType) {
            case 'rotate-scale':
                return {
                    transform: 'rotate(90deg) scale(1.15)',
                };
            case 'scale':
                return {
                    transform: 'scale(1.2)',
                };
            case 'bounce':
                return {
                    transform: 'translateY(-4px) scale(1.1)',
                };
            case 'pulse':
                return {
                    transform: 'scale(1.15)',
                    filter: 'brightness(1.2)',
                };
            default:
                return {
                    transform: 'rotate(90deg) scale(1.15)',
                };
        }
    };

    return (
        <Box
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...getAnimationStyle(),
                '&:active': {
                    transform: 'scale(0.95)',
                },
                ...sx
            }}
            {...props}
        >
            {children}
        </Box>
    );
}
