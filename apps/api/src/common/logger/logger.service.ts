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
    this.ensureLogDirectory();

    const logFormat = winston.format.printf(
      ({ timestamp, level, message, fileName, functionName, lineNumber }) => {
        return `${timestamp} | ${fileName} | ${functionName} | ${lineNumber} | ${level} | ${message}`;
      },
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat,
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize({ colors: customLogLevels.colors }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat,
    );

    this.logger = winston.createLogger({
      levels: customLogLevels.levels,
      transports: [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'ERROR', // Matches <= ERROR (0 and 1, which are FATAL and ERROR)
          format: fileFormat,
        }),
        new winston.transports.File({
          filename: 'logs/app.log',
          level: 'TRACE', // Matches everything (<= 5)
          format: fileFormat,
        }),
      ],
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          level: 'TRACE',
          format: consoleFormat,
        }),
      );
    }
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
