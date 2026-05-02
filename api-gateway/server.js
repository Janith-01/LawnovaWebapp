import express from 'express';
import cors from 'cors';
console.log('[Gateway] Restarting server.js...');
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from repo-root FIRST (shared secrets), then gateway-local to override.
// Repo-root (.env) contains shared secrets like JWT_SECRET in this codebase.
const repoRootEnv = path.join(__dirname, '../.env');
const gatewayLocalEnv = path.join(__dirname, '.env');

if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
  console.log(`[Gateway] Loaded env from: ${repoRootEnv}`);
}
if (fs.existsSync(gatewayLocalEnv)) {
  dotenv.config({ path: gatewayLocalEnv, override: true });
  console.log(`[Gateway] Loaded env from: ${gatewayLocalEnv}`);
}

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// IMPORTANT:
// Do NOT JSON-parse proxied /api/* requests in the gateway.
// Parsing consumes the request stream and can surface JSON SyntaxErrors here,
// preventing the request from reaching the downstream service.
// Only gateway-owned routes under /auth/* need JSON parsing.
app.use('/auth', express.json({ limit: '10kb' }));
app.use(cookieParser());

const PORT = process.env.API_GATEWAY_PORT || process.env.PORT || 5000;
const hasJwtSecret = !!process.env.JWT_SECRET;
console.log(`[Gateway] JWT_SECRET loaded: ${hasJwtSecret}`);

// Docker-aware upstream service URLs.
// In containers, never use localhost/127.0.0.1 for cross-service calls.
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5005';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5008';
const MOCKTRIAL_SERVICE_URL = process.env.MOCKTRIAL_SERVICE_URL || 'http://mocktrial-service:10004';
const ROLEPLAY_SERVICE_URL = process.env.ROLEPLAY_SERVICE_URL || 'http://roleplay-service:10005';
const JUDGMENT_SERVICE_URL = process.env.JUDGMENT_SERVICE_URL || 'http://judgment-prediction-service:5006';
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://argument-audit-service:5001';
const DRAFTING_SERVICE_URL = process.env.DRAFTING_SERVICE_URL || 'http://localhost:8001';

// Decode access token and attach user to req for downstream header injection.
// Token payload is expected to include: { sub: userId, role: 'student'|'admin', email: '...' }
app.use((req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.access_token;
  if (req.originalUrl.includes('trigger-learning')) {
    console.log(`[Gateway] DEBUG Auth: Cookie found? ${!!cookieToken}. Auth Header found? ${!!authHeader}`);
    if (!cookieToken && !authHeader) {
      console.log(`[Gateway] DEBUG Auth: Headers dump:`, JSON.stringify(req.headers));
    }
  }
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;
  const token = bearerToken || cookieToken;
  if (!token) {
    if (req.originalUrl.includes('trigger-learning')) {
      console.log(`[Gateway] DEBUG Auth: No token found for trigger-learning. Headers:`, JSON.stringify(req.headers));
    }
    return next();
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (decoded?.sub && decoded?.role) {
      req.user = {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email || null,
      };
    }
  } catch (err) {
    if (req.originalUrl.includes('trigger-learning')) {
      console.error(`[Gateway] DEBUG Auth: JWT Verify failed for trigger-learning:`, err.message);
    }
    // Ignore invalid/expired tokens here; downstream services will enforce auth.
  }

  next();
});

