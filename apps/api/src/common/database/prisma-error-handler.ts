import { Prisma } from '@prisma/client';
import { AppException } from '../errors/app.exception.js';
import type { ErrorDefinition } from '../errors/error-definition.interface.js';

interface PrismaErrorOptions {
  modelName: string;
  notFoundError?: ErrorDefinition;
  duplicateError?: ErrorDefinition;
  foreignKeyError?: ErrorDefinition;
}

export function handlePrismaError(
  error: unknown,
  options: PrismaErrorOptions,
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2025':
        if (options.notFoundError) {
          throw new AppException(options.notFoundError);
        }
        throw new AppException({
          code: 5000,
          message: `${options.modelName} not found`,
          httpStatus: 404,
        });

      case 'P2002':
        if (options.duplicateError) {
          throw new AppException(options.duplicateError);
        }
        throw new AppException({
          code: 5001,
          message: `${options.modelName} already exists`,
          httpStatus: 409,
        });

      case 'P2003':
        if (options.foreignKeyError) {
          throw new AppException(options.foreignKeyError);
        }
        throw new AppException({
          code: 5002,
          message: `Related ${options.modelName} record not found`,
          httpStatus: 400,
        });
    }
  }

  throw error;
}
