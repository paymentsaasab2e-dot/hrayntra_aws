"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function write(level, event, meta = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...meta
    };
    const line = JSON.stringify(payload);
    if (level === 'ERROR') {
        console.error(line);
        return;
    }
    if (level === 'WARN') {
        console.warn(line);
        return;
    }
    console.log(line);
}
exports.logger = {
    info: (event, meta) => write('INFO', event, meta),
    warn: (event, meta) => write('WARN', event, meta),
    error: (event, meta) => write('ERROR', event, meta),
};
//# sourceMappingURL=logger.js.map