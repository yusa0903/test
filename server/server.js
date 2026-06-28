// レシート読み込み家計簿アプリのバックエンドサーバー
// __dirnameで絶対パスを指定し、実行場所に依存しないようにする
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3001;

// Claude APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ファイルをメモリに一時保存（ディスクに書き出さない）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 最大10MB
  fileFilter: (req, file, cb) => {
    // 画像ファイルのみ受け付ける
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロード可能です'), false);
    }
  },
});

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// レシート画像をClaude APIで解析するエンドポイント
app.post('/api/analyze-receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '画像ファイルが必要です' });
  }

  try {
    // 画像をBase64エンコード
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    // Claude APIにレシート解析を依頼
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `このレシート画像を解析して、以下のJSON形式で情報を抽出してください。
日付が読み取れない場合は今日の日付を使用してください。
カテゴリは「食費」「外食」「日用品」「交通費」「医療費」「娯楽」「その他」から最も適切なものを選んでください。

{
  "date": "YYYY-MM-DD形式の日付",
  "store": "店舗名",
  "items": [
    {
      "name": "商品名",
      "price": 金額（数値のみ、円マーク不要）,
      "category": "カテゴリ名"
    }
  ],
  "total": 合計金額（数値のみ）
}

JSONのみを返してください。余分な説明は不要です。`,
            },
          ],
        },
      ],
    });

    // Claude APIのレスポンスからJSONを抽出
    const content = response.content[0].text.trim();
    // コードブロックが含まれている場合は除去する
    const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const receiptData = JSON.parse(jsonText);

    res.json(receiptData);
  } catch (error) {
    console.error('レシート解析エラー:', error);
    if (error instanceof SyntaxError) {
      res.status(500).json({ error: 'レシートの解析結果を読み取れませんでした' });
    } else {
      res.status(500).json({ error: 'レシートの解析中にエラーが発生しました: ' + error.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
