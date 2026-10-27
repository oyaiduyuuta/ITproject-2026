import { Router } from 'express';
import {
  getTodoList,
  createTodo,
  updateTodo,
  deleteTodo,
} from './todoController';

const todoRouter = Router();

// GET    /api/v1/todos - 一覧取得
todoRouter.get('/', getTodoList);

// POST   /api/v1/todos - 新規登録
todoRouter.post('/', createTodo);

// PATCH  /api/v1/todos/:id - 完了状態の変更
todoRouter.patch('/:id', updateTodo);

// DELETE /api/v1/todos/:id - 削除
todoRouter.delete('/:id', deleteTodo);

export default todoRouter;