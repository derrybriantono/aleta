// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { FOLDER_MENU_PUTUSAN, masukanRekomendasiDariBaris, PETA_PUTUSAN_BAWAAN, pilihPutusanBawaan, rekomendasiBlangko, teksDasarSidang } from "@/lib/rekomendasi-blangko";

/**
 * ============================================================================
 * REKOMENDASI BLANGKO UNTUK PERKARA x SIDANG (Q3, 16 Okt 2026) - tampilan Blangko ABT
 * ============================================================================
 */

const CG = "Cerai Gugat";
const CT = "Cerai Talak";
const labelBas = (r: ReturnType<typeof rekomendasiBlangko>) => r.bas.map((x) => x.label.split("]")[0].replace("[", ""));

describe("teks dasar: alasan tunda dahulu, agenda bila kosong", () => {
  it("alasan tunda berisi huruf menang; '0' bawaan kolom SIPP dan kosong jatuh ke agenda; keduanya kosong = kosong", () => {
    expect(teksDasarSidang({ alasanDitunda: "Menunggu jawaban Tergugat", agenda: "Pembuktian" })).toEqual({ sumber: "alasan-tunda", teks: "Menunggu jawaban Tergugat" });
    expect(teksDasarSidang({ alasanDitunda: "0", agenda: " Pembuktian  Penggugat " })).toEqual({ sumber: "agenda", teks: "Pembuktian Penggugat" });
    expect(teksDasarSidang({ alasanDitunda: "", keterangan: "replik penggugat", agenda: "x1" })).toEqual({ sumber: "alasan-tunda", teks: "replik penggugat" });
    expect(teksDasarSidang({ alasanDitunda: "", agenda: "" })).toEqual({ sumber: "kosong", teks: "" });
  });
});

