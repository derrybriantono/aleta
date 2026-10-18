// Pembantu uji pemetaan: menjalankan ekstensi-sipp/panel-alat.js utuh di node:vm (lingkungan peramban ditiru), seperti tipe-keluaran-cermin-ekstensi.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function muatPanelAlat(): { jalan: (kode: string) => unknown } {
  const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/panel-alat.js"), "utf8");
  const elemen = () => ({
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: unknown) => x,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  });
  const konteks: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    Map,
    Set,
    URLSearchParams,
    URL,
    AbortController,
    document: { documentElement: elemen(), createElement: elemen, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    location: { origin: "http://127.0.0.1", pathname: "/", search: "" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p: string) => p },
      storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), clone() { return this; } }),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumber, konteks, { filename: "panel-alat.js" });
  return { jalan: (kode: string) => JSON.parse(JSON.stringify(vm.runInContext(kode, konteks) ?? null)) };
}

/** Pilihan baris peta oleh alatPetaUntukPerkara (JS) untuk dibandingkan dengan pilihPutusanBawaan (TS). */
export function pilihDariPanel(panel: { jalan: (kode: string) => unknown }, jenis: string, status: string, verstek: boolean, kumulasi: unknown, keadaan: string[]) {
  const h = panel.jalan(
    `alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(jenis)}, ${JSON.stringify(status)}, ${verstek}, ${JSON.stringify(kumulasi ?? null)}, ${JSON.stringify(keadaan)})`
  ) as { kunci: string; tingkat: string } | null;
  return h ? { kunci: h.kunci, tingkat: h.tingkat } : null;
}
