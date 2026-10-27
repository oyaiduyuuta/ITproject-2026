
# TODOアプリ V1 設計書 (02_design.md)

## 1. 作るものとファイルの役割

### ファイル構成
```text
プロジェクト直下/
├── index.ts                          # アプリのエントリーポイント（todoRouterの追加）
├── db.ts                             # PostgreSQL（Neon）接続プール
├── sql/
│   └── todo/
│       └── 020_create_todo_tasks.sql # TODOテーブル作成用SQL
├── src/
│   └── apps/
│       └── todo/
│           ├── todoRouter.ts         # ルーティング定義 (/api/v1/todos)
│           ├── todoController.ts     # リクエスト検証・レスポンス制御
│           └── todoModel.ts          # DB操作（SQLクエリの実行）
├── views/
│   └── todo/
│       └── index.ejs                 # TODO管理画面UI (/todo)
├── public/
│   └── todo/
│       └── todo.js                   # クライアント側スクリプト（TodoApiクラスと画面接続）
└── docs/
    └── todo/
        ├── 01_requirements.md        # 要件定義書
        ├── 02_design.md              # 本設計書
        ├── 03_implementation_plan.md # 実装手順書
        └── 04_test_results.md        # テスト結果記録

```

---

## 2. リクエストはどこを通るか

### APIリクエスト処理フロー (`/api/v1/todos`)

```text
[ブラウザ / TodoApi] 
       │ (Fetch API)
       ▼
[index.ts] ─────────────> [todoRouter.ts]
 (URL判定 & json解析)        (メソッド・パスルーティング)
                                │
                                ▼
                        [todoController.ts]
                         (入力バリデーション & HTTPステータス決定)
                                │
                                ▼
                        [todoModel.ts]
                         (SQL構築 & パラメータ結合)
                                │
                                ▼
                         [db.ts / Neon DB]
                          (PostgreSQL実行)

```

### 画面リクエストフロー (`/todo`)

```text
[ブラウザ] ──GET /todo──> [index.ts] ──> [views/todo/index.ejs] (HTML描画)

```

---

## 3. DBの設計

### テーブル名: `todo_tasks`

| 列名 (snake_case) | 型 | 制約 | 目的 |
| --- | --- | --- | --- |
| `id` | `INTEGER` | `GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | 1件を識別するID |
| `title` | `TEXT` | `NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100 AND char_length(btrim(title)) > 0)` | TODO本文（1~100文字、空白のみ不可） |
| `is_completed` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | 完了状態 |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | 作成日時 |

---

## 4. APIの共通ルール

* **ベースURL**: `/api/v1/todos`
* **データ形式**: JSON (`Content-Type: application/json`)
* **プロパティ命名規則**:
* DB列名: `snake_case` (`is_completed`, `created_at`)
* API JSONキー: `camelCase` (`isCompleted`, `createdAt`)


* **成功レスポンス共通形式** (200 / 201):
```json
{
  "status": "success",
  "data": { ... } または [ ... ]
}

```


* **エラーレスポンス共通形式** (400 / 404 / 422 / 500 / 503):
```json
{
  "status": "error",
  "code": "エラーコード",
  "message": "エラーメッセージ",
  "details": []
}

