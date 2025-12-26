import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatScreenMui from "./ChatScreenMui";
import AdminDashboard from "./AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatScreenMui />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
