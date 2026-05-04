import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

const parsePort = (port: string | undefined) => {
  if (!port) {
    return 3001;
  }

  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return parsedPort;
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

export const config: AppConfig = {
  port: parsePort(process.env.PORT),
  databaseUrl: requireEnv('DATABASE_URL'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
