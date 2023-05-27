import pino, { Logger as Pino } from "pino";
import { env } from "./env";
import { Logger } from "./core";

class PinoLogger implements Logger {
  private readonly pino: Pino = pino({ level: env.logLevel });

  debug(msg: string, context?: any): void {
    this.pino.debug(context, msg);
  }

  info(msg: string, context?: any): void {
    this.pino.info(context, msg);
  }

  warn(msg: string, context?: any): void {
    this.pino.warn(context, msg);
  }

  error(msg: string, context?: any): void {
    this.pino.error(context, msg);
  }
}

export const logger: Logger = new PinoLogger();
