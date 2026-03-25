import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { receiveItem } from './routes/receive-item.js';
import { generateEmbedding } from './routes/generate-embedding.js';
import { detectItems } from './routes/detect-items.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Iris backend is running' });
});

// AI endpoints
app.post('/ai/receive-item', receiveItem);
app.post('/ai/generate-embedding', generateEmbedding);
app.post('/ai/detect-items', detectItems);

// Admin endpoints (temporary - for testing/data cleanup)
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    error: err.message || 'Internal server error' 
  });
});

// Start server for local development
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Iris backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

