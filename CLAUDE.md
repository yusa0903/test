# プロジェクト設定

## コード改修後の自動Git操作

コードを改修するたびに、以下の手順でGitの初期化とGitHubへのプッシュを行うこと。

### 手順

1. **Gitの初期化**（未初期化の場合）
   ```
   git init
   git remote add origin https://github.com/yusa0903/test.git
   ```

2. **変更をコミット**
   ```
   git add <変更ファイル>
   git commit -m "<コミットメッセージ>"
   ```

3. **GitHubにプッシュ**
   ```
   git push -u origin main
   ```

### プッシュ先リポジトリ

- URL: `https://github.com/yusa0903/test.git`
- ブランチ: `main`

### 注意事項

- `.env` や認証情報を含むファイルはコミットしないこと
- コミットメッセージは変更内容を簡潔に記述すること
- 既にリモートが設定済みの場合は `git init` と `git remote add` をスキップすること

## 設計書の管理

- 設計変更（機能追加・API変更・データ構造変更など）が生じた場合は、`設計書.md` を随時更新すること
- 更新時は変更履歴テーブルに日付と内容を追記すること
