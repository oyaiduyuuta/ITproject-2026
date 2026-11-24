# AI質問機能 実装手順書および実装コード (`docs/ai/04_implementation.md`)

## 1. ドキュメント概要

* **目的**: 設計書（`03_design.md`）に基づき、AI質問機能を既存プロジェクトへ組み込むための手順と全ソースコードを定義する。
* **使用モデル**: `gemini-3.8-flash`（`@google/genai` SDK）
* **関連ドキュメント**:
* `docs/ai/01_request.md`（追加要望書）
* `docs/ai/02_requirements.md`（要件定義書）
* `docs/ai/03_design.md`（設計書）



---

## 2. 事前準備（パッケージ追加・環境変数設定）

### 2.1. パッケージのインストール

プロジェクトルートで Google Gen AI SDK をインストールする。

```bash
npm install @google/genai

```

### 2.2. 環境変数の追加

`.env`（および `.env.example` がある場合はそちらにもキー名のみ）に Gemini API キーを追記する。

```env
GEMINI_API_KEY=your_gemini_api_key_here

```

---

## 3. 新規作成ファイルの実装コード

### 3.1. サービス層 (`src/apps/ai/aiService.ts`)

外部 SDK（`@google/genai`）の呼び出し、環境変数チェック、30秒タイムアウト制御、エラー変換を担当する。

```typescript
import { GoogleGenAI } from '@google/genai';

const MODEL_NAME = 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 30_000;

export class ConfigError extends Error {
  constructor(message = 'GEMINI_API_KEY is not configured.') {
    super(message);
    this.name = 'ConfigError';
  }
}

export class AiServiceError extends Error {
  constructor(message = 'Failed to generate answer from Gemini API.') {
    super(message);
    this.name = 'AiServiceError';
  }
}

export const generateAnswer = async (question: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new ConfigError();
  }

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: question,
      config: {
        abortSignal: controller.signal,
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      throw new AiServiceError('Empty response received from Gemini API.');
    }

    return answer;
  } catch (error) {
    console.error('[aiService] Gemini API Error:', error);
    if (error instanceof ConfigError || error instanceof AiServiceError) {
      throw error;
    }
    throw new AiServiceError();
  } finally {
    clearTimeout(timeoutId);
  }
};

```

---

### 3.2. コントローラー層 (`src/apps/ai/aiController.ts`)

画面レンダリング、リクエストボディのバリデーション、HTTPステータスおよびJSONレスポンス制御、未捕捉例外の `next(err)` 委譲を担当する。

```typescript
import { Request, Response, NextFunction } from 'express';
import {
  generateAnswer,
  ConfigError,
  AiServiceError,
} from './aiService';

const MAX_QUESTION_LENGTH = 1000;

export const renderIndex = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    res.render('ai/index', {
      title: 'AI質問アシスタント',
    });
  } catch (error) {
    next(error);
  }
};

export const askQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawQuestion: unknown = req.body?.question;

    if (typeof rawQuestion !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '質問内容を1文字以上1,000文字以内で入力してください。',
        },
      });
      return;
    }

    const trimmedQuestion = rawQuestion.trim();
    if (
      trimmedQuestion.length === 0 ||
      trimmedQuestion.length > MAX_QUESTION_LENGTH
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '質問内容を1文字以上1,000文字以内で入力してください。',
        },
      });
      return;
    }

    const answer = await generateAnswer(trimmedQuestion);
    res.status(200).json({ answer });
  } catch (error) {
    if (error instanceof ConfigError) {
      res.status(500).json({
        error: {
          code: 'CONFIG_ERROR',
          message: '現在AI機能を利用できません。管理者にお問い合わせください。',
        },
      });
      return;
    }

    if (error instanceof AiServiceError) {
      res.status(502).json({
        error: {
          code: 'AI_SERVICE_ERROR',
          message:
            'AIからの回答取得に失敗しました。時間をおいて再度お試しください。',
        },
      });
      return;
    }

    next(error);
  }
};

```

---

### 3.3. ルーティング層 (`src/apps/ai/aiRouter.ts`)

`/ai` 配下のパスとコントローラーメソッドを紐づける。

```typescript
import { Router } from 'express';
import { renderIndex, askQuestion } from './aiController';

const aiRouter = Router();

aiRouter.get('/', renderIndex);
aiRouter.post('/ask', askQuestion);

export default aiRouter;

```

---

### 3.4. ビューテンプレート (`views/ai/index.ejs`)

