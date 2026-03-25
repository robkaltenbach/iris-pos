import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { receiveItem } from '../routes/receive-item.js';
import { generateEmbedding } from '../routes/generate-embedding.js';
import { detectItems } from '../routes/detect-items.js';
import adminRoutes from '../routes/admin.js';

dotenv.config();

console.log('[Vercel] API handler loaded at', new Date().toISOString());
console.log('[Vercel] Environment:', process.env.NODE_ENV || 'production');

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins (or specify your frontend URL)
  credentials: true, // Allow cookies/credentials to be sent
}));
app.use(express.json({ limit: '50mb' })); // Large limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path} at ${new Date().toISOString()}`);
  console.log(`[Request] Headers:`, {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'origin': req.headers['origin'],
  });
  next();
});

// API key authentication removed - no longer required

// Root route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Iris backend API is running'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Iris backend is running' });
});

// AI endpoints with request logging
app.post('/ai/receive-item', (req, res, next) => {
  console.log('[Route] /ai/receive-item handler called');
  receiveItem(req, res, next);
});
app.post('/ai/generate-embedding', (req, res, next) => {
  console.log('[Route] /ai/generate-embedding handler called');
  generateEmbedding(req, res, next);
});
app.post('/ai/detect-items', (req, res, next) => {
  console.log('[Route] /ai/detect-items handler called');
  detectItems(req, res, next);
});

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

// Export for Vercel serverless
export default app;

