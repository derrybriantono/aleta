// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { keadaanPutusan } from "@/lib/keadaan-putusan";

/**
 * ============================================================================
 * PEMILIHAN BLANGKO PUTUSAN PER KEADAAN (Q3, 16 Okt 2026; peta perkara L3 15 Okt, kesenjangan bagian 3)
 * ============================================================================
 *
 * panel-alat.js dijalankan SUNGGUHAN (node:vm). Dua hal dijaga:
 *   1. keadaanPutusan (portal): kode keadaan dari baris jadwal sidang - konservatif bila kehadiran/mediasi tidak pasti;
 *   2. alatPetaUntukPerkara (ekstensi): argumen ke-6 `keadaan` memilih berkas yang tepat (mediasi sebagian [02b], T tidak hadir
 *      setelah mediasi [01c], verstek tanpa bendera, cabut sesudah mediasi, NO SEMA 4a, gugur 3a, itsbat/DK/PAW/perwalian/
 *      pengangkatan anak/AUA/HB/waris/poligami per status, itsbat kontensius), dan pemetaan kumulasi tetap paling khusus.
 * Nama berkas semua baris sudah diperiksa terhadap daftar berkas server (16 Okt, 117 nama termasuk varian: 0 yang tidak ada).
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

type Hasil = { baris: { berkas: string; blangko?: string; blangkoLain?: string[] }; kunci: string; tingkat: string } | null;

describe("pemilih blangko putusan per keadaan (panel-alat.js yang dijalankan)", () => {
  const jalan = jalankanPanelAlat();
  const pilih = (jenis: string, status: string, verstek = false, keadaan: string[] = [], kumulasi: string[] = []): Hasil =>
    jalan(
      `alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(jenis)}, ${JSON.stringify(status)}, ${verstek}, ${JSON.stringify(kumulasi)}, ${JSON.stringify(keadaan)})`
    );

  for (const [jenis, kode] of [
    ["Cerai Gugat", "CG"],
    ["Cerai Talak", "CT"],
  ] as const) {
    it(`${jenis}: mediasi berhasil sebagian -> [02b]; T tidak hadir setelah mediasi -> [01c]; tanpa keadaan tetap [02]`, () => {
      expect(pilih(jenis, "Dikabulkan")!.baris.berkas).toBe(`[02] [Kabul] ${kode} - F`);
      const sebagian = pilih(jenis, "Dikabulkan", false, ["mediasi-sebagian", "sesudah-mediasi"]);
      expect(sebagian!.baris.berkas).toBe(`[02b] [Kabul] ${kode} - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)`);
      expect(sebagian!.tingkat).toBe("keadaan");
      const km = pilih(jenis, "Dikabulkan", false, ["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi"]);
      expect(km!.baris.berkas).toBe("[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi");
      expect(km!.baris.berkas).not.toBe(pilih(jenis, "Dikabulkan")!.baris.berkas);
      // menu tetap menu cerai jenisnya
      expect(km!.baris.blangko).toBe(jenis === "Cerai Gugat" ? "Putusan Cerai Gugat" : "Putusan Cerai Talak");
    });

    it(`${jenis}: bendera verstek kosong tetapi T tak pernah hadir -> diperlakukan verstek (kabul [01], tolak [01ab])`, () => {
      const kabul = pilih(jenis, "Dikabulkan", false, ["verstek-tanpa-bendera"]);
      expect(kabul!.kunci).toBe(`${jenis.toLowerCase()}|dikabulkan|verstek`);
      expect(kabul!.baris.berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
      const tolak = pilih(jenis, "Ditolak", false, ["verstek-tanpa-bendera"]);
      expect(tolak!.baris.berkas).toBe("[01ab] [Tolak Verstek] Cerai - Tidak ada bukti");
      // tanpa kode itu: perilaku lama
      expect(pilih(jenis, "Ditolak")!.baris.berkas).toContain("[03] [Tolak]");
    });

    it(`${jenis}: cabut sesudah mediasi -> [98] Cabut 2; NO pola SEMA -> 4a; gugur P tidak hadir T hadir -> 3a`, () => {
      expect(pilih(jenis, "Dicabut")!.baris.berkas).toContain("[98] [Cabut] 1a.");
      expect(pilih(jenis, "Dicabut", false, ["sesudah-mediasi"])!.baris.berkas).toBe("[98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban)");
      expect(pilih(jenis, "Tidak Dapat Diterima")!.baris.berkas).toContain("[98] [NO] 4.");
      expect(pilih(jenis, "Tidak Dapat Diterima", false, ["sema-1-2022"])!.baris.berkas).toBe(
        "[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)"
      );
      for (const status of ["Digugurkan", "Gugur"]) {
        expect(pilih(jenis, status)!.baris.berkas).toBe("[98] [Gugur] 3. Cerai P & T Tidak Hadir");
        expect(pilih(jenis, status, false, ["p-tidak-hadir-t-hadir"])!.baris.berkas).toBe("[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir");
      }
    });
  }

  it("kode keadaan asing / bukan daftar diabaikan; baris kumulasi tetap paling khusus", () => {
    expect(pilih("Cerai Gugat", "Dikabulkan", false, ["tidak-dikenal", "BUKAN KODE"])!.baris.berkas).toBe("[02] [Kabul] CG - F");
    const jalanan = jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, "Cerai Gugat", "Dikabulkan", false, [], "bukan-daftar")`) as Hasil;
    expect(jalanan!.baris.berkas).toBe("[02] [Kabul] CG - F");
    const kumulasi = pilih("Cerai Gugat", "Dikabulkan", true, ["mediasi-sebagian"], ["hak-asuh-anak"]);
    expect(kumulasi!.tingkat).toBe("kumulasi-verstek");
    expect(kumulasi!.baris.berkas).toContain("Kumulasi Hak Asuh Anak");
  });

  describe("Itsbat Nikah", () => {
    const IN = "Pengesahan Perkawinan/Istbat Nikah"; // nama SIPP, dipadankan ke "itsbat nikah"
    it("per status: kabul tetap [01]; gugur/cabut/tolak/NO punya blangko sendiri (dulu semuanya blangko kabul)", () => {
      expect(pilih(IN, "Dikabulkan")!.baris.berkas).toBe("[01] [Kabul] IN");
      expect(pilih(IN, "Digugurkan")!.baris.berkas).toBe("[98] [Gugur] IN");
      expect(pilih(IN, "Gugur")!.baris.berkas).toBe("[98] [Gugur] IN");
      expect(pilih(IN, "Dicabut")!.baris.berkas).toBe("[98] [Cabut] IN");
      expect(pilih(IN, "Ditolak")!.baris.berkas).toBe("[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)");
      const no = pilih(IN, "Tidak Dapat Diterima");
      expect(no!.baris.berkas).toBe("[99] [NO] IN - Dibawah Umur");
      expect(no!.baris.blangko).toBe("Putusan Itsbat Nikah");
    });
    it("NO pola SEMA 1/2022 -> permohonan umum 9b", () => {
      const h = pilih(IN, "Tidak Dapat Diterima", false, ["sema-1-2022"]);
      expect(h!.baris.berkas).toBe("[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)");
      expect(h!.baris.blangko).toBe("Putusan Permohonan Umum (Cabut/Gugur/NO)");
    });
    it("itsbat kontensius (Pdt.G): kabul/cabut/NO ke folder 2a, bukan permohonan", () => {
      const kabul = pilih(IN, "Dikabulkan", false, ["kontensius"]);
      expect(kabul!.baris.berkas).toBe("[01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris Mengakui");
      expect(kabul!.baris.blangko).toBe("Putusan Itsbat Nikah Kontensius");
      expect(pilih(IN, "Dicabut", false, ["kontensius"])!.baris.berkas).toBe("[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban");
      expect(pilih(IN, "Tidak Dapat Diterima", false, ["kontensius"])!.baris.berkas).toContain("[99] [NO] IN Kontensius");
    });
  });

  describe("permohonan lain dan gugatan", () => {
    it("Dispensasi Kawin: tolak [03], cabut [98], NO [99], gugur -> 9b; kabul tetap baris jenis", () => {
      expect(pilih("Dispensasi Kawin", "Dikabulkan")!.baris.berkas).toBe("[01] [Kabul] DK - (Anak P Cewek) Hamil");
      expect(pilih("Dispensasi Kawin", "Ditolak")!.baris.berkas).toBe("[03] [Tolak] DK - (Anak P Cewek) Belum Hamil");
      expect(pilih("Dispensasi Kawin", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] DK");
      expect(pilih("Dispensasi Kawin", "Tidak Dapat Diterima")!.baris.berkas).toBe("[99] [NO] DK - Pemohon Tidak Hadir Lagi (SEMA 1 2022)");
      const gugur = pilih("Dispensasi Kawin", "Digugurkan");
      expect(gugur!.baris.berkas).toBe("[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir");
      expect(gugur!.baris.blangko).toBe("Putusan Permohonan Umum (Cabut/Gugur/NO)");
    });
    it("Penetapan Ahli Waris (nama SIPP P3HP/...): kabul [01], NO kabur [99], cabut/gugur -> 9b", () => {
      const P3 = "P3HP/Penetapan Ahli Waris";
      const kabul = pilih(P3, "Dikabulkan");
      expect(kabul!.baris.berkas).toContain("[01] [Kabul] PAW - Ahli Waris Anak Kandung");
      expect(kabul!.baris.blangko).toBe("Putusan Penetapan Ahli Waris (P3HP)");
      expect(pilih(P3, "Tidak Dapat Diterima")!.baris.berkas).toBe("[99] [NO] PAW - Permohonan Kabur (Obscuur Libel)");
      expect(pilih(P3, "Tidak Dapat Diterima", false, ["sema-1-2022"])!.baris.berkas).toContain("[99] [NO] Permohonan");
      expect(pilih(P3, "Dicabut")!.baris.berkas).toBe("[98] [Cabut] Permohonan");
      expect(pilih(P3, "Digugurkan")!.baris.berkas).toContain("[98] [Gugur] Permohonan");
    });
    it("Perwalian: kabul, tolak primer-subsider, cabut/gugur/NO -> 9b", () => {
      expect(pilih("Perwalian", "Dikabulkan")!.baris.berkas).toBe("Perwalian Anak oleh ortu kandung Kabul");
      expect(pilih("Perwalian", "Ditolak")!.baris.berkas).toBe("Perwalian Anak oleh ortu kandung Tolak Primer Kabul Subsider");
      expect(pilih("Perwalian", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] Permohonan");
      expect(pilih("Perwalian", "Tidak Dapat Diterima")!.baris.berkas).toContain("[99] [NO] Permohonan");
    });
    it("Pengangkatan Anak (SIPP Lain-Lain) dan Asal Usul Anak", () => {
      const pa = pilih("Lain-Lain", "Dikabulkan");
      expect(pa!.baris.berkas).toBe("[01] [Kabul] Pengangkatan Anak");
      expect(pa!.baris.blangko).toBe("Putusan Lain-Lain (Pengangkatan Anak)");
      expect(pilih("Lain-Lain", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] Permohonan");
      expect(pilih("Asal Usul Anak", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] AUA - Setelah Pembuktian");
      expect(pilih("Asal Usul Anak", "Tidak Dapat Diterima")!.baris.berkas).toContain("[99] [NO] AUA - Poliandri");
    });
    it("Harta Bersama, Kewarisan, Poligami: damai, cabut, kontradiktoir", () => {
      expect(pilih("Harta Bersama", "Dikabulkan")!.baris.berkas).toBe("[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi");
      expect(pilih("Harta Bersama", "Dikabulkan", false, ["kontradiktoir"])!.baris.berkas).toBe(
        "[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan"
      );
      expect(pilih("Harta Bersama", "Perdamaian")!.baris.berkas).toBe("[97] [Perdamaian] Akta Perdamaian");
      expect(pilih("Harta Bersama", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban");
      const waris = pilih("Kewarisan", "Perdamaian");
      expect(waris!.baris.berkas).toBe("[97] [Perdamaian] Akta Perdamaian");
      expect(waris!.baris.blangko).toBe("Putusan Kewarisan");
      // 4b Kewarisan tidak punya [98]: dipakai milik 4a (menu Harta Bersama)
      const cabutWaris = pilih("Kewarisan", "Dicabut");
      expect(cabutWaris!.baris.berkas).toBe("[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban");
      expect(cabutWaris!.baris.blangko).toBe("Putusan Harta Bersama");
      expect(pilih("Izin Poligami", "Dicabut")!.baris.berkas).toBe("[98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban");
      expect(pilih("Izin Poligami", "Dikabulkan")!.baris.berkas).toBe("[01] [Kabul] Izin Poligami");
    });
  });

  it("sebutan kunci peta berkeadaan terbaca manusia, bukan '(verstek)'", () => {
    const baris = jalan(`ALAT_PETA_BAWAAN["cerai gugat|dikabulkan|mediasi-sebagian"]`);
    expect(jalan(`alatSebutKunciPeta("cerai gugat|dikabulkan|mediasi-sebagian", ALAT_PETA_BAWAAN["cerai gugat|dikabulkan|mediasi-sebagian"])`)).toBe(
      "Cerai Gugat · Dikabulkan (mediasi sebagian)"
    );
    expect(baris).not.toBeNull();
    expect(jalan(`alatSebutKunciPeta("cerai gugat|dikabulkan|verstek", ALAT_PETA_BAWAAN["cerai gugat|dikabulkan|verstek"])`)).toBe("Cerai Gugat · Dikabulkan (verstek)");
  });
});

describe("keadaanPutusan (portal) - dari baris jadwal sidang", () => {
  const cerai = { jenisPerkara: "Cerai Gugat", nomorPerkara: "10/Pdt.G/2026/PA.Dgl" };
  const med = (hasil: string) => ({ mediasi: { hasil }, mediasiTerbaca: true });

  it("mediasi berhasil sebagian -> mediasi-sebagian lebih dulu", () => {
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 1, ...med("S") })).toEqual(["mediasi-sebagian", "kontradiktoir", "sesudah-mediasi"]);
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 1, ...med("T") })).not.toContain("mediasi-sebagian");
  });

  it("T hadir mediasi lalu tidak hadir saat putusan -> t-tidak-hadir-setelah-mediasi (butuh mediasi dan kehadiran tercatat)", () => {
    const k = keadaanPutusan({ ...cerai, dihadiriOleh: 2, panggilan: { tergugatPernahHadir: true }, ...med("T") });
    expect(k).toEqual(["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi"]);
    // tanpa mediasi: kontradiktoir biasa, bukan KM
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 2, panggilan: { tergugatPernahHadir: true }, mediasi: null, mediasiTerbaca: true })).toEqual([]);
    // kehadiran sidang ini belum tercatat: tidak menebak
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: null, panggilan: { tergugatPernahHadir: true }, ...med("T") })).toEqual(["sesudah-mediasi"]);
  });

  it("verstek tanpa bendera: hanya bila T tak pernah hadir, tidak ada mediasi (terbaca), dan sidang ini tercatat P saja hadir", () => {
    const dasar = { ...cerai, dihadiriOleh: 2, panggilan: { tergugatPernahHadir: false }, mediasi: null, mediasiTerbaca: true, verstekPutusan: false };
    expect(keadaanPutusan(dasar)).toEqual(["verstek-tanpa-bendera"]);
    expect(keadaanPutusan({ ...dasar, verstekPutusan: true })).toEqual([]); // bendera ada: tak perlu
    expect(keadaanPutusan({ ...dasar, mediasiTerbaca: false })).toEqual([]); // mediasi tak terbaca: tak dapat memastikan
    expect(keadaanPutusan({ ...dasar, mediasi: { hasil: "T" } })).not.toContain("verstek-tanpa-bendera");
    expect(keadaanPutusan({ ...dasar, dihadiriOleh: null })).toEqual([]);
    expect(keadaanPutusan({ ...dasar, panggilan: { tergugatPernahHadir: true } })).not.toContain("verstek-tanpa-bendera");
  });

  it("NO pola SEMA 1/2022 dan gugur P tidak hadir T hadir", () => {
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: true } })).toContain("sema-1-2022");
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 4, penggugatPernahHadir: false } })).not.toContain("sema-1-2022");
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 2, penggugatPernahHadir: true } })).not.toContain("sema-1-2022");
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 3 })).toContain("p-tidak-hadir-t-hadir");
    expect(keadaanPutusan({ ...cerai, dihadiriOleh: 4, panggilan: { hadirSebelumnya: 3 } })).toContain("p-tidak-hadir-t-hadir");
  });

  it("itsbat kontensius dikenali dari nomor Pdt.G; permohonan Pdt.P tidak", () => {
    const itsbat = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" };
    expect(keadaanPutusan({ ...itsbat, nomorPerkara: "33/Pdt.G/2026/PA.Dgl" })).toEqual(["kontensius"]);
    expect(keadaanPutusan({ ...itsbat, nomorPerkara: "33/Pdt.P/2026/PA.Dgl" })).toEqual([]);
    expect(keadaanPutusan({ jenisPerkara: "Cerai Gugat", nomorPerkara: "33/Pdt.G/2026/PA.Dgl", dihadiriOleh: 1 })).not.toContain("kontensius");
  });

  it("harta bersama: T hadir saat putusan -> kontradiktoir; jenis kosong -> tanpa kode", () => {
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", dihadiriOleh: 1 })).toEqual(["kontradiktoir"]);
    expect(keadaanPutusan({ jenisPerkara: "", dihadiriOleh: 1 })).toEqual([]);
  });
});

describe("ekstensi meneruskan keadaan putusan dari baris sidang ke pemilih blangko", () => {
  const baca = (berkas: string) => readFileSync(path.join(AKAR_EKSTENSI, berkas), "utf8");
  it("tiga pemuat sidang (panel-alat, abt, konten) membawa keadaan; tiga pemanggil alatPetaUntukPerkara menerimanya", () => {
    expect(baca("panel-alat.js")).toContain("keadaan: alatKodeKeadaan(s.keadaanPutusan)");
    const abt = baca("abt.js");
    expect(abt).toContain("alatKodeKeadaan(s.keadaanPutusan)");
    expect(abt.match(/alatPetaUntukPerkara\(keadaan\.peta, [^;]*s\.kumulasi, \(s\.keadaan/g)).toHaveLength(2);
    const konten = baca("konten.js");
    expect(konten).toContain("s && s.kumulasi, (s && s.keadaan");
    expect(konten).toContain("keadaan: Array.isArray(s.keadaanPutusan) ? s.keadaanPutusan.map(String).slice(0, 8) : []");
    expect(konten).toContain("...(Array.isArray(s.keadaan) && s.keadaan.length ? { keadaan: s.keadaan.slice(0, 8) } : {})");
  });
});
