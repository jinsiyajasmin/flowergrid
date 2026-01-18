import * as React from 'react';
import { motion, useAnimation } from 'framer-motion';

const animations = {
    default: {
        rect1: {
            initial: {
                height: 9,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
            animate: {
                height: 5,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
        },
        rect2: {
            initial: {
                height: 5,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
            animate: {
                height: 9,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
        },
        rect3: {
            initial: {
                height: 9,
                y: 0,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
            animate: {
                height: 5,
                y: 4,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
        },
        rect4: {
            initial: {
                height: 5,
                y: 0,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
            animate: {
                height: 9,
                y: -4,
                transition: { duration: 0.3, ease: 'easeInOut' },
            },
        },
    }
};

const IconComponent = ({ size = 24, color = "currentColor", ...props }) => {
    const controls = useAnimation();
    const variants = animations.default;

    return (
        <div
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onMouseEnter={() => controls.start('animate')}
            onMouseLeave={() => controls.start('initial')}
            {...props}
        >
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <motion.rect
                    width={7}
                    height={9}
                    x={3}
                    y={3}
                    rx={1}
                    ry={1}
                    variants={variants.rect1}
                    initial="initial"
                    animate={controls}
                />
                <motion.rect
                    width={7}
                    height={5}
                    x={14}
                    y={3}
                    rx={1}
                    ry={1}
                    variants={variants.rect2}
                    initial="initial"
                    animate={controls}
                />
                <motion.rect
                    width={7}
                    height={9}
                    x={14}
                    y={12}
                    rx={1}
                    ry={1}
                    variants={variants.rect3}
                    initial="initial"
                    animate={controls}
                />
                <motion.rect
                    width={7}
                    height={5}
                    x={3}
                    y={16}
                    rx={1}
                    ry={1}
                    variants={variants.rect4}
                    initial="initial"
                    animate={controls}
                />
            </motion.svg>
        </div>
    );
}

export default IconComponent;
