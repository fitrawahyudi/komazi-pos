import pino from 'pino';
import { Writable } from 'stream';

/**
 * ANSI Color Escape Sequences for Terminal Styling
 */
export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  // Foreground Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright Colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  gray: '\x1b[90m',
};

/**
 * Log Level Color Mappings (PRD Section 2)
 * INFO: hijau
 * SUCCESS: hijau terang
 * WARN: kuning
 * ERROR/FATAL: merah
 * DEBUG: abu-abu
 */
export const LEVEL_COLORS = {
  DEBUG: ANSI.gray,
  INFO: ANSI.green,
  SUCCESS: ANSI.brightGreen,
  WARN: ANSI.yellow,
  ERROR: ANSI.red,
  FATAL: ANSI.brightRed,
};

/**
 * Domain Category Color Mappings (PRD Section 2 & 5)
 * HTTP: biru
 * AUTH/SECURITY: cyan
 * ORDER/PAYMENT: ungu
 * DATABASE: kuning
 * INVENTORY: hijau
 * KDS/BDS: cyan / teal
 * PRINTER: kuning terang
 * TELEGRAM: biru terang
 * SCHEDULER: abu-abu / dim
 */
export const CATEGORY_COLORS = {
  HTTP: ANSI.brightBlue,
  AUTH: ANSI.brightCyan,
  SECURITY: ANSI.brightCyan,
  DATABASE: ANSI.yellow,
  ORDER: ANSI.magenta,
  PAYMENT: ANSI.brightMagenta,
  INVENTORY: ANSI.green,
  KDS: ANSI.cyan,
  BDS: ANSI.cyan,
  PRINTER: ANSI.brightYellow,
  TELEGRAM: ANSI.blue,
  SCHEDULER: ANSI.dim,
  PUSH: ANSI.brightMagenta,
  NOTIFICATION: ANSI.brightCyan,
  APP: ANSI.green,
};

/**
 * HTTP Status Code Color Formatter (PRD Section 4)
 * 2xx: hijau
 * 3xx: cyan
 * 4xx: kuning
 * 5xx: merah
 */
export function colorizeStatusCode(status) {
  const code = Number(status);
  if (code >= 200 && code < 300) return `${ANSI.green}${code}${ANSI.reset}`;
  if (code >= 300 && code < 400) return `${ANSI.cyan}${code}${ANSI.reset}`;
  if (code >= 400 && code < 500) return `${ANSI.yellow}${code}${ANSI.reset}`;
  if (code >= 500) return `${ANSI.red}${code}${ANSI.reset}`;
  return `${code}`;
}

const isProduction = process.env.NODE_ENV === 'production';
const rawLogLevel = (process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')).toLowerCase();

// Sensitive keys list for redaction (PRD Section 7)
const REDACT_KEYS = [
  'password',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
  'DATABASE_URL',
  'refreshToken',
  'accessToken',
  'creditCard',
  'cvv',
];

/**
 * Helper to sanitize & redact sensitive keys in metadata
 */
function sanitizeMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMeta);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = REDACT_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()));
    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeMeta(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Pretty Stream for Development Mode
 * Formats structured JSON from Pino into clean, readable ANSI colored terminal lines:
 * [HH:mm:ss] LEVEL [CATEGORY] Message | key=value
 */
function createPrettyStream() {
  return new Writable({
    write(chunk, encoding, callback) {
      try {
        const log = JSON.parse(chunk.toString());
        const date = new Date(log.time || Date.now());
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        const timeStr = `${ANSI.dim}[${hh}:${mm}:${ss}]${ANSI.reset}`;

        const level = (log.level || 'INFO').toUpperCase();
        const levelColor = LEVEL_COLORS[level] || ANSI.reset;
        const levelStr = `${levelColor}${level.padEnd(7)}${ANSI.reset}`;

        const category = (log.category || 'APP').toUpperCase();
        const catColor = CATEGORY_COLORS[category] || ANSI.reset;
        const catStr = `${catColor}[${category}]${ANSI.reset}`;

        // Format message: If HTTP, colorize status code if detected
        let msg = log.msg || '';
        if (category === 'HTTP') {
          // Detect status code pattern: "GET /path 200 24ms"
          msg = msg.replace(/\b([1-5]\d{2})\b(?=\s+\d+ms|\s*$)/g, (match) => colorizeStatusCode(match));
        }

        // Format metadata (exclude internal Pino fields)
        const excludeKeys = new Set(['level', 'time', 'pid', 'hostname', 'category', 'msg', 'v', 'err', 'error']);
        const metaPairs = [];
        for (const [k, v] of Object.entries(log)) {
          if (!excludeKeys.has(k)) {
            const valStr = typeof v === 'object' ? JSON.stringify(v) : v;
            // Cegah duplikasi jika pesan sudah mengandung key=val
            if (!msg.includes(`${k}=${valStr}`) && !msg.includes(`${k}=`)) {
              metaPairs.push(`${k}=${valStr}`);
            }
          }
        }
        const metaStr = metaPairs.length > 0 ? ` ${ANSI.dim}| ${metaPairs.join(' ')}${ANSI.reset}` : '';

        // Write log line
        process.stdout.write(`${timeStr} ${levelStr} ${catStr} ${msg}${metaStr}\n`);

        // If error stack exists, print indented
        const errObj = log.err || log.error;
        if (errObj && errObj.stack) {
          process.stdout.write(`${ANSI.red}${errObj.stack}${ANSI.reset}\n`);
        }
      } catch {
        process.stdout.write(chunk);
      }
      callback();
    },
  });
}

/**
 * Configure Core Pino Logger
 */
const pinoOptions = {
  level: rawLogLevel,
  customLevels: {
    success: 35,
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'jwt',
      '*.jwt',
      'authorization',
      'headers.authorization',
      'cookie',
      'headers.cookie',
      'secret',
      '*.secret',
      'apiKey',
      '*.apiKey',
      'api_key',
      '*.api_key',
      'refreshToken',
      '*.refreshToken',
      'creditCard',
      '*.creditCard',
      'DATABASE_URL',
    ],
    censor: '[REDACTED]',
  },
};

// Destination stream: Pretty formatted stream in development, stdout for structured JSON in production
const destination = isProduction ? process.stdout : createPrettyStream();

const baseLogger = pino(pinoOptions, destination);

/**
 * Normalize logger call arguments to support:
 * - log(msg)
 * - log(msg, meta)
 * - log(meta, msg)
 * - log(err)
 */
function normalizeArgs(category, arg1, arg2) {
  let msg = '';
  let meta = { category };

  if (typeof arg1 === 'string') {
    msg = arg1;
    if (arg2 && typeof arg2 === 'object') {
      if (arg2 instanceof Error) {
        meta.err = { message: arg2.message, stack: arg2.stack, name: arg2.name };
      } else {
        Object.assign(meta, sanitizeMeta(arg2));
      }
    }
  } else if (arg1 instanceof Error) {
    msg = arg1.message;
    meta.err = { message: arg1.message, stack: arg1.stack, name: arg1.name };
    if (arg2 && typeof arg2 === 'object') {
      Object.assign(meta, sanitizeMeta(arg2));
    }
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    Object.assign(meta, sanitizeMeta(arg1));
    if (typeof arg2 === 'string') {
      msg = arg2;
    } else if (arg1.msg || arg1.message) {
      msg = arg1.msg || arg1.message;
    }
  }

  return { meta, msg };
}

/**
 * Category-Scoped Sub-Logger Factory
 */
function createCategoryLogger(category) {
  return {
    debug: (arg1, arg2) => {
      const { meta, msg } = normalizeArgs(category, arg1, arg2);
      baseLogger.debug(meta, msg);
    },
    info: (arg1, arg2) => {
      const { meta, msg } = normalizeArgs(category, arg1, arg2);
      baseLogger.info(meta, msg);
    },
    success: (arg1, arg2) => {
      const { meta, msg } = normalizeArgs(category, arg1, arg2);
      baseLogger.success(meta, msg);
    },
    warn: (arg1, arg2) => {
      const { meta, msg } = normalizeArgs(category, arg1, arg2);
      baseLogger.warn(meta, msg);
    },
    error: (arg1, arg2) => {
      const { meta, msg } = normalizeArgs(category, arg1, arg2);
      baseLogger.error(meta, msg);
    },
  };
}

/**
 * Primary Exported Logger Object
 */
export const logger = {
  // Direct Level Calls
  debug: (arg1, arg2) => {
    const { meta, msg } = normalizeArgs('APP', arg1, arg2);
    baseLogger.debug(meta, msg);
  },
  info: (arg1, arg2) => {
    const { meta, msg } = normalizeArgs('APP', arg1, arg2);
    baseLogger.info(meta, msg);
  },
  success: (arg1, arg2) => {
    const { meta, msg } = normalizeArgs('APP', arg1, arg2);
    baseLogger.success(meta, msg);
  },
  warn: (arg1, arg2) => {
    const { meta, msg } = normalizeArgs('APP', arg1, arg2);
    baseLogger.warn(meta, msg);
  },
  error: (arg1, arg2) => {
    const { meta, msg } = normalizeArgs('APP', arg1, arg2);
    baseLogger.error(meta, msg);
  },

  // POS Domain Category Loggers (PRD Section 5)
  auth: createCategoryLogger('AUTH'),
  http: createCategoryLogger('HTTP'),
  db: createCategoryLogger('DATABASE'),
  database: createCategoryLogger('DATABASE'),
  order: createCategoryLogger('ORDER'),
  payment: createCategoryLogger('PAYMENT'),
  inventory: createCategoryLogger('INVENTORY'),
  kds: createCategoryLogger('KDS'),
  bds: createCategoryLogger('BDS'),
  printer: createCategoryLogger('PRINTER'),
  telegram: createCategoryLogger('TELEGRAM'),
  scheduler: createCategoryLogger('SCHEDULER'),
  push: createCategoryLogger('PUSH'),
  notification: createCategoryLogger('NOTIFICATION'),

  // Under-the-hood Pino instance
  raw: baseLogger,
};

export default logger;
