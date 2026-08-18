import { Injectable, OnModuleInit } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import { customLogLevels } from './logger.constants.js';
import { LogMetadata } from './logger.interface.js';

@Injectable()
export class LoggerService implements OnModuleInit {
  private logger: winston.Logger;

  constructor() {
    const isVercel = !!process.env.VERCEL;

    const logFormat = winston.format.printf(
      ({ timestamp, level, message, fileName, functionName, lineNumber }) => {
        return `${timestamp} | ${fileName || '-'} | ${functionName || '-'} | ${lineNumber || '-'} | ${level} | ${message}`;
      },
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize({ colors: customLogLevels.colors }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat,
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: 'TRACE',
        format: consoleFormat,
      }),
    ];

    if (!isVercel) {
      try {
        this.ensureLogDirectory();
        const fileFormat = winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          logFormat,
        );
        transports.push(
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'ERROR',
            format: fileFormat,
          }),
          new winston.transports.File({
            filename: 'logs/app.log',
            level: 'TRACE',
            format: fileFormat,
          }),
        );
      } catch (err) {
        // Ignore file system errors on read-only environments
      }
    }

    this.logger = winston.createLogger({
      levels: customLogLevels.levels,
      transports,
    });
  }

  onModuleInit() {
    // Optionally log that the module initialized
  }

  private ensureLogDirectory() {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  trace(message: string, metadata: LogMetadata) {
    this.logger.log('TRACE', message, metadata);
  }

  debug(message: string, metadata: LogMetadata) {
    this.logger.log('DEBUG', message, metadata);
  }

  info(message: string, metadata: LogMetadata) {
    this.logger.log('INFO', message, metadata);
  }

  warn(message: string, metadata: LogMetadata) {
    this.logger.log('WARN', message, metadata);
  }

  error(message: string, metadata: LogMetadata) {
    this.logger.log('ERROR', message, metadata);
  }

  fatal(message: string, metadata: LogMetadata) {
    this.logger.log('FATAL', message, metadata);
  }
}
