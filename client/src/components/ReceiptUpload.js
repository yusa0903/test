// レシート画像アップロード・解析コンポーネント
import React, { useState, useRef, useEffect } from 'react';
import './ReceiptUpload.css';

// 解析ステップの定義（ラベルと完了目安の進捗率）
const STEPS = [
  { label: '画像をアップロード中...', target: 20 },
  { label: 'Claude AIが画像を読み取り中...', target: 55 },
  { label: '商品・金額を抽出中...', target: 80 },
  { label: 'カテゴリを分類中...', target: 95 },
];

function ReceiptUpload({ onAnalyzed, isLoading, setIsLoading, setError }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);

  // ローディング終了時にプログレスをリセットする
  useEffect(() => {
    if (!isLoading) {
      clearInterval(progressTimerRef.current);
      setProgress(0);
      setStepLabel('');
    }
  }, [isLoading]);

  // ファイルが選択・ドロップされたときの処理
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }
    setSelectedFile(file);
    setError(null);

    // プレビュー用URLを作成する
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleFileInput = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // 疑似的な進捗バーをインターバルで進める
  const startProgress = () => {
    let current = 0;
    setProgress(0);
    setStepLabel(STEPS[0].label);

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        // 現在のステップを特定し、次のターゲット手前で一時停止する
        const currentStep = STEPS.findLast((s) => prev >= s.target - 1) ?? STEPS[0];
        const nextStep = STEPS[STEPS.indexOf(currentStep) + 1];
        const ceiling = nextStep ? nextStep.target - 1 : 94; // API応答待ちで95%で止まる

        if (prev >= ceiling) return prev;

        const next = Math.min(prev + Math.random() * 3, ceiling);
        // ステップラベルを更新する
        const activeStep = STEPS.findLast((s) => next >= s.target - 15) ?? STEPS[0];
        setStepLabel(activeStep.label);
        return next;
      });
    }, 200);
  };

  // サーバーにレシート画像を送信してClaude APIで解析する
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);
    startProgress();

    try {
      const formData = new FormData();
      formData.append('receipt', selectedFile);

      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '解析に失敗しました');
      }

      const data = await response.json();

      // 完了アニメーション：100%まで一気に進める
      clearInterval(progressTimerRef.current);
      setProgress(100);
      setStepLabel('解析完了！');

      await new Promise((r) => setTimeout(r, 600));

      onAnalyzed(data);

      // 解析完了後にプレビューをリセットする
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      clearInterval(progressTimerRef.current);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="upload-container">
      <h2 className="section-title">レシートを登録する</h2>

      {!preview ? (
        // ドラッグ&ドロップエリア
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📷</div>
          <p className="drop-zone-text">レシート画像をここにドロップ</p>
          <p className="drop-zone-sub">またはクリックしてファイルを選択</p>
          <p className="drop-zone-hint">対応形式: JPG, PNG, GIF, WebP（最大10MB）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        // プレビュー表示エリア
        <div className="preview-area">
          <img src={preview} alt="レシートプレビュー" className="preview-image" />
          <div className="preview-actions">
            <button className="btn btn-secondary" onClick={handleReset} disabled={isLoading}>
              別の画像を選ぶ
            </button>
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  AI解析中...
                </>
              ) : (
                '🤖 AIで解析する'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 進捗バー：解析中のみ表示 */}
      {isLoading && (
        <div className="progress-area">
          <div className="progress-header">
            <span className="progress-label">{stepLabel}</span>
            <span className="progress-pct">{Math.round(progress)}%</span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${progress === 100 ? 'complete' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-steps">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`progress-step ${progress >= step.target ? 'done' : ''}`}
              >
                <span className="step-dot" />
                <span className="step-text">{step.label.replace('...', '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptUpload;
