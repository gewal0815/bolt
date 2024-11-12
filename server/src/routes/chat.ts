// backend/src/routes/chat.ts

import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

/**
 * POST /api/messages
 * Create a new chat message
 */
router.post('/messages', async (req: Request, res: Response): Promise<void> => {
  const { session_id, message } = req.body;

  // Validate request payload
  if (!session_id || !message || !message.sender || !message.text) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  try {
    await pool.query(
      'INSERT INTO n8n_chat_histories (session_id, message, timestamp) VALUES ($1, $2, NOW())',
      [session_id, message]
    );
    res.status(201).json({ message: 'Chat message created successfully' });
  } catch (error) {
    console.error('Error inserting chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/messages
 * Fetch chat messages based on session_id and time_period
 * Query Parameters:
 * - session_id: string (required)
 * - time_period: string (optional, e.g., '1 day', '1 week', '1 month')
 */
router.get('/messages', async (req: Request, res: Response): Promise<void> => {
  const { session_id, time_period } = req.query;

  // Validate query parameters
  if (!session_id || typeof session_id !== 'string') {
    res.status(400).json({ error: 'session_id is required and must be a string' });
    return;
  }

  const period = typeof time_period === 'string' ? time_period : '1 week'; // Default to 1 week

  try {
    const result = await pool.query(
      `
      SELECT * FROM n8n_chat_histories
      WHERE session_id = $1 AND timestamp >= NOW() - $2::interval
      ORDER BY timestamp ASC
      `,
      [session_id, period]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/messages/:id
 * Update a chat message
 */
router.put('/messages/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { message } = req.body;

  // Validate request payload
  if (!message || !message.sender || !message.text) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  try {
    const result = await pool.query(
      'UPDATE n8n_chat_histories SET message = $1 WHERE id = $2',
      [message, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.status(200).json({ message: 'Chat message updated successfully' });
  } catch (error) {
    console.error('Error updating chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/messages/:id
 * Delete a chat message
 */
router.delete('/messages/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM n8n_chat_histories WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.status(200).json({ message: 'Chat message deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
