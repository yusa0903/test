// レシート一覧・明細表示コンポーネント
import React, { useState } from 'react';
import './ItemList.css';

const CATEGORY_COLORS = {
  食費: '#4ade80',
  外食: '#f97316',
  日用品: '#60a5fa',
  交通費: '#a78bfa',
  医療費: '#f43f5e',
  娯楽: '#fbbf24',
  その他: '#94a3b8',
};

function ItemList({ receipts, onDelete, onReset }) {
  // 展開中のレシートIDを管理する
  const [expandedId, setExpandedId] = useState(null);

  if (receipts.length === 0) {
    return (
      <div className="list-empty">
        <p className="empty-icon">🧾</p>
        <p>まだレシートが登録されていません</p>
        <p className="empty-sub">「レシート登録」タブから画像をアップロードしてください</p>
      </div>
    );
  }

  return (
    <div className="list-container">
      <div className="list-header">
        <h2 className="section-title">登録済みレシート</h2>
        <button className="btn-danger" onClick={onReset}>
          全削除
        </button>
      </div>

      <div className="receipt-list">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="receipt-card">
            <div
              className="receipt-card-header"
              onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
            >
              <div className="receipt-meta">
                <span className="receipt-date">{receipt.date}</span>
                <span className="receipt-store">{receipt.store || '店舗不明'}</span>
              </div>
              <div className="receipt-right">
                <span className="receipt-total">¥{(receipt.total || 0).toLocaleString()}</span>
                <span className="expand-icon">{expandedId === receipt.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* 展開時に明細を表示する */}
            {expandedId === receipt.id && (
              <div className="receipt-detail">
                <table className="item-table">
                  <thead>
                    <tr>
                      <th>商品名</th>
                      <th>カテゴリ</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td>
                          <span
                            className="category-tag"
                            style={{
                              background: CATEGORY_COLORS[item.category] || '#94a3b8',
                            }}
                          >
                            {item.category || 'その他'}
                          </span>
                        </td>
                        <td className="price-cell">¥{(item.price || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="receipt-actions">
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => onDelete(receipt.id)}
                  >
                    このレシートを削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ItemList;