/**
 * POST /auth/login
 * Verifies credentials via user-service, then issues a gateway access JWT in an HttpOnly cookie.
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const userServiceUrl = `${USER_SERVICE_URL}/auth/login`;
    const upstream = await fetch(userServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.get('user-agent') || 'api-gateway',
      },
      body: JSON.stringify({ email, password }),
    });

    const upstreamBody = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message = upstreamBody?.error?.message || upstreamBody?.message || 'Login failed';
      return res.status(upstream.status).json({ message });
    }

    const upstreamUser = upstreamBody?.data?.user || upstreamBody?.user || null;
    const upstreamUserId = upstreamUser?._id || upstreamUser?.id || upstreamUser?.userId || null;
    if (!upstreamUserId || !upstreamUser?.role) {
      console.error('[Gateway] Invalid login response from user service', {
        status: upstream.status,
        hasBody: !!upstreamBody,
        hasUser: !!upstreamUser,
        hasUserId: !!upstreamUserId,
        hasRole: !!upstreamUser?.role,
      });
      return res.status(502).json({ message: 'Invalid login response from user service' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'JWT_SECRET not configured' });
    }

    // Production-grade practice: mint a gateway token with an explicit 24h lifetime
    // to match the cookie maxAge for localhost persistence.
    const accessToken = jwt.sign(
      { sub: upstreamUserId, role: upstreamUser.role, email: upstreamUser.email },
      secret,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    // Create a refresh token with longer expiry
    const refreshToken = jwt.sign(
      { sub: upstreamUserId, type: 'refresh' },
      secret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    // Also set HttpOnly cookie as backup auth method
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    const name =
      upstreamUser.fullName ||
      [upstreamUser.firstName, upstreamUser.lastName].filter(Boolean).join(' ') ||
      upstreamUser.email ||
      'User';

    // Return in the format expected by frontend: { data: { accessToken, refreshToken, user } }
    return res.status(200).json({
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: upstreamUserId,
          id: upstreamUserId,
          email: upstreamUser.email,
          fullName: name,
          firstName: upstreamUser.firstName,
          lastName: upstreamUser.lastName,
          role: upstreamUser.role,
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /auth/google
 * Verifies Google credential via user-service, then issues a gateway access JWT in an HttpOnly cookie.
 */
