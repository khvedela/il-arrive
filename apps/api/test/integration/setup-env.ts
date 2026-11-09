// Dummy, non-secret defaults so the integration suite runs without a local .env.
// Real environment values (CI, developer .env) take precedence.
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.DATABASE_URL ??= 'postgresql://ilarrive:ilarrive_dev@localhost:5432/ilarrive?schema=public';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
