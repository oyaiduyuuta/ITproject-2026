`docs/todo/03_implementation_plan.md` にそのまま保存できる実装手順書の完成稿です。

```markdown
# TODOアプリ V1 実装手順書 (03_implementation_plan.md)

`01_requirements.md` および `02_design.md` に基づき、小規模な変更単位で実装と検証を行う手順です[cite: 29, 30, 31]。各工程完了ごとに確認コマンドを実行して進めます[cite: 31]。

---

## 工程 1: SQLファイルの作成とGit保存

- **対象ファイル**: `sql/todo/020_create_todo_tasks.sql`[cite: 28, 32]
- **作業内容**:
  テーブル `todo_tasks` を作成する定義を記述して保存する[cite: 32]。
  ```sql
  CREATE TABLE IF NOT EXISTS todo_tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL CHECK (
      char_length(title) BETWEEN 1 AND 100
      AND char_length(btrim(title)) > 0
    ),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

```

* **確認コマンド**:
```bash
git add sql/todo/020_create_todo_tasks.sql
git status

```


* **期待結果**: 指定ファイルがステージング状態（`Changes to be committed`）になる。


* **失敗時に最初に見る場所**: 保存したフォルダーパス (`sql/todo/`) に誤りがないか。



---

## 工程 2: Neon SQL Editor でのテーブル作成手動実行

* **対象場所**: Neon Console (ブラウザ) > SQL Editor


* **作業内容**:
1. Neonのダッシュボードを開き、`DATABASE_URL` と同じブランチ・データベースを選択する。


2. `020_create_todo_tasks.sql` の内容を貼り付けて実行する。


3. テーブルが正常作成されたか確認用SQLを実行する。





```sql
SELECT * FROM todo_tasks ORDER BY id;

```

* **確認コマンド**: SQL Editor上で `Run` ボタンを押下


* **期待結果**: エラーなく実行が完了し、初回は0件の結果（空のテーブル）が表示される。


* **失敗時に最初に見る場所**: 接続先のNeonブランチおよびデータベース名が正しいか。



---

## 工程 3: REQ-01 一覧取得APIの実装と動作確認

* **対象ファイル**:
* `src/apps/todo/todoModel.ts`


* `src/apps/todo/todoController.ts`


* `src/apps/todo/todoRouter.ts`


* `index.ts`




* **作業内容**:
1. `todoModel.ts` に全件取得SQL (`SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id ASC`) を記述。


2. `todoController.ts` に取得処理と `snake_case` から `camelCase` への変換・JSONレスポンス記述。


3. `todoRouter.ts` に `GET /` を登録。


4. `index.ts` で `express.json()` の後に `/api/v1/todos` として `todoRouter` を登録（既存ルートは残す）。




* **確認コマンド**:
```bash
npm run build
npm run dev

```


ブラウザまたは別ターミナルで以下を実行：
```bash
curl.exe -i http://localhost:3000/api/v1/todos

```


* **期待結果**: ステータス `200 OK` と `{"status":"success","data":[]}` が返る。


* **失敗時に最初に見る場所**: `index.ts` の `app.use` の登録位置、`db.ts` のインポート文、サーバー起動エラーログ。



---

## 工程 4: REQ-02 登録APIの実装と動作確認

* **対象ファイル**: `src/apps/todo/todoModel.ts`, `todoController.ts`, `todoRouter.ts`


* **作業内容**:
1. `todoModel.ts` に挿入SQL (`INSERT INTO todo_tasks (title) VALUES ($1) RETURNING ...`) をパラメータ化して記述。


2. `todoController.ts` で `title` の存在確認 (欠落時は400) および文字数・空白判定 (1〜100文字以外は422) のバリデーションを追加。


3. `todoRouter.ts` に `POST /` を追加。




* **確認コマンド**:
```bash
curl.exe -i -X POST http://localhost:3000/api/v1/todos -H "Content-Type: application/json" -d "{\"title\":\"テスト課題\"}"

```


* **期待結果**: ステータス `201 Created` と作成されたTODOデータ（`id` 付与済み）が返る。


* **失敗時に最初に見る場所**: `express.json()` の設定漏れ、SQLの `$1` プレースホルダー指定ミス。



---

## 工程 5: REQ-03 部分更新APIの実装と動作確認

* **対象ファイル**: `src/apps/todo/todoModel.ts`, `todoController.ts`, `todoRouter.ts`


* **作業内容**:
1. `todoModel.ts` に更新SQL (`UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING ...`) を記述。


2. `todoController.ts` でパスパラメータ `id` の数値チェック (不正時400)、`isCompleted` の型チェック、対象IDが存在しない場合の404チェックを記述。


3. `todoRouter.ts` に `PATCH /:id` を追加。




* **確認コマンド**:
```bash
curl.exe -i -X PATCH http://localhost:3000/api/v1/todos/1 -H "Content-Type: application/json" -d "{\"isCompleted\":true}"

