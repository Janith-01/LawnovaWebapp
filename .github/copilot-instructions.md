# Lawnova Codebase Instructions for AI Agents

## Architecture Overview

**Lawnova** is a legal learning platform with a **microservices architecture**:

- **API Gateway** (port 5000): Express proxy routing requests to services via `http-proxy-middleware`
- **User Service** (port 5002): MongoDB-based auth, user management, admin functions
- **Mock Trial Service** (port 5003): Case simulations (incomplete)
- **Other Services**: AI, drafting, judgment prediction, roleplay services (stubs)
- **Web Client**: React 18 + Vite + Tailwind CSS frontend

**Key Principle**: Services communicate through the gateway via proxy rules (e.g., `/api/auth` → user-service `/auth`). Each service is independently deployable.

---

## Critical Patterns & Conventions

### Request/Response Format
All services use a standardized response format (`responses.js`):
```javascript
// Success
{ success: true, data: {...}, meta: { timestamp } }

// Error (with defined ERROR_CODES enum)
{ success: false, error: { code: 'ERROR_NAME', message: '...' }, meta: { timestamp } }
```
**Important**: The frontend expects `response.data.data` to access payload (Axios wraps in `.data`).

### Authentication Flow
1. **JWT-based** with access (`15m`) + refresh tokens (`7d`)
2. **Frontend**: `AuthContext` stores tokens in localStorage; Axios interceptor auto-refreshes on 401
3. **Backend**: `authMiddleware.js` validates tokens, checks user.isActive, validates token issued after password change
4. **Gateway**: Injects `x-user-id` and `x-user-role` headers from decoded JWT to downstream services

### User Model Structure
- Fields: `email`, `passwordHash` (never selected by default), `fullName`, `role` (enum: student|admin), `isActive`
- Nested objects: `profile` (avatarUrl, institution, languagePreference, bio), `security` (failedLoginAttempts, lockUntil, passwordChangedAt)
- Password validation: Min 8 chars, bcrypt rounds = 10
- Account lockout: 5 failed attempts → 15 min lockout (configurable via env)

### Frontend Conventions
- **Routes**: Protected via `<ProtectedRoute adminOnly={true|false}>` wrapper
- **API Calls**: Use centralized `api` service (axios instance with interceptors)
- **Forms**: React Hook Form + Zod validation
- **State**: React Context API only (no Redux/Zustand)
- **Components**: Reusable UI in `src/components/ui/` (Button, Input), layout wrappers in `src/components/layout/`
- **Pages**: Organized by role (admin/, auth/, student/)
- **Error Handling**: `react-hot-toast` for user feedback

---

## Common Developer Workflows

### Starting Development
```bash
# Terminal 1: API Gateway
npm run dev

# Terminal 2: User Service (or other service)
npm run dev:user

# Terminal 3: Web Client
cd web-client && npm run dev
```
Gateway runs on 5000, services on 5002+, client on 3000.

### Running Tests
User Service uses **Jest** with supertest:
```bash
cd services/user-service
npm test
```
Tests connect to MongoDB and clean up after each suite. See `tests/setup.js` for configuration.

### Environment Variables
- Root `.env`: Database URI, JWT secrets, ports, rate limits, bcrypt rounds
- Web client `.env`: `VITE_API_BASE_URL=http://localhost:5000`
- Each service loads env relative to its config dir (e.g., `src/config/index.js`)

### Adding a New Endpoint
1. **Backend**: Create route → controller → service layer → reuse response utilities
2. **Add auth**: Apply `requireAuth` middleware if user context needed
3. **Error handling**: Use ERROR_CODES enum, let express-async-errors catch throws
4. **Frontend**: Call via `api.post('/api/path')`, wrap in try/catch, use toast for feedback

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Service config (ports, secrets) | `services/user-service/src/config/index.js` |
| Auth middleware & JWT logic | `services/user-service/src/middleware/authMiddleware.js`, `utils/tokenUtils.js` |
| Response format & error codes | `services/user-service/src/utils/responses.js` |
| User schema | `services/user-service/src/models/User.js` |
| Gateway routing | `api-gateway/server.js` |
| Frontend auth state | `web-client/src/context/AuthContext.jsx` |
| API interceptor setup | `web-client/src/services/api.js` |
| Route protection | `web-client/src/routes/ProtectedRoute.jsx` |

---

## Gotchas & Important Details

1. **Password field is never returned**: User model has `select: false` on `passwordHash`—always use `passwordHash` (not `password`) in models/queries
2. **Token refresh loop prevention**: Axios uses `originalRequest._retry` flag; direct axios call (not via `api` instance) avoids interceptor loop in refresh endpoint
3. **Admin vs Student**: Check `user.role` enum; frontend routes use `ProtectedRoute adminOnly={true}` for admin gates
4. **Rate limiting**: Applies to all requests globally (can be customized per route)
5. **CORS**: Configured per env var; don't hardcode origins
6. **Logging**: Winston logger available—use `logger.info/error/warn` (not console.log for production)
7. **Service discovery**: All services hardcoded to localhost:5002/5003 in gateway—update gateway routes when adding services

---

## Testing Tips

- Tests in `tests/auth.test.js` show patterns: use `beforeAll` for DB connect, `afterEach` for cleanup
- Mock data not stored in git—generate fixtures in tests
- Supertest extends Express app directly; no need to start HTTP server separately
