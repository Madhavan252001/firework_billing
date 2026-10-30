import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Billing from './pages/billing';
import Checkout from './pages/checkout';
import Login from './pages/login';
import ViewBill from './pages/ViewBill';

function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('bmes_logged_in') === 'true' && Boolean(localStorage.getItem('auth_token'));
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <CartProvider>
      <BrowserRouter basename="/billing">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/bill/:orderId" element={<ViewBill />} />
          <Route path="/billing" element={
            <ProtectedRoute><Billing /></ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute><Checkout /></ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
