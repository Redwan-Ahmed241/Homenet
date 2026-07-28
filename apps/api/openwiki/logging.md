# Logging

The Homenet API uses a **custom Winston logger** wrapped in a NestJS provider (`LoggerModule`).  It centralises log handling for both file output and console (development) with a structured log line format.

## Components
- `logger.constants.ts` – defines custom log levels (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`) and colors.
- `logger.interface.ts` – `LogMetadata` shape `{ fileName?: string; functionName?: string; lineNumber?: number; }` passed to each log call.
- `logger.service.ts` – creates the Winston logger, configures transports, and exposes convenience methods (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).
- `logger.module.ts` – registers `LoggerService` as a global module that can be injected anywhere via Nest's DI.

## How It Works
1. On construction the service ensures a `logs/` directory exists.
2. Two **file transports** are set up:
   - `logs/error.log` – captures `ERROR` and `FATAL` levels.
   - `logs/app.log` – captures all levels (`TRACE` and above).
3. In non‑production environments a **console transport** prints coloured logs to STDOUT.
4. Each log line follows the pattern:
   ```
   <timestamp> | <fileName> | <functionName> | <lineNumber> | <level> | <message>
   ```
   This makes it easy to grep logs for a particular source.

## Using the Logger
Inject `LoggerService` into any provider or controller:
```ts
@Injectable()
export class SomeService {
  constructor(private readonly logger: LoggerService) {}

  doWork() {
    this.logger.info('Work started', { fileName: __filename, functionName: 'doWork', lineNumber: 42 });
    // …
  }
}
```
The `LogMetadata` fields are optional; you can provide as much context as needed.

## Extending / Customising
- **Add transports** – modify `logger.service.ts` to add e.g., a remote logging service.
- **Change format** – adjust the `logFormat` definition.
- **Runtime level** – set `process.env.LOG_LEVEL` and read it when constructing the transports if you need dynamic control.

---
**Key files**: `src/common/logger/*`, `src/common/logger/logger.constants.ts`, `src/common/logger/logger.service.ts`
