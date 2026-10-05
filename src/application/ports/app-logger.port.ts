export type LogFields = Record<string, unknown>;

export abstract class AppLogger {
  abstract info(event: string, fields?: LogFields): void;
  abstract warn(event: string, fields?: LogFields): void;
  abstract error(event: string, fields?: LogFields): void;
}
