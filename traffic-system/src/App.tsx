// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
// 為了讓路由完整，我們先建立幾個空的範例頁面
import ViolationLog from './pages/ViolationLog';
import GenerateTickets from './components/violations/GenerateTickets';
//import Analytics from './pages/Analytics';
//import SystemManagement from './pages/SystemManagement';


function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="violations" element={<ViolationLog />} />
        <Route path="/generate-tickets" element={<GenerateTickets />} />
        {/*<Route path="analytics" element={<Analytics />} /> 
        {/*<Route path="system" element={<SystemManagement />} />
        {/* 你可以在這裡加入其他頁面的路由 */}
      </Route>
    </Routes>
  );
}

export default App;