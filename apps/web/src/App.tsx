import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminDocumentsPage } from "./pages/AdminDocumentsPage.js";
import { AdminPage } from "./pages/AdminPage.js";
import { ChatPage } from "./pages/ChatPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/documents" element={<AdminDocumentsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
