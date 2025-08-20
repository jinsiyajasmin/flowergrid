import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { FiSend, FiSun, FiMoon } from "react-icons/fi";

const themes = {
  light: {
    background: "linear-gradient(135deg, #f0f4f8, #d9e2ec)",
    containerBg: "white",
    headerBg: "#263746",       // Dark grey header
    headerColor: "white",
    chatBg: "#f8fafc",
    userBubbleBg: "#263746",   // Dark grey user bubble
    userBubbleColor: "white",
    botBubbleBg: "#DFF1E9",    // ✅ Updated soft green for bot bubble
    botBubbleColor: "#000000", // Black text for readability
    inputBg: "white",
    inputBorder: "#263746",    // Dark grey border
    inputText: "#000000",      // Black text in light mode
    sendButtonBg: "#263746",   // Dark grey send button
    sendButtonDisabledBg: "#cbd5e0",
    sendButtonColor: "white",
  },
  dark: {
    background: "linear-gradient(135deg, #1f2937, #111827)",
    containerBg: "#1f2937",
    headerBg: "#263746",       // Dark grey header
    headerColor: "white",
    chatBg: "#1c2732",
    userBubbleBg: "#263746",   // Dark grey user bubble
    userBubbleColor: "white",
    botBubbleBg: "#DFF1E9",    // ✅ Updated soft green for bot bubble
    botBubbleColor: "#000000", // Black text for readability
    inputBg: "#111827",
    inputBorder: "#263746",    // Dark grey border
    inputText: "#ffffff",      // White text in dark mode
    sendButtonBg: "#263746",   // Dark grey send button
    sendButtonDisabledBg: "#374151",
    sendButtonColor: "white",
  },
};

// Three dots typing indicator for chat
const TypingIndicator = ({ color }) => (
  <div style={{
    display: "flex",
    gap: "4px",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0.5rem 1rem",
    backgroundColor: color.bg,
    color: color.text,
    borderRadius: "18px",
    maxWidth: "80%",
    lineHeight: 1.5,
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    fontSize: "1rem"
  }}>
    <span style={dotStyle(0, color.text)} />
    <span style={dotStyle(1, color.text)} />
    <span style={dotStyle(2, color.text)} />
  </div>
);

const dotStyle = (i, dotColor) => ({
  width: "6px",
  height: "6px",
  backgroundColor: dotColor || "currentColor",
  borderRadius: "50%",
  display: "inline-block",
  animation: `dotPulse 1.4s infinite ease-in-out`,
  animationDelay: `${i * 0.2}s`
});

function App() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! Ask me anything about your ISO notes." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("light");

  const currentTheme = themes[theme];
  const messagesEndRef = useRef(null);

  // 🔥 Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages(m => [...m, { role: "user", text: question }]);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ message: question })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(m => [...m, { role: "bot", text: data.answer }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(m => [...m, { role: "bot", text: "⚠️ Server error. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => { 
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(); 
    }
  };

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <>
      <style>
        {`
          @keyframes dotPulse {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: currentTheme.background,
        fontFamily: "Inter, sans-serif",
        padding: "1rem",
        boxSizing: "border-box",
        transition: "background 0.5s ease-in-out"
      }}>
        <div style={{
          backgroundColor: currentTheme.containerBg,
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          height: "90vh",
          overflow: "hidden",
          transition: "background-color 0.5s ease-in-out"
        }}>
          {/* Header */}
          <div style={{
            padding: "1rem 1.5rem",
            backgroundColor: currentTheme.headerBg,
            color: currentTheme.headerColor,
            fontWeight: "600",
            fontSize: "1.25rem",
            textAlign: "center",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            transition: "background-color 0.5s ease-in-out"
          }}>
            <span>ISO Chat Assistant</span>
            <button
              onClick={toggleTheme}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                transition: "transform 0.2s"
              }}
            >
              {theme === "light" ? <FiMoon size={22} /> : <FiSun size={22} />}
            </button>
          </div>

          {/* Chat messages */}
          <div style={{
            flex: 1,
            padding: "1rem",
            overflowY: "auto",
            backgroundColor: currentTheme.chatBg,
            transition: "background-color 0.5s ease-in-out"
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                marginBottom: "1rem",
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                animation: "fadeIn 0.5s ease-in-out"
              }}>
                <div style={{
                  backgroundColor: m.role === "user" ? currentTheme.userBubbleBg : currentTheme.botBubbleBg,
                  color: m.role === "user" ? currentTheme.userBubbleColor : currentTheme.botBubbleColor,
                  padding: "0.75rem 1rem",
                  borderRadius: "18px",
                  maxWidth: "80%",
                  lineHeight: "1.5",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                  transition: "background-color 0.5s ease-in-out, color 0.5s ease-in-out"
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "1rem" }}>
                <TypingIndicator color={{ bg: currentTheme.botBubbleBg, text: currentTheme.botBubbleColor }} />
              </div>
            )}

            {/* 🔥 Auto-scroll target */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${currentTheme.inputBorder}`,
            padding: "1rem",
            backgroundColor: currentTheme.containerBg,
            gap: "0.5rem",
            transition: "background-color 0.5s ease-in-out"
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type your question..."
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                borderRadius: "20px",
                border: `1px solid ${currentTheme.inputBorder}`,
                backgroundColor: currentTheme.inputBg,
                color: currentTheme.inputText,
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.3s, box-shadow 0.3s, background-color 0.5s, color 0.5s"
              }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: (loading || !input.trim()) ? currentTheme.sendButtonDisabledBg : currentTheme.sendButtonBg,
                color: currentTheme.sendButtonColor,
                border: "none",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.3s, transform 0.2s, box-shadow 0.3s"
              }}
            >
              <FiSend size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
