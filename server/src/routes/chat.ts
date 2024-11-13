// backend/src/routes/chat.ts

import { Router, Request, Response } from 'express';
import pool from '../db'; // Ensure this points to your PostgreSQL pool configuration

const router = Router();

/**
 * GET /api/messages
 * Fetch chat messages based on session_id and time_period
 * Query Parameters:
 * - session_id: string (required)
 * - time_period: string (optional, e.g., '1 day', '1 week', '1 month')
 */
router.get('/messages', async (req: Request, res: Response): Promise<void> => {
  const { session_id, time_period } = req.query;

  console.log('--- Received GET /api/messages Request ---');
  console.log(`Query Parameters: session_id=${session_id}, time_period=${time_period}`);

  // Validate query parameters
  if (!session_id || typeof session_id !== 'string') {
    console.error('Invalid session_id provided');
    res.status(400).json({ error: 'session_id is required and must be a string' });
    return;
  }

  const period = typeof time_period === 'string' ? time_period : '1 month'; // Default to 1 month
  console.log(`Using time_period: ${period}`);

  try {
    const queryText = `
      SELECT message, timestamp FROM n8n_chat_histories
      WHERE session_id = $1 AND timestamp >= NOW() - $2::interval
      ORDER BY timestamp ASC
    `;
    console.log(`Executing SQL Query: ${queryText}`);
    console.log(`With Parameters: session_id=${session_id}, period=${period}`);

    const result = await pool.query(queryText, [session_id, period]);

    console.log(`Database Query Returned ${result.rowCount} rows`);

    // Map the result to extract and structure message objects
    const messages = result.rows.map(row => {
      let parsedMessage: { sender: 'user' | 'ai'; text: string; timestamp: string };

      // Ensure 'message' is a valid JSON object with 'type' and 'content'
      if (
        typeof row.message === 'object' &&
        row.message !== null &&
        typeof row.message.type === 'string' &&
        typeof row.message.content === 'string'
      ) {
        // Map 'type' to 'sender'
        let sender: 'user' | 'ai';
        if (row.message.type.toLowerCase() === 'human') {
          sender = 'user';
        } else if (row.message.type.toLowerCase() === 'ai') {
          sender = 'ai';
        } else {
          sender = 'ai'; // Default to 'ai' if type is unrecognized
          console.warn(`Unrecognized message type: ${row.message.type}. Defaulting sender to 'ai'.`);
        }

        parsedMessage = {
          sender: sender,
          text: row.message.content,
          timestamp: row.timestamp.toISOString(), // Convert to ISO string for frontend consistency
        };
      } else {
        console.warn('Invalid or incomplete message format:', row.message);
        parsedMessage = {
          sender: 'ai',
          text: 'Incomplete message data.',
          timestamp: row.timestamp.toISOString(),
        };
      }

      return parsedMessage;
    });

    console.log('Formatted Messages to Send to Frontend:', messages);

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
