import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { FiSend, FiSun, FiMoon } from "react-icons/fi";

const themes = {
  light: {
    background: "linear-gradient(135deg, #f0f4f8, #d9e2ec)",
    containerBg: "white",
    headerBg: "#007bff",
    headerColor: "white",
    chatBg: "#f8fafc",
    userBubbleBg: "#007bff",
    userBubbleColor: "white",
    botBubbleBg: "#e2e8f0",
    botBubbleColor: "#1a202c",
    inputBg: "white",
    inputBorder: "#cbd5e0",
    sendButtonBg: "#007bff",
    sendButtonDisabledBg: "#cbd5e0",
    sendButtonColor: "white",
  },
  dark: {
    background: "linear-gradient(135deg, #1f2937, #111827)",
    containerBg: "#1f2937",
    headerBg: "#374151",
    headerColor: "white",
    chatBg: "#111827",
    userBubbleBg: "#4f46e5",
    userBubbleColor: "white",
    botBubbleBg: "#374151",
    botBubbleColor: "#d1d5db",
    inputBg: "#1f2937",
    inputBorder: "#4b5563",
    sendButtonBg: "#4f46e5",
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
                color: currentTheme.botBubbleColor,
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
