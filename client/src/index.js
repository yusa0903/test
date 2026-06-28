import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // 認証コンテキストをアプリ全体に提供する
  <AuthProvider>
    <App />
  </AuthProvider>
);