describe("BAS: langkah dari alasan tunda / agenda, selalu berkas di folder '<jenis> - BAS'", () => {
  const dasar = { jenisPerkara: CG, urutanSidang: 5, dihadiriOleh: 1, agenda: "Sidang lanjutan" };

  it("alasan tunda menggeser tebakan: agenda generik + alasan 'duplik tergugat' -> ALUR 04 [5]", () => {
    const tanpa = rekomendasiBlangko(dasar);
    expect(tanpa.sumberTeks).toBe("agenda");
    expect(tanpa.bas[0].label.startsWith("[5]")).toBe(true); // urutan sidang
    const dengan = rekomendasiBlangko({ ...dasar, urutanSidang: 7, alasanDitunda: "Duplik Tergugat" });
    expect(dengan.sumberTeks).toBe("alasan-tunda");
    expect(dengan.bas[0].label.startsWith("[5]")).toBe(true); // dari kata kunci, bukan urutan ke-7
    expect(dengan.bas[0]).toMatchObject({ utama: true, menu: "Cerai Gugat - BAS", folder: "derry_briantono/1 Perceraian CG - BAS" });
    expect(dengan.bas[0].berkas).toMatch(/^BAS ALUR 04 \[5\]/);
    expect(dengan.bas.every((x) => x.folder === "derry_briantono/1 Perceraian CG - BAS")).toBe(true);
    expect(dengan.bas.filter((x) => x.utama)).toHaveLength(1);
  });

  it("cerai talak mendapat folder CT; verstek sidang 1 menawarkan ALUR 01 [1b] (CT) bukan [1a]", () => {
    const r = rekomendasiBlangko({ jenisPerkara: CT, urutanSidang: 1, dihadiriOleh: 2, agenda: "Sidang pertama" });
    expect(r.bas.every((x) => x.menu === "Cerai Talak - BAS")).toBe(true);
    expect(r.bas.some((x) => x.berkas.includes("[1b] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek di Sidang Pertama - Cerai Talak"))).toBe(true);
    expect(r.bas.some((x) => x.berkas.includes("[1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verstek"))).toBe(false);
  });

  it("putusan sudah ada: akhir diketahui menggeser tebakan ke cabut / gugur / NO", () => {
    const cabut = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dicabut" });
    expect(cabut.bas[0].berkas).toMatch(/ALUR 08 \[B\]/);
    expect(cabut.bas[0].perkiraan).toBe(true); // salinan dibuat perkiraan - petugas memeriksa
    const no = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Tidak Dapat Diterima" });
    expect(no.bas[0].berkas).toMatch(/ALUR 09 \[2\]/);
  });

  it("permohonan: perwalian sidang 1 -> BAS di '6 Perwalian - BAS'; jenis tanpa BAS -> daftar kosong", () => {
    const pw = rekomendasiBlangko({ jenisPerkara: "Perwalian", urutanSidang: 1, dihadiriOleh: 1, agenda: "Pemeriksaan saksi" });
    expect(pw.bas.length).toBeGreaterThan(0);
    expect(pw.bas.every((x) => x.folder === "derry_briantono/6 Perwalian - BAS")).toBe(true);
    // F21 17 Okt: ekonomi syariah GUGATAN SEDERHANA (Pdt.G.S) punya BAS ALUR 40; F22 17 Okt: acara biasa (Pdt.G) ALUR 43 di "10a Ekonomi Syariah Biasa - BAS" dan wasiat ALUR 42
    // di "4c Wasiat - BAS"; nomor tak diketahui tetap tanpa BAS.
    const esBiasa = rekomendasiBlangko({ jenisPerkara: "Ekonomi Syariah", urutanSidang: 1, dihadiriOleh: 1, nomorPerkara: "5/Pdt.G/2026/PA.Dgl" }).bas;
    expect(esBiasa.length).toBeGreaterThan(0);
    expect(esBiasa.every((x) => x.folder === "derry_briantono/10a Ekonomi Syariah Biasa - BAS")).toBe(true);
    expect(rekomendasiBlangko({ jenisPerkara: "Ekonomi Syariah", urutanSidang: 1, dihadiriOleh: 1 }).bas).toEqual([]);
    const wasiat = rekomendasiBlangko({ jenisPerkara: "Wasiat", urutanSidang: 1, dihadiriOleh: 1, nomorPerkara: "5/Pdt.G/2026/PA.Dgl" }).bas;
    expect(wasiat.length).toBeGreaterThan(0);
    expect(wasiat.every((x) => x.folder === "derry_briantono/4c Wasiat - BAS")).toBe(true);
    expect(rekomendasiBlangko({ jenisPerkara: "", urutanSidang: 1 })).toMatchObject({ bas: [], putusan: [], relaas: [] });
  });
});

