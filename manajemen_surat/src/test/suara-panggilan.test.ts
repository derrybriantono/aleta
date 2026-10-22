// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * SUARA PANGGILAN DIPILIH PETUGAS, BUKAN DIPILIHKAN PERAMBAN
 * ============================================================================
 *
 * Sebelumnya kalimat panggilan hanya diberi lang = "id-ID" lalu diserahkan
 * kepada peramban. Chrome memuat beberapa suara Indonesia sekaligus - beberapa
 * jernih, beberapa datar - dan mana yang terpakai bergantung urutan yang tidak
 * dapat diramalkan. Pada pengeras suara ruang tunggu yang memantul, bedanya
 * menentukan apakah nomor antrian terdengar atau tidak.
 *
 * Diuji di lingkungan node dengan speechSynthesis tiruan: yang diuji BUKAN
 * bunyinya - itu milik peramban - melainkan suara mana yang dipilih, dan
 * kalimat apa yang dikirim kepadanya.
 */

type SuaraTiruan = { voiceURI: string; name: string; lang: string; localService: boolean };

const SUARA: SuaraTiruan[] = [
  { voiceURI: "en-us-1", name: "Samantha", lang: "en-US", localService: true },
  { voiceURI: "id-net", name: "Google Bahasa Indonesia", lang: "id-ID", localService: false },
  { voiceURI: "id-lokal", name: "Andika", lang: "id-ID", localService: true },
  { voiceURI: "en-gb-1", name: "Daniel", lang: "en-GB", localService: false },
];

let diucapkan: Array<{ teks: string; suara: SuaraTiruan | null; lang: string }> = [];

class UcapanTiruan {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  voice: SuaraTiruan | null = null;
  constructor(teks: string) {
    this.text = teks;
  }
}

