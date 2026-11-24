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