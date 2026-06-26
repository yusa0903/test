// レシート画像アップロード・解析コンポーネント
import React, { useState, useRef } from 'react';
import './ReceiptUpload.css';

function ReceiptUpload({ onAnalyzed, isLoading, setIsLoading, setError }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  // サーバーにレシート画像を送信してClaude APIで解析する
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

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
      onAnalyzed(data);

      // 解析完了後にプレビューをリセットする
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
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

      {isLoading && (
        <div className="loading-message">
          <p>Claude AIがレシートを読み取っています...</p>
          <p className="loading-sub">少々お待ちください</p>
        </div>
      )}
    </div>
  );
}

export default ReceiptUpload;
