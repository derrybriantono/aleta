// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { saranPemetaan } from "@/lib/pemetaan-blangko";

/**
 * ============================================================================
 * PETA BLANGKO PUTUSAN GUGATAN LAIN (Agen 4B, 11 Okt 2026)
 * ============================================================================
 *
 * Paket ABT "abt-blangko-gugatan-lain" menambah menu derry_briantono 920-923 dan blangko putusan yang disusun
 * dari putusan nyata PA Donggala. panel-alat.js dijalankan SUNGGUHAN (node:vm) lalu fungsi pemilihnya
 * (alatPetaUntukPerkara) dipanggil dengan jenis perkara PERSIS seperti tertulis di SIPP sipp_donggala
 * ("Harta Bersama", "Kewarisan", "Izin Poligami", "Pengesahan Perkawinan/Istbat Nikah").
 *
 * Yang dijaga:
 *   1. tiap jenis gugatan lain mendarat di berkas & kelompok menu paket - bukan di menu cerai;
 *   2. "Izin Poligami" lewat padanan ke kunci "poligami";
 *   3. itsbat (termasuk kontensius alur 15) TETAP di blangko itsbat lama - jenis SIPP-nya sama;
 *   4. layar admin portal (saranPemetaan) menawarkan bawaan yang sama.
 */

const AKAR_EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");

function jalankanPanelAlat() {
  const sumber = readFileSync(path.join(AKAR_EKSTENSI, "panel-alat.js"), "utf8");
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
    console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set,
    URLSearchParams, URL, AbortController,
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
  return (kode: string) => JSON.parse(JSON.stringify(vm.runInContext(kode, konteks) ?? null));
}

describe("peta blangko gugatan lain - pemilih panel-alat.js yang dijalankan", () => {
  const jalan = jalankanPanelAlat();
  const pilih = (jenis: string, status = "Dikabulkan") =>
    jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(jenis)}, ${JSON.stringify(status)}, false)`);

  it("Harta Bersama -> [02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi di menu Putusan Harta Bersama", () => {
    const h = pilih("Harta Bersama");
    expect(h.tingkat).toBe("jenis");
    expect(h.baris.berkas).toBe("[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi");
    expect(h.baris.blangko).toBe("Putusan Harta Bersama");
    expect(h.baris.blangkoLain).toEqual(["Putusan HB", "HB - Putusan"]);
  });

  it("Kewarisan -> [01] [Kabul] Kewarisan - Kontradiktur di menu Putusan Kewarisan; perdamaian -> [97] (Q3 16 Okt)", () => {
    const h = pilih("Kewarisan", "Dikabulkan");
    expect(h.baris.berkas).toBe("[01] [Kabul] Kewarisan - Kontradiktoir");
    expect(h.baris.blangko).toBe("Putusan Kewarisan");
    const damai = pilih("Kewarisan", "Perdamaian");
    expect(damai.baris.berkas).toBe("[97] [Perdamaian] Akta Perdamaian");
    expect(damai.baris.blangko).toBe("Putusan Kewarisan");
  });

  it("Izin Poligami (nama SIPP) lewat padanan ke kunci poligami -> [01] [Kabul] Izin Poligami", () => {
    expect(jalan('alatKunciJenis("Izin Poligami")')).toBe("poligami");
    const h = pilih("Izin Poligami");
    expect(h.kunci).toBe("poligami");
    expect(h.baris.berkas).toBe("[01] [Kabul] Izin Poligami");
    expect(h.baris.blangko).toBe("Putusan Izin Poligami");
  });

  it("itsbat (juga kontensius alur 15) tetap di blangko itsbat lama, cerai tetap di menu cerai", () => {
    expect(pilih("Pengesahan Perkawinan/Istbat Nikah").baris.berkas).toBe("[01] [Kabul] IN");
    expect(pilih("Cerai Gugat").baris.blangko).toBe("Putusan Cerai Gugat");
    expect(pilih("Cerai Talak").baris.blangko).toBe("Putusan Cerai Talak");
  });

  it("jenis yang tidak diberi bawaan tetap tanpa baris - tidak ditebak", () => {
    // F21 17 Okt: Ekonomi Syariah (gugatan sederhana), Pembatalan Perkawinan, dan Penguasaan Anak (hak asuh) kini punya bawaan;
    // F22 17 Okt: juga Wasiat, Pencegahan Perkawinan (dan Ekonomi Syariah acara biasa lewat keadaan "es-biasa").
    expect(pilih("Zakat")).toBeNull(); // I28 18 Okt: Hibah kini punya bawaan (folder 4d)
    expect(pilih("Wasiat").baris.blangko).toBe("Putusan Wasiat");
    expect(pilih("Pencegahan Perkawinan").baris.blangko).toBe("Putusan Pencegahan Perkawinan");
    expect(pilih("Ekonomi Syariah").baris.blangko).toBe("Putusan Ekonomi Syariah");
  });
});

describe("saran layar admin portal = bawaan ekstensi", () => {
  it("menawarkan berkas paket untuk Harta Bersama, Kewarisan, Izin Poligami", () => {
    const saran = Object.fromEntries(saranPemetaan("putusan").map((s) => [s.kunci, s.namaBerkas]));
    expect(saran["Harta Bersama"]).toBe("[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi");
    expect(saran["Kewarisan"]).toBe("[01] [Kabul] Kewarisan - Kontradiktoir");
    expect(saran["Izin Poligami"]).toBe("[01] [Kabul] Izin Poligami");
  });
});
