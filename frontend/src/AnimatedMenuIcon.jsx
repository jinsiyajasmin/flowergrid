import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Menu Icon with Framer Motion
 * Transforms from hamburger menu to X with sophisticated rotating X animation
 * The X lines rotate 90 degrees when appearing
 */

export default function AnimatedMenuIcon({
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    isOpen = false,
    onClick,
    ...props
}) {
    // Hamburger to X transformation variants
    const line1Variants = {
        closed: {
            rotate: 0,
            x: 0,
            y: 0,
            opacity: 1,
        },
        open: {
            rotate: -45,
            x: -2.35,
            y: 0.35,
            opacity: 1,
            transformOrigin: 'top right',
        },
    };

    const line2Variants = {
        closed: {
            opacity: 1,
        },
        open: {
            opacity: 0,
        },
    };

    const line3Variants = {
        closed: {
            rotate: 0,
            x: 0,
            y: 0,
            opacity: 1,
        },
        open: {
            rotate: 45,
            x: -2.35,
            y: -0.35,
            opacity: 1,
            transformOrigin: 'bottom right',
        },
    };

    // Additional rotation for the X when it's formed
    const xRotationVariants = {
        closed: {
            rotate: 0,
        },
        open: {
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
            onClick={onClick}
            style={{ cursor: 'pointer' }}
            {...props}
        >
            {/* Wrapper group that rotates the entire X */}
            <motion.g
                variants={xRotationVariants}
                initial="closed"
                animate={isOpen ? 'open' : 'closed'}
                transition={{
                    ease: 'easeInOut',
                    duration: 0.4,
                    delay: isOpen ? 0.2 : 0, // Rotate after X is formed
                }}
            >
                {/* Top line of hamburger -> top line of X */}
                <motion.line
                    x1={4}
                    y1={6}
                    x2={20}
                    y2={6}
                    variants={line1Variants}
                    initial="closed"
                    animate={isOpen ? 'open' : 'closed'}
                    transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                    }}
                />

                {/* Middle line of hamburger -> fades out */}
                <motion.line
                    x1={4}
                    y1={12}
                    x2={20}
                    y2={12}
                    variants={line2Variants}
                    initial="closed"
                    animate={isOpen ? 'open' : 'closed'}
                    transition={{
                        ease: 'easeInOut',
                        duration: 0.2,
                    }}
                />

                {/* Bottom line of hamburger -> bottom line of X */}
                <motion.line
                    x1={4}
                    y1={18}
                    x2={20}
                    y2={18}
                    variants={line3Variants}
                    initial="closed"
                    animate={isOpen ? 'open' : 'closed'}
                    transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                    }}
                />
            </motion.g>
        </motion.svg>
    );
}

// Export with multiple names for flexibility
export { AnimatedMenuIcon as Menu, AnimatedMenuIcon as MenuIcon };
