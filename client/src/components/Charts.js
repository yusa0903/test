// Chart.jsを使ったグラフ表示コンポーネント
import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import './Charts.css';

// Chart.jsのコンポーネントを登録する
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// カテゴリ別の色定義
const CATEGORY_COLORS = {
  食費: '#4ade80',
  外食: '#f97316',
  日用品: '#60a5fa',
  交通費: '#a78bfa',
  医療費: '#f43f5e',
  娯楽: '#fbbf24',
  その他: '#94a3b8',
};

function Charts({ allItems, receipts }) {
  if (allItems.length === 0) {
    return (
      <div className="charts-empty">
        <p className="empty-icon">📊</p>
        <p>データがありません</p>
        <p className="empty-sub">レシートを登録するとグラフが表示されます</p>
      </div>
    );
  }

  // カテゴリ別に集計してグラフデータを作成する
  const categoryTotals = allItems.reduce((acc, item) => {
    const cat = item.category || 'その他';
    acc[cat] = (acc[cat] || 0) + (item.price || 0);
    return acc;
  }, {});

  const categoryLabels = Object.keys(categoryTotals);
  const categoryValues = Object.values(categoryTotals);
  const categoryColors = categoryLabels.map((c) => CATEGORY_COLORS[c] || '#94a3b8');

  // 円グラフのデータ
  const pieData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryValues,
        backgroundColor: categoryColors,
        borderColor: 'white',
        borderWidth: 2,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => `¥${ctx.parsed.toLocaleString()}`,
        },
      },
    },
  };

  // 月別に集計してグラフデータを作成する（直近6ヶ月）
  const monthlyTotals = receipts.reduce((acc, receipt) => {
    const month = receipt.date ? receipt.date.substring(0, 7) : '不明';
    acc[month] = (acc[month] || 0) + (receipt.total || 0);
    return acc;
  }, {});

  // 月を昇順にソートして直近6ヶ月分を取る
  const sortedMonths = Object.keys(monthlyTotals).sort().slice(-6);
  const monthlyValues = sortedMonths.map((m) => monthlyTotals[m]);

  // 棒グラフのデータ
  const barData = {
    labels: sortedMonths.map((m) => m.replace('-', '年') + '月'),
    datasets: [
      {
        label: '支出合計',
        data: monthlyValues,
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: '#667eea',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `¥${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `¥${value.toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div className="charts-container">
      {/* カテゴリ別円グラフ */}
      <div className="chart-card">
        <h2 className="chart-title">カテゴリ別支出</h2>
        <div className="chart-wrap chart-pie">
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>

      {/* 月別棒グラフ */}
      <div className="chart-card">
        <h2 className="chart-title">月別支出推移</h2>
        <div className="chart-wrap chart-bar">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}

export default Charts;