app.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const userServiceUrl = `${USER_SERVICE_URL}/auth/google`;
    const upstream = await fetch(userServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.get('user-agent') || 'api-gateway',
      },
      body: JSON.stringify({ credential }),
    });

    const upstreamBody = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message = upstreamBody?.error?.message || upstreamBody?.message || 'Google Login failed';
      return res.status(upstream.status).json({ message });
    }

    const upstreamUser = upstreamBody?.data?.user || upstreamBody?.user || null;
    const upstreamUserId = upstreamUser?._id || upstreamUser?.id || upstreamUser?.userId || null;
    if (!upstreamUserId || !upstreamUser?.role) {
      console.error('[Gateway] Invalid google login response from user service', {
        status: upstream.status,
        hasBody: !!upstreamBody,
        hasUser: !!upstreamUser,
        hasUserId: !!upstreamUserId,
        hasRole: !!upstreamUser?.role,
      });
      return res.status(502).json({ message: 'Invalid google login response from user service' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'JWT_SECRET not configured' });
    }

    // Production-grade practice: mint a gateway token with an explicit 24h lifetime
    // to match the cookie maxAge for localhost persistence.
    const accessToken = jwt.sign(
      { sub: upstreamUserId, role: upstreamUser.role, email: upstreamUser.email },
      secret,
      { expiresIn: '24h', algorithm: 'HS256' }
    );

    // Create a refresh token with longer expiry
    const refreshToken = jwt.sign(
      { sub: upstreamUserId, type: 'refresh' },
      secret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    // Also set HttpOnly cookie as backup auth method
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    const name =
      upstreamUser.fullName ||
      [upstreamUser.firstName, upstreamUser.lastName].filter(Boolean).join(' ') ||
      upstreamUser.email ||
      'User';

    // Return in the format expected by frontend: { data: { accessToken, refreshToken, user } }
    return res.status(200).json({
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: upstreamUserId,
          id: upstreamUserId,
          email: upstreamUser.email,
          fullName: name,
          firstName: upstreamUser.firstName,
          lastName: upstreamUser.lastName,
          role: upstreamUser.role,
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Restores session from HttpOnly cookie and returns authenticated user info.
 */
app.get('/auth/me', async (req, res) => {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'JWT_SECRET not configured' });

    let decoded;
    try {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch user profile from user-service to return a stable name
    const meResp = await fetch(`${USER_SERVICE_URL}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': req.get('user-agent') || 'api-gateway',
      },
    });

    const meBody = await meResp.json().catch(() => null);
    if (!meResp.ok) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = meBody?.data;
    const name =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.email ||
      'User';

    return res.status(200).json({
      id: decoded.sub,
      name,
      role: decoded.role,
    });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Clears the HttpOnly cookie.
 */
app.post('/auth/logout', (req, res) => {
  res.clearCookie('access_token', { path: '/' });
  return res.status(200).json({ success: true });
});

// Helper function to log proxy requests
const logProxyRequest = (req, service, targetPort) => {
  const cleanUrl = req.url.replace('/api', '');
  console.log(`[Gateway] ${req.method.padEnd(6)} ${req.originalUrl.padEnd(40)} -> ${service} (${targetPort}) ${cleanUrl}`);
};


const forwardJsonBodyToProxy = (proxyReq, req) => {
  const method = (req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

  const contentType = String(req.headers?.['content-type'] || '');
  if (!contentType.includes('application/json')) return;

  if (!req.body || typeof req.body !== 'object') return;
  const bodyKeys = Object.keys(req.body);
  if (bodyKeys.length === 0) return;

  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
};

// Proxy configuration for user-service
const userServiceProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  // NOTE: Express strips the mount path from req.url when a middleware is mounted
  // (e.g. app.use('/api/users', proxy) makes req.url start with '/me').
  // Use req.originalUrl to make rewrites stable and avoid accidental upstream 404s.
  pathRewrite: (path, req) => {
    const original = req.originalUrl || path;

    if (original.startsWith('/api/auth')) return original.replace(/^\/api\/auth/, '/auth');
    if (original.startsWith('/api/admin')) return original.replace(/^\/api\/admin/, '/admin');
    // Backward compatibility: /api/user/* and /api/users/* both map to /users/*
    if (original.startsWith('/api/user')) return original.replace(/^\/api\/user(s)?/, '/users');

    return path;
  },
  onProxyReq: (proxyReq, req, res) => {
    // If we have a cookie token but no Authorization header, pass it through.
    const cookieToken = req.cookies?.access_token;
    if (!req.headers.authorization && cookieToken) {
      proxyReq.setHeader('Authorization', `Bearer ${cookieToken}`);
    }

    // Inject headers from JWT (using user-id format for consistency)
    if (req.user) {
      console.log(`[Gateway] Injecting user-id header for User Service: ${req.user.id}`);
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
    }

    forwardJsonBodyToProxy(proxyReq, req);
    logProxyRequest(req, 'user-service', 5005);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] User Service proxy error:', err.message);
    res.status(503).json({ error: 'User service unavailable' });
  },
});

// Proxy configuration for mocktrial-service
const mocktrialServiceProxy = createProxyMiddleware({
  target: MOCKTRIAL_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 300000, // 5 minutes
  timeout: 300000, // 5 minutes
  pathRewrite: (path, req) => {
    const original = req.originalUrl || path;

    // Route mapping for mocktrial-service
    if (original.startsWith('/api/mock-trials')) return original.replace(/^\/api\/mock-trials/, '/api');
    if (original.startsWith('/api/sessions')) return original.replace(/^\/api\/sessions/, '/sessions');
    // Default passthrough
    return path;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Always mark as proxied from gateway (for downstream CORS skip)
    proxyReq.setHeader('x-forwarded-by', 'api-gateway');

    // Pass auth token from cookie if present
    const cookieToken = req.cookies?.access_token;
    if (!req.headers.authorization && cookieToken) {
      proxyReq.setHeader('Authorization', `Bearer ${cookieToken}`);
    }

    // Inject auth headers (using lowercase without x- prefix as mocktrial-service expects)
    if (req.user) {
      console.log(`[Gateway] Injecting auth headers for ${req.user.id} (${req.user.role}) - Email: ${req.user.email}`);
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
      if (req.user.email) {
        proxyReq.setHeader('user-email', req.user.email);
      }
    } else {
      const publicRoutes = ['/health', '/status', '/allocations'];
      const isPublic = publicRoutes.some(route => req.originalUrl.includes(route));
      if (!isPublic) {
        console.warn(`[Gateway] No req.user for ${req.method} ${req.originalUrl} - auth headers NOT injected`);
      }
    }

    forwardJsonBodyToProxy(proxyReq, req);

    logProxyRequest(req, 'mocktrial-service', 10004);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode < 400) {
      console.log(`[Gateway] ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    } else {
      console.error(`[Gateway] ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Mock Trial Service error:', {
      message: err.message,
      code: err.code,
      method: req.method,
      path: req.originalUrl,
    });
    res.status(503).json({ error: 'Mock Trial service unavailable', details: err.message });
  },
});

// Socket.IO proxy (WebSocket upgrades) for mocktrial-service
const mocktrialSocketIoProxy = createProxyMiddleware({
  target: MOCKTRIAL_SERVICE_URL,
  changeOrigin: true,
  logLevel: 'debug', // Increased for troubleshooting
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Forward Host and Origin headers to allow handshake
    proxyReq.setHeader('Host', new URL(MOCKTRIAL_SERVICE_URL).host);
    const origin = req.headers.origin;
    if (origin) {
      proxyReq.setHeader('Origin', origin);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] WebSocket Proxy Error:', err.message);
  }
});

// Route requests to appropriate services
// Note: Ensure /socket.io is mounted before catch-all routes
app.use('/socket.io', mocktrialSocketIoProxy);

app.use('/api/auth', userServiceProxy);
app.use('/api/admin', userServiceProxy);
app.use('/api/user', userServiceProxy);
app.use('/api/users', userServiceProxy);

const aiServiceProxy = createProxyMiddleware({
  target: AI_SERVICE_URL,
  changeOrigin: true,
  proxyTimeout: 300000,
  timeout: 300000,
  pathRewrite: (path, req) => {
    const original = req.originalUrl || path;
    if (original.startsWith('/api/ai')) return original.replace(/^\/api\/ai/, '/api');
    return original;
  },
  onProxyReq: (proxyReq, req, res) => {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'super_secure_internal_secret_key_123';
    proxyReq.setHeader('x-internal-service-auth', internalSecret);


    const authHeader = req.headers.authorization;
    if (authHeader) {
      proxyReq.setHeader('Authorization', authHeader);
      console.log(`[Gateway] Proxy: Forwarding Authorization header for ${req.method} ${req.originalUrl}`);
    }

    // 3. Also check for cookie-based auth token and forward if no header present
    const cookieToken = req.cookies?.access_token;
    if (!authHeader && cookieToken) {
      proxyReq.setHeader('Authorization', `Bearer ${cookieToken}`);
      console.log(`[Gateway] Proxy: Using cookie token for ${req.method} ${req.originalUrl}`);
    }

    // 4. Add user identification headers (from decoded JWT in gateway middleware)
    if (req.user) {
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
      if (req.user.email) {
        proxyReq.setHeader('user-email', req.user.email);
      }
      console.log(`[Gateway] Proxy: User identified as ${req.user.id} (${req.user.role})`);
    } else {
      console.warn(`[Gateway] Proxy: No user context for ${req.method} ${req.originalUrl} - check Authorization header`);
    }

    // 5. Forward request body for POST/PUT/PATCH requests
    forwardJsonBodyToProxy(proxyReq, req);

    // 6. Log the proxy request
    logProxyRequest(req, 'ai-service', 5008);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log response status for debugging
    if (proxyRes.statusCode >= 400) {
      console.error(`[Gateway] Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    } else {
      console.log(`[Gateway] Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] AI Service proxy error:', err.message);
    res.status(503).json({ error: 'AI service unavailable', details: err.message });
  }
});

// Socket.IO for Roleplay Service
const roleplaySocketProxy = createProxyMiddleware({
  target: ROLEPLAY_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/roleplay-socket': '/roleplay-socket'
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    proxyReq.setHeader('Host', new URL(ROLEPLAY_SERVICE_URL).host);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Roleplay WebSocket Proxy Error:', err.message);
  }
});

// Proxy for HTTP requests to roleplay-service
const roleplayServiceProxy = createProxyMiddleware({
  target: ROLEPLAY_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    return req.originalUrl || path;
  },
  onProxyReq: (proxyReq, req, res) => {
    if (req.user) {
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
    }
    forwardJsonBodyToProxy(proxyReq, req);
    logProxyRequest(req, 'roleplay-service', 10005);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode >= 400) {
      console.error(`[Gateway] Roleplay Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    } else {
      console.log(`[Gateway] Roleplay Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Roleplay Service proxy error:', err.message);
    res.status(503).json({ error: 'Roleplay service unavailable' });
  }
});

app.use('/roleplay-socket', roleplaySocketProxy);

app.use('/api/ai', aiServiceProxy);
app.use('/api/video', aiServiceProxy);
app.use('/api/chat', aiServiceProxy);

// New Audit Route for Flask Microservice
const auditServiceProxy = createProxyMiddleware({
  target: AUDIT_SERVICE_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    forwardJsonBodyToProxy(proxyReq, req);
    logProxyRequest(req, 'audit-service', new URL(AUDIT_SERVICE_URL).port || 80);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Audit Service proxy error:', err.message);
    res.status(503).json({ error: 'Audit service unavailable' });
  },
});
app.use('/api/audit', auditServiceProxy);


app.use('/api/mock-trials', mocktrialServiceProxy);
app.use('/api/sessions', mocktrialServiceProxy);
app.use('/api/dashboard', mocktrialServiceProxy);
app.use('/api/mocktrial', mocktrialServiceProxy);

// Roleplay Routes
app.use('/api/roleplay', roleplayServiceProxy);
app.use('/api/trials', roleplayServiceProxy);

// ------------------------------------------------------------------
// Judgment Prediction Service Proxy (ML Predictions + Data Pipelines)
// ------------------------------------------------------------------
const judgmentServiceProxy = createProxyMiddleware({
  target: JUDGMENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    const original = req.originalUrl || path;
    // /api/judgment/* -> /* (strip the /api/judgment prefix)
    if (original.startsWith('/api/judgment')) return original.replace(/^\/api\/judgment/, '');
    return path;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward auth token from cookie if present
    const cookieToken = req.cookies?.access_token;
    if (!req.headers.authorization && cookieToken) {
      proxyReq.setHeader('Authorization', `Bearer ${cookieToken}`);
    }

    // Inject auth headers from JWT
    if (req.user) {
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
      if (req.user.email) {
        proxyReq.setHeader('user-email', req.user.email);
      }
    }

    forwardJsonBodyToProxy(proxyReq, req);
    logProxyRequest(req, 'judgment-prediction-service', new URL(JUDGMENT_SERVICE_URL).port || 80);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode >= 400) {
      console.error(`[Gateway] Judgment Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    } else {
      console.log(`[Gateway] Judgment Proxy: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Judgment Prediction Service proxy error:', err.message);
    res.status(503).json({ error: 'Judgment Prediction service unavailable', details: err.message });
  },
});

app.use('/api/judgment', judgmentServiceProxy);
const draftingServiceProxy = createProxyMiddleware({
  target: DRAFTING_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    const original = req.originalUrl || path;
    if (original.startsWith('/api/drafting')) return original.replace(/^\/api\/drafting/, '');
    return path;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward auth token from cookie if present
    const cookieToken = req.cookies?.access_token;
    if (!req.headers.authorization && cookieToken) {
      proxyReq.setHeader('Authorization', `Bearer ${cookieToken}`);
    }

    // Inject auth headers from JWT
    if (req.user) {
      proxyReq.setHeader('user-id', req.user.id);
      proxyReq.setHeader('user-role', req.user.role);
      if (req.user.email) {
        proxyReq.setHeader('user-email', req.user.email);
      }
    }

    forwardJsonBodyToProxy(proxyReq, req);
    logProxyRequest(req, 'drafting-service', new URL(DRAFTING_SERVICE_URL).port || 80);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode >= 400) {
      console.error(`[Gateway] Drafting Proxy: ${req.method} ${req.originalUrl} â†’ ${proxyRes.statusCode}`);
    } else {
      console.log(`[Gateway] Drafting Proxy: ${req.method} ${req.originalUrl} â†’ ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Drafting Service proxy error:', err.message);
    res.status(503).json({ error: 'Drafting service unavailable', details: err.message });
  },
});

app.use('/api/drafting', draftingServiceProxy);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'API Gateway',
    services: {
      'user-service': USER_SERVICE_URL,
      'mocktrial-service': MOCKTRIAL_SERVICE_URL,
      'ai-service': AI_SERVICE_URL,
      'roleplay-service': ROLEPLAY_SERVICE_URL,
      'audit-service': AUDIT_SERVICE_URL,
      'judgment-prediction-service': JUDGMENT_SERVICE_URL,
      'drafting-service': DRAFTING_SERVICE_URL
    }
  });
});

app.get('/health/services', (req, res) => {
  res.json({
    status: 'API Gateway Health Check',
    timestamp: new Date().toISOString(),
    services: {
      'user-service': { url: USER_SERVICE_URL, status: 'configured' },
      'mocktrial-service': { url: MOCKTRIAL_SERVICE_URL, status: 'configured' },
      'ai-service': { url: AI_SERVICE_URL, status: 'configured' },
      'roleplay-service': { url: ROLEPLAY_SERVICE_URL, status: 'configured' },
      'audit-service': { url: AUDIT_SERVICE_URL, status: 'configured' },
      'judgment-prediction-service': { url: JUDGMENT_SERVICE_URL, status: 'configured' },
      'drafting-service': { url: DRAFTING_SERVICE_URL, status: 'configured' }
    },
    routing: {
      '/api/auth/*': 'user-service',
      '/api/admin/*': 'user-service',
      '/api/user/*': 'user-service',
      '/api/users/*': 'user-service',
      '/api/mock-trials/*': 'mocktrial-service (10004)',
      '/api/sessions/*': 'mocktrial-service (10004)',
      '/api/ai/*': 'ai-service (5008)',
      '/api/roleplay/*': 'roleplay-service (10005)',
      '/api/judgment/*': 'judgment-prediction-service (5006)',
      '/api/drafting/*': 'drafting-service (8001)'
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`========================================`);
  console.log(`\nService Routes:`);
  console.log(`  /api/auth/*       → user-service (5005)`);
  console.log(`  /api/admin/*      → user-service (5005)`);
  console.log(`  /api/user/*       → user-service (5005)`);
  console.log(`  /api/users/*      → user-service (5005)`);
  console.log(`  /api/mock-trials/* → mocktrial-service (10004)`);
  console.log(`  /api/sessions/*   → mocktrial-service (10004)`);
  console.log(`  /api/ai/*         → ai-service (5008)`);
  console.log(`  /api/roleplay/*   → roleplay-service (10005)`);
  console.log(`  /api/judgment/*   → judgment-prediction-service (5006)`);
  console.log(`\nHealth Checks:`);
  console.log(`  GET /health            → Gateway status`);
  console.log(`  GET /health/services   → Service status`);
  console.log(`\n========================================\n`);
});

// Wire WebSocket upgrade handling for Socket.IO
server.on('upgrade', (req, socket, head) => {
  try {
    const url = req.url || '';
    if (url.startsWith('/socket.io')) {
      mocktrialSocketIoProxy.upgrade(req, socket, head);
    } else if (url.startsWith('/roleplay-socket')) {
      roleplaySocketProxy.upgrade(req, socket, head);
    }
  } catch (err) {
    console.error('[Gateway] Upgrade failed:', err.message);
  }
});
// Force restart
