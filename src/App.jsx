import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";

import Home from "./pages/Home";
import Stock from "./pages/Stock";
import Add from "./pages/Add";
import History from "./pages/History";
import Income from "./pages/Income";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/add" element={<Add />} />
        <Route path="/history" element={<History />} />
        <Route path="/income" element={<Income />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}