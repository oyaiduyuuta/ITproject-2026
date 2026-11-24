# AI質問機能 設計書 (`docs/ai/03_design.md`)

## 1. ドキュメント概要

* **目的**: 要件定義書（`02_requirements.md`）に基づき、AI質問機能のアーキテクチャ、API仕様、画面構成、モジュール設計、例外処理フローを具体化する。
* **対象システム**: 既存 Web アプリケーション（Express / TypeScript / EJS）
* **関連ドキュメント**:
* `docs/ai/01_request.md`（追加要望書）
* `docs/ai/02_requirements.md`（要件定義書）



---

## 2. システムアーキテクチャ・ディレクトリ構成

既存の TODO アプリ（`src/apps/todo/`）のレイヤー構造（Router / Controller / Service）を踏襲し、以下のようにファイルを配置する。

```text
project-root/
├── index.ts                      # [修正] /ai ルーターのマウント追加
├── .env                          # [修正] GEMINI_API_KEY の追記
├── src/
│   └── apps/
│       └── ai/
│           ├── aiRouter.ts       # [新規] エンドポイント定義 (GET /ai, POST /ai/ask)
│           ├── aiController.ts   # [新規] リクエスト検証・レスポンス制御・例外委譲
│           └── aiService.ts      # [新規] @google/genai 呼び出し・タイムアウト制御
├── views/
│   └── ai/
│       └── index.ejs             # [新規] AI質問画面テンプレート
└── public/
    └── ai/
        └── ai.js                 # [新規] 非同期送信・DOM描画制御スクリプト

```

---

## 3. API・ルーティング設計

### 3.1. エンドポイント一覧

| メソッド | パス | 処理内容 | レスポンス形式 |
| --- | --- | --- | --- |
| `GET` | `/ai` | AI質問画面の初期表示 | `text/html` (`views/ai/index.ejs`) |
| `POST` | `/ai/ask` | 質問テキストを受け取り、Gemini API の回答を返却 | `application/json` |

### 3.2. `POST /ai/ask` リクエスト仕様

* **Content-Type**: `application/json`
* **リクエストボディ**:

```json
{
  "question": "TypeScriptの型推論のメリットを簡潔に教えてください。"
}

```

| フィールド名 | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `question` | `string` | 必須 | 前後空白除去（`trim()`）後、1文字以上 1,000文字以内 |

### 3.3. `POST /ai/ask` レスポンス仕様

#### 正常系（HTTP `200 OK`）

```json
{
  "answer": "TypeScriptの型推論には、主に以下のメリットがあります。\n1. コード量の削減..."
}

```

#### 異常系（HTTP `400` / `500` / `502`）

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "質問内容を1文字以上1,000文字以内で入力してください。"
  }
}

```

| HTTPステータス | エラーコード (`code`) | メッセージ (`message`) | 発生条件 |
| --- | --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | 質問内容を1文字以上1,000文字以内で入力してください。 | `question` が未指定、文字列以外、空文字、または1,000文字超過 |
| `500 Internal Server Error` | `CONFIG_ERROR` | 現在AI機能を利用できません。管理者にお問い合わせください。 | 環境変数 `GEMINI_API_KEY` が未設定 |
| `502 Bad Gateway` | `AI_SERVICE_ERROR` | AIからの回答取得に失敗しました。時間をおいて再度お試しください。 | Gemini API 呼び出し時のネットワークエラー、タイムアウト、APIエラー |

---

## 4. モジュール詳細設計

### 4.1. `src/apps/ai/aiRouter.ts`

* Express の `Router` インスタンスを生成し、以下のルートをバインドする。
* `router.get('/', aiController.renderIndex)`
* `router.post('/ask', aiController.askQuestion)`


* `index.ts` 側で `app.use('/ai', aiRouter)` としてマウントする（既存の `express.json()` ミドルウェアが有効であることを前提とする）。

### 4.2. `src/apps/ai/aiController.ts`

* **`renderIndex(req, res, next)`**:
* `res.render('ai/index', { title: 'AI質問アシスタント' })` を実行する。


* **`askQuestion(req, res, next)`**:
1. `req.body?.question` を取得し、型チェック（`typeof question === 'string'`）および `trim()` 後の文字数チェック（`1 <= trimmed.length <= 1000`）を行う。
2. 不正な場合はステータス `400` と `INVALID_INPUT` の JSON を返却する。
3. `aiService.generateAnswer(trimmed)` を呼び出し、取得した文字列を `{ answer }` として `200` 返却する。
4. `aiService` から投げられたカスタムエラー（`ConfigError` / `AiServiceError`）を捕捉し、それぞれ `500` / `502` の JSON レスポンスとして返却する。
5. それ以外の予期せぬエラーは `next(err)` で既存のグローバルエラーハンドラーへ委譲する。



### 4.3. `src/apps/ai/aiService.ts`

* **`generateAnswer(question: string): Promise<string>`**:
1. `process.env.GEMINI_API_KEY` の存在を確認する。未設定の場合は `ConfigError` をスローする。
2. `@google/genai` の `GoogleGenAI` クライアントを初期化する。
3. `AbortController` を用いて **30,000ms（30秒）** のタイムアウトタイマーを設定し、`ai.models.generateContent` を呼び出す。
* **指定モデル**: `gemini-3.8-flash`
* **contents**: `question`


4. レスポンスの `response.text` を検証し、空でない文字列であれば返却する。
5. タイムアウトまたは SDK 例外発生時はサーバーログ（`console.error`）に詳細を出力した上で、機密情報を含まない `AiServiceError` をスローする。



---

## 5. 画面・フロントエンド設計

### 5.1. 画面構成 (`views/ai/index.ejs`)

| 要素ID / セレクタ | HTML要素 | 役割・初期状態 |
| --- | --- | --- |
| `#ai-question-form` | `<form>` | 質問送信フォーム |
| `#question-input` | `<textarea>` | 質問入力欄（`maxlength="1000"`、`placeholder` 設定） |
| `#char-count` | `<span>` | 現在の入力文字数カウンター（例: `0 / 1000`） |
| `#submit-btn` | `<button type="submit">` | 送信ボタン（「質問する」） |
| `#loading-indicator` | `<div>` | 通信中インジケーター（初期状態: 非表示 `hidden`） |
| `#error-box` | `<div>` | エラーメッセージ表示領域（初期状態: 非表示 `hidden`） |
| `#answer-box` | `<div>` | AI回答表示領域（初期状態: 非表示 `hidden`） |
| `#answer-content` | `<div>` | 回答テキスト本体（改行保持のため CSS で `white-space: pre-wrap;` を指定） |

### 5.2. フロントエンド処理フロー (`public/ai/ai.js`)

1. **文字数カウント更新**: `#question-input` の `input` イベントで `#char-count` をリアルタイム更新する。
2. **フォーム送信 (`submit` イベント)**:
* `e.preventDefault()` でデフォルトの画面遷移を抑止する。
* 入力値の `trim()` チェックを行い、空または 1,000文字超過の場合はサーバーへ通信せず `#error-box` にエラーを表示して終了する。


3. **通信開始時のUI制御**:
* `#error-box` と `#answer-box` を非表示にする。
* `#loading-indicator` を表示し、`#submit-btn` と `#question-input` を `disabled = true` にする。


4. **非同期通信 (`fetch('/ai/ask', ...)`)**:
* `POST` メソッド、`Content-Type: application/json` で `{ question }` を送信する。


5. **レスポンス反映・完了時のUI制御 (`finally`)**:
* `response.ok` が `true` の場合：`#answer-content.textContent = data.answer` で描画（XSS防止）し、`#answer-box` を表示する。
* `response.ok` が `false` またはネットワーク例外の場合：`#error-box.textContent` にエラーメッセージを設定して表示する。
* `finally` ブロックで `#loading-indicator` を非表示に戻し、`#submit-btn` と `#question-input` の `disabled` を解除する。



---

## 6. シーケンス図（質問送信〜回答表示）

```text
ユーザー        ブラウザ (ai.js)         aiRouter / Controller          aiService              Gemini API
  │                   │                          │                         │                      │
  │── 質問入力・送信 ─▶│                          │                         │                      │
  │                   │── 1. クライアント検証 ───│                         │                      │
  │                   │── 2. ローディング表示 ───│                         │                      │
  │                   │── POST /ai/ask (JSON) ──▶│                         │                      │
  │                   │                          │── 3. サーバー側検証 ────│                      │
  │                   │                          │── generateAnswer() ────▶│                      │
  │                   │                          │                         │── generateContent() ─▶│
  │                   │                          │                         │   (gemini-3.8-flash) │
  │                   │                          │                         │◀── 回答テキスト ─────│
  │                   │                          │◀── answer (string) ─────│                      │
  │                   │◀── 200 OK { answer } ────│                         │                      │
  │                   │── 4. textContent描画 ────│                         │                      │
  │◀── 回答表示 ──────│                          │                         │                      │

```

---

次はフェーズ3の **`docs/ai/04_implementation.md`（実装手順書および各ファイルの実装コード）** の作成に進みますか？