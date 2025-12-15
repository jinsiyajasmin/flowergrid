import React, { useEffect, useRef, useState } from "react";
import {
    CssBaseline,
    Typography,
    IconButton,
    Box,
    Container,
    Paper,
    TextField,
    Chip,
} from "@mui/material";
import InteractiveSvgAvatar from "./InteractiveSvgAvatar";

function TypingIndicator({ bg, color }) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: bg,
                color,
                borderRadius: "18px",
                maxWidth: "80%",
            }}
        >
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: color,
                    animation: "dotPulse 1.4s infinite",
                }}
            />
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: color,
                    animation: "dotPulse 1.4s infinite",
                    animationDelay: "0.2s",
                }}
            />
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: color,
                    animation: "dotPulse 1.4s infinite",
                    animationDelay: "0.4s",
                }}
            />
            <style>{`@keyframes dotPulse {0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}`}</style>
        </Box>
    );
}

const SESSION_KEY = "flora_session_id";

function getOrCreateSessionId() {
    try {
        let id = sessionStorage.getItem(SESSION_KEY);
        if (!id) {
            if (window.crypto && window.crypto.randomUUID) {
                id = window.crypto.randomUUID();
            } else {
                id =
                    "sess_" +
                    Math.random().toString(36).slice(2) +
                    Date.now().toString(36);
            }
            sessionStorage.setItem(SESSION_KEY, id);
        }
        return id;
    } catch {
        // Fallback if sessionStorage is blocked
        return "sess_fallback";
    }
}

// ---------------------------------------------------------------------------

