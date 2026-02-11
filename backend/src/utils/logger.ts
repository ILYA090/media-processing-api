import pino from 'pino';
import { config } from '../config/index.js';

const transport =
  config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

export const logger = pino({
  level: config.logging.level,
  transport,
  base: {
    env: config.env,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'apiKey',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
});

export const createChildLogger = (bindings: Record<string, unknown>) => {
  return logger.child(bindings);
};

export const requestLogger = createChildLogger({ component: 'http' });
export const dbLogger = createChildLogger({ component: 'database' });
export const queueLogger = createChildLogger({ component: 'queue' });
export const storageLogger = createChildLogger({ component: 'storage' });
export const authLogger = createChildLogger({ component: 'auth' });
export const jobLogger = createChildLogger({ component: 'job' });

export type Logger = typeof logger;