beforeEach(() => {
  diucapkan = [];
  const simpanan = new Map<string, string>();

  vi.stubGlobal("window", {
    speechSynthesis: {
      getVoices: () => SUARA,
      speak: (u: UcapanTiruan) => diucapkan.push({ teks: u.text, suara: u.voice, lang: u.lang }),
      cancel: () => diucapkan.push({ teks: "[batal]", suara: null, lang: "" }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    localStorage: {
      getItem: (k: string) => simpanan.get(k) ?? null,
      setItem: (k: string, v: string) => void simpanan.set(k, v),
    },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", UcapanTiruan);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function muat() {
  return import("@/lib/suara-panggilan");
}

describe("daftar suara", () => {
  it("bahasa Indonesia didahulukan", async () => {
    const { daftarSuara } = await muat();
    const urut = daftarSuara().map((x) => x.uri);
    expect(urut.slice(0, 2).sort()).toEqual(["id-lokal", "id-net"]);
  });

  it("di dalam bahasa yang sama, yang terpasang di perangkat lebih dahulu", async () => {
    // Suara yang perlu jaringan gagal diam-diam ketika jaringannya putus, dan
    // ruang tunggu tiba-tiba senyap tanpa ada yang tahu sebabnya.
    const { daftarSuara } = await muat();
    expect(daftarSuara()[0].uri).toBe("id-lokal");
  });

  it("suara bukan Indonesia TIDAK dibuang", async () => {
    // Sebagian perangkat tidak punya satu pun suara Indonesia, dan daftar
    // kosong akan membuat layarnya tampak rusak.
    const { daftarSuara } = await muat();
    expect(daftarSuara()).toHaveLength(4);
  });

  it("bawaannya suara Indonesia pertama", async () => {
    const { daftarSuara, suaraIndonesiaBawaan } = await muat();
    expect(suaraIndonesiaBawaan(daftarSuara())).toBe("id-lokal");
  });

  it("tanpa suara Indonesia, bawaannya kosong - bukan menebak", async () => {
    const { suaraIndonesiaBawaan } = await muat();
    expect(
      suaraIndonesiaBawaan([{ uri: "en", nama: "Daniel", bahasa: "en-GB", lokal: true }])
    ).toBe("");
  });
});

describe("mengucapkan", () => {
  it("memakai suara yang dipilih", async () => {
    const { ucapkan } = await muat();
    expect(ucapkan("Nomor antrian satu.", "id-net")).toBe(true);
    expect(diucapkan).toHaveLength(1);
    expect(diucapkan[0].suara?.voiceURI).toBe("id-net");
  });

  it("bahasa mengikuti suaranya, bukan dipaksa id-ID", async () => {
    // Memaksakan id-ID pada suara Inggris membuat sebagian peramban menolak
    // keduanya lalu diam sama sekali.
    const { ucapkan } = await muat();
    ucapkan("Nomor antrian satu.", "en-us-1");
    expect(diucapkan[0].lang).toBe("en-US");
  });

  it("tanpa pilihan, tetap berbahasa Indonesia", async () => {
    const { ucapkan } = await muat();
    ucapkan("Nomor antrian satu.");
    expect(diucapkan[0].lang).toBe("id-ID");
    expect(diucapkan[0].suara).toBeNull();
  });

  it("kalimat kosong tidak diucapkan", async () => {
    const { ucapkan } = await muat();
    expect(ucapkan("   ")).toBe(false);
    expect(diucapkan).toHaveLength(0);
  });

  it("pilihan yang tidak dikenali tidak menggagalkan ucapan", async () => {
    // Suara yang dipilih kemarin dapat hilang sesudah sistemnya diperbarui.
    // Diam total lebih buruk daripada berbicara dengan suara bawaan.
    const { ucapkan } = await muat();
    expect(ucapkan("Nomor antrian satu.", "suara-yang-sudah-hilang")).toBe(true);
    expect(diucapkan[0].suara).toBeNull();
  });

  it("pilihan diingat antar sesi", async () => {
    const { simpanPilihan, bacaPilihanTersimpan } = await muat();
    simpanPilihan("id-net");
    expect(bacaPilihanTersimpan()).toBe("id-net");
  });
});

describe("panggilan petugas hanya bersuara", () => {
  const berkas = readFileSync(
    path.resolve(process.cwd(), "src/components/portal/aleta-antrian-panggil.tsx"),
    "utf8"
  );

  it("tombol petugas tidak menyentuh rute antrian", () => {
    // Kalau panggilan petugas ikut menandai antrian, satu panggilan kepada
    // rohaniwan akan menggeser nomor yang sedang menunggu - dan pihak yang
    // belum dipanggil terlewat tanpa jejak.
    const blok = berkas.slice(berkas.indexOf("const PANGGILAN_PETUGAS"), berkas.indexOf("export function"));
    expect(blok).not.toContain("fetch(");
    expect(blok).not.toContain("antrian/panggil");
  });

  it("kelima petugas SIPP ada", () => {
    for (const kunci of ["majelis", "jurusita", "rohaniwan", "mediasi", "persidangan"]) {
      expect(berkas, kunci).toContain(`kunci: "${kunci}"`);
    }
  });

  it("saksi dipanggil dengan namanya", () => {
    // Kalimatnya kini disusun di lib/kalimat-panggilan (W59, 22 Okt 2026); bunyinya tetap.
    expect(berkas).toContain("kalimatSaksiKetik(nama");
    const lib = readFileSync(path.resolve(process.cwd(), "src/lib/kalimat-panggilan.ts"), "utf8");
    expect(lib).toContain("Saksi atas nama ${bersih(nama)}");
  });

  it("suara hanya berbunyi bila panggilan berhasil tercatat", () => {
    // Suara atas panggilan yang gagal membuat petugas mengira nomornya sudah
    // bergerak, lalu meneruskan ke nomor berikutnya.
    expect(berkas).toContain("if (hasil.ok !== false && suaraNyala && satu.nomor !== null)");
  });
});