export default function ChatScreenMui() {
    const BG_GRADIENT =
        "radial-gradient(circle at 50% 40%, #F7EEDB 0%, #F3E5CB 20%, #E6CFA4 100%)";
    const PAPER_BG = "#f3e6cf";
    const INPUT_BG = "#DBC094";
    const SIDEBAR_BG = "#5b3f2a";
    const ACCENT_DARK = "#2b1a11";
    const ACCENT_LIGHT = "#c9b07a";

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const [conversationMode, setConversationMode] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    // 🔊 Speech recognition state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    const menuItems = [
        { icon: "/chat.svg", label: "Chat with Flora" },
        { icon: "/test.svg", label: "Self Tests" },
        { icon: "/book.svg", label: "Book a Therapist" },
        { icon: "/focus.svg", label: "Focus Zone" },
        { icon: "/care.svg", label: "Self Care" },
        { icon: "/music.svg", label: "Music" },
        { icon: "/community.svg", label: "Community" },
        { icon: "/worksheets.svg", label: "Worksheets" },
    ];

    const API_BASE = "https://api.luna.flowergrid.co.uk";

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("token");
            if (token) {
                localStorage.setItem("auth_token", token);
                const url = new URL(window.location.href);
                url.searchParams.delete("token");
                window.history.replaceState({}, document.title, url.toString());
            }
        } catch (err) {
            console.warn("token read failed", err);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sending, conversationMode]);

    // 🔊 Initialise Web Speech API
    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn("Speech recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-GB"; // British English
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript?.trim();
            if (!transcript) return;

            // Auto send transcript to Flora
            setConversationMode(true);
            setInput("");
            sendToServer(transcript);
        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch {
                // ignore
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function sendToServer(text) {
        if (!text) return;
        setConversationMode(true);
        setMessages((m) => [...m, { id: Date.now(), from: "user", text }]);
        setSending(true);

        const sessionId = getOrCreateSessionId();

        try {
            const resp = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, sessionId }),
            });

            const raw = await resp.text();

            if (!resp.ok) {
                let body;
                try {
                    body = JSON.parse(raw);
                } catch {
                    body = raw || resp.statusText;
                }
                throw new Error(`Server ${resp.status}: ${JSON.stringify(body)}`);
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                data = { answer: raw };
            }

            const reply =
                data?.answer || data?.message || "Sorry, something went wrong.";

            setMessages((m) => [
                ...m,
                { id: Date.now() + 1, from: "bot", text: reply },
            ]);
        } catch (err) {
            console.error("chat error", err);
            setMessages((m) => [
                ...m,
                {
                    id: Date.now() + 1,
                    from: "bot",
                    text: "⚠️ Server error. Try again.",
                },
            ]);
        } finally {
            setSending(false);
        }
    }

    function onSubmit(e) {
        e?.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;
        setConversationMode(true);
        sendToServer(trimmed);
        setInput("");
    }

    function onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
        }
    }

    // 🔊 Mic click handler
    function handleMicClick() {
        const recognition = recognitionRef.current;

        if (!recognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        try {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        } catch (err) {
            console.error("Error starting/stopping speech recognition:", err);
        }
    }

    function goToHome() {
        setMessages([]);
        setConversationMode(false);
        setInput("");
    }

    const quickTopics = [
        "Analyse my personality",
        "Work is stressful",
        "Book a Therapist",
        "Today is great",
        "I am bored",
    ];

    const sidebarWidth = collapsed ? 159 : 270;

    return (
        <Box
            sx={{
                display: "flex",
                minHeight: "100vh",
                height: "100vh",
                background: BG_GRADIENT,
                fontFamily:
                    "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
                overflow: "hidden",
            }}
        >
            <CssBaseline />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>

            {/* SIDEBAR */}
            <Box
                sx={{
                    width: sidebarWidth,
                    bgcolor: SIDEBAR_BG,
                    color: "#664B2E",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    py: 3,
                    px: collapsed ? 1 : 2,
                    gap: 2,
                    transition: "width 250ms ease",
                    position: "fixed",
                    top: 0,
                    left: 0,
                    height: "100vh",
                    zIndex: 1300,
                    boxSizing: "border-box",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                    <img
                        src="/logo.svg"
                        alt="logo"
                        style={{ width: collapsed ? 46 : 46, height: "auto" }}
                    />
                </Box>

                <Box
                    onClick={() => setCollapsed((s) => !s)}
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        mt: 2,
                        mb: 2,
                        background: "#866A4D",
                        border: "1px solid #CAA361",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 250ms ease",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
                        "&:hover": {
                            transform: "scale(1.05)",
                            background: "#8b7358",
                        },
                    }}
                >
                    <Box
                        sx={{
                            width: 32,
                            height: 72,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "transform 250ms ease",
                            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                        }}
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M9 6L15 12L9 18"
                                stroke="white"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </Box>
                </Box>

                <Box
                    sx={{
                        mt: 1,
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                    }}
                >
                    {menuItems.map(({ icon, label }, index) => (
                        <Box
                            key={label}
                            onClick={index === 0 ? goToHome : undefined}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: collapsed ? 0 : 1,
                                justifyContent: collapsed ? "center" : "flex-start",
                                cursor: index === 0 ? "pointer" : "default",
                            }}
                        >
                            <IconButton
                                sx={{
                                    color: "#EDDBBF",
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    justifyContent: "center",
                                    "&:hover": {
                                        background: "rgba(255,255,255,0.1)",
                                    },
                                }}
                            >
                                <img
                                    src={icon}
                                    alt={label}
                                    style={{
                                        width: 22,
                                        height: 22,
                                        objectFit: "contain",
                                        filter: "brightness(0) invert(1)",
                                    }}
                                />
                            </IconButton>
                            {!collapsed && (
                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        ml: 1,
                                        color: "rgba(255,255,255,0.95)",
                                    }}
                                >
                                    {label}
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Box>

                <Box sx={{ flex: 1 }} />
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                        mb: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            bgcolor: ACCENT_LIGHT,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: ACCENT_DARK,
                            fontWeight: 400,
                            cursor: "pointer",
                            boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
                        }}
                    >
                        SOS
                    </Box>
                </Box>
            </Box>

            {/* MAIN CONTENT */}
            <Box
                sx={{
                    flex: 1,
                    marginLeft: `${sidebarWidth}px`,
                    height: "100vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    transition: "margin-left 250ms ease",
                }}
            >
                <Container
                    maxWidth="lg"
                    sx={{
                        minHeight: "100%",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* HERO */}
                    <Box
                        sx={{
                            display: conversationMode ? "none" : "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            pt: { xs: 6, md: 10 },
                            transition:
                                "opacity 320ms ease, transform 320ms ease",
                            opacity: conversationMode ? 0 : 1,
                            transform: conversationMode
                                ? "translateY(-10px) scale(0.99)"
                                : "none",
                        }}
                    >
                        <InteractiveSvgAvatar
                            maxOffsetPx={3}
                            style={{
                                width: 160,
                                height: 160,
                                marginTop: 24,
                                marginBottom: 12,
                            }}
                        />
                        <Typography
                            variant="h4"
                            align="center"
                            sx={{
                                fontWeight: 600,
                                mb: 1,
                                lineHeight: 1.55,
                                color: ACCENT_DARK,
                            }}
                        >
                            I'm Flora,{" "}
                            <Box
                                component="span"
                                sx={{ fontWeight: 400 }}
                            >
                                your AI Mental Health Companion
                            </Box>
                        </Typography>

                        <Typography
                            variant="h6"
                            align="center"
                            sx={{
                                maxWidth: 900,
                                mb: 6,
                                fontWeight: 400,
                                color: ACCENT_DARK,
                            }}
                        >
                            I'm here to support your emotional health in any way
                            I can!
                        </Typography>

                        {/* Input (hero) */}
                        <Box
                            component="form"
                            onSubmit={onSubmit}
                            sx={{
                                width: "100%",
                                display: "flex",
                                justifyContent: "center",
                                mb: 4,
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: "94%", md: "74%" },
                                    maxWidth: 1100,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                }}
                            >
                                <Box sx={{ position: "relative", flex: 1 }}>
                                    <TextField
                                        value={input}
                                        onChange={(e) =>
                                            setInput(e.target.value)
                                        }
                                        onKeyDown={onKeyDown}
                                        placeholder="Start typing here..."
                                        multiline={false}
                                        fullWidth
                                        variant="filled"
                                        InputProps={{
                                            disableUnderline: true,
                                            sx: {
                                                height: 54,
                                                borderRadius: "28px",
                                                border: "1px solid #CAA361",
                                                pr: "64px",
                                                pl: 3,
                                                bgcolor: INPUT_BG,
                                                display: "flex",
                                                alignItems: "center",
                                                boxShadow:
                                                    "inset 0 1px 0 rgba(0,0,0,0.02)",
                                                "& .MuiInputBase-input": {
                                                    height: "100%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    padding: 0,
                                                    fontSize: 16,
                                                    color: ACCENT_DARK,
                                                },
                                                "& .MuiInputBase-input::placeholder":
                                                    {
                                                        color: "#8F7E63",
                                                        opacity: 1,
                                                    },
                                            },
                                        }}
                                        disabled={sending}
                                    />

                                    {/* MIC INSIDE FIELD (hero) */}
                                    <IconButton
                                        type="button"
                                        aria-label="voice input"
                                        onClick={handleMicClick}
                                        sx={{
                                            position: "absolute",
                                            right: 14,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            width: 36,
                                            height: 36,
                                            borderRadius: "50%",
                                            bgcolor: "transparent",
                                            boxShadow: "none",
                                            p: 0,
                                            "&:hover": {
                                                bgcolor: "transparent",
                                            },
                                            opacity: isListening ? 1 : 0.9,
                                        }}
                                    >
                                        <Box
                                            component="svg"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            sx={{
                                                width: 22,
                                                height: 22,
                                                stroke: isListening
                                                    ? "#b52a2a"
                                                    : "#503920",
                                                strokeWidth: 1.4,
                                                fill: "none",
                                                display: "block",
                                            }}
                                        >
                                            <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                                            <path d="M19 11a7 7 0 0 1-14 0" />
                                            <line
                                                x1="12"
                                                y1="17"
                                                x2="12"
                                                y2="21"
                                            />
                                            <line
                                                x1="8"
                                                y1="21"
                                                x2="16"
                                                y2="21"
                                            />
                                        </Box>
                                    </IconButton>
                                </Box>

                                <Box
                                    component="button"
                                    type="submit"
                                    aria-label="send message"
                                    disabled={sending || !input.trim()}
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "1px solid #CAA361",
                                        backgroundColor: INPUT_BG,
                                        cursor:
                                            input.trim() && !sending
                                                ? "pointer"
                                                : "default",
                                        transition: "0.15s",
                                        "&:hover": {
                                            transform: input.trim()
                                                ? "scale(1.05)"
                                                : "none",
                                        },
                                        "&:disabled": {
                                            opacity: 0.6,
                                            cursor: "default",
                                            transform: "none",
                                        },
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/icon.svg"
                                        alt="send icon"
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            objectFit: "contain",
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <Typography
                            variant="body2"
                            sx={{
                                textAlign: "center",
                                fontStyle: "italic",
                                mb: 2,
                                color: "#4E351A",
                                fontFamily: "Poppins",
                                fontSize: 14,
                            }}
                        >
                            What people talk about most.
                        </Typography>

                        {/* Chips */}
                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                justifyContent: "center",
                                mt: 1,
                            }}
                        >
                            {quickTopics.slice(0, 3).map((t) => (
                                <Chip
                                    key={t}
                                    label={t}
                                    onClick={() => setInput(t)}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 99,
                                        borderColor: "#9E7F49",
                                        background: "transparent",
                                        color: "rgba(80, 57, 32, 0.6)",
                                        px: 3,
                                        minWidth: 140,
                                        "& .MuiChip-label": {
                                            py: 0.7,
                                            fontSize: 14,
                                            fontFamily: "Poppins",
                                        },
                                    }}
                                />
                            ))}
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                justifyContent: "center",
                                mt: 2,
                            }}
                        >
                            {quickTopics.slice(3, 5).map((t) => (
                                <Chip
                                    key={t}
                                    label={t}
                                    onClick={() => setInput(t)}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 99,
                                        borderColor: "#9E7F49",
                                        background: "transparent",
                                        color: "rgba(80, 57, 32, 0.6)",
                                        px: 3,
                                        minWidth: 140,
                                        "& .MuiChip-label": {
                                            py: 0.7,
                                            fontSize: 14,
                                            fontFamily: "Poppins",
                                        },
                                    }}
                                />
                            ))}
                        </Box>

                        <Typography
                            variant="caption"
                            sx={{
                                mt: 6,
                                color: "#826840",
                                fontSize: 16,
                                fontWeight: 300,
                            }}
                        >
                            Disclaimer: Flora offers support, not medical care.
                            Always consult a professional.
                        </Typography>
                    </Box>

                    {/* Conversation view */}
                    {conversationMode && (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: "100vh",
                                pt: { xs: 4, md: 6 },
                                pb: 2,
                            }}
                        >
                            <Box sx={{ flex: 1, pb: 2 }}>
                                <Box
                                    sx={{
                                        maxWidth: 900,
                                        mx: "auto",
                                        py: 2,
                                    }}
                                >
                                    {messages.map((m) => (
                                        <Box
                                            key={m.id}
                                            sx={{
                                                mb: 2,
                                                display: "flex",
                                                gap: 1,
                                                alignItems: "flex-start",
                                                justifyContent:
                                                    m.from === "user"
                                                        ? "flex-end"
                                                        : "flex-start",
                                            }}
                                        >
                                            {m.from === "bot" ? (
                                                <>
                                                    <Box
                                                        sx={{
                                                            width: 40,
                                                            height: 40,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <InteractiveSvgAvatar
                                                            keepEyesClosed={true}
                                                            maxOffsetPx={3}
                                                            style={{
                                                                width: 40,
                                                                height: 40,
                                                                marginTop: 0,
                                                                marginBottom: 0,
                                                            }}
                                                        />
                                                    </Box>
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            p: 1.2,
                                                            px: 2,
                                                            borderRadius: 2,
                                                            backgroundColor:
                                                                PAPER_BG,
                                                            color: ACCENT_DARK,
                                                            maxWidth: "80%",
                                                            whiteSpace:
                                                                "pre-wrap",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                color: ACCENT_DARK,
                                                            }}
                                                        >
                                                            {m.text}
                                                        </Typography>
                                                    </Paper>
                                                </>
                                            ) : (
                                                <>
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            p: 1.2,
                                                            px: 2,
                                                            borderRadius: 2,
                                                            backgroundColor:
                                                                "#fff",
                                                            color: ACCENT_DARK,
                                                            maxWidth: "80%",
                                                            whiteSpace:
                                                                "pre-wrap",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                color: ACCENT_DARK,
                                                            }}
                                                        >
                                                            {m.text}
                                                        </Typography>
                                                    </Paper>
                                                </>
                                            )}
                                        </Box>
                                    ))}

                                    {sending && (
                                        <Box
                                            sx={{
                                                mb: 2,
                                                display: "flex",
                                                gap: 1,
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <InteractiveSvgAvatar
                                                    keepEyesClosed={true}
                                                    maxOffsetPx={3}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        marginTop: 0,
                                                        marginBottom: 0,
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ mt: 0.3 }}>
                                                <TypingIndicator
                                                    bg={INPUT_BG}
                                                    color={ACCENT_DARK}
                                                />
                                            </Box>
                                        </Box>
                                    )}

                                    <div ref={messagesEndRef} />
                                </Box>
                            </Box>

                            {/* Input bar (sticky) */}
                            <Box
                                component="form"
                                onSubmit={onSubmit}
                                sx={{
                                    borderTop: 1,
                                    borderColor: "rgba(0,0,0,0.08)",
                                    py: 2,
                                    position: "sticky",
                                    bottom: 0,
                                    bgcolor: BG_GRADIENT,
                                    zIndex: 100,
                                }}
                            >
                                <Container maxWidth="lg">
                                    <Box
                                        sx={{
                                            width: { xs: "100%", md: "74%" },
                                            maxWidth: 1100,
                                            mx: "auto",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                position: "relative",
                                                flex: 1,
                                            }}
                                        >
                                            <TextField
                                                value={input}
                                                onChange={(e) =>
                                                    setInput(e.target.value)
                                                }
                                                onKeyDown={onKeyDown}
                                                placeholder="Send a message..."
                                                multiline
                                                minRows={1}
                                                maxRows={6}
                                                fullWidth
                                                variant="filled"
                                                InputProps={{
                                                    disableUnderline: true,
                                                    sx: {
                                                        borderRadius: "18px",
                                                        pr: "64px",
                                                        pl: 3,
                                                        bgcolor: INPUT_BG,
                                                        paddingY: "14px",
                                                        "& .MuiInputBase-input":
                                                            {
                                                                fontSize: 16,
                                                                lineHeight: 1.6,
                                                                color: ACCENT_DARK,
                                                            },
                                                    },
                                                }}
                                                disabled={sending}
                                            />

                                            {/* MIC INSIDE FIELD (conversation) */}
                                            <IconButton
                                                type="button"
                                                aria-label="voice input"
                                                onClick={handleMicClick}
                                                sx={{
                                                    position: "absolute",
                                                    right: 14,
                                                    top: "50%",
                                                    transform:
                                                        "translateY(-50%)",
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "50%",
                                                    bgcolor: "transparent",
                                                    boxShadow: "none",
                                                    p: 0,
                                                    "&:hover": {
                                                        bgcolor: "transparent",
                                                    },
                                                    opacity: isListening
                                                        ? 1
                                                        : 0.9,
                                                }}
                                            >
                                                <Box
                                                    component="svg"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    sx={{
                                                        width: 22,
                                                        height: 22,
                                                        stroke: isListening
                                                            ? "#b52a2a"
                                                            : "#503920",
                                                        strokeWidth: 1.4,
                                                        fill: "none",
                                                        display: "block",
                                                    }}
                                                >
                                                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                                                    <path d="M19 11a7 7 0 0 1-14 0" />
                                                    <line
                                                        x1="12"
                                                        y1="17"
                                                        x2="12"
                                                        y2="21"
                                                    />
                                                    <line
                                                        x1="8"
                                                        y1="21"
                                                        x2="16"
                                                        y2="21"
                                                    />
                                                </Box>
                                            </IconButton>
                                        </Box>

                                        <Box
                                            component="button"
                                            type="submit"
                                            aria-label="send message"
                                            disabled={sending || !input.trim()}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: "50%",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                border: "1px solid #CAA361",
                                                backgroundColor: INPUT_BG,
                                                cursor:
                                                    input.trim() && !sending
                                                        ? "pointer"
                                                        : "default",
                                                transition: "0.15s",
                                                "&:hover": {
                                                    transform: input.trim()
                                                        ? "scale(1.05)"
                                                        : "none",
                                                },
                                                "&:disabled": {
                                                    opacity: 0.6,
                                                    cursor: "default",
                                                    transform: "none",
                                                },
                                            }}
                                        >
                                            <Box
                                                component="img"
                                                src="/icon.svg"
                                                alt="send icon"
                                                sx={{
                                                    width: 22,
                                                    height: 22,
                                                    objectFit: "contain",
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                </Container>
                            </Box>
                        </Box>
                    )}
                </Container>
            </Box>
        </Box>
    );
}
