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