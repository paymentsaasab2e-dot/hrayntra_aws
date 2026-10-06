declare module 'leaflet/dist/leaflet.css';
declare module 'superdoc' {
  export class SuperDoc {
    constructor(options?: any);
    destroy(): void;
    [key: string]: any;
  }
  export default SuperDoc;
}
/** Webpack/Turbopack alias target for SuperDoc ESM entry */
declare module '*/superdoc/dist/superdoc.es.js' {
  export class SuperDoc {
    constructor(options?: any);
    destroy(): void;
    [key: string]: any;
  }
  export default SuperDoc;
}
declare module '../../node_modules/superdoc/dist/superdoc.es.js' {
  export class SuperDoc {
    constructor(options?: any);
    destroy(): void;
    [key: string]: any;
  }
  export default SuperDoc;
}
