import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

const readBearerToken = (authHeader = '') => {
    const header = normalize(authHeader);
    if (!header.toLowerCase().startsWith('bearer ')) return null;
    return header.slice(7).trim() || null;
};

export const resolveRequestIdentity = (req, res, next) => {
    const headerUserId = normalize(req.headers['user-id']);
    const headerUserEmail = normalize(req.headers['user-email']).toLowerCase();
    const headerUserRole = normalize(req.headers['user-role']);

    if (headerUserId || headerUserEmail) {
        req.authUser = {
            id: headerUserId || null,
            email: headerUserEmail || null,
            role: headerUserRole || null,
            source: 'gateway-header'
        };
        req.authStatus = 'resolved';
        return next();
    }

    const token = readBearerToken(req.headers.authorization);
    if (!token) {
        req.authUser = null;
        req.authStatus = 'missing';
        req.authFailureCode = 'AUTH_MISSING';
        return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        req.authUser = null;
        req.authStatus = 'invalid';
        req.authFailureCode = 'AUTH_CONFIG_MISSING';
        return next();
    }

    try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        const userId = normalize(decoded?.sub || decoded?.id || decoded?._id);
        const userEmail = normalize(decoded?.email).toLowerCase();
        const userRole = normalize(decoded?.role);

        req.authUser = {
            id: userId || null,
            email: userEmail || null,
            role: userRole || null,
            source: 'bearer-jwt'
        };
        req.authStatus = 'resolved';

        // Backfill headers so legacy controller code keeps working.
        if (userId && !req.headers['user-id']) req.headers['user-id'] = userId;
        if (userEmail && !req.headers['user-email']) req.headers['user-email'] = userEmail;
        if (userRole && !req.headers['user-role']) req.headers['user-role'] = userRole;
    } catch (error) {
        req.authUser = null;
        req.authStatus = 'invalid';
        req.authFailureCode = error?.name === 'TokenExpiredError' ? 'AUTH_INVALID_EXPIRED' : 'AUTH_INVALID';
    }

    next();
};

export const requireAuth = (req, res, next) => {
    if (req.authUser?.id || req.authUser?.email) {
        return next();
    }

    const code = req.authFailureCode || 'AUTH_MISSING';
    const detail = req.authStatus === 'invalid' ? 'Invalid or expired authentication token.' : 'Authentication is required.';
    return next(new ApiError(401, detail, [{ code }]));
};

export default {
    resolveRequestIdentity,
    requireAuth
};