```


* **期待結果**: ステータス `200 OK` と `isCompleted: true` に更新されたTODOデータが返る。


* **失敗時に最初に見る場所**: パスパラメータ `id` の `parseInt` 処理、対象行が存在しない場合の `rowCount` 判定。



---

## 工程 6: REQ-04 削除APIの実装と動作確認

* **対象ファイル**: `src/apps/todo/todoModel.ts`, `todoController.ts`, `todoRouter.ts`


* **作業内容**:
1. `todoModel.ts` に削除SQL (`DELETE FROM todo_tasks WHERE id = $1`) を記述。


2. `todoController.ts` で `id` チェック、削除行数が0の場合は404返却、成功時は `res.status(204).send()` を記述。


3. `todoRouter.ts` に `DELETE /:id` を追加。




* **確認コマンド**:
```bash
curl.exe -i -X DELETE http://localhost:3000/api/v1/todos/1

```


* **期待結果**: ステータス `204 No Content` が返り、レスポンス本文が空であること。


* **失敗時に最初に見る場所**: `204` 返却時に `res.json()` を呼んでいないか、対象IDが存在するか。



---

## 工程 7: TodoApiクラス (public/todo/todo.js) の実装

* **対象ファイル**: `public/todo/todo.js`


* **作業内容**:
Fetch APIを使用して `/api/v1/todos` に対する4つのメソッド (`list`, `create`, `update`, `delete`) を持つ `TodoApi` クラスを記述する。※`delete` (204) の時は `res.json()` を実行しない処理を入れる。


* **確認コマンド**:
`npm run dev` 実行後、ブラウザで `/todo` を開き DevTools Console で以下をテスト：
```javascript
const api = new TodoApi();
await api.list();

```


* **期待結果**: Console上に正常にAPIの実行結果オブジェクトが返されること。


* **失敗時に最初に見る場所**: 静的ファイルの配信パス設定 (`express.static('public')`)、`res.ok` の判定処理。



---

## 工程 8: 画面 (views/todo/index.ejs) の実装と接続

* **対象ファイル**: `views/todo/index.ejs`, `index.ts`


* **作業内容**:
1. `index.ts` に画面表示ルート (`app.get('/todo', ...)` ) を追加。


2. `views/todo/index.ejs` に入力フォーム、0件表示、TODO一覧、チェックボックス、削除ボタンを配置し `public/todo/todo.js` を読み込む。


3. ボタン操作やフォーム送信のイベントに `TodoApi` の呼び出しと一覧の再描画処理を紐付ける。




* **確認コマンド**:
```bash
npm run build
npm run start

```


ブラウザで `http://localhost:3000/todo` にアクセス。


* **期待結果**: 画面が表示され、追加・完了切り替え・削除の操作に応じてリロードなしで画面表示が更新される。


* **失敗時に最初に見る場所**: EJSテンプレートの文法、ブラウザ Console のJavaScript実行エラーログ。



---

## 工程 9: ローカル環境での総合動作確認

* **対象機能**: REQ-01 〜 REQ-04 およびエラー系


* **作業内容**:
1. 正常系（追加・一覧表示・完了切替・削除）を画面から通しで実施。


2. 異常系（空文字での登録、存在しないID操作）の確認。


3. 既存の `/` および `/api/db-check` が正常に動くか回帰確認。




* **確認コマンド**:
```bash
npm run build && npm start

```


* **期待結果**: 全機能が正常に動作し、既存ルートも破壊されていないこと。


* **失敗時に最初に見る場所**: ターミナルのログ、DevTools NetworkタブのHTTPステータス。



---

## 工程 10: Vercel Preview 環境でのテスト

* **対象場所**: Git & Vercel Preview Deployment


* **作業内容**:
1. 変更したファイルをコミットして `feature/todo-app` ブランチを push する。





```bash
git add src/ views/ public/ sql/ docs/ index.ts
git status
git commit -m "feat: add todo app V1"
git push -u origin feature/todo-app

```

2. VercelのDashboardで Preview Deployment が `Ready` になったことを確認する。


3. Preview URL の `/todo` および `/api/v1/todos` にアクセスして動作確認。



* **確認コマンド**: Vercel Dashboard から Preview URL を開く


* **期待結果**: ローカル同様にPreview環境でも全機能およびDB疎通が確認できる。


* **失敗時に最初に見る場所**: Vercelの Deployment Logs / Function Logs、`DATABASE_URL` の環境変数設定。



---

## 工程 11: Pull Request 作成と Production 環境へのマージ・確認

* **対象場所**: GitHub & Vercel Production


* **作業内容**:
1. GitHubで `main` に向けて Pull Request を作成する。


2. 差分に `.env` や秘密情報が含まれていないことを確認してマージを実行。


3. ローカルで `main` に切り替えて最新コードを引き込む。





```bash
git switch main
git pull origin main

```

4. Vercelの Production URL にて本番動作確認を行う。



* **確認コマンド**: Production URL の `/todo` および `/api/db-check` をブラウザで開く。


* **期待結果**: 本番環境で TODO アプリが正常に動作し、結果が `04_test_results.md` に記録できること。


* **失敗時に最初に見る場所**: Production用の `DATABASE_URL` 設定、GitHubのPR差分。



```

---

ファイル `docs/todo/03_implementation_plan.md` として保存できたら教えてください[cite: 28, 30]！次のステップ（実装作業開始）に案内します。

```