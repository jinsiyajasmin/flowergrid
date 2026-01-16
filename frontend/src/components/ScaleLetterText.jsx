import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

export default function ScaleLetterText({ text, delay = 0, style = {} }) {
    const letters = text.split("");

    const container = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.03,
                delayChildren: delay,
                stiffness: 200
            }
        }
    };

    const child = {
        hidden: {
            opacity: 0,
            transform: "scale(0.5)",
            filter: "blur(5px)"
        },
        visible: {
            opacity: 1,
            transform: "scale(1)",
            filter: "blur(0px)",
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 200
            }
        }
    };

    return (
        <motion.div
            style={{ display: "inline-flex", ...style }}
            variants={container}
            initial="hidden"
            animate="visible"
        >
            {letters.map((letter, index) => (
                <motion.span
                    variants={child}
                    key={index}
                    style={{
                        display: "inline-block",
                        whiteSpace: "pre"
                    }}
                >
                    {letter}
                </motion.span>
            ))}
        </motion.div>
    );
}
