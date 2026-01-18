import React, { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { gsap } from "gsap";
import flowerLogo from "../../assets/flower.png";
import flowergridLogo from "../../assets/flowergrid_logo.png";

const LandingIntro = ({ onComplete }) => {
    const containerRef = useRef(null);
    const flowerRef = useRef(null);
    const logoRef = useRef(null);
    const quoteRef = useRef(null);

    useEffect(() => {
        if (!flowerRef.current || !logoRef.current || !quoteRef.current) return;

        const tl = gsap.timeline();

        // 1. Flower icon fades in and scales
        tl.fromTo(flowerRef.current,
            { opacity: 0, scale: 0.8 },
            { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }
        );

        // 2. FlowerGrid logo fades in
        tl.fromTo(logoRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
            "-=0.4"
        );

        // 3. Wait 2 seconds
        tl.to({}, { duration: 2 });

        // 4. Fade out flower and logo
        tl.to([flowerRef.current, logoRef.current], {
            opacity: 0,
            y: -30,
            duration: 0.6,
            ease: "power2.in"
        });

        // 5. Quote slides up from below
        tl.fromTo(quoteRef.current,
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 1, ease: "power2.out" },
            "-=0.2"
        );

        // 6. Wait 2 seconds
        tl.to({}, { duration: 2 });

        // 7. Fade out everything and transition to chat
        tl.to(containerRef.current, {
            opacity: 0,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                if (onComplete) onComplete();
            }
        });

        return () => {
            tl.kill();
        };
    }, [onComplete]);

    return (
        <Box
            ref={containerRef}
            sx={{
                width: "100%",
                height: "100vh",
                bgcolor: "#F9F3EA",
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                px: 2
            }}
        >
            {/* Flower Icon */}
            <Box
                ref={flowerRef}
                component="img"
                src={flowerLogo}
                alt="Flower Icon"
                sx={{
                    width: { xs: 80, md: 120 },
                    opacity: 0,
                    mb: 2
                }}
            />

            {/* FlowerGrid Logo */}
            <Box
                ref={logoRef}
                component="img"
                src={flowergridLogo}
                alt="FlowerGrid Logo"
                sx={{
                    width: { xs: 200, sm: 280, md: 350 },
                    maxWidth: '90%',
                    opacity: 0
                }}
            />

            {/* Quote Text - Initially hidden */}
            <Typography
                ref={quoteRef}
                sx={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2.5rem' },
                    color: '#5b3f2a',
                    textAlign: 'center',
                    fontWeight: 300,
                    px: { xs: 3, sm: 4 },
                    maxWidth: 800,
                    opacity: 0,
                    position: 'absolute'
                }}
            >
                Your calm space to pause, reflect, and reconnect.
            </Typography>
        </Box>
    );
};

export default LandingIntro;
