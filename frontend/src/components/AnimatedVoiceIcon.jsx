import React from "react";
import { Box } from "@mui/material";

/**
 * Voice button icon:
 * - idleMode "dots" → three dots while waiting for speech (End button)
 * - idleMode "wave" → static equalizer bars (default mic button)
 * - active → animated wave bars while user is speaking
 */
export default function AnimatedVoiceIcon({
  active = false,
  idleMode = "wave",
  color = "#ffffff",
  size = 20,
}) {
  const barHeights = [0.5, 0.78, 1, 0.78, 0.5];

  if (!active && idleMode === "dots") {
    return (
      <Box
        component="span"
        aria-hidden
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          width: size,
          height: size,
          minWidth: size,
          "@keyframes dotPulse": {
            "0%, 100%": { opacity: 0.35, transform: "scale(0.85)" },
            "50%": { opacity: 1, transform: "scale(1)" },
          },
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              bgcolor: color,
              flexShrink: 0,
              animation: "dotPulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.22}s`,
            }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        width: size,
        height: size,
        minWidth: size,
        "@keyframes voiceEqBar": {
          "0%, 100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(1)" },
        },
      }}
    >
      {barHeights.map((scale, i) => (
        <Box
          key={i}
          sx={{
            width: 2.5,
            height: Math.round(4 + scale * 12),
            borderRadius: "2px",
            bgcolor: color,
            flexShrink: 0,
            transformOrigin: "center center",
            ...(active
              ? {
                  animation: "voiceEqBar 0.9s ease-in-out infinite",
                  animationDelay: `${i * 0.11}s`,
                }
              : {}),
          }}
        />
      ))}
    </Box>
  );
}
