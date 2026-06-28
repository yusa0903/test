// メインアプリケーションコンポーネント
import React, { useState, useEffect, useCallback } from 'react';
import ReceiptUpload from './components/ReceiptUpload';
import ItemList from './components/ItemList';
import Charts from './components/Charts';
import Summary from './components/Summary';
import Login from './components/Login';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import './App.css';

// 認証済みトークンをAuthorizationヘッダーとして取得するヘルパー
const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session.access_token}` };
};

function App() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();

  const [receipts, setReceipts]       = useState([]);
  const [activeTab, setActiveTab]     = useState('upload');
  const [isLoading, setIsLoading]     = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError]             = useState(null);

  // ログイン中のユーザーのレシートをサーバーから取得する
  const loadReceipts = useCallback(async () => {
    setDataLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/receipts', { headers });
      if (!res.ok) throw new Error('データの取得に失敗しました');
      const data = await res.json();
      setReceipts(data.receipts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // 認証状態が変わるたびにレシートを取得する
  useEffect(() => {
    if (user) loadReceipts();
    else setReceipts([]);
  }, [user, loadReceipts]);

  // レシート解析完了後にSupabaseへ保存する
  const handleReceiptAnalyzed = async (receiptData) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/receipts', {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify(receiptData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存に失敗しました');
      }
      const saved = await res.json();
      setReceipts((prev) => [saved, ...prev]);
      setActiveTab('list');
    } catch (err) {
      setError(err.message);
    }
  };

  // 指定IDのレシートを削除する
  const handleDeleteReceipt = async (id) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('削除に失敗しました');
      setReceipts((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  // 自分のレシートを全件削除する
  const handleReset = async () => {
    if (!window.confirm('すべてのデータを削除しますか？')) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/receipts', { method: 'DELETE', headers });
      if (!res.ok) throw new Error('削除に失敗しました');
      setReceipts([]);
    } catch (err) {
      setError(err.message);
    }
  };

  // 全アイテムをフラットなリストに変換する
  const allItems = receipts.flatMap((receipt) =>
    (receipt.items || []).map((item) => ({
      ...item,
      date:      receipt.date,
      store:     receipt.store,
      receiptId: receipt.id,
    }))
  );

  // 認証ロード中はスピナーを表示する
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>読み込み中...</p>
      </div>
    );
  }

  // 未ログインはログイン画面を表示する
  if (!user) return <Login />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>レシート家計簿</h1>
            <p className="app-subtitle">レシートを撮影してアップロードするだけで自動で家計簿に記録</p>
          </div>
          <div className="header-user">
            {isAdmin && <span className="admin-badge">管理者</span>}
            <span className="user-email">{user.email}</span>
            <button className="logout-btn" onClick={signOut}>ログアウト</button>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          レシート登録
        </button>
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          明細一覧 {receipts.length > 0 && <span className="badge">{receipts.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          グラフ分析
        </button>
      </nav>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {activeTab === 'upload' && (
          <ReceiptUpload
            onAnalyzed={handleReceiptAnalyzed}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            setError={setError}
          />
        )}

        {activeTab === 'list' && (
          <>
            {dataLoading ? (
              <div className="data-loading">データを読み込み中...</div>
            ) : (
              <>
                <Summary allItems={allItems} />
                <ItemList
                  receipts={receipts}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteReceipt}
                  onReset={handleReset}
                />
              </>
            )}
          </>
        )}

        {activeTab === 'charts' && (
          <Charts allItems={allItems} receipts={receipts} />
        )}
      </main>
    </div>
  );
}

export default App;
