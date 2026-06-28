// ログイン・新規登録コンポーネント
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

function Login() {
  const [mode, setMode]       = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [message, setMessage] = useState(null);
  const { signIn, signUp }    = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setMessage('確認メールを送信しました。メール内のリンクをクリックしてからログインしてください。');
        setMode('login');
      }
    } catch (err) {
      // Supabaseのエラーメッセージを日本語に変換する
      const msg = err.message;
      if (msg.includes('Invalid login credentials')) setError('メールアドレスまたはパスワードが正しくありません');
      else if (msg.includes('Email not confirmed'))  setError('メールアドレスの確認が完了していません');
      else if (msg.includes('already registered'))  setError('このメールアドレスはすでに登録されています');
      else if (msg.includes('Password should'))     setError('パスワードは6文字以上で入力してください');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">🧾</div>
        <h1 className="login-title">レシート家計簿</h1>
        <p className="login-sub">
          {mode === 'login' ? 'アカウントにログイン' : '新規アカウントを作成'}
        </p>

        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-message">{message}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="login-spinner" /> : null}
            {mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <div className="login-toggle">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでない方は{' '}
              <button onClick={() => { setMode('signup'); setError(null); setMessage(null); }}>
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちの方は{' '}
              <button onClick={() => { setMode('login'); setError(null); setMessage(null); }}>
                ログイン
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
