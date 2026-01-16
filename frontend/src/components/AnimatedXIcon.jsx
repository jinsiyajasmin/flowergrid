import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Animated X/Close Icon with Framer Motion
 * Rotates 90 degrees on hover with smooth animation
 */
export default function AnimatedXIcon({
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    onClick,
    ...props
}) {
    const [isHovered, setIsHovered] = useState(false);

    // Line variants for rotation animation
    const line1Variants = {
        initial: {
            rotate: 0,
        },
        hover: {
            rotate: 90,
        },
    };

    const line2Variants = {
        initial: {
            rotate: 0,
        },
        hover: {
            rotate: 90,
        },
    };

    return (
        <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
            {...props}
        >
            <motion.line
                x1={6}
                y1={18}
                x2={18}
                y2={6}
                variants={line1Variants}
                initial="initial"
                animate={isHovered ? 'hover' : 'initial'}
                transition={{
                    ease: 'easeInOut',
                    duration: 0.4,
                }}
            />
            <motion.line
                x1={6}
                y1={6}
                x2={18}
                y2={18}
                variants={line2Variants}
                initial="initial"
                animate={isHovered ? 'hover' : 'initial'}
                transition={{
                    ease: 'easeInOut',
                    duration: 0.4,
                    delay: 0.1,
                }}
            />
        </motion.svg>
    );
}

export { AnimatedXIcon as XIcon, AnimatedXIcon as CloseIcon };
