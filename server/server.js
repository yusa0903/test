require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3001;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Supabase管理者クライアント（service_role_keyでRLSを迂回する・JWT検証・管理者操作用）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ユーザーのJWTを使ってRLSが有効なクライアントを生成する（一般ユーザーのデータ操作用）
const createUserClient = (token) => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

// ファイルをメモリに一時保存（4MBはVercelサーバーレス関数のボディ制限に合わせた上限）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'), false);
  },
});

// Vercelでは同一ドメインのためCORSは不要だが、外部クライアント向けに環境変数で制御できるようにする
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ───────────────────────────────────────────────
// JWTトークンを検証して req.user / req.token にセットするミドルウェア
// ───────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '認証が必要です' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: '無効なトークンです' });

  req.user  = user;
  req.token = token;
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
// ───────────────────────────────────────────────
app.get('/api/receipts', authenticate, async (req, res) => {
  const role    = await getUserRole(req.user.id);
  const isAdmin = role === 'admin';

  let query;
  if (isAdmin) {
    query = supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false });
  } else {
    query = createUserClient(req.token)
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ receipts: data, isAdmin });
});

// ───────────────────────────────────────────────
// レシートを保存する
// ───────────────────────────────────────────────
app.post('/api/receipts', authenticate, async (req, res) => {
  const { date, store, items, total } = req.body;

  const { data, error } = await createUserClient(req.token)
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
// ───────────────────────────────────────────────
app.delete('/api/receipts/:id', authenticate, async (req, res) => {
  const role    = await getUserRole(req.user.id);
  const isAdmin = role === 'admin';

  const client = isAdmin ? supabase : createUserClient(req.token);
  const { error } = await client
    .from('receipts')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ───────────────────────────────────────────────
// 自分のレシートを全件削除する
// ───────────────────────────────────────────────
app.delete('/api/receipts', authenticate, async (req, res) => {
  const { error } = await createUserClient(req.token)
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
            text: `このレシート画像を解析して、以下のJSON形式で情報を抽出してください。\n日付が読み取れない場合は今日の日付を使用してください。\nカテゴリは「食費」「外食」「日用品」「交通費」「医療費」「娯楽」「その他」から最も適切なものを選んでください。\n\n{\n  "date": "YYYY-MM-DD形式の日付",\n  "store": "店舗名",\n  "items": [\n    { "name": "商品名", "price": 金額（数値のみ）, "category": "カテゴリ名" }\n  ],\n  "total": 合計金額（数値のみ）\n}\n\nJSONのみを返してください。余分な説明は不要です。`,
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

// ローカル実行時のみリッスン（Vercelサーバーレスではmodule.exportsを使う）
if (require.main === module) {
  app.listen(PORT, () => console.log(`サーバーが起動しました: http://localhost:${PORT}`));
}

module.exports = app;
