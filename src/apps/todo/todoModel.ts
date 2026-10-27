import { pool } from '../../../db';

export interface TodoRow {
  id: number;
  title: string;
  is_completed: boolean;
  created_at: Date;
}

/**
 * DBからTODOタスク一覧を取得する (ID昇順)
 */
export const getTodoListFromDb = async (): Promise<TodoRow[]> => {
  const result = await pool.query<TodoRow>(
    'SELECT id, title, is_completed, created_at FROM todo_tasks ORDER BY id ASC;'
  );
  return result.rows;
};

/**
 * DBに新しいTODOタスクを登録する
 */
export const createTodoInDb = async (title: string): Promise<TodoRow> => {
  const result = await pool.query<TodoRow>(
    'INSERT INTO todo_tasks (title, is_completed) VALUES ($1, false) RETURNING id, title, is_completed, created_at;',
    [title]
  );
  return result.rows[0];
};

/**
 * REQ-03: タスクの完了状態(is_completed)を更新する
 */
export const updateTodoInDb = async (id: number, isCompleted: boolean): Promise<TodoRow | null> => {
  const result = await pool.query<TodoRow>(
    'UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING id, title, is_completed, created_at;',
    [isCompleted, id]
  );
  return result.rows[0] || null;
};

/**
 * REQ-04: タスクを削除する
 */
export const deleteTodoFromDb = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM todo_tasks WHERE id = $1;', [id]);
  return (result.rowCount ?? 0) > 0;
};