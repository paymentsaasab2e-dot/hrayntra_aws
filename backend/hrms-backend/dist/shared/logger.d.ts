type LogMeta = Record<string, unknown>;
export declare const logger: {
    info: (event: string, meta?: LogMeta) => void;
    warn: (event: string, meta?: LogMeta) => void;
    error: (event: string, meta?: LogMeta) => void;
};
export {};
