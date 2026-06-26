// 合計金額・カテゴリ別サマリーコンポーネント
import React from 'react';
import './Summary.css';

// カテゴリのアイコンマッピング
const CATEGORY_ICONS = {
  食費: '🛒',
  外食: '🍽️',
  日用品: '🧴',
  交通費: '🚃',
  医療費: '💊',
  娯楽: '🎮',
  その他: '📦',
};

function Summary({ allItems }) {
  if (allItems.length === 0) {
    return null;
  }

  // カテゴリ別に集計する
  const categoryTotals = allItems.reduce((acc, item) => {
    const cat = item.category || 'その他';
    acc[cat] = (acc[cat] || 0) + (item.price || 0);
    return acc;
  }, {});

  const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

  return (
    <div className="summary-container">
      <div className="summary-total">
        <span className="summary-total-label">合計支出</span>
        <span className="summary-total-amount">¥{total.toLocaleString()}</span>
      </div>

      <div className="summary-categories">
        {Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => (
            <div key={category} className="summary-category-item">
              <span className="category-icon">{CATEGORY_ICONS[category] || '📦'}</span>
              <span className="category-name">{category}</span>
              <span className="category-amount">¥{amount.toLocaleString()}</span>
              <div className="category-bar-wrap">
                <div
                  className="category-bar"
                  style={{ width: `${(amount / total) * 100}%` }}
                />
              </div>
              <span className="category-pct">{Math.round((amount / total) * 100)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default Summary;
