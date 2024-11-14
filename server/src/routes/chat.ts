// backend/src/routes/chat.ts

import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db'; // Ensure this points to your PostgreSQL pool configuration

const router = Router();

/**
 * Extending Express Request interface to include sessionId
 */
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

/**
 * Middleware to extract session_id from headers
 */
function extractSessionId(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.header('Session-ID');
  if (!sessionId) {
    console.error('Session-ID header missing');
    res.status(400).json({ message: 'Session-ID header is required.' });
    return;
  }
  req.sessionId = sessionId;
  next();
}

/**
 * Utility function to extract code blocks from content
 */
function extractCodeBlocks(content: string): {
  code: string;
  language: string;
  start: number;
  end: number;
}[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || '',
      code: match[2],
      start: match.index,
      end: codeBlockRegex.lastIndex,
    });
  }

  return codeBlocks;
}

/**
 * Utility function to replace a specific code block in content
 */
function replaceCodeBlock(
  content: string,
  codeBlock: { start: number; end: number },
  newCode: string,
  language: string
): string {
  const before = content.substring(0, codeBlock.start);
  const after = content.substring(codeBlock.end);
  const newCodeBlock = `\`\`\`${language}\n${newCode}\n\`\`\``;
  return before + newCodeBlock + after;
}

/**
 * Utility function to remove a specific code block from content
 */
function removeCodeBlock(content: string, codeBlock: { start: number; end: number }): string {
  const before = content.substring(0, codeBlock.start);
  const after = content.substring(codeBlock.end);
  return before + after;
}

/**
 * GET /api/messages
 * Fetch messages based on session_id and time_period
 * Query Parameters:
 * - time_period: string (optional, e.g., '1 day', '1 week', '1 month')
 */
router.get('/messages', extractSessionId, async (req: Request, res: Response) => {
  const sessionId = req.sessionId!;
  const { time_period } = req.query;
  const period = typeof time_period === 'string' ? time_period : '1 month';

  try {
    const queryText = `
      SELECT id, session_id, message, timestamp FROM n8n_chat_histories
      WHERE session_id = $1 AND timestamp >= NOW() - $2::interval
      ORDER BY timestamp ASC
    `;
    const result = await pool.query(queryText, [sessionId, period]);

    const messages = result.rows.map((row) => {
      const messageContent = row.message.content;
      return {
        id: row.id,
        sender: row.message.type === 'human' ? 'user' : 'ai',
        text: messageContent,
        timestamp: row.timestamp.toISOString(),
      };
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/messages
 * Create a new message
 * Body Parameters:
 * - text: string (the message content)
 */
router.post('/messages', extractSessionId, async (req: Request, res: Response) => {
  const sessionId = req.sessionId!;
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ message: 'Text is required.' });
    return;
  }

  try {
    const messageData = {
      session_id: sessionId,
      message: { type: 'human', content: text },
      timestamp: new Date(),
    };

    const result = await pool.query(
      'INSERT INTO n8n_chat_histories (session_id, message, timestamp) VALUES ($1, $2, $3) RETURNING id',
      [messageData.session_id, messageData.message, messageData.timestamp]
    );

    const messageId = result.rows[0].id;

    res.status(201).json({ messageId: messageId });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/code/:id
 * Update a specific code snippet within a message
 * Body Parameters:
 * - selectedCode: string (the exact code snippet to identify which block to update)
 * - newCode: string (the new code to replace the selected snippet)
 */
router.put('/code/:id', extractSessionId, async (req: Request, res: Response) => {
  const codeId = parseInt(req.params.id, 10);
  const { selectedCode, newCode } = req.body;
  const sessionId = req.sessionId!;

  // Validate parameters
  if (isNaN(codeId) || !selectedCode || !newCode) {
    res.status(400).json({ message: 'Invalid request parameters.' });
    return;
  }

  try {
    // Retrieve the existing message to verify session_id
    const result = await pool.query(
      'SELECT session_id, message FROM n8n_chat_histories WHERE id = $1',
      [codeId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Entry not found.' });
      return;
    }

    const messageRow = result.rows[0];
    if (messageRow.session_id !== sessionId) {
      res.status(403).json({ message: 'Session mismatch. Unauthorized operation.' });
      return;
    }

    const content = messageRow.message.content;
    const codeBlocks = extractCodeBlocks(content);

    // Find the code block matching the selectedCode
    const codeBlock = codeBlocks.find(
      (block) => block.code.trim() === selectedCode.trim()
    );

    if (!codeBlock) {
      res.status(404).json({ message: 'Code snippet not found.' });
      return;
    }

    // Replace the code block
    const updatedContent = replaceCodeBlock(
      content,
      codeBlock,
      newCode,
      codeBlock.language
    );

    // Update the message in the database
    const updatedMessage = { ...messageRow.message, content: updatedContent };
    await pool.query('UPDATE n8n_chat_histories SET message = $1 WHERE id = $2', [
      updatedMessage,
      codeId,
    ]);

    res.json({ message: 'Code snippet updated successfully.' });
  } catch (error) {
    console.error('Error updating code snippet:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * DELETE /api/code/:id
 * Delete a specific code snippet within a message
 * Body Parameters:
 * - selectedCode: string (the exact code snippet to identify which block to delete)
 */
router.delete('/code/:id', extractSessionId, async (req: Request, res: Response) => {
  const codeId = parseInt(req.params.id, 10);
  const { selectedCode } = req.body;
  const sessionId = req.sessionId!;

  // Validate parameters
  if (isNaN(codeId) || !selectedCode) {
    res.status(400).json({ message: 'Invalid request parameters.' });
    return;
  }

  try {
    // Retrieve the existing message to verify session_id
    const result = await pool.query(
      'SELECT session_id, message FROM n8n_chat_histories WHERE id = $1',
      [codeId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Entry not found.' });
      return;
    }

    const messageRow = result.rows[0];
    if (messageRow.session_id !== sessionId) {
      res.status(403).json({ message: 'Session mismatch. Unauthorized operation.' });
      return;
    }

    const content = messageRow.message.content;
    const codeBlocks = extractCodeBlocks(content);

    // Find the code block matching the selectedCode
    const codeBlock = codeBlocks.find(
      (block) => block.code.trim() === selectedCode.trim()
    );

    if (!codeBlock) {
      res.status(404).json({ message: 'Code snippet not found.' });
      return;
    }

    // Remove the code block
    const updatedContent = removeCodeBlock(content, codeBlock);

    // Update the message in the database
    const updatedMessage = { ...messageRow.message, content: updatedContent };
    await pool.query('UPDATE n8n_chat_histories SET message = $1 WHERE id = $2', [
      updatedMessage,
      codeId,
    ]);

    res.json({ message: 'Code snippet deleted successfully.' });
  } catch (error) {
    console.error('Error deleting code snippet:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
