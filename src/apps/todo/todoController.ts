import { Request, Response } from 'express';
import {
  getTodoListFromDb,
  createTodoInDb,
  updateTodoInDb,
  deleteTodoFromDb,
} from './todoModel';

/**
 * REQ-01: TODO一覧を取得して camelCase に変換して返却
 */
export const getTodoList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await getTodoListFromDb();

    // DBの snake_case を API用の camelCase に変換
    const todos = rows.map((row) => ({
      id: row.id,
      title: row.title,
      isCompleted: row.is_completed,
      createdAt: row.created_at.toISOString(),
    }));

    res.status(200).json({
      status: 'success',
      data: todos,
    });
  } catch (error) {
    console.error('TODO一覧取得エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'TODO一覧の取得に失敗しました。',
      details: [],
    });
  }
};

/**
 * REQ-02: TODOタスクを新規登録
 */
export const createTodo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title } = req.body;

    // バリデーションチェック (REQ-02の必須条件)
    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({
        status: 'fail',
        code: 'INVALID_TITLE',
        message: 'titleは必須であり、空文字は指定できません。',
        details: [],
      });
      return;
    }

    const newTodo = await createTodoInDb(title.trim());

    res.status(201).json({
      status: 'success',
      data: {
        id: newTodo.id,
        title: newTodo.title,
        isCompleted: newTodo.is_completed,
        createdAt: newTodo.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('TODO作成エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'TODOの登録に失敗しました。',
      details: [],
    });
  }
};

/**
 * REQ-03: TODOタスクの完了状態を変更 (PATCH /api/v1/todos/:id)
 */
export const updateTodo = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isCompleted } = req.body;

    // バリデーションチェック
    if (isNaN(id) || id <= 0 || typeof isCompleted !== 'boolean') {
      res.status(400).json({
        status: 'fail',
        code: 'BAD_REQUEST',
        message: 'リクエストパラメータまたはボディが不正です。',
        details: [],
      });
      return;
    }

    const updatedTodo = await updateTodoInDb(id, isCompleted);

    if (!updatedTodo) {
      res.status(404).json({
        status: 'fail',
        code: 'NOT_FOUND',
        message: '指定されたIDのタスクが見つかりません。',
        details: [],
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: updatedTodo.id,
        title: updatedTodo.title,
        isCompleted: updatedTodo.is_completed,
        createdAt: updatedTodo.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('TODO更新エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'TODOの更新に失敗しました。',
      details: [],
    });
  }
};

/**
 * REQ-04: TODOタスクを削除 (DELETE /api/v1/todos/:id)
 */
export const deleteTodo = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      res.status(400).json({
        status: 'fail',
        code: 'BAD_REQUEST',
        message: '不正なID形式です。',
        details: [],
      });
      return;
    }

    const isDeleted = await deleteTodoFromDb(id);

    if (!isDeleted) {
      res.status(404).json({
        status: 'fail',
        code: 'NOT_FOUND',
        message: '指定されたIDのタスクが見つかりません。',
        details: [],
      });
      return;
    }

    // 204 No Content (レスポンス本文なし)
    res.status(204).send();
  } catch (error) {
    console.error('TODO削除エラー:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'TODOの削除に失敗しました。',
      details: [],
    });
  }
};