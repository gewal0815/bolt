// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Session-ID'],
}));
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api', chatRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.send('Chat Backend API');
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
