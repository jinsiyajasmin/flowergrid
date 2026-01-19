import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatScreenMui from "./ChatScreenMui";
import AdminDashboard from "./AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatScreenMui />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Page Not Found (React)</div>} />
      </Routes>
    </BrowserRouter>
  );
}