describe("putusan: per keadaan", () => {
  it("cerai kabul dengan mediasi berhasil sebagian -> [02b]; T tidak hadir setelah mediasi -> [01c]; menu dan folder cerai", () => {
    const sebagian = rekomendasiBlangko({ jenisPerkara: CT, urutanSidang: 6, dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Dikabulkan", mediasi: { hasil: "S" } });
    expect(sebagian.putusan[0]).toMatchObject({ utama: true, menu: "Putusan Cerai Talak", folder: "derry_briantono/1a Perceraian CT", perkiraan: false });
    expect(sebagian.putusan[0].berkas).toBe("[02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar).rtf");
    const km = rekomendasiBlangko({
      jenisPerkara: CG,
      urutanSidang: 4,
      dihadiriOleh: 2,
      sudahPutus: true,
      statusPutusan: "Dikabulkan",
      tergugatPernahHadir: true,
      mediasi: { hasil: "T" },
    });
    expect(km.putusan[0].berkas).toBe("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf");
    expect(km.putusan[0].alasan).toContain("t tidak hadir setelah mediasi");
  });

  it("verstek tanpa bendera -> blangko verstek; bendera ada -> tetap", () => {
    const m = { jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dikabulkan", mediasi: null, mediasiTerbaca: true };
    expect(rekomendasiBlangko(m).putusan[0].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    expect(rekomendasiBlangko({ ...m, verstekPutusan: true }).putusan[0].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    expect(rekomendasiBlangko({ ...m, mediasiTerbaca: false }).putusan[0].berkas).toBe("[02] [Kabul] CG - F.rtf");
  });

  it("itsbat gugur -> [98] Gugur IN; itsbat kontensius (Pdt.G) -> folder 2a; varian ikut sebagai alternatif", () => {
    const gugur = rekomendasiBlangko({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", urutanSidang: 2, dihadiriOleh: 4, sudahPutus: true, statusPutusan: "Digugurkan" });
    expect(gugur.putusan[0]).toMatchObject({ berkas: "[98] [Gugur] IN.rtf", folder: "derry_briantono/2 Itsbat Nikah" });
    const ink = rekomendasiBlangko({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", urutanSidang: 3, dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Dikabulkan" });
    expect(ink.putusan[0]).toMatchObject({ folder: "derry_briantono/2a Itsbat Nikah Kontensius", menu: "Putusan Itsbat Nikah Kontensius" });
    const tidakDapat = rekomendasiBlangko({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", sudahPutus: true, statusPutusan: "Tidak Dapat Diterima", urutanSidang: 1, dihadiriOleh: 2 });
    expect(tidakDapat.putusan.map((x) => x.berkas)).toEqual(["[99] [NO] IN - Dibawah Umur.rtf", "[99] [NO] IN - Masih Terikat Nikah Sebelumnya (Belum Cerai).rtf"]);
    const cerai = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dicabut" });
    expect(cerai.putusan.length).toBeGreaterThan(1);
    expect(cerai.putusan.filter((x) => x.utama)).toHaveLength(1);
    expect(cerai.putusan.slice(1).every((x) => !x.utama && x.perkiraan)).toBe(true);
  });

  it("belum putus: hanya sidang beragenda memutus yang diberi blangko, bertanda perkiraan dikabulkan", () => {
    expect(rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 1, agenda: "Pembuktian" }).putusan).toEqual([]);
    const r = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 1, agenda: "Pembacaan putusan" });
    expect(r.putusan[0]).toMatchObject({ perkiraan: true });
    expect(r.putusan[0].alasan).toContain("diperkirakan dikabulkan");
    // alasan tunda yang menyebut musyawarah ikut menentukan
    expect(rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 1, agenda: "Sidang", alasanDitunda: "Musyawarah majelis" }).putusan).not.toEqual([]);
  });

  it("kumulasi menang: cerai gugat + hak asuh verstek -> folder 1d", () => {
    const r = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true, kumulasi: ["hak-asuh-anak"] });
    expect(r.putusan[0]).toMatchObject({ folder: "derry_briantono/1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak", menu: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak" });
  });
});

describe("relaas: panggilan lanjutan dan pemberitahuan putusan, e-Court bila perkaranya e-Court", () => {
  it("sidang ditunda, hanya P hadir -> relaas T sidang lanjutan + amplop; e-Court -> 5.2 + amplop surat tercatat", () => {
    const biasa = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2, ditunda: true });
    expect(biasa.relaas.map((x) => x.berkas)).toEqual(["[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf", "[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf"]);
    expect(biasa.relaas[0].utama).toBe(true);
    expect(biasa.relaas[1].utama).toBe(false);
    const ec = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2, ditunda: true, lewatEcourt: true });
    expect(ec.relaas.map((x) => x.berkas)).toEqual(["[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf", "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf"]);
  });

  it("semua pihak hadir: tidak ada relaas; kedua pihak tidak hadir: dua relaas; putus verstek e-Court -> 6.2", () => {
    expect(rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 1, ditunda: true }).relaas).toEqual([]);
    const dua = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 4, ditunda: true });
    expect(dua.relaas.filter((x) => x.utama).map((x) => x.berkas)).toEqual([
      "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
      "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
    ]);
    const pbt = rekomendasiBlangko({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true, lewatEcourt: true });
    expect(pbt.relaas.map((x) => x.berkas)).toEqual(["[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf", "[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf"]);
  });
});

