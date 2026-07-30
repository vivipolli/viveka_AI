import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage.js";
import { ChatPage } from "./pages/ChatPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
