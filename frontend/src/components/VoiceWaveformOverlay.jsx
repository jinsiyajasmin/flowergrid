import React, { useEffect, useRef } from "react";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";

const BAR_WIDTH = 2.5;
const BAR_GAP = 2;
const BAR_STEP = BAR_WIDTH + BAR_GAP;
const MIN_LEVEL = 0.06;
const MAX_LEVEL = 1;
const SCROLL_SPEED = 1.2; // px per frame — smooth left drift
function safeCloseAudioContext(ctx) {
  if (!ctx) return;
  try {
    if (ctx.state !== "closed") {
      const result = ctx.close();
      if (result?.catch) result.catch(() => {});
    }
  } catch {
    // ignore
  }
}

function readVolume(analyser, freqData, timeData) {
  analyser.getByteFrequencyData(freqData);
  let fSum = 0;
  const fEnd = Math.min(48, freqData.length);
  for (let i = 2; i < fEnd; i++) fSum += freqData[i];
  const freq = fSum / (fEnd - 2) / 255;

  analyser.getByteTimeDomainData(timeData);
  let tSum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const n = (timeData[i] - 128) / 128;
    tSum += n * n;
  }
  const time = Math.sqrt(tSum / timeData.length);

  return Math.min(1, Math.max(freq * 1.8, time * 2.8));
}

function drawWaveform(canvas, levels, scrollPx, maxBarHeight) {
  const parent = canvas.parentElement;
  if (!parent) return;

  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (w <= 0 || h <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const centerY = h / 2;
  const minPx = 3;
  const maxPx = Math.min(maxBarHeight, h - 8);

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const barH = Math.max(minPx, minPx + Math.pow(level, 0.72) * (maxPx - minPx));
    const x = w - (levels.length - i) * BAR_STEP - scrollPx;

    if (x + BAR_WIDTH < 0 || x > w + BAR_STEP) continue;

    const alpha = 0.28 + Math.min(1, level * 1.1) * 0.72;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, centerY - barH / 2, BAR_WIDTH, barH, BAR_WIDTH);
    ctx.fill();
  }
}

/**
 * ChatGPT-style voice waveform: smooth bars, scroll left, react to mic level.
 */
export default function VoiceWaveformOverlay({
  onConfirm,
  onCancel,
  borderRadius = "28px",
  background = "#DBC094",
}) {
  const canvasRef = useRef(null);
  const waveAreaRef = useRef(null);
  const levelsRef = useRef(null);
  const smoothRef = useRef(MIN_LEVEL);
  const scrollPxRef = useRef(0);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const initLevels = (width) => {
      const count = Math.max(32, Math.ceil(width / BAR_STEP) + 4);
      levelsRef.current = new Float32Array(count).fill(MIN_LEVEL);
    };

    const pushLevel = (raw) => {
      smoothRef.current =
        smoothRef.current * 0.55 + Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, raw)) * 0.45;
      const levels = levelsRef.current;
      if (!levels) return;
      levels.copyWithin(0, 1);
      levels[levels.length - 1] = smoothRef.current;
    };

    const render = () => {
      const canvas = canvasRef.current;
      const area = waveAreaRef.current;
      if (canvas && area && levelsRef.current) {
        drawWaveform(canvas, levelsRef.current, scrollPxRef.current, 26);
      }
    };

    const cleanup = () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      safeCloseAudioContext(audioCtxRef.current);
      audioCtxRef.current = null;
    };

    let analyserRef = null;
    let freqDataRef = null;
    let timeDataRef = null;
    let useFallbackRef = false;

    const frame = () => {
      if (cancelled) return;

      if (useFallbackRef) {
        phaseRef.current += 0.22;
        const v =
          MIN_LEVEL + (Math.sin(phaseRef.current) * 0.5 + 0.5) * 0.5;
        smoothRef.current = smoothRef.current * 0.6 + v * 0.4;
      } else if (analyserRef && freqDataRef && timeDataRef) {
        const raw = readVolume(analyserRef, freqDataRef, timeDataRef);
        smoothRef.current =
          smoothRef.current * 0.72 + Math.max(MIN_LEVEL, raw) * 0.28;
      }

      scrollPxRef.current += SCROLL_SPEED;
      while (scrollPxRef.current >= BAR_STEP) {
        scrollPxRef.current -= BAR_STEP;
        pushLevel(smoothRef.current);
      }

      render();
      rafRef.current = requestAnimationFrame(frame);
    };

    const setupMic = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          useFallbackRef = true;
          rafRef.current = requestAnimationFrame(frame);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          stream.getTracks().forEach((t) => t.stop());
          useFallbackRef = true;
          rafRef.current = requestAnimationFrame(frame);
          return;
        }

        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        if (cancelled) {
          cleanup();
          return;
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.78;
        analyser.minDecibels = -85;
        analyser.maxDecibels = -8;
        source.connect(analyser);

        analyserRef = analyser;
        freqDataRef = new Uint8Array(analyser.frequencyBinCount);
        timeDataRef = new Uint8Array(analyser.fftSize);

        rafRef.current = requestAnimationFrame(frame);
      } catch (err) {
        console.error("Voice waveform mic error:", err);
        useFallbackRef = true;
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (waveAreaRef.current) {
        initLevels(waveAreaRef.current.clientWidth);
        render();
      }
    });

    if (waveAreaRef.current) {
      initLevels(waveAreaRef.current.clientWidth);
      resizeObserver.observe(waveAreaRef.current);
    }

    setupMic();

    return () => {
      resizeObserver.disconnect();
      cleanup();
    };
  }, []);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        borderRadius,
        display: "flex",
        alignItems: "center",
        background,
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {/* Waveform canvas area — ChatGPT style */}
      <Box
        ref={waveAreaRef}
        sx={{
          flex: 1,
          height: "100%",
          minWidth: 0,
          position: "relative",
          overflow: "hidden",
          pl: 2,
          pr: 0.5,
          maskImage:
            "linear-gradient(to right, black 0%, black 92%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, black 0%, black 92%, transparent 100%)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
          }}
        />
      </Box>

      {/* Actions — fixed right like ChatGPT */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pr: 0.75,
          pl: 0.25,
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={onCancel}
          size="small"
          aria-label="Cancel recording"
          sx={{
            color: "rgba(80, 57, 32, 0.85)",
            bgcolor: "rgba(255,255,255,0.45)",
            width: 34,
            height: 34,
            "&:hover": { bgcolor: "rgba(255,255,255,0.65)" },
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <IconButton
          onClick={onConfirm}
          size="small"
          aria-label="Confirm recording"
          sx={{
            bgcolor: "rgba(80, 57, 32, 0.7)",
            color: "#fff",
            width: 34,
            height: 34,
            "&:hover": { bgcolor: "rgba(80, 57, 32, 0.9)" },
          }}
        >
          <CheckIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