```



---

## 5. 機能別API詳細 specification

### 5.1 REQ-01 TODO一覧を取得する

| 項目 | 内容 |
| --- | --- |
| **HTTPメソッド** | `GET` |
| **URL** | `/api/v1/todos` |
| **リクエスト本文** | なし |
| **成功ステータス** | `200 OK` |
| **成功JSON例** | `{"status":"success","data":[{"id":1,"title":"課題をする","isCompleted":false,"createdAt":"2026-10-27T00:00:00.000Z"}]}` |



※0件時は `{"status":"success","data":[]}` |
| **失敗ステータス** | `500 INTERNAL_ERROR` / `503 DB_UNAVAILABLE` |
| **DB処理** | `SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id ASC;` |
| **TodoApiメソッド** | `TodoApi.list()` |
| **確認方法** | ブラウザで `/api/v1/todos` を開く、または DevTools Console で `await fetch('/api/v1/todos').then(r=>r.json())` |

---

### 5.2 REQ-02 TODOを登録する

| 項目 | 内容 |
| --- | --- |
| **HTTPメソッド** | `POST` |
| **URL** | `/api/v1/todos` |
| **リクエスト本文** | `{"title": "課題を提出する"}` |
| **成功ステータス** | `201 Created` |
| **成功JSON例** | `{"status":"success","data":{"id":1,"title":"課題を提出する","isCompleted":false,"createdAt":"2026-10-27T00:00:00.000Z"}}` |
| **失敗ステータス** | `400 BAD_REQUEST` (title欠落・JSON不正) |



`422 VALIDATION_ERROR` (空白のみ・101文字以上) |
| **DB処理** | `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING id, title, is_completed, created_at;` |
| **TodoApiメソッド** | `TodoApi.create(title)` |
| **確認方法** | DevTools Console で POST 送信テストを行い 201 が返ることを確認 |

---

### 5.3 REQ-03 完了状態を変える

| 項目 | 内容 |
| --- | --- |
| **HTTPメソッド** | `PATCH` |
| **URL** | `/api/v1/todos/:id` |
| **リクエスト本文** | `{"isCompleted": true}` |
| **成功ステータス** | `200 OK` |
| **成功JSON例** | `{"status":"success","data":{"id":1,"title":"課題を提出する","isCompleted":true,"createdAt":"2026-10-27T00:00:00.000Z"}}` |
| **失敗ステータス** | `400 BAD_REQUEST` (ID型不正・JSON不正) |



`404 NOT_FOUND` (指定IDが存在しない) |
| **DB処理** | `UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at;` |
| **TodoApiメソッド** | `TodoApi.update(id, isCompleted)` |
| **確認方法** | DevTools Console で PATCH 送信テストを行い 200 および更新データを確認 |

---

### 5.4 REQ-04 TODOを削除する

| 項目 | 内容 |
| --- | --- |
| **HTTPメソッド** | `DELETE` |
| **URL** | `/api/v1/todos/:id` |
| **リクエスト本文** | なし |
| **成功ステータス** | `204 No Content` (レスポンス本文なし) |
| **成功JSON例** | なし (レスポンスボディ空) |
| **失敗ステータス** | `400 BAD_REQUEST` (ID非数値) |



`404 NOT_FOUND` (指定IDが存在しない) |
| **DB処理** | `DELETE FROM todo_tasks WHERE id = $1 RETURNING id;` (または rowCount チェック) |
| **TodoApiメソッド** | `TodoApi.delete(id)` |
| **確認方法** | DevTools Console で DELETE 送信を行い 204 が返ることを確認 (`res.json()` は呼ばない) |

---

## 6. 画面とTodoApiの設計

### `public/todo/todo.js` (TodoApiクラス)

```javascript
class TodoApi {
  constructor(baseUrl = '/api/v1/todos') {
    this.baseUrl = baseUrl;
  }
  async list() { /* GET /api/v1/todos */ }
  async create(title) { /* POST /api/v1/todos */ }
  async update(id, isCompleted) { /* PATCH /api/v1/todos/:id */ }
  async delete(id) { /* DELETE /api/v1/todos/:id (204時は解析なし) */ }
}

```

### `views/todo/index.ejs` (画面要素)

* **入力フォーム**: テキスト入力 (`input[type="text"]`) + 登録ボタン
* **状態表示**: 処理中メッセージ / エラー表示エリア / 0件時表示「TODOがありません」
* **TODOリスト**:
* チェックボックス (`change` イベントで `update` 呼び出し)
* タイトルテキスト (`textContent` で安全に出力)
* 削除ボタン (`click` イベントで `delete` 呼び出し)



---

## 7. エラーはどこで処理するか

1. **express.json() 段階**: 不正なJSON形式が送信された場合、グローバルエラーハンドラーでキャッチし `400 BAD_REQUEST` の統一JSONを返す。


2. **Controller 段階**: パラメータ型チェック（IDが1以上の整数か）、`title` の文字数（1~100文字）をバリデーションし、違反時は `400` または `422` を返却する。


3. **Model / DB 段階**: 存在しないIDへの操作は `rowCount === 0` を判定して `404 NOT_FOUND` を返却。DB接続障害時は `500/503` を返却する。



---

## 8. 実装への注意事項・index.tsの追記

### `index.ts` への最小限の追記位置

既存の `/` および `/api/db-check` の設定を残し、以下のように追記します。

```typescript
import express from 'express';
import todoRouter from './src/apps/todo/todoRouter'; // 設定箇所

const app = express();
app.use(express.json());

// 既存ルート (/ や /api/db-check) はそのまま残す

// TODO APIの登録
app.use('/api/v1/todos', todoRouter);

// TODO 画面ルートの追加
app.get('/todo', (req, res) => {
  res.render('todo/index');
});

```

```

---

### ❓ 設計書作成にあたっての確認事項（AIからの質問）

設計書の内容に不足・不一致がないか確認するため、以下の点についてご回答・ご確認ください[cite: 28, 30, 31]：

1. **フォルダ構成**: `src/apps/todo/` 配下に `todoRouter.ts`, `todoController.ts`, `todoModel.ts` を配置する設計としていますが、プロジェクトの既存構成と一致していますか[cite: 28]？
2. **画面ルート**: EJSテンプレートは `views/todo/index.ejs` に置き、画面アクセス用URLを `/todo` とする設定で問題ありませんか[cite: 27, 28, 29]？

上記を `docs/todo/02_design.md` に保存できたら、3つ目のドキュメント **`03_implementation_plan.md`（実装手順書）** の作成に進みますので教えてください[cite: 28, 30]！

```