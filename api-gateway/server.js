import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

// Proxy configuration for user-service
const userServiceProxy = createProxyMiddleware({
  target: 'http://localhost:5002',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove /api prefix: /api/auth/register -> /auth/register
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] Proxying: ${req.method} ${req.originalUrl} -> http://localhost:5002${req.url.replace('/api', '')}`);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  },
});

// Apply the proxy to all /api/* routes
app.use('/api', userServiceProxy);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'API Gateway' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Proxying /api/* -> http://localhost:5002/*`);
});
