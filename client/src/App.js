// メインアプリケーションコンポーネント
import React, { useState, useEffect } from 'react';
import ReceiptUpload from './components/ReceiptUpload';
import ItemList from './components/ItemList';
import Charts from './components/Charts';
import Summary from './components/Summary';
import './App.css';

// ローカルストレージのキー
const STORAGE_KEY = 'kakeibo_receipts';

function App() {
  // ローカルストレージから初期データを読み込む
  const [receipts, setReceipts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // レシートデータが更新されるたびにローカルストレージに保存する
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  }, [receipts]);

  // レシート解析結果を追加する
  const handleReceiptAnalyzed = (receiptData) => {
    const newReceipt = {
      id: Date.now(),
      ...receiptData,
      createdAt: new Date().toISOString(),
    };
    setReceipts((prev) => [newReceipt, ...prev]);
    setActiveTab('list');
  };

  // レシートを削除する
  const handleDeleteReceipt = (id) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  // 全データをリセットする
  const handleReset = () => {
    if (window.confirm('すべてのデータを削除しますか？')) {
      setReceipts([]);
    }
  };

  // 全アイテムをフラットなリストに変換する
  const allItems = receipts.flatMap((receipt) =>
    receipt.items.map((item) => ({
      ...item,
      date: receipt.date,
      store: receipt.store,
      receiptId: receipt.id,
    }))
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>レシート家計簿</h1>
        <p className="app-subtitle">レシートを撮影してアップロードするだけで自動で家計簿に記録</p>
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
            <Summary allItems={allItems} />
            <ItemList
              receipts={receipts}
              onDelete={handleDeleteReceipt}
              onReset={handleReset}
            />
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
