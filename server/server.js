// レシート読み込み家計簿アプリのバックエンドサーバー
// __dirnameで絶対パスを指定し、実行場所に依存しないようにする
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// 社内プロキシ等によるSSL証明書エラーを回避する（開発環境用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3001;

// Claude APIクライアントの初期化
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Supabase管理者クライアント（service_role_keyでRLSを迂回する）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ファイルをメモリに一時保存（ディスクに書き出さない）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'), false);
  },
});

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// ───────────────────────────────────────────────
// JWTトークンを検証して req.user にユーザー情報をセットするミドルウェア
// ───────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '認証が必要です' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: '無効なトークンです' });

  req.user = user;
  next();
};

// ユーザーのロールを取得するヘルパー
const getUserRole = async (userId) => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  return data?.role || 'user';
};

// ───────────────────────────────────────────────
// ユーザー情報・ロールを返す
// ───────────────────────────────────────────────
app.get('/api/me', authenticate, async (req, res) => {
  const role = await getUserRole(req.user.id);
  res.json({ id: req.user.id, email: req.user.email, role });
});

// ───────────────────────────────────────────────
// レシート一覧取得
// 管理者：全ユーザーのレシートを返す
// 一般ユーザー：自分のレシートのみ返す
// ───────────────────────────────────────────────
app.get('/api/receipts', authenticate, async (req, res) => {
  const role    = await getUserRole(req.user.id);
  const isAdmin = role === 'admin';

  let query = supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    query = query.eq('user_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('receipts クエリエラー:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ receipts: data, isAdmin });
});

// ───────────────────────────────────────────────
// レシートを保存する
// ───────────────────────────────────────────────
app.post('/api/receipts', authenticate, async (req, res) => {
  const { date, store, items, total } = req.body;

  const { data, error } = await supabase
    .from('receipts')
    .insert({
      user_id:    req.user.id,
      user_email: req.user.email,
      date,
      store,
      items,
      total,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ───────────────────────────────────────────────
// 指定IDのレシートを削除する
// 管理者：任意のレシートを削除可能
// 一般ユーザー：自分のレシートのみ削除可能
// ───────────────────────────────────────────────
app.delete('/api/receipts/:id', authenticate, async (req, res) => {
  const role    = await getUserRole(req.user.id);
  const isAdmin = role === 'admin';

  let query = supabase.from('receipts').delete().eq('id', req.params.id);
  if (!isAdmin) {
    query = query.eq('user_id', req.user.id);
  }

  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ───────────────────────────────────────────────
// 自分のレシートを全件削除する（一般ユーザーは自分のデータのみ）
// ───────────────────────────────────────────────
app.delete('/api/receipts', authenticate, async (req, res) => {
  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ───────────────────────────────────────────────
// レシート画像をClaude APIで解析する（認証必須）
// ───────────────────────────────────────────────
app.post('/api/analyze-receipt', authenticate, upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '画像ファイルが必要です' });

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mediaType   = req.file.mimetype;

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
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
    { "name": "商品名", "price": 金額（数値のみ）, "category": "カテゴリ名" }
  ],
  "total": 合計金額（数値のみ）
}

JSONのみを返してください。余分な説明は不要です。`,
          },
        ],
      }],
    });

    const content  = response.content[0].text.trim();
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

app.listen(PORT, () => console.log(`サーバーが起動しました: http://localhost:${PORT}`));
