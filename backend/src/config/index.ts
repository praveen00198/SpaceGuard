import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';

// Load .env and .env.local from project root (.env.local overrides .env)
const possibleRoots = [
  path.resolve(__dirname, '../../../'),
  path.resolve(__dirname, '../../'),
  process.cwd(),
];

const initialNodeEnv = process.env.NODE_ENV;

for (const root of possibleRoots) {
  const envPath = path.resolve(root, '.env');
  const envLocalPath = path.resolve(root, '.env.local');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}

if (initialNodeEnv === 'test') {
  process.env.NODE_ENV = 'test';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  host: process.env.BACKEND_HOST || 'localhost',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/spaceguard',
    dbName: process.env.MONGODB_DB_NAME || 'spaceguard',
  },

  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  nasa: {
    apiKey: process.env.NASA_API_KEY || 'DEMO_KEY',
  },

  satnogs: {
    apiToken: process.env.SATNOGS_API_TOKEN || '',
  },

  noaa: {
    baseUrl: process.env.NOAA_SWPC_BASE_URL || 'https://services.swpc.noaa.gov',
  },

  celestrak: {
    baseUrl: process.env.CELESTRAK_BASE_URL || 'https://celestrak.org',
  },

  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  rateLimit: {
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
