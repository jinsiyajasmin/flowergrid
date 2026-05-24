import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CssBaseline,
    Typography,
    IconButton,
    Box,
    Container,
    Paper,
    TextField,
    Chip,
    Tooltip,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";
import InteractiveSvgAvatar from "./InteractiveSvgAvatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import Drawer from "@mui/material/Drawer";
import AnimatedMenuIcon from "./AnimatedMenuIcon";
import AnimateIcon from "./components/AnimateIcon";
import AnimatedXIcon from "./components/AnimatedXIcon";
import TypingAnimation from "./components/TypingAnimation";
import ScaleLetterText from "./components/ScaleLetterText";
import { API_BASE } from "./config";
import SplashScreen from "./components/SplashScreen";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline"; // or Delete
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import chatIcon from "../assets/chat.svg";
import testIcon from "../assets/test.svg";
import bookIcon from "../assets/book.svg";
import worksheetsIcon from "../assets/worksheets.svg";
import flowerLogo from "../assets/flower.png";
import SendIcon from "../assets/icon.svg";
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import LandingIntro from "./components/LandingIntro";
import VoiceWaveformOverlay from "./components/VoiceWaveformOverlay";
import AnimatedVoiceIcon from "./components/AnimatedVoiceIcon";



function TypingIndicator({ bg, color, isAdornment }) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: isAdornment ? 0.6 : 1,
                alignItems: "center",
                padding: isAdornment ? "4px 8px" : "8px 12px",
                backgroundColor: bg,
                color,
                borderRadius: "18px",
                maxWidth: "80%",
            }}
        >
            <Box
                sx={{
                    width: isAdornment ? 5 : 6,
                    height: isAdornment ? 5 : 6,
                    borderRadius: "50%",
                    bgcolor: color,
                    animation: "dotPulse 1.4s infinite",
                }}
            />
            <Box
                sx={{
                    width: isAdornment ? 5 : 6,
                    height: isAdornment ? 5 : 6,
                    borderRadius: "50%",
                    bgcolor: color,
                    animation: "dotPulse 1.4s infinite",
                    animationDelay: "0.2s",
                }}
            />
            <Box
                sx={{
                    width: isAdornment ? 5 : 6,
                    height: isAdornment ? 5 : 6,
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
const GUEST_LIMIT_KEY = "flora_guest_limit_reached";
const GUEST_REPLY_LIMIT = 5;
const SIGNUP_REQUIRED_MESSAGE =
    "You have used your free messages with Luna.\n\n" +
    "To continue this conversation, please sign up or log in with Google using the Sign up button above. " +
    "Once you are signed in, you can chat with Luna without this limit.\n\n" +
    "Thank you for spending time with me today — I would love to keep supporting you when you are ready.";

function countGuestBotReplies(messages) {
    return messages.filter((m) => m.from === "bot").length;
}

function isGuestLimitReached() {
    try {
        return localStorage.getItem(GUEST_LIMIT_KEY) === "true";
    } catch {
        return false;
    }
}

function setGuestLimitReached() {
    try {
        localStorage.setItem(GUEST_LIMIT_KEY, "true");
    } catch {
        /* ignore */
    }
}

function clearGuestLimitReached() {
    try {
        localStorage.removeItem(GUEST_LIMIT_KEY);
    } catch {
        /* ignore */
    }
}

function guestMustSignUp(user) {
    return !user && isGuestLimitReached();
}

function renderChatText(text, color) {
    const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
    return (
        <Typography variant="body1" component="div" sx={{ color, whiteSpace: "pre-wrap" }}>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                    <Box
                        key={i}
                        component="a"
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
                    >
                        {part}
                    </Box>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </Typography>
    );
}

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
    const [splashComplete, setSplashComplete] = useState(false);
    const [signupAnchorEl, setSignupAnchorEl] = useState(null);
    const signupOpen = Boolean(signupAnchorEl);
    const [user, setUser] = useState(null);

    const audioRef = useRef(null);
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [lastInputWasVoice, setLastInputWasVoice] = useState(false);
    const [inputDisabled, setInputDisabled] = useState(false);
    const inputDisabledRef = useRef(false);
    const [voiceTranscript, setVoiceTranscript] = useState(""); // temp transcript
    const voiceTranscriptRef = useRef(""); // Ref for accessing inside callbacks
    const [isSpeaking, setIsSpeaking] = useState(false);
    const summarySentRef = useRef(false);


    const handleSignupClick = (event) => {
        setSignupAnchorEl(event.currentTarget);
    };

    const handleSignupClose = () => {
        setSignupAnchorEl(null);
    };

    const isMobile = useMediaQuery("(max-width:900px)");
    const [conversationMode, setConversationMode] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false); // Mobile drawer state
    const [collapsed, setCollapsed] = useState(false); // Default open

    // Delete Confirmation Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [idToDelete, setIdToDelete] = useState(null);

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    // Landing Intro State - Show only once per session
    const [showLanding, setShowLanding] = useState(() => {
        const hasSeenLanding = sessionStorage.getItem('hasSeenLanding');
        return !hasSeenLanding;
    });

    // Voice Chat Mode State
    const [voiceModalOpen, setVoiceModalOpen] = useState(false);
    const [voiceModeActive, setVoiceModeActive] = useState(false);
    const continuousListeningRef = useRef(false); // Ref to track if we should restart listening
    const silenceTimerRef = useRef(null); // Ref for 3s silence timeout
    const typingIntervalRef = useRef(null);
    const chatAbortRef = useRef(null);
    const isBotSpeakingRef = useRef(false);



    const menuItems = [
        { icon: chatIcon, label: "Chat with Luna" },
        { icon: testIcon, label: "Self Tests" },
        { icon: bookIcon, label: "Book a Therapist" },
        { icon: worksheetsIcon, label: "Worksheets" },
    ];

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
            credentials: "include",
            headers: {
                'x-user-id': user.id
            }
        })
            .then((res) => {
                if (res.status === 401) return [];
                return res.json();
            })
            .then((data) => {
                setConversations(Array.isArray(data) ? data : []);
            })
            .catch(console.error);
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, sending, conversationMode]);

    useEffect(() => {
        inputDisabledRef.current = inputDisabled;
    }, [inputDisabled]);

    useEffect(() => {
        if (user) {
            clearGuestLimitReached();
            setInputDisabled(false);
            inputDisabledRef.current = false;
        } else if (isGuestLimitReached()) {
            setInputDisabled(true);
            inputDisabledRef.current = true;
        }
    }, [user]);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const userParam = params.get("user");

            if (userParam) {
                const parsedUser = JSON.parse(decodeURIComponent(userParam));
                localStorage.setItem("flora_user", JSON.stringify(parsedUser));
                setUser(parsedUser);
                clearGuestLimitReached();
                setInputDisabled(false);
                inputDisabledRef.current = false;

                const url = new URL(window.location.href);
                url.searchParams.delete("user");
                window.history.replaceState({}, document.title, url.toString());
            } else {
                const stored = localStorage.getItem("flora_user");
                if (stored) {
                    setUser(JSON.parse(stored));
                    clearGuestLimitReached();
                    setInputDisabled(false);
                    inputDisabledRef.current = false;
                } else if (isGuestLimitReached()) {
                    setInputDisabled(true);
                    inputDisabledRef.current = true;
                }
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
            // We don't call sendChatSummary here again if we want to avoid double-send on component unmount vs page unload
            // But since keepalive is specific to page unload, it's safer to leave it in the unmount effect above 
            // or just rely on 'beforeunload' for page exits.
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
        recognition.interimResults = true; // Show real-time results
        recognition.continuous = !isMobile; // Continuous mode is often flaky on mobile (iOS/Android)
        recognition.maxAlternatives = 3; // Get more alternatives for better accuracy


        recognition.onsoundstart = () => setIsSpeaking(true);
        recognition.onsoundend = () => setIsSpeaking(false);
        recognition.onspeechstart = () => setIsSpeaking(true);
        recognition.onspeechend = () => setIsSpeaking(false);

        recognition.onstart = () => {
            setIsListening(true);
            setIsSpeaking(false);

            // Clear any stale timer
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // Initial timer: wait 4s for user to ANY speech
            if (continuousListeningRef.current) {
                silenceTimerRef.current = setTimeout(() => {
                    console.log("Initial silence timeout. Stopping.");
                    recognition.stop();
                }, 4000);
            }
        };

        recognition.onend = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            setIsListening(false);
            setIsSpeaking(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);

            switch (event.error) {
                case 'no-speech':
                    console.log('No speech detected. Please try speaking again.');
                    break;
                case 'audio-capture':
                    alert('Microphone not accessible. Please check your microphone permissions.');
                    setIsListening(false);
                    break;
                case 'not-allowed':
                    alert('Microphone permission denied. Please allow microphone access to use voice input.');
                    setIsListening(false);
                    break;
                case 'network':
                    console.log('Network error during speech recognition.');
                    break;
                case 'aborted':
                    console.log('Speech recognition aborted.');
                    break;
                default:
                    console.log('Speech recognition error:', event.error);
            }
        };

        recognition.onresult = (event) => {
            let fullTranscript = "";
            let interimTranscript = "";

            // Rebuild transcript from scratch to avoid duplicates
            for (let i = 0; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    fullTranscript += transcript + " ";
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update transcript state with the full rebuilt string (including interim)
            const currentTranscript = (fullTranscript + interimTranscript).trim();
            if (currentTranscript) {
                setVoiceTranscript(currentTranscript);
                voiceTranscriptRef.current = currentTranscript;
                setIsSpeaking(true);
            }

            // Log interim for debugging if needed
            // console.log('Interim:', interimTranscript);

            // --- Silence Detection Logic ---
            if (continuousListeningRef.current) {
                // Clear existing timer
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

                // Set new 3-second timer
                silenceTimerRef.current = setTimeout(() => {
                    console.log("3 seconds silence detected. Stopping recognition.");
                    recognition.stop();
                }, 3000);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch {

            }
        };
    }, []);

    function resumeVoiceListening() {
        if (!continuousListeningRef.current) return;
        const recognition = recognitionRef.current;
        if (!recognition) return;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            // Already listening
        }
    }

    function interruptBotResponse() {
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;

        if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
            audioRef.current = null;
        }
        isBotSpeakingRef.current = false;
        setSending(false);
    }

    function applyGuestSignupBlock(showOnEmptyChat = false) {
        setGuestLimitReached();
        setInputDisabled(true);
        inputDisabledRef.current = true;
        if (voiceModeActive) stopVoiceMode();

        setMessages((prev) => {
            const hasSignupMsg = prev.some(
                (m) => m.from === "bot" && m.text === SIGNUP_REQUIRED_MESSAGE
            );
            if (hasSignupMsg) return prev;
            if (showOnEmptyChat && prev.length === 0) {
                return [{ id: Date.now(), from: "bot", text: SIGNUP_REQUIRED_MESSAGE }];
            }
            return [
                ...prev,
                { id: Date.now() + 1, from: "bot", text: SIGNUP_REQUIRED_MESSAGE },
            ];
        });
    }

    async function sendToServer(text, isVoiceInput = false) {

        if (!text) return;
        if (inputDisabledRef.current || guestMustSignUp(user)) {
            applyGuestSignupBlock();
            return;
        }

        if (!user && countGuestBotReplies(messages) >= GUEST_REPLY_LIMIT) {
            applyGuestSignupBlock();
            return;
        }

        if (
            isVoiceInput &&
            (sending || isBotSpeakingRef.current || audioRef.current)
        ) {
            interruptBotResponse();
        }

        setConversationMode(true);
        setMessages((m) => [...m, { id: Date.now(), from: "user", text }]);
        setSending(true);

        const sessionId = getOrCreateSessionId();

        try {
            chatAbortRef.current = new AbortController();

            const headers = { "Content-Type": "application/json" };
            if (user?.id) headers["x-user-id"] = user.id;

            const resp = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers,
                credentials: "include", // Ensure session cookies are sent
                signal: chatAbortRef.current.signal,
                body: JSON.stringify({
                    message: text,
                    sessionId,
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

            // --- Letter-by-letter Typing Effect ---
            const botMsgId = Date.now() + 1;
            setMessages((prev) => [...prev, { id: botMsgId, from: "bot", text: "" }]);

            let i = 0;
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = setInterval(() => {
                if (i < reply.length) {
                    const nextChar = reply.charAt(i);
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === botMsgId ? { ...msg, text: msg.text + nextChar } : msg
                        )
                    );
                    i++;
                } else {
                    clearInterval(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                }
            }, 15); // Adjust speed here

            if (data?.disableInput) {
                setGuestLimitReached();
                setInputDisabled(true);
                inputDisabledRef.current = true;
                if (voiceModeActive) stopVoiceMode();
            }

            if (data?.audio && isVoiceInput) {
                playBotVoice(data.audio);
            }




        } catch (err) {
            if (err.name === "AbortError") return;
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
            chatAbortRef.current = null;
            setSending(false);
            if (continuousListeningRef.current) {
                resumeVoiceListening();
            }
        }
    }

    async function startNewChat() {
        // Guest used free messages — new chat still requires sign up
        if (guestMustSignUp(user)) {
            sessionStorage.removeItem(SESSION_KEY);
            setActiveConversationId(null);
            setConversationMode(true);
            setInput("");
            applyGuestSignupBlock(true);
            return;
        }

        // 🔥 Capture current state for background saving
        const currentMessages = [...messages];
        const currentSessionId = sessionStorage.getItem(SESSION_KEY);

        // 🔥 OPTIMISTIC UI: Clear screen immediately
        sessionStorage.removeItem(SESSION_KEY);
        setMessages([]);
        setActiveConversationId(null);
        setConversationMode(false);
        setInputDisabled(false);
        inputDisabledRef.current = false;

        // 🔥 Save history in background (don't await here for instant feel)
        if (user && currentMessages.length > 0 && currentSessionId) {
            sendChatSummary(currentMessages, currentSessionId)
                .then(() => {
                    // Refresh history after background save completes
                    fetch(`${API_BASE}/conversations`, {
                        credentials: "include",
                        headers: { 'x-user-id': user.id }
                    })
                        .then(res => res.ok && res.json())
                        .then(data => { if (Array.isArray(data)) setConversations(data) })
                        .catch(console.error);
                })
                .catch(err => console.warn("Background summary failed", err));
        }
    }

    function openConversation(conversation) {
        // 🔥 Capture current state for background saving
        const currentMessages = [...messages];
        const currentSessionId = sessionStorage.getItem("flora_session_id");

        // 🔥 Save current chat in background before switching (if not just opening same one)
        if (user && currentMessages.length > 0 && currentSessionId && activeConversationId !== conversation.id) {
            sendChatSummary(currentMessages, currentSessionId)
                .then(() => {
                    // Refresh history list so newly saved title appears
                    fetch(`${API_BASE}/conversations`, {
                        credentials: "include",
                        headers: { 'x-user-id': user.id }
                    })
                        .then(res => res.ok && res.json())
                        .then(data => { if (Array.isArray(data)) setConversations(data) })
                        .catch(console.error);
                })
                .catch(err => console.warn("Background summary failed", err));
        }

        if (inputDisabled && activeConversationId !== conversation.id && !guestMustSignUp(user)) {
            setInputDisabled(false);
            inputDisabledRef.current = false;
        }

        setActiveConversationId(conversation.id);
        setConversationMode(true);

        fetch(`${API_BASE}/conversations/${conversation.id}`, {
            credentials: "include",
            headers: { 'x-user-id': user.id }
        })
            .then((res) => res.json())
            .then((data) => {
                // Resume session if sessionId exists
                if (data.sessionId) {
                    sessionStorage.setItem("flora_session_id", data.sessionId);
                }

                setMessages(Array.isArray(data.messages) ? data.messages.map((m, i) => ({
                    id: i,
                    from: m.role === 'user' ? 'user' : 'bot',
                    text: m.content
                })) : []);
            })
            .catch(console.error);
    }

    function deleteConversation(e, id) {
        e.stopPropagation();
        setIdToDelete(id);
        setDeleteDialogOpen(true);
    }

    async function handleConfirmDelete() {
        if (!idToDelete) return;
        try {
            const res = await fetch(`${API_BASE}/conversations/${idToDelete}`, {
                method: "DELETE",
                credentials: "include",
                headers: { 'x-user-id': user.id }
            });

            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== idToDelete));
                if (activeConversationId === idToDelete) {
                    startNewChat();
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteDialogOpen(false);
            setIdToDelete(null);
        }
    }


    function playBotVoice(base64Audio) {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.onended = null;
                audioRef.current = null;
            }

            const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
            audioRef.current = audio;

            audio.onplay = () => {
                isBotSpeakingRef.current = true;
            };

            audio.onended = () => {
                isBotSpeakingRef.current = false;
                audioRef.current = null;
                if (continuousListeningRef.current) {
                    resumeVoiceListening();
                }
            };

            audio.onerror = () => {
                isBotSpeakingRef.current = false;
                audioRef.current = null;
            };

            audio.play().catch((err) => {
                console.warn("Autoplay blocked:", err);
                isBotSpeakingRef.current = false;
                if (continuousListeningRef.current) {
                    resumeVoiceListening();
                }
            });
        } catch (err) {
            console.error("Audio play failed:", err);
            isBotSpeakingRef.current = false;
        }
    }

    async function sendChatSummary(overrideMessages = null, overrideSessionId = null) {
        try {
            const msgsToSave = overrideMessages || messages;
            const sidToSave = overrideSessionId || sessionStorage.getItem("flora_session_id");

            if (!user || !msgsToSave.length || !sidToSave) return;

            await fetch(`${API_BASE}/chat/summary`, {
                method: "POST",
                credentials: "include",
                keepalive: true,
                headers: {
                    "Content-Type": "application/json",
                    'x-user-id': user.id
                },
                body: JSON.stringify({
                    sessionId: sidToSave,
                    messages: msgsToSave.map(m => ({
                        role: m.from === 'user' ? 'user' : 'assistant',
                        content: m.text
                    })),
                }),
            });
        } catch (err) {
            console.warn("Summary send failed", err);
        }
    }




    function onSubmit(e) {
        e?.preventDefault();

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (inputDisabledRef.current || guestMustSignUp(user)) {
            applyGuestSignupBlock();
            return;
        }

        const trimmed = input.trim();
        if (!user && countGuestBotReplies(messages) >= GUEST_REPLY_LIMIT) {
            applyGuestSignupBlock();
            return;
        }
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


    async function handleLogout() {
        try {
            await sendChatSummary(); // 🔥 save summary before logout
        } catch (e) {
            console.warn("Summary save failed on logout", e);
        }

        localStorage.removeItem("flora_user");
        sessionStorage.removeItem("flora_session_id");

        try {
            await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
        } catch (e) { }

        setUser(null);
        setMessages([]);
        setConversationMode(false);
        setActiveConversationId(null);
        clearGuestLimitReached();
        setInputDisabled(false);
        inputDisabledRef.current = false;
        handleSignupClose();
    }

    function handleMicClick() {
        const recognition = recognitionRef.current;

        if (inputDisabledRef.current || guestMustSignUp(user)) {
            applyGuestSignupBlock();
            return;
        }

        if (!recognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        try {
            if (isListening) {
                // If clicked again while listening, treat as cancel or maybe just stop?
                // User asked for specific cross icon to cancel.
                // Let's make mic click just toggle off (cancel) for safety, or do nothing?
                // Standard behavior: toggle off.
                handleCancelVoice();
            } else {
                setVoiceTranscript("");
                recognition.start();
            }
        } catch (err) {
            console.error("Error starting/stopping speech recognition:", err);
        }
    }

    function handleCancelVoice() {
        const recognition = recognitionRef.current;
        if (recognition) recognition.stop();
        setIsListening(false);
        setVoiceTranscript("");
        setInput(""); // Clear any partial input
    }

    // Helper function to format voice transcript with proper capitalization and punctuation
    function formatTranscript(text) {
        if (!text) return '';

        // Trim whitespace
        let formatted = text.trim();

        // Capitalize first letter
        formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

        // Add period at end if no punctuation exists
        if (!/[.!?]$/.test(formatted)) {
            formatted += '.';
        }

        return formatted;
    }

    function handleConfirmVoice() {
        const recognition = recognitionRef.current;
        if (recognition) recognition.stop();
        setIsListening(false);

        if (voiceTranscript.trim()) {
            const formattedTranscript = formatTranscript(voiceTranscript);
            setLastInputWasVoice(true);
            setConversationMode(true);
            sendToServer(formattedTranscript, true); // true = isVoice
            setInput("");
            setVoiceTranscript("");
        }
    }

    // --- Voice Chat Mode Logic ---

    function startVoiceMode() {
        setVoiceModalOpen(false);
        setVoiceModeActive(true);
        continuousListeningRef.current = true;

        // Start listening
        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                recognition.start();
                setIsListening(true);
            } catch (e) {
                console.log("Recognition already started or failed", e);
            }
        }
    }

    function stopVoiceMode() {
        setVoiceModeActive(false);
        continuousListeningRef.current = false;

        const recognition = recognitionRef.current;
        if (recognition) recognition.stop();
        setIsListening(false);

        interruptBotResponse();
    }

    // Interrupt Luna when user speaks during bot reply (voice chat mode)
    useEffect(() => {
        if (!voiceModeActive || !isSpeaking) return;
        if (sending || isBotSpeakingRef.current || audioRef.current) {
            interruptBotResponse();
            resumeVoiceListening();
        }
    }, [isSpeaking, voiceModeActive, sending]);

    // --- Effect to handle End of Speech in Voice Mode ---
    useEffect(() => {
        if (voiceModeActive && !isListening) {
            // Recognition stopped. Check if we have text.
            const text = voiceTranscript; // using state here is fine as this effect runs on update

            if (text && text.trim()) {
                const formatted = formatTranscript(text);
                setLastInputWasVoice(true);
                // clear transcript immediately so we don't send duplicates
                setVoiceTranscript("");
                voiceTranscriptRef.current = "";

                // Send — mic stays open so user can speak again during Luna's reply
                sendToServer(formatted, true);
                setTimeout(() => resumeVoiceListening(), 80);
            } else {
                if (continuousListeningRef.current) {
                    resumeVoiceListening();
                }
            }
        }
    }, [isListening, voiceModeActive]); // Runs when listening state changes

    useEffect(() => {
        const handler = () => sendChatSummary();
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, []);

    const quickTopics = [
        "Analyse my personality",
        "Work is stressful",
        "Book a Therapist",
        "Today is great",
        "I am bored",
    ];

    const SIDEBAR_WIDTH_EXPANDED = 270;
    const SIDEBAR_WIDTH_COLLAPSED = 76;
    const sidebarWidth = isMobile
        ? SIDEBAR_WIDTH_EXPANDED
        : collapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH_EXPANDED;

    const renderSidebarContent = (isDesktop = true) => (
        <Box sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            height: "100%",
            overflowY: "auto",
            scrollbarWidth: 'none',
            "&::-webkit-scrollbar": { display: "none" }
        }}>
            {!isDesktop && (
                <Box sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1
                }}>
                    <img src={flowerLogo} alt="logo" style={{ width: 42, height: "auto" }} />
                    <IconButton onClick={() => setMobileOpen(false)} sx={{ color: "#EDDBBF" }}>
                        <AnimatedXIcon color="#EDDBBF" size={24} />
                    </IconButton>
                </Box>
            )}

            {isDesktop && (
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    <img
                        src={flowerLogo}
                        alt="logo"
                        style={{
                            width: collapsed ? 40 : 52,
                            height: "auto",
                            transition: "width 0.3s ease",
                        }}
                    />

                    <IconButton
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        sx={{
                            bgcolor: "#F7EEDB",
                            color: SIDEBAR_BG,
                            width: 44,
                            height: 44,
                            flexShrink: 0,
                            "&:hover": { bgcolor: "#F3E5CB" },
                            transition: "all 0.3s",
                        }}
                    >
                        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </Box>
            )}

            <Box
                sx={{
                    mt: isDesktop ? 1 : 0,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                }}
            >
                {/* Explicit New Chat Button - Only for logged in users */}
                {user && (
                    <Tooltip title={(isDesktop && collapsed) ? "New Chat" : ""} placement="right">
                        <Box
                            onClick={() => {
                                startNewChat();
                                if (!isDesktop) setMobileOpen(false);
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: (isDesktop && collapsed) ? 0 : 1,
                                justifyContent: (isDesktop && collapsed) ? "center" : "flex-start",
                                cursor: "pointer",
                            }}
                        >
                            <IconButton
                                sx={{
                                    color: "#EDDBBF",
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    justifyContent: "center",
                                    bgcolor: "rgba(255,255,255,0.08)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    "&:hover": {
                                        background: "rgba(255,255,255,0.2)",
                                    },
                                }}
                            >
                                <AddIcon />
                            </IconButton>
                            {(!isDesktop || !collapsed) && (
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
                    </Tooltip>
                )}

                {/* Menu Items */}
                {menuItems.map(({ icon, label }) => (
                    <Tooltip key={label} title={(isDesktop && collapsed) ? label : ""} placement="right">
                        <Box
                            onClick={() => {
                                if (label === "Chat with Luna") startNewChat();
                                if (!isDesktop) setMobileOpen(false);
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: (isDesktop && collapsed) ? 0 : 1,
                                justifyContent: (isDesktop && collapsed) ? "center" : "flex-start",
                                cursor: "pointer",
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
                                <AnimateIcon animateOnHover animationType="bounce">
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
                                </AnimateIcon>
                            </IconButton>
                            {(!isDesktop || !collapsed) && (
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
                    </Tooltip>
                ))}

                {/* History List */}
                {user && conversations.length > 0 && (
                    <Box sx={{
                        width: '100%',
                        mt: 2,
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: (isDesktop && collapsed) ? 'center' : 'flex-start',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        "&::-webkit-scrollbar": { display: "none" },
                        position: 'relative'
                    }}>
                        {!(isDesktop && collapsed) && (
                            <Box
                                sx={{
                                    position: 'sticky',
                                    top: 0,
                                    bgcolor: SIDEBAR_BG,
                                    zIndex: 10,
                                    py: 1,
                                    width: '100%',
                                    pl: 3,
                                    mb: 1,
                                }}
                            >
                                <Typography sx={{
                                    fontSize: 11,
                                    color: 'rgba(255,255,255,0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                }}>
                                    History
                                </Typography>
                            </Box>
                        )}

                        {conversations.map((c) => (
                            <Tooltip key={c.id} title={(isDesktop && collapsed) ? (c.title || "Conversation") : ""} placement="right">
                                <Box
                                    onClick={() => {
                                        openConversation(c);
                                        if (!isDesktop) setMobileOpen(false);
                                    }}
                                    sx={{
                                        width: (isDesktop && collapsed) ? 44 : '90%',
                                        mx: 'auto',
                                        mb: 1,
                                        p: (isDesktop && collapsed) ? 0 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: (isDesktop && collapsed) ? 'center' : 'space-between',
                                        borderRadius: 1.5,
                                        cursor: "pointer",
                                        background: activeConversationId === c.id ? "rgba(255,255,255,0.12)" : "transparent",
                                        "&:hover": {
                                            background: "rgba(255,255,255,0.08)",
                                            "& .delete-btn": { opacity: 1 }
                                        },
                                        position: 'relative'
                                    }}
                                >
                                    {isDesktop && collapsed ? (
                                        <IconButton
                                            size="small"
                                            sx={{
                                                color: "rgba(255,255,255,0.9)",
                                                width: 40,
                                                height: 40,
                                            }}
                                        >
                                            <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    ) : (
                                        <>
                                            <Typography
                                                sx={{
                                                    fontSize: 12,
                                                    color: "rgba(255,255,255,0.9)",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    maxWidth: '80%'
                                                }}
                                            >
                                                {c.title || "Conversation"}
                                            </Typography>

                                            <IconButton
                                                className="delete-btn"
                                                size="small"
                                                onClick={(e) => deleteConversation(e, c.id)}
                                                sx={{
                                                    color: "rgba(255,255,255,0.4)",
                                                    opacity: 0,
                                                    transition: 'opacity 0.2s',
                                                    padding: 0.5,
                                                    "&:hover": { color: "#ff6b6b" }
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </>
                                    )}
                                </Box>
                            </Tooltip>
                        ))}
                    </Box>
                )}
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
    );

    return (
        <>
            {/* Prevent mobile keyboard from pushing entire page up */}
            <style>{`
                @media (max-width: 900px) {
                    body {
                        position: fixed;
                        width: 100%;
                        height: 100vh;
                        overflow: hidden;
                    }
                }
            `}</style>

            <Box
                sx={{
                    display: "flex",
                    height: "100%", // Matches fixed body height
                    width: "100%",
                    background: BG_GRADIENT,
                    marginLeft: 0,
                    fontFamily:
                        "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
                    overflow: "hidden", // Fixes keyboard push
                }}
            >
                <CssBaseline />

                {/* Landing Intro Animation */}
                {showLanding && (
                    <LandingIntro onComplete={() => {
                        sessionStorage.setItem('hasSeenLanding', 'true');
                        setShowLanding(false);
                    }} />
                )}

                <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>

                {/* Main App Content */}
                {/* Mobile Sidebar (Drawer) */}
                <Drawer
                    anchor="left"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    sx={{
                        "& .MuiDrawer-paper": {
                            width: sidebarWidth,
                            bgcolor: SIDEBAR_BG,
                            color: "#EDDBBF",
                            p: 2,
                            boxShadow: "none",
                            backgroundImage: "none"
                        },
                    }}
                >
                    {renderSidebarContent(false)}
                </Drawer>

                {/* Desktop Sidebar */}
                {!isMobile && (
                    <Box
                        sx={{
                            width: sidebarWidth,
                            minWidth: sidebarWidth,
                            maxWidth: sidebarWidth,
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
                            overflowX: "hidden",
                            overflowY: "auto",
                            transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1), max-width 300ms cubic-bezier(0.4, 0, 0.2, 1), padding 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                            scrollbarWidth: 'none',
                            "&::-webkit-scrollbar": { display: "none" }
                        }}
                    >
                        {renderSidebarContent(true)}
                    </Box>
                )}

                {!isMobile && (
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
                                    transition: 'transform 0.2s ease-in-out',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                    },
                                }}
                            >
                                Sign up
                            </Button>
                        )}
                    </Box>
                )}

                {/* Mobile Top Navigation */}
                {isMobile && (
                    <Box
                        sx={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 60,
                            background: 'transparent',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 2.5,
                            zIndex: 1200,
                        }}
                    >
                        {/* Left: Menu Button */}
                        <IconButton
                            onClick={() => setMobileOpen(true)}
                            sx={{
                                p: 1,
                            }}
                        >
                            <AnimatedMenuIcon
                                color={SIDEBAR_BG}
                                size={22}
                                isOpen={mobileOpen}
                                animateOnHover={false}
                            />
                        </IconButton>

                        {/* Right: User Avatar or Sign Up */}
                        {user ? (
                            <IconButton
                                onClick={handleSignupClick}
                                sx={{
                                    p: 0,
                                }}
                            >
                                <Box
                                    component="img"
                                    src={user.avatar}
                                    alt={user.name}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                    }}
                                />
                            </IconButton>
                        ) : (
                            <Button
                                onClick={handleSignupClick}
                                sx={{
                                    color: ACCENT_DARK,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    textTransform: "none",
                                    transition: 'transform 0.2s ease-in-out',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                    },
                                }}
                            >
                                Sign up
                            </Button>
                        )}
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
                        height: "100dvh",
                        overflow: "hidden", // Use flex layout instead of scrolling here
                        display: "flex",
                        flexDirection: "column",
                        transition: "margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                        pt: isMobile ? "72px" : 0, // Padding for mobile header
                        // Masking to fade chats behind the transparent top nav
                        ...(isMobile && {
                            maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 100%)",
                            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 100%)",
                        })
                    }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            overflowX: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <Container
                            maxWidth="lg"
                            sx={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                px: isMobile ? 2 : 3,
                                minHeight: "100%",
                                position: "relative",
                            }}
                        >
                            <Box
                                sx={{
                                    display: conversationMode ? "none" : "flex",
                                    flex: 1,
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    pt: conversationMode ? 0 : { xs: 0, md: 10 },
                                    transition: "opacity 320ms ease, transform 320ms ease",
                                    opacity: conversationMode ? 0 : 1,
                                    transform: conversationMode
                                        ? "translateY(-10px) scale(0.99)"
                                        : "none",
                                }}
                            >
                                {/* --- Voice Chat Modal (Global) --- */}
                                <Dialog
                                    open={voiceModalOpen}
                                    onClose={() => setVoiceModalOpen(false)}
                                    PaperProps={{
                                        sx: {
                                            bgcolor: "#F5E4C8", // Page background color
                                            color: "#5b3f2a",
                                            borderRadius: "20px",
                                            border: "2px solid #5b3f2a"
                                        }
                                    }}
                                >
                                    <DialogTitle sx={{ color: "#5b3f2a", fontWeight: "bold" }}>Start Voice Chat?</DialogTitle>
                                    <DialogContent>
                                        <DialogContentText sx={{ color: "#6e4c32" }}>
                                            Do you want to start a continuous voice chat session with Luna?
                                        </DialogContentText>
                                    </DialogContent>
                                    <DialogActions>
                                        <Button onClick={() => setVoiceModalOpen(false)} sx={{ color: "#5b3f2a" }}>Cancel</Button>
                                        <Button onClick={startVoiceMode} variant="contained" sx={{ bgcolor: "#5b3f2a", color: "white", borderRadius: "10px", "&:hover": { bgcolor: "#4a3322" } }}>
                                            Start
                                        </Button>
                                    </DialogActions>
                                </Dialog>

                                <InteractiveSvgAvatar
                                    maxOffsetPx={3}
                                    style={{
                                        width: isMobile ? 120 : 160,
                                        height: isMobile ? 120 : 160,
                                        marginTop: 24,
                                        marginBottom: 12,
                                    }}
                                />

                                {isMobile ? (
                                    <>
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
                                            <TypingAnimation duration={100} delay={showLanding}>
                                                Welcome to Luna
                                            </TypingAnimation>
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
                                            Your Reflective AI Wellness Companion
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
                                        <ScaleLetterText
                                            text="Welcome to Luna"
                                            delay={showLanding ? 0.5 : 0}
                                        />
                                        {" "}
                                        <Box component="span" sx={{ fontWeight: 400 }}>
                                            - Your Reflective AI Wellness Companion
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
                                        I'm here to support your emotional health in any way I can
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
                                        mt: { xs: 8, md: 0 },
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
                                                placeholder={isListening && !voiceModeActive ? "" : "Start typing here..."}
                                                multiline={false}
                                                fullWidth
                                                variant="filled"
                                                InputProps={{
                                                    disableUnderline: true,
                                                    sx: {
                                                        height: 54,
                                                        borderRadius: "28px",
                                                        border: "1px solid #CAA361",
                                                        pr: voiceModeActive
                                                            ? "132px"
                                                            : isListening && !voiceModeActive
                                                                ? "110px"
                                                                : "64px",
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
                                                        "& .MuiInputBase-input.Mui-disabled": {
                                                            opacity: 1,
                                                            "-webkit-text-fill-color": ACCENT_DARK,
                                                        },
                                                        "& .MuiInputBase-input::placeholder":
                                                        {
                                                            color: "#8F7E63",
                                                            opacity: 1,
                                                        },
                                                    },
                                                }}
                                                disabled={sending || (isListening && !voiceModeActive) || voiceModeActive || inputDisabled}
                                            />



                                            {isListening && !voiceModeActive && (
                                                <VoiceWaveformOverlay
                                                    onConfirm={handleConfirmVoice}
                                                    onCancel={handleCancelVoice}
                                                    borderRadius="28px"
                                                />
                                            )}



                                            {/* MIC INSIDE FIELD (hero) */}
                                            {/* Positioned at right: 58 (now left of voice button) */}
                                            <IconButton
                                                type="button"
                                                aria-label="voice input"
                                                onClick={handleMicClick}
                                                disabled={inputDisabled || sending || voiceModeActive}
                                                sx={{
                                                    position: "absolute",
                                                    right: 58,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "50%",
                                                    bgcolor: "transparent",
                                                    boxShadow: "none",
                                                    p: 0,
                                                    "&:hover": { bgcolor: "transparent" },
                                                    display: isListening || voiceModeActive ? "none" : "inline-flex",
                                                }}
                                            >
                                                <Box
                                                    component="svg"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    sx={{
                                                        width: 22,
                                                        height: 22,
                                                        stroke: isListening ? "#b52a2a" : "#503920",
                                                        strokeWidth: 1.4,
                                                        fill: "none",
                                                    }}
                                                >
                                                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                                                    <path d="M19 11a7 7 0 0 1-14 0" />
                                                    <line x1="12" y1="17" x2="12" y2="21" />
                                                    <line x1="8" y1="21" x2="16" y2="21" />
                                                </Box>
                                            </IconButton>

                                            {/* --- VOICE CHAT BUTTON (Landing) --- */}
                                            {/* Positioned at right: 14 (far right) */}
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    right: 14,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    zIndex: 30,
                                                }}
                                            >
                                                <Button
                                                    onClick={voiceModeActive ? stopVoiceMode : () => setVoiceModalOpen(true)}
                                                    variant="contained"
                                                    disableElevation
                                                    sx={{
                                                        bgcolor: "#5b3f2a",
                                                        color: "white",
                                                        minWidth: voiceModeActive ? 120 : 36,
                                                        width: voiceModeActive ? "auto" : 36,
                                                        height: 36,
                                                        borderRadius: voiceModeActive ? "18px" : "50%",
                                                        p: 0,
                                                        px: voiceModeActive ? 2 : 0,
                                                        boxShadow: "none",
                                                        transition: "width 0.25s ease, min-width 0.25s ease, border-radius 0.25s ease",
                                                        "&:hover": { bgcolor: "#4a3322", boxShadow: "none" },
                                                        display: (isListening && !voiceModeActive) ? "none" : "flex",
                                                        gap: 1,
                                                    }}
                                                >
                                                    {voiceModeActive ? (
                                                        <>
                                                            <AnimatedVoiceIcon
                                                                active={isSpeaking}
                                                                idleMode="dots"
                                                                size={20}
                                                            />
                                                            <Typography variant="button" sx={{ textTransform: "none" }}>End</Typography>
                                                        </>
                                                    ) : (
                                                        <AnimatedVoiceIcon active={false} size={20} />
                                                    )}
                                                </Button>
                                            </Box>
                                        </Box>

                                        <Box
                                            component="button"
                                            type="submit"
                                            aria-label="send message"
                                            disabled={sending || !input.trim() || inputDisabled}
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
                                                    input.trim() && !sending && !inputDisabled
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
                                        Disclaimer: Luna offers support, not medical care.
                                        Always consult a professional.
                                    </Typography>
                                </>
                            )}

                    </Box>

                    {isMobile && !conversationMode && (
                        <Box sx={{ mt: "auto", pb: 3, width: "100%" }}>
                            <Typography
                                variant="caption"
                                align="center"
                                sx={{
                                    color: "rgba(80, 57, 32, 0.5)",
                                    px: 4,
                                    fontSize: 14,
                                    fontWeight: 100,
                                    display: "block",
                                    textAlign: "center"
                                }}
                            >
                                Disclaimer: Luna offers support, not medical care.
                                Always consult a professional.
                            </Typography>
                        </Box>
                    )}

                    {/* Conversation view */}
                    {conversationMode && (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: "auto",
                                pt: { xs: 8, md: 6 },
                                pb: { xs: 12, md: 2 }, // Extra padding on mobile for fixed input
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
                                                        {renderChatText(m.text, ACCENT_DARK)}
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
                                                        {renderChatText(m.text, ACCENT_DARK)}
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
                        </Box>
                    )}
                </Container>
            </Box >

            {/* Input bar (flex item at bottom) */}
            {conversationMode && (
                <Box
                    component="form"
                    onSubmit={onSubmit}
                    sx={{
                        borderTop: 1,
                        borderColor: "rgba(0,0,0,0.08)",
                        pt: 2,
                        pb: 0,
                        width: "100%",
                        background: BG_GRADIENT,
                        backgroundAttachment: "fixed",
                        zIndex: 100,
                        flexShrink: 0,
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
                            <Box sx={{ position: "relative", flex: 1 }}>
                                <TextField
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    placeholder={isListening && !voiceModeActive ? "" : "Send a message..."}
                                    multiline
                                    minRows={1}
                                    maxRows={6}
                                    fullWidth
                                    variant="filled"
                                    InputProps={{
                                        disableUnderline: true,
                                        sx: {
                                            borderRadius: "18px",
                                            pr: voiceModeActive
                                                ? "132px"
                                                : isListening && !voiceModeActive
                                                    ? "110px"
                                                    : "64px",
                                            pl: 3,
                                            bgcolor: INPUT_BG,
                                            paddingY: "14px",
                                            "& .MuiInputBase-input": {
                                                fontSize: 16,
                                                lineHeight: 1.6,
                                                color: ACCENT_DARK,
                                            },
                                        },
                                    }}
                                    disabled={sending || (isListening && !voiceModeActive) || voiceModeActive || inputDisabled}
                                />

                                <IconButton
                                    type="button"
                                    aria-label="voice input"
                                    onClick={handleMicClick}
                                    disabled={inputDisabled || sending || voiceModeActive}
                                    sx={{
                                        position: "absolute",
                                        right: 58,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        bgcolor: "transparent",
                                        boxShadow: "none",
                                        p: 0,
                                        "&:hover": { bgcolor: "transparent" },
                                        opacity: isListening ? 1 : 0.9,
                                        display: isListening || voiceModeActive ? "none" : "inline-flex"
                                    }}
                                >
                                    <Box
                                        component="svg"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            stroke: isListening ? "#b52a2a" : "#503920",
                                            strokeWidth: 1.4,
                                            fill: "none",
                                            display: "block",
                                        }}
                                    >
                                        <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                                        <path d="M19 11a7 7 0 0 1-14 0" />
                                        <line x1="12" y1="17" x2="12" y2="21" />
                                        <line x1="8" y1="21" x2="16" y2="21" />
                                    </Box>
                                </IconButton>
                                <Box
                                    sx={{
                                        position: "absolute",
                                        right: 14,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        zIndex: 30,
                                    }}
                                >
                                    <Button
                                        onClick={voiceModeActive ? stopVoiceMode : () => setVoiceModalOpen(true)}
                                        variant="contained"
                                        disableElevation
                                        disabled={inputDisabled}
                                        sx={{
                                            bgcolor: "#5b3f2a",
                                            color: "white",
                                            minWidth: voiceModeActive ? 120 : 36,
                                            width: voiceModeActive ? "auto" : 36,
                                            height: 36,
                                            borderRadius: voiceModeActive ? "18px" : "50%",
                                            p: 0,
                                            px: voiceModeActive ? 2 : 0,
                                            boxShadow: "none",
                                            transition: "width 0.25s ease, min-width 0.25s ease, border-radius 0.25s ease",
                                            "&:hover": { bgcolor: "#4a3322", boxShadow: "none" },
                                            display: (isListening && !voiceModeActive) ? "none" : "flex",
                                            gap: 1,
                                        }}
                                    >
                                        {voiceModeActive ? (
                                            <>
                                                <AnimatedVoiceIcon
                                                    active={isSpeaking}
                                                    idleMode="dots"
                                                    size={20}
                                                />
                                                <Typography variant="button" sx={{ textTransform: "none" }}>End</Typography>
                                            </>
                                        ) : (
                                            <AnimatedVoiceIcon active={false} size={20} />
                                        )}
                                    </Button>
                                </Box>

                                {isListening && !voiceModeActive && (
                                    <VoiceWaveformOverlay
                                        onConfirm={handleConfirmVoice}
                                        onCancel={handleCancelVoice}
                                        borderRadius="18px"
                                    />
                                )}
                            </Box>

                            <Box
                                component="button"
                                type="submit"
                                aria-label="send message"
                                disabled={sending || !input.trim() || inputDisabled}
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
                        <Typography
                            variant="caption"
                            align="center"
                            sx={{
                                color: "rgba(80, 57, 32, 0.8)",
                                fontSize: 12,
                                fontWeight: 400,
                                display: "block",
                                textAlign: "center",
                                mt: 1,
                                mb: 0,
                                width: "100%",
                            }}
                        >
                            Disclaimer: Luna offers support, not medical care. Always consult a professional.
                        </Typography>
                    </Container>
                </Box>
            )}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: "20px",
                        bgcolor: PAPER_BG,
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ color: ACCENT_DARK, fontWeight: 700 }}>
                    Delete History?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: "rgba(43, 26, 17, 0.7)" }}>
                        Are you sure you want to delete this chat history? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ color: "rgba(43, 26, 17, 0.5)", textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        sx={{
                            bgcolor: "#ff6b6b",
                            color: "#fff",
                            borderRadius: "10px",
                            textTransform: 'none',
                            "&:hover": { bgcolor: "#ff5252" }
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    </Box >
            </>
    );
}
