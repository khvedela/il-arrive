// Imported first by specs that load AppModule: config validation runs at import time.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
process.env.JWT_SECRET ??= 'test';
process.env.SESSION_SECRET ??= 'test';
process.env.NODE_ENV = 'development';
