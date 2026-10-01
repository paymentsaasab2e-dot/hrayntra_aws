declare module 'leaflet/dist/leaflet.css';
declare module 'superdoc' {
  export class SuperDoc {
    constructor(options?: any);
    destroy(): void;
    [key: string]: any;
  }
  export default SuperDoc;
}
