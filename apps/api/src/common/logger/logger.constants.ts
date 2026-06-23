import * as winston from 'winston';

export const customLogLevels: winston.config.AbstractConfigSet = {
  levels: {
    FATAL: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    TRACE: 5,
  },
  colors: {
    FATAL: 'red',
    ERROR: 'red',
    WARN: 'yellow',
    INFO: 'green',
    DEBUG: 'blue',
    TRACE: 'magenta',
  },
};
