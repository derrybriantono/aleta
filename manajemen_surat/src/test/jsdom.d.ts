/**
 * jsdom sudah terpasang sebagai dependensi vitest, tetapi tanpa berkas tipe.
 * Yang dideklarasikan hanya bagian yang dipakai uji jembatan SSO, supaya tidak
 * perlu menambah paket @types/jsdom hanya untuk satu berkas uji.
 */
declare module "jsdom" {
  export type JsdomOptions = {
    runScripts?: "dangerously" | "outside-only";
    url?: string;
    beforeParse?: (window: Window & typeof globalThis) => void;
  };

  export class JSDOM {
    constructor(html?: string, options?: JsdomOptions);
    readonly window: Window & typeof globalThis;
    serialize(): string;
  }
}
