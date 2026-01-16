import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import flowerLogo from '../../assets/flowergrid_logo_v2.jpg';

const ACCENT_DARK = "#5B3F2A"; // Matches the app's accent color

export default function SplashScreen({ onComplete }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Show for 2.5 seconds total
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) {
                // Wait for exit animation to finish before calling onComplete
                setTimeout(onComplete, 500);
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #F7EEDB 0%, #F3E5CB 100%)', // Creamy gradient to match app
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 24,
                        }}
                    >
                        {/* Static Flowergrid Logo */}
                        <motion.img
                            src={flowerLogo}
                            alt="Flowergrid Logo"
                            animate={{ scale: [0.9, 1, 0.9] }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            style={{
                                width: 180,
                                height: 'auto',
                                objectFit: 'contain',
                                borderRadius: 20,
                            }}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