describe("masukanRekomendasiDariBaris: bentuk baris jadwal bot", () => {
  it("memetakan ruas baris (panggilan, mediasi, lewatEcourt) dan toleran terhadap bot lama", () => {
    const m = masukanRekomendasiDariBaris({
      jenisPerkara: CG,
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      urutanSidang: "3",
      dihadiriOleh: "2",
      agenda: "Sidang",
      alasanDitunda: "panggil tergugat",
      panggilan: { tergugatPernahHadir: true, penggugatPernahHadir: null, hadirSebelumnya: 1 },
      mediasi: { hasil: "S" },
      lewatEcourt: true,
      ditunda: true,
    });
    expect(m).toMatchObject({ urutanSidang: 3, dihadiriOleh: 2, tergugatPernahHadir: true, penggugatPernahHadir: null, hadirSebelumnya: 1, mediasi: { hasil: "S" }, mediasiTerbaca: true, lewatEcourt: true, ditunda: true });
    const lama = masukanRekomendasiDariBaris({ jenisPerkara: CG });
    expect(lama).toMatchObject({ urutanSidang: 0, dihadiriOleh: null, tergugatPernahHadir: false, lewatEcourt: null, mediasi: null });
    expect(() => rekomendasiBlangko(lama)).not.toThrow();
    expect(rekomendasiBlangko(masukanRekomendasiDariBaris({})).bas).toEqual([]);
  });
});

// ============================================================================
// Cermin TS pilihPutusanBawaan = alatPetaUntukPerkara (panel-alat.js dijalankan)
// ============================================================================
function jalankanPanelAlat() {
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
    console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, URLSearchParams, URL, AbortController,
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

describe("pilihPutusanBawaan (TS) = alatPetaUntukPerkara (ekstensi) atas matriks masukan", () => {
  it("peta bawaan TS sama dengan ALAT_PETA_BAWAAN; jawabannya (kunci dan tingkat) sama untuk ratusan kombinasi", () => {
    const jalan = jalankanPanelAlat();
    const alat = jalan("ALAT_PETA_BAWAAN") as Record<string, { berkas: string }>;
    expect(Object.keys(PETA_PUTUSAN_BAWAAN)).toEqual(Object.keys(alat));
    const jenis = [CG, CT, "Pengesahan Perkawinan/Istbat Nikah", "Dispensasi Kawin", "P3HP/Penetapan Ahli Waris", "Perwalian", "Lain-Lain", "Asal Usul Anak", "Harta Bersama", "Kewarisan", "Izin Poligami", "Wali Adhol", "Ekonomi Syariah"];
    const status = ["", "Dikabulkan", "Dikabulkan (verstek)", "Ditolak", "Tidak Dapat Diterima", "Digugurkan", "Gugur", "Dicabut", "Dicoret dari Register", "Perdamaian"];
    const kumulasi = [[], ["itsbat-nikah"], ["hak-asuh-anak"], ["hak-asuh-anak", "nafkah-anak"]];
    const keadaan = [[], ["mediasi-sebagian", "sesudah-mediasi"], ["t-tidak-hadir-setelah-mediasi"], ["verstek-tanpa-bendera"], ["sema-1-2022"], ["p-tidak-hadir-t-hadir"], ["kontensius"], ["kontradiktoir"]];
    let dicoba = 0;
    for (const j of jenis) {
      for (const s of status) {
        for (const v of [false, true]) {
          for (const k of kumulasi) {
            for (const kd of keadaan) {
              const dariAlat = jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(j)}, ${JSON.stringify(s)}, ${v}, ${JSON.stringify(k)}, ${JSON.stringify(kd)})`) as { kunci: string; tingkat: string } | null;
              const dariTs = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, k, kd);
              expect(dariTs ? { kunci: dariTs.kunci, tingkat: dariTs.tingkat } : null, `${j} | ${s} | ${v} | ${k} | ${kd}`).toEqual(dariAlat ? { kunci: dariAlat.kunci, tingkat: dariAlat.tingkat } : null);
              dicoba += 1;
            }
          }
        }
      }
    }
    expect(dicoba).toBeGreaterThan(5000);
  });

  it("tiap menu putusan bawaan punya folder (agar rekomendasi dapat menunjuk ABT)", () => {
    const menu = new Set(Object.values(PETA_PUTUSAN_BAWAAN).map((b) => b.blangko).filter(Boolean) as string[]);
    for (const m of menu) expect(FOLDER_MENU_PUTUSAN[m], m).toBeTruthy();
  });
});
