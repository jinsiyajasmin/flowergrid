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
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import GoogleIcon from "@mui/icons-material/Google";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import AddIcon from "@mui/icons-material/Add";
import chatIcon from "../assets/chat.svg";
import testIcon from "../assets/test.svg";
import bookIcon from "../assets/book.svg";
import worksheetsIcon from "../assets/worksheets.svg";
import flowerLogo from "../assets/flower.png";
import SendIcon from "../assets/icon.svg";



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
        return "sess_fallback";
    }
}

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
    const [signupAnchorEl, setSignupAnchorEl] = useState(null);
    const signupOpen = Boolean(signupAnchorEl);
    const [user, setUser] = useState(null);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const audioRef = useRef(null);
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [lastInputWasVoice, setLastInputWasVoice] = useState(false);



    const handleSignupClick = (event) => {
        setSignupAnchorEl(event.currentTarget);
    };

    const handleSignupClose = () => {
        setSignupAnchorEl(null);
    };

    const isMobile = useMediaQuery("(max-width:900px)");
    const [conversationMode, setConversationMode] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);



    const menuItems = [
        { icon: chatIcon, label: "Chat with Flora" },
        { icon: testIcon, label: "Self Tests" },
        { icon: bookIcon, label: "Book a Therapist" },
        { icon: worksheetsIcon, label: "Worksheets" },
    ];


    const API_BASE = 'https://api.luna.flowergrid.co.uk';

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
        return () => {
            // Runs when ChatScreenMui unmounts
            sendChatSummary();
        };
    }, []);

    useEffect(() => {
        if (!user) return;

        fetch(`${API_BASE}/conversations`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                setConversations(Array.isArray(data) ? data : []);
            })
            .catch(console.error);
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sending, conversationMode]);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const userParam = params.get("user");

            if (userParam) {
                const parsedUser = JSON.parse(decodeURIComponent(userParam));
                localStorage.setItem("flora_user", JSON.stringify(parsedUser));
                setUser(parsedUser);

                const url = new URL(window.location.href);
                url.searchParams.delete("user");
                window.history.replaceState({}, document.title, url.toString());
            } else {
                const stored = localStorage.getItem("flora_user");
                if (stored) setUser(JSON.parse(stored));
            }
        } catch (err) {
            console.warn("User restore failed", err);
        }
    }, []);



    useEffect(() => {
        const handleBeforeUnload = () => {
            sendChatSummary();
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            sendChatSummary();
        };
    }, []);

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn("Speech recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-GB";
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

            setLastInputWasVoice(true);
            setConversationMode(true);
            setInput("");
            sendToServer(transcript, true);


        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch {

            }
        };
    }, []);





    async function sendToServer(text, isVoiceInput = false) {

        if (!text) return;
        setConversationMode(true);
        setMessages((m) => [...m, { id: Date.now(), from: "user", text }]);
        setSending(true);

        const sessionId = getOrCreateSessionId();

        try {
            const sessionId = getOrCreateSessionId();

            const resp = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({
                    message: text,
                    sessionId, // 🔥 THIS WAS MISSING
                }),


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

            if (data?.audio && isVoiceInput) {
                playBotVoice(data.audio);
            }




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

    function startNewChat() {
        sendChatSummary(); // 👈 SAVE previous chat

        sessionStorage.removeItem("flora_session_id");

        setMessages([]);
        setActiveConversationId(null);
        setConversationMode(false);
    }


    function VoiceWaveformOverlay() {
        return (
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                    px: 2.5,
                }}
            >
                {/* dotted baseline */}
                <Box
                    sx={{
                        position: "absolute",
                        left: 20,
                        right: 20,
                        height: 2,
                        background:
                            "repeating-linear-gradient(to right, rgba(255,255,255,0.6) 0 4px, transparent 4px 8px)",
                        opacity: 0.6,
                    }}
                />

                {/* waveform */}
                <Box
                    sx={{
                        display: "flex",
                        gap: "3px",
                        alignItems: "center",
                        marginLeft: 60,
                    }}
                >
                    {[...Array(22)].map((_, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 3,
                                height: `${Math.random() * 22 + 6}px`,
                                borderRadius: 2,
                                backgroundColor: "#fff",
                                opacity: 0.9,
                                animation: "wavePulse 1.2s infinite ease-in-out",
                                animationDelay: `${i * 0.05}s`,
                            }}
                        />
                    ))}
                </Box>

                <style>{`
        @keyframes wavePulse {
          0%, 100% {
            transform: scaleY(0.4);
            opacity: 0.4;
          }
          50% {
            transform: scaleY(1.2);
            opacity: 1;
          }
        }
      `}</style>
            </Box>
        );
    }
    function openConversation(conversation) {
        setActiveConversationId(conversation._id);
        setConversationMode(true);

        fetch(`${API_BASE}/conversations/${conversation._id}`)
            .then((res) => res.json())
            .then((data) => {
                setMessages(Array.isArray(data.messages) ? data.messages : []);
            })
            .catch(console.error);
    }


    function playBotVoice(base64Audio) {
        try {
            // Stop previous audio if any
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
            audioRef.current = audio;

            audio.play().catch(err => {
                console.warn("Autoplay blocked:", err);
            });
        } catch (err) {
            console.error("Audio play failed:", err);
        }
    }

    async function sendChatSummary() {
        try {
            const sessionId = sessionStorage.getItem("flora_session_id");
            if (!sessionId) return;

            await fetch("http://localhost:3001/chat/summary", {
                method: "POST",
                credentials: "include", // REQUIRED
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            });

        } catch (err) {
            console.warn("Summary send failed", err);
        }
    }

    function handleLogout() {
        localStorage.removeItem("flora_user");
        setUser(null);
        handleSignupClose();
    }

    function onSubmit(e) {
        e?.preventDefault();

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const trimmed = input.trim();
        if (!trimmed) return;

        setLastInputWasVoice(false); // 👈 typed input
        setConversationMode(true);
        sendToServer(trimmed, false);

        setInput("");
    }


    function onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
        }
    }

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
    function startNewChat() {
        setMessages([]);
        setActiveConversationId(null);
        setConversationMode(false);
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
                marginLeft: isMobile ? 0 : 0,
                fontFamily:
                    "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
                overflowY: "auto",
            }}
        >
            <CssBaseline />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>

            {isMobile && (
                <>
                    <IconButton
                        onClick={() => setMobileDrawerOpen(true)}
                        sx={{
                            position: "fixed",
                            top: 16,
                            left: 16,
                            zIndex: 2000,

                            bgcolor: "#fff",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Box
                        sx={{
                            position: "fixed",
                            top: 16,
                            right: 16,
                            zIndex: 2000,

                        }}
                    >
                        {user ? (
                            <IconButton onClick={handleSignupClick} sx={{ p: 0 }}>
                                <Box
                                    component="img"
                                    src={user.avatar}
                                    alt={user.name}
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: "50%",
                                        border: "2px solid #CAA361",
                                        objectFit: "cover",

                                    }}
                                />
                            </IconButton>
                        ) : (
                            <Button
                                onClick={handleSignupClick}
                                sx={{
                                    color: ACCENT_DARK,
                                    fontWeight: 500,
                                    bgcolor: "rgba(255,255,255,0.9)",
                                    px: 2,
                                    borderRadius: 2,
                                }}
                            >
                                Sign up
                            </Button>
                        )}
                    </Box>
                </>
            )}

            <Drawer
                anchor="left"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: 260,
                        bgcolor: SIDEBAR_BG,
                        color: "#fff",
                        pt: 3,
                    },
                }}
            >
              <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
  <img src={flowerLogo} alt="logo" style={{ width: 48 }} />