UI要素の配置および XSS 対策（`white-space: pre-wrap` でのテキスト表示前提）を備えたテンプレート。既存の共通ヘッダー／レイアウトがある場合は適宜 `include` に置き換える。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><%= title %></title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 760px;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.6;
      color: #222;
    }
    .nav-links {
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    .nav-links a {
      margin-right: 1rem;
      color: #0066cc;
      text-decoration: none;
    }
    .nav-links a:hover {
      text-decoration: underline;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem;
      font-size: 1rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      resize: vertical;
    }
    .form-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.5rem;
    }
    .char-counter {
      font-size: 0.85rem;
      color: #666;
    }
    button[type="submit"] {
      padding: 0.6rem 1.4rem;
      font-size: 1rem;
      color: #fff;
      background-color: #0066cc;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    button[type="submit"]:disabled {
      background-color: #99bce0;
      cursor: not-allowed;
    }
    .status-box {
      margin-top: 1.5rem;
      padding: 1rem;
      border-radius: 6px;
    }
    .loading {
      background-color: #f4f6f8;
      color: #444;
    }
    .error {
      background-color: #fdecea;
      border: 1px solid #f5c2c7;
      color: #842029;
    }
    .answer {
      background-color: #f8fbff;
      border: 1px solid #cfe2ff;
    }
    .answer h2 {
      margin-top: 0;
      font-size: 1.1rem;
      color: #084298;
    }
    #answer-content {
      white-space: pre-wrap;
      word-break: break-word;
    }
    [hidden] {
      display: none !important;
    }
  </style>
</head>
<body>
  <nav class="nav-links">
    <a href="/">TOPへ戻る</a>
    <a href="/todo">TODO一覧へ</a>
  </nav>

  <h1><%= title %></h1>
  <p>疑問点や調べたいことを入力してください。AI（Gemini）が回答を生成します。</p>

  <form id="ai-question-form" novalidate>
    <label for="question-input" hidden>質問内容</label>
    <textarea
      id="question-input"
      name="question"
      rows="5"
      maxlength="1000"
      placeholder="例: TypeScriptの型推論のメリットを簡潔に教えてください。"
      required
    ></textarea>
    <div class="form-footer">
      <span id="char-count" class="char-counter">0 / 1000</span>
      <button type="submit" id="submit-btn">質問する</button>
    </div>
  </form>

  <div id="loading-indicator" class="status-box loading" role="status" hidden>
    回答を生成しています。しばらくお待ちください...
  </div>

  <div id="error-box" class="status-box error" role="alert" hidden></div>

  <section id="answer-box" class="status-box answer" hidden>
    <h2>AIからの回答</h2>
    <div id="answer-content"></div>
  </section>

  <script src="/ai/ai.js" defer></script>
</body>
</html>

```

---

### 3.5. フロントエンドスクリプト (`public/ai/ai.js`)

入力文字数カウント、クライアント側バリデーション、非同期通信（`fetch`）、二重送信防止、XSS安全な描画（`textContent`）を実装する。

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const MAX_LENGTH = 1000;

  const form = document.getElementById('ai-question-form');
  const questionInput = document.getElementById('question-input');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorBox = document.getElementById('error-box');
  const answerBox = document.getElementById('answer-box');
  const answerContent = document.getElementById('answer-content');

  if (!form || !questionInput || !submitBtn) return;

  const updateCharCount = () => {
    const currentLength = questionInput.value.length;
    charCount.textContent = `${currentLength} / ${MAX_LENGTH}`;
  };

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  const resetMessages = () => {
    errorBox.hidden = true;
    errorBox.textContent = '';
    answerBox.hidden = true;
    answerContent.textContent = '';
  };

  const setLoadingState = (isLoading) => {
    loadingIndicator.hidden = !isLoading;
    submitBtn.disabled = isLoading;
    questionInput.disabled = isLoading;
  };

  questionInput.addEventListener('input', updateCharCount);
  updateCharCount();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetMessages();

    const trimmed = questionInput.value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      showError('質問内容を1文字以上1,000文字以内で入力してください。');
      return;
    }

    setLoadingState(true);

    try {
      const response = await fetch('/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.error?.message ||
          'AIからの回答取得に失敗しました。時間をおいて再度お試しください。';
        showError(message);
        return;
      }

      if (typeof data?.answer !== 'string') {
        showError('不正なレスポンスを受信しました。再度お試しください。');
        return;
      }

      answerContent.textContent = data.answer;
      answerBox.hidden = false;
    } catch (_error) {
      showError(
        '通信エラーが発生しました。ネットワーク環境を確認して再度お試しください。'
      );
    } finally {
      setLoadingState(false);
    }
  });
});

```

---

## 4. 既存ファイルの修正 (`index.ts`)

既存の Express アプリケーション設定において、以下の順序が保たれていることを確認した上で `/ai` ルーターをマウントする。

1. `express.json()` および `express.static('public')` の設定 **より後**
2. 404 ハンドラーおよびグローバルエラーハンドラー **より前**

```typescript
// --- 既存のインポート群 ---
import aiRouter from './src/apps/ai/aiRouter';

// --- 既存のミドルウェア設定 ---
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

// --- 既存のルーターマウント ---
// app.use('/todo', todoRouter);

// [追加] AI質問機能ルーターのマウント
app.use('/ai', aiRouter);

// --- 既存の 404 ハンドラー / エラーハンドラー ---

```

---

## 5. コンパイル・起動確認コマンド

実装後、TypeScript の型エラーがないことを確認しサーバーを起動する。

```bash
# 型チェック（tsconfig.json がある場合）
npx tsc --noEmit

# 開発サーバー起動（package.json のスクリプトに合わせる）
npm run dev

```

---

次は最終フェーズ（フェーズ4）である **`docs/ai/05_test_spec.md`（テスト仕様書・動作確認チェックリスト）** の作成に進みますか？