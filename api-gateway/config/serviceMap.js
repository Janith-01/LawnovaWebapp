const SERVICE_HOST = process.env.SERVICE_HOST || '127.0.0.1';
const SERVICE_PROTOCOL = process.env.SERVICE_PROTOCOL || 'http';

const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const servicePorts = {
  user: toPort(process.env.USER_SERVICE_PORT, 5005),
  mocktrial: toPort(process.env.MOCKTRIAL_SERVICE_PORT, 10004),
  ai: toPort(process.env.AI_SERVICE_PORT, 5008),
  roleplay: toPort(process.env.ROLEPLAY_SERVICE_PORT, 10005),
  judgment: toPort(process.env.JUDGMENT_PREDICTION_PORT, 8000),
  audit: toPort(process.env.AUDIT_SERVICE_PORT, 5009),
};

const buildUrl = (port) => `${SERVICE_PROTOCOL}://${SERVICE_HOST}:${port}`;

export const serviceMap = Object.freeze({
  user: { name: 'user-service', host: SERVICE_HOST, port: servicePorts.user, url: buildUrl(servicePorts.user) },
  mocktrial: { name: 'mocktrial-service', host: SERVICE_HOST, port: servicePorts.mocktrial, url: buildUrl(servicePorts.mocktrial) },
  ai: { name: 'ai-service', host: SERVICE_HOST, port: servicePorts.ai, url: buildUrl(servicePorts.ai) },
  roleplay: { name: 'roleplay-service', host: SERVICE_HOST, port: servicePorts.roleplay, url: buildUrl(servicePorts.roleplay) },
  judgment: { name: 'judgment-prediction-service', host: SERVICE_HOST, port: servicePorts.judgment, url: buildUrl(servicePorts.judgment) },
  audit: { name: 'audit-service', host: SERVICE_HOST, port: servicePorts.audit, url: buildUrl(servicePorts.audit) },
});