</Box>

                {user && (
                    <Box
                        onClick={() => {
                            startNewChat();

                            setMobileDrawerOpen(false);
                        }}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            px: 3,
                            py: 1.5,
                            cursor: "pointer",
                            borderRadius: 2,
                            mx: 2,
                            mb: 1,
                            background: "rgba(255,255,255,0.08)",
                            "&:hover": {
                                background: "rgba(255,255,255,0.14)",
                            },
                        }}
                    >
                        <AddIcon sx={{ fontSize: 22, color: "#EDDBBF" }} />
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                            New Chat
                        </Typography>
                    </Box>
                )}


                {menuItems.map(({ icon, label }, index) => (
                    <Box
                        key={label}
                        onClick={() => {
                            if (index === 0) startNewChat();
                            ;
                            setMobileDrawerOpen(false);
                        }}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            px: 3,
                            py: 1.5,
                            cursor: "pointer",
                            "&:hover": { background: "rgba(255,255,255,0.1)" },
                        }}
                    >
                        <img
                            src={icon}
                            alt={label}
                            style={{
                                width: 22,
                                height: 22,
                                filter: "brightness(0) invert(1)",
                            }}
                        />
                        <Typography sx={{ fontSize: 14 }}>{label}</Typography>
                    </Box>
                ))}
            </Drawer>

            {!isMobile && (
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
                        position: "fixed",
                        top: 0,
                        left: 0,
                        height: "100vh",
                        zIndex: 1300,
                        overflowY: "auto",
                    }}
                >
                    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                       
                         <img src={flowerLogo} alt="logo" style={{ width: collapsed ? 46 : 46, height: "auto"}} />
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

                        {user && (
                            <Box
                                onClick={startNewChat}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    px: collapsed ? 0 : 1,
                                    justifyContent: collapsed ? "center" : "flex-start",
                                    cursor: "pointer",
                                    mb: 1,
                                }}
                            >
                                {conversations.map((c) => (
                                    <Box
                                        key={c._id}
                                        onClick={() => openConversation(c)}
                                        sx={{
                                            px: collapsed ? 1 : 2,
                                            py: 1,
                                            mx: 1,
                                            borderRadius: 1.5,
                                            cursor: "pointer",
                                            background:
                                                activeConversationId === c._id
                                                    ? "rgba(255,255,255,0.12)"
                                                    : "transparent",
                                            "&:hover": {
                                                background: "rgba(255,255,255,0.1)",
                                            },
                                        }}
                                    >
                                        {!collapsed && (
                                            <Typography
                                                sx={{
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    color: "rgba(255,255,255,0.95)",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {c.title || "New conversation"}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}

                                <IconButton
                                    sx={{
                                        color: "#EDDBBF",
                                        width: 44,
                                        height: 44,
                                        borderRadius: 2,
                                        justifyContent: "center",
                                        border: "1px solid rgba(255,255,255,0.18)",
                                        background: "rgba(255,255,255,0.06)",
                                        "&:hover": {
                                            background: "rgba(255,255,255,0.14)",
                                        },
                                    }}
                                >
                                    <AddIcon sx={{ fontSize: 22 }} />
                                </IconButton>

                                {!collapsed && (
                                    <Typography
                                        sx={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            ml: 1,
                                            color: "rgba(255,255,255,0.95)",
                                        }}
                                    >
                                        New Chat
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {menuItems.map(({ icon, label }, index) => (
                            <Box
                                key={label}
                                onClick={index === 0 ? startNewChat : undefined}
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
                            position: "fixed",
                            top: 16,
                            right: 24,
                            zIndex: 2000,
                        }}
                    >
                        {user ? (
                            <IconButton onClick={handleSignupClick} sx={{ p: 0 }}>
                                <Box
                                    component="img"
                                    src={user.avatar}
                                    alt={user.name}
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: "50%",
                                        border: "2px solid #CAA361",
                                        objectFit: "cover",
                                    }}
                                />
                            </IconButton>
                        ) : (
                            <Button
                                onClick={handleSignupClick}
                                sx={{
                                    color: ACCENT_DARK,
                                    fontWeight: 500,
                                }}
                            >
                                Sign up
                            </Button>
                        )}


                    </Box>

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
            )}

            <Menu
                anchorEl={signupAnchorEl}
                open={signupOpen}
                onClose={handleSignupClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        mt: 1,
                        minWidth: 220,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
                    },
                }}
            >
                {user ? (
                    <>
                        <MenuItem
                            disableRipple
                            sx={{
                                pointerEvents: "none",
                                "&:hover": { background: "transparent" },
                            }}
                        >
                            <Box
                                sx={{
                                    width: "100%",
                                    textAlign: "center",
                                    py: 1,
                                }}
                            >
                                <Box
                                    component="img"
                                    src={user.avatar}
                                    alt={user.name}
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        mb: 1,
                                    }}
                                />
                                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                                    {user.name}
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                                    {user.email}
                                </Typography>
                            </Box>
                        </MenuItem>

                        <Box sx={{ px: 2, my: 1 }}>
                            <Box sx={{ height: 1, bgcolor: "#E5E7EB" }} />
                        </Box>

                        <MenuItem
                            onClick={handleLogout}
                            sx={{
                                justifyContent: "center",
                                color: "#B91C1C",
                                fontWeight: 500,
                            }}
                        >
                            Logout
                        </MenuItem>
                    </>
                ) : (
                    <MenuItem
                        disableRipple
                        sx={{
                            pt: 3,
                            pb: 2,
                            "&:hover": { background: "transparent" },
                        }}
                    >
                        <Box sx={{ width: "100%" }}>
                            <Typography
                                sx={{
                                    mb: 2,
                                    textAlign: "center",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#374151",
                                }}
                            >
                                Sign up
                            </Typography>

                            <Box
                                onClick={() => {
                                    handleSignupClose();
                                    window.location.href = `${API_BASE}/auth/google`;
                                }}
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 1.5,
                                    py: 1.4,
                                    px: 3,
                                    borderRadius: "14px",
                                    backgroundColor: "#F9FAFB",
                                    color: "#111827",
                                    border: "1px solid #E5E7EB",
                                    cursor: "pointer",
                                    "&:hover": {
                                        backgroundColor: "#F3F4F6",
                                    },
                                }}
                            >
                                <Box
                                    component="img"
                                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                    alt="Google"
                                    sx={{ width: 20, height: 20 }}
                                />
                                <Typography sx={{ fontWeight: 500 }}>
                                    Continue with Google
                                </Typography>
                            </Box>
                        </Box>
                    </MenuItem>
                )}
            </Menu>
            <Box
                sx={{
                    flex: 1,
                    marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
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
                        px: isMobile ? 2 : 3,

                    }}
                >
                    <Box
                        sx={{
                            display: conversationMode ? "none" : "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            pt: { xs: 10, md: 10 },

                            transition: "opacity 320ms ease, transform 320ms ease",
                            opacity: conversationMode ? 0 : 1,
                            transform: conversationMode
                                ? "translateY(-10px) scale(0.99)"
                                : "none",
                        }}
                    >
                        {!isMobile && (
                            <InteractiveSvgAvatar
                                maxOffsetPx={3}
                                style={{
                                    width: 160,
                                    height: 160,
                                    marginTop: 24,
                                    marginBottom: 12,
                                }}
                            />
                        )}

                        {isMobile ? (
                            <>
                                <Box sx={{ height: 100 }} />

                                <Typography
                                    variant="h6"
                                    align="center"
                                    sx={{
                                        fontWeight: 600,
                                        mb: 0.5,
                                        color: ACCENT_DARK,
                                        fontSize: "1.5rem",
                                        px: 2,
                                    }}
                                >
                                    I'm Luna,
                                </Typography>

                                <Typography
                                    align="center"
                                    sx={{
                                        fontWeight: 400,
                                        mb: 2,
                                        color: ACCENT_DARK,
                                        fontSize: "1.05rem",
                                    }}
                                >
                                    your AI Mental Health Companion
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        textAlign: "center",
                                        fontStyle: "italic",
                                        mb: 2,
                                        color: "#4E351A",
                                        fontFamily: "Poppins",
                                        fontSize: 14,
                                        mt: 20,
                                    }}
                                >
                                    What people talk about most.
                                </Typography>


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
                                                px: 0,
                                                minWidth: 100,
                                                "& .MuiChip-label": {
                                                    py: 0.7,
                                                    fontSize: 12,
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
                                                px: 0,
                                                minWidth: 100,
                                                "& .MuiChip-label": {
                                                    py: 0.7,
                                                    fontSize: 12,
                                                    fontFamily: "Poppins",
                                                },
                                            }}
                                        />
                                    ))}
                                </Box>
                                <Box sx={{ height: 100 }} />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        mb: 1,
                                        textAlign: "center",
                                        color: "#826840",
                                        fontSize: 14,
                                        fontWeight: 100,
                                    }}
                                >
                                    Disclaimer: Flora offers support, not medical care.<br />
                                    Always consult a professional.
                                </Typography>
                            </>
                        ) : (
                            <Typography
                                variant="h4"
                                align="center"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1,
                                    lineHeight: 1.55,
                                    color: ACCENT_DARK,
                                    fontSize: { xs: "1.5rem", md: "2.125rem" },
                                    px: 2,
                                }}
                            >
                                I'm Luna,{" "}
                                <Box component="span" sx={{ fontWeight: 400 }}>
                                    your AI Mental Health Companion
                                </Box>
                            </Typography>
                        )}

                        {!isMobile && (
                            <Typography
                                variant="h6"
                                align="center"
                                sx={{
                                    maxWidth: 900,
                                    mb: 6,
                                    fontWeight: 400,
                                    color: ACCENT_DARK,
                                    fontSize: { xs: "1rem", md: "1.25rem" },
                                    px: 2,
                                }}
                            >
                                I'm here to support your emotional health in any way I can!
                            </Typography>
                        )}


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
                                    width: { xs: "100%", md: "74%" },
                                    maxWidth: 1100,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                }}
                            >
                                <Box sx={{ position: "relative", flex: 1 }}>
                                    <TextField
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={onKeyDown}
                                        placeholder={isListening ? "" : "Start typing here..."}
                                        multiline={false}
                                        fullWidth
                                        variant="filled"
                                        InputProps={{
                                            disableUnderline: true,
                                            sx: {
                                                height: 54,
                                                borderRadius: "28px",
                                                border: "1px solid #CAA361",
                                                pr: isListening ? "110px" : "64px",
                                                pl: 3,
                                                bgcolor: INPUT_BG,
                                                display: "flex",
                                                alignItems: "center",
                                                boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)",
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
                                        disabled={sending || isListening}
                                    />

                                    {isListening && <VoiceWaveformOverlay />}



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
                                        src={SendIcon}
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
                        {!isMobile && (
                            <>
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
                            </>
                        )}

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
                                                src={SendIcon}
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
