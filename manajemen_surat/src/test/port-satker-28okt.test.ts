/**
 * 28 Okt 2026: portal ALETA dapat dibuka lewat port sendiri (192.168.10.10:8008), tetapi SIPP dan ABT satker di port bawaan.
 * Tautan "Perbaiki"/Buka SIPP/ABT dari popup, portal, dan pekerja latar sempat membuka 192.168.10.10:8008/SIPP - asal tempat
 * ekstensi tidak aktif dan sesi SIPP terpisah. Mesin setempat (127.0.0.1/localhost) tetap memakai asalnya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const fungsi = (sumber: string, nama: string) => {
  const a = sumber.indexOf(`function ${nama}(`);
  return sumber.slice(a, sumber.indexOf("\n}\n", a) + 3);
};

describe("popup: alamat aplikasi dari asal portal", () => {
  const popup = baca("popup.js");
  const jalankan = (asalPortal: string) => {
    const k: Record<string, unknown> = { URL, tahap2: { asalPortal } };
    vm.createContext(k);
    vm.runInContext(`${fungsi(popup, "asalSitus")}\n${fungsi(popup, "asalSatkerDari")}\n${fungsi(popup, "alamatAplikasi")}`, k);
    return (apa: string) => vm.runInContext(`alamatAplikasi(${JSON.stringify(apa)})`, k) as string;
  };

  it("portal :8008 -> SIPP dan ABT di port bawaan; portal tetap :8008", () => {
    const a = jalankan("http://192.168.10.10:8008/aleta");
    expect(a("sipp")).toBe("http://192.168.10.10/SIPP/");
    expect(a("abt")).toBe("http://192.168.10.10/aps_badilag/abt");
    expect(a("portal")).toBe("http://192.168.10.10:8008/aleta");
  });

  it("portal port 80 tidak berubah; mesin setempat memakai asalnya sendiri", () => {
    expect(jalankan("http://192.168.10.10/aleta")("sipp")).toBe("http://192.168.10.10/SIPP/");
    expect(jalankan("http://127.0.0.1:3000/aleta")("sipp")).toBe("http://127.0.0.1:3000/index.php/");
    expect(jalankan("http://localhost:3000/aleta")("abt")).toBe("http://localhost:3000/aps_badilag/abt");
  });
});

describe("portal (aleta.js): Buka SIPP/ABT, alamat depan, dan jembatan ABT", () => {
  const aleta = baca("aleta.js");
  const jalankan = (href: string) => {
    const u = new URL(href);
    const k: Record<string, unknown> = { location: { origin: u.origin, protocol: u.protocol, hostname: u.hostname } };
    vm.createContext(k);
    vm.runInContext(
      `${fungsi(aleta, "asalSatkerPortal")}\n${fungsi(aleta, "t4AlamatSippDepan")}\n${fungsi(aleta, "t4AlamatAbtDepan")}\n${fungsi(aleta, "jembatanAsal")}`,
      k
    );
    return k;
  };

  it("portal :8008 -> SIPP/ABT port bawaan; jembatan ABT juga", () => {
    const k = jalankan("http://192.168.10.10:8008/aleta/aleta-ecourt");
    expect(vm.runInContext("t4AlamatSippDepan()", k)).toBe("http://192.168.10.10/SIPP/");
    expect(vm.runInContext("t4AlamatAbtDepan()", k)).toBe("http://192.168.10.10/aps_badilag/");
    expect(vm.runInContext("jembatanAsal().asalAbt", k)).toBe("http://192.168.10.10/aps_badilag");
  });

  it("mesin setempat tetap memakai asalnya", () => {
    const k = jalankan("http://127.0.0.1:3000/aleta");
    expect(vm.runInContext("t4AlamatSippDepan()", k)).toBe("http://127.0.0.1:3000/index.php/");
    expect(vm.runInContext("t4AlamatAbtDepan()", k)).toBe("http://127.0.0.1:3000/aps_badilag/");
  });

  it("tombol Buka SIPP / Buka ABT di panel portal memakai asal satker", () => {
    expect(aleta).toContain('tautan(`${asalSatkerPortal()}/SIPP/`, "Buka SIPP")');
    expect(aleta).toContain('tautan(`${asalSatkerPortal()}/aps_badilag/`, "Buka ABT")');
  });
});
