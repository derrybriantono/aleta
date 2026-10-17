// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { hitungLembarSkp } from "@/lib/skp-jabatan-hitung";
import { KUNCI_FAKTA_SKP_JABATAN, SKP_JABATAN_2026 } from "@/lib/skp-jabatan-katalog";
import { GRUP_SIPP_JABATAN, JABATAN_SKP, type DataSkpJabatan, type PegawaiSkp } from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * SISI BOT SKP JABATAN - RUTE, KUNCI FAKTA, PERIODE BULANAN
 * ============================================================================
 *
 *   - Potongan router.get("/sipp/skp-jabatan") dan ("/sipp/skp-akun") DIPOTONG
 *     dari internalGatewayRoutes.js dan dijalankan di node:vm (pola
 *     riwayat-pihak-rute.test.ts): dijaga requireInternalToken, status dari
 *     hasil layanan, galat tak terduga 500.
 *   - Kunci fakta bot = KUNCI_FAKTA_SKP_JABATAN katalog portal, dan setiap
 *     indikator dapat dihitung dari daftar yang BENAR-BENAR dikirim (turunan
 *     membaca `dari`/rasio dari daftar yang dikirim).
 *   - Fakta dari layanan bot (kueri tiruan) memasuki hitungLembarSkp portal
 *     dan menghasilkan angka, bukan "—".
 *   - Periode bulanan b01..b12 sah di jalur bot, tw/tahun lama tidak berubah.
 */

const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const BERKAS_RUTE = path.join(AKAR_BOT, "routes/internalGatewayRoutes.js");
const requireBot = createRequire(path.join(AKAR_BOT, "services/_uji.js"));

// Memuat layanan bot menyentuh db_config (kolam tanpa sambungan sampai dipakai).
const layanan = requireBot("./evidenSkpJabatanService.js") as {
  JABATAN: string[];
  KUNCI_FAKTA: Record<string, string[]>;
  KUNCI_TURUNAN: string[];
  KUNCI_TAMBAHAN: Record<string, string[]>;
  GRUP_JABATAN: Record<string, string>;
  jendelaBht: (p: { mulai: string; bulan: number }) => { mulai: string; selesai: string };
  buatLayanan: (deps: Record<string, unknown>) => {
    skpJabatan: (m: Record<string, string>, o?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};
const eviden = requireBot("./evidenSkpService.js") as {
  susunPeriode: (k: string, t: number) => { mulai: string; selesai: string; bulan: number; labelPanjang: string };
  periksaMasukan: (m: Record<string, string>, h?: string) => { ok: boolean; alasan?: string };
};

// ===========================================================================
// RUTE
// ===========================================================================

function potongRute(jalur: string, layananTiruan: Record<string, (m: Record<string, string>) => Promise<unknown>>) {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const awal = isi.indexOf(`router.get("${jalur}"`);
  expect(awal, `rute ${jalur} tidak ditemukan di internalGatewayRoutes.js`).toBeGreaterThan(0);
  const akhir = isi.indexOf("\n});", awal) + "\n});".length;
  const PENJAGA = Symbol("requireInternalToken");
  const terdaftar: Array<{ jalur: string; penjaga: unknown; penangan: (req: unknown, res: unknown) => Promise<void> }> = [];
  const konteks = vm.createContext({
    requireInternalToken: PENJAGA,
    evidenSkpJabatanService: layananTiruan,
    String,
    router: {
      get: (j: string, penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) =>
        terdaftar.push({ jalur: j, penjaga, penangan }),
    },
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: `internalGatewayRoutes.js#${jalur}` });
  return { terdaftar, PENJAGA };
}

function jawab() {
  const hasil: { status: number; badan: unknown } = { status: 0, badan: null };
  const res = {
    status(s: number) {
      hasil.status = s;
      return res;
    },
    json(x: unknown) {
      hasil.badan = x;
      return res;
    },
  };
  return { res, hasil };
}

describe("rute bot /sipp/skp-jabatan", () => {
  it("dijaga requireInternalToken, meneruskan kueri sebagai teks, status dari layanan", async () => {
    const dipanggil: Array<Record<string, string>> = [];
    const { terdaftar, PENJAGA } = potongRute("/sipp/skp-jabatan", {
      skpJabatan: async (m) => {
        dipanggil.push(m);
        return { ok: false, status: 404, alasan: "akun_tidak_ditemukan", error: "Akun SIPP itu tidak ditemukan." };
      },
    });
    expect(terdaftar).toHaveLength(1);
    expect(terdaftar[0].jalur).toBe("/sipp/skp-jabatan");
    expect(terdaftar[0].penjaga).toBe(PENJAGA);

    const { res, hasil } = jawab();
    await terdaftar[0].penangan(
      { query: { tahun: "2026", periode: "tw3", jabatan: "jurusita", username: "mustini", tambahan: "1" } },
      res
    );
    expect(dipanggil).toEqual([{ tahun: "2026", periode: "tw3", jabatan: "jurusita", username: "mustini", tambahan: "1" }]);
    expect(hasil.status).toBe(404);
    expect(hasil.badan).toMatchObject({ ok: false, alasan: "akun_tidak_ditemukan" });
  });

  it("username berulang (?username=a&username=b) diteruskan sebagai daftar, koma tidak dipecah", async () => {
    const dipanggil: Array<Record<string, unknown>> = [];
    const { terdaftar } = potongRute("/sipp/skp-jabatan", {
      skpJabatan: async (m) => {
        dipanggil.push(m);
        return { ok: true };
      },
    });
    const { res } = jawab();
    await terdaftar[0].penangan({ query: { tahun: "2026", periode: "tw3", jabatan: "petugas-meja", username: ["meja3g", "munifa,SH."] } }, res);
    expect(JSON.stringify(dipanggil[0].username)).toBe(JSON.stringify(["meja3g", "munifa,SH."]));
    expect(dipanggil[0].jabatan).toBe("petugas-meja");
  });

  it("masukan kosong diteruskan sebagai teks kosong; jawaban ok 200; masukan salah memakai status 400 dari layanan", async () => {
    const { terdaftar } = potongRute("/sipp/skp-jabatan", {
      skpJabatan: async (m) => (m.periode === "" ? { ok: false, status: 400, alasan: "periode_tidak_dikenal" } : { ok: true }),
    });
    const a = jawab();
    await terdaftar[0].penangan({ query: {} }, a.res);
    expect(a.hasil.status).toBe(400);
    const b = jawab();
    await terdaftar[0].penangan({ query: { tahun: "2026", periode: "b09" } }, b.res);
    expect(b.hasil.status).toBe(200);
  });

  it("galat tak terduga dijawab 500 dengan pesan dipotong, tanpa melempar", async () => {
    const { terdaftar } = potongRute("/sipp/skp-jabatan", {
      skpJabatan: async () => {
        throw new Error("x".repeat(500));
      },
    });
    const { res, hasil } = jawab();
    await terdaftar[0].penangan({ query: { tahun: "2026", periode: "tw3" } }, res);
    expect(hasil.status).toBe(500);
    expect((hasil.badan as { error: string }).error.length).toBeLessThanOrEqual(300);
  });
});

describe("rute bot /sipp/skp-akun (jembatan pemetaan akun-grup)", () => {
  it("dijaga requireInternalToken dan meneruskan username + semua", async () => {
    const dipanggil: Array<Record<string, string>> = [];
    const { terdaftar, PENJAGA } = potongRute("/sipp/skp-akun", {
      daftarAkun: async (m) => {
        dipanggil.push(m);
        return { ok: true, akun: [] };
      },
    });
    expect(terdaftar[0].jalur).toBe("/sipp/skp-akun");
    expect(terdaftar[0].penjaga).toBe(PENJAGA);
    const { res, hasil } = jawab();
    await terdaftar[0].penangan({ query: { semua: "1" } }, res);
    expect(dipanggil).toEqual([{ username: "", semua: "1" }]);
    expect(hasil.status).toBe(200);
  });

  it("SIPP tidak terbaca -> status 502 dari layanan", async () => {
    const { terdaftar } = potongRute("/sipp/skp-akun", {
      daftarAkun: async () => ({ ok: false, status: 502, alasan: "sipp_tidak_terbaca", error: "Daftar akun SIPP tidak dapat dibaca dari SIPP saat ini." }),
    });
    const { res, hasil } = jawab();
    await terdaftar[0].penangan({ query: {} }, res);
    expect(hasil.status).toBe(502);
  });
});

// ===========================================================================
// KUNCI FAKTA
// ===========================================================================

describe("kunci fakta bot = katalog portal", () => {
  it("daftar kunci setiap jabatan sama persis dengan KUNCI_FAKTA_SKP_JABATAN", () => {
    for (const j of JABATAN_SKP) {
      expect([...(layanan.KUNCI_FAKTA[j] ?? [])].sort(), j).toEqual([...KUNCI_FAKTA_SKP_JABATAN[j]].sort());
    }
    expect(layanan.JABATAN).toEqual([...JABATAN_SKP]);
  });

  it("setiap kunci tertulis harfiah di berkas layanan (uji katalog memeriksa teksnya)", () => {
    const isi = readFileSync(path.join(AKAR_BOT, "services/evidenSkpJabatanService.js"), "utf8");
    for (const j of JABATAN_SKP) for (const k of KUNCI_FAKTA_SKP_JABATAN[j]) expect(isi.includes(`"${k}"`), k).toBe(true);
  });

  it("indikator yang bukan turunan dikirim; turunan dapat dihitung dari daftar yang dikirim", () => {
    const turunan = new Set(layanan.KUNCI_TURUNAN);
    for (const j of JABATAN_SKP) {
      if (j === "operator") continue; // sumber jejak ALETA di portal, bot tidak mengirim
      for (const r of SKP_JABATAN_2026[j]) {
        for (const i of r.indikator) {
          if (i.aturan.jenis === "isian") continue;
          if (i.aturan.jenis === "rasio") {
            // pembilang dan penyebut harus daftar yang dikirim (bukan turunan)
            expect(turunan.has(i.aturan.pembilang), `${j}:${i.kunci} pembilang`).toBe(false);
            expect(turunan.has(i.aturan.penyebut), `${j}:${i.kunci} penyebut`).toBe(false);
          } else if (turunan.has(i.kunci)) {
            expect(i.dari, `${j}:${i.kunci} turunan tanpa dari`).toBeTruthy();
            expect(turunan.has(i.dari as string), `${j}:${i.kunci} dari ${i.dari} juga turunan`).toBe(false);
          }
        }
      }
    }
  });

  it("grup SIPP -> jabatan di bot selaras GRUP_SIPP_JABATAN kontrak", () => {
    expect(layanan.GRUP_JABATAN).toEqual(
      Object.fromEntries(Object.entries(GRUP_SIPP_JABATAN).map(([g, j]) => [g, j]))
    );
  });

  it("kunci tambahan hanya berawalan x- (tidak menabrak katalog)", () => {
    const sah = new Set(JABATAN_SKP.flatMap((j) => KUNCI_FAKTA_SKP_JABATAN[j]));
    for (const daftar of Object.values(layanan.KUNCI_TAMBAHAN)) {
      for (const k of daftar) {
        expect(k.startsWith("x-")).toBe(true);
        expect(sah.has(k)).toBe(false);
      }
    }
  });
});

// ===========================================================================
// FAKTA BOT MEMASUKI HITUNG PORTAL
// ===========================================================================

describe("fakta bot -> hitungLembarSkp portal", () => {
  const baris = {
    relaas: [
      { id: 1, pengguna: 68, perkaraId: 9, nomor: "1/Pdt.G/2026/PA.Dgl", tanggal: "2026-08-01", diinput: "2026-08-02", berdokumen: 1, sidang: "2026-08-10" },
      { id: 2, pengguna: 68, perkaraId: 9, nomor: "1/Pdt.G/2026/PA.Dgl", tanggal: "2026-08-08", diinput: "2026-08-12", berdokumen: 0, sidang: "2026-08-10" },
      { id: 3, pengguna: 99, perkaraId: 7, nomor: "2/Pdt.G/2026/PA.Dgl", tanggal: "2026-08-03", diinput: "2026-08-03", berdokumen: 1, sidang: "2026-08-20" },
    ],
  };
  const kueri = async (sql: string) => {
    if (/FROM sys_users u/.test(sql)) return [{ userid: 68, username: "mustini", nama: "Mustini", aktif: 1 }];
    if (/FROM sys_user_group ug/.test(sql)) return [{ userid: 68, groupid: 600, nama: "Jurusita" }];
    if (/FROM user_jurusita uj/.test(sql)) return [{ userid: 68, jabatan: "1" }];
    if (/FROM user_panitera up/.test(sql)) return [];
    if (/FROM perkara_pelaksanaan_relaas r/.test(sql)) return baris.relaas;
    return [];
  };
  const tiruan = (ekstra: Record<string, unknown> = {}) =>
    layanan.buatLayanan({
      kueri,
      tabelAda: async () => true,
      pilihKolom: async (_t: string, calon: string[]) => calon[0],
      jam: () => Date.parse("2026-10-17T02:00:00Z"),
      ...ekstra,
    });
  const pegawai: PegawaiSkp = { userId: "u1", nama: "Mustini", nip: null, pangkatGolongan: null, jabatanUtama: "jurusita", jabatanTambahan: [] };

  it("bacaUsername: satu teks atau daftar, koma tidak dipecah, duplikat dibuang, terlalu panjang ditolak", () => {
    const baca = (layanan as unknown as { bacaUsername: (x: unknown) => { ok: boolean; daftar?: string[]; alasan?: string } }).bacaUsername;
    expect(baca("munifa,SH.")).toEqual({ ok: true, daftar: ["munifa,SH."] });
    expect(baca(["a", "b", "a", " "])).toEqual({ ok: true, daftar: ["a", "b"] });
    expect(baca("")).toEqual({ ok: true, daftar: [] });
    expect(baca("x".repeat(61)).ok).toBe(false);
  });

  it("beberapa username sekaligus: yang tak dikenal dicatat, yang ada tetap dihitung", async () => {
    const dipakai: unknown[][] = [];
    const lay = tiruan({
      kueri: async (sql: string, params: unknown[] = []) => {
        if (/FROM sys_users u/.test(sql)) {
          dipakai.push(params);
          return [{ userid: 68, username: "mustini", nama: "Mustini", aktif: 1 }];
        }
        return kueri(sql);
      },
    });
    const data = (await lay.skpJabatan({ tahun: "2026", periode: "tw3", jabatan: "jurusita", username: ["mustini", "hantu,SH."] as never }, { hariIni: "2026-10-17" })) as unknown as DataSkpJabatan;
    expect(dipakai[0]).toEqual(["mustini", "hantu,SH."]);
    expect(data.ok).toBe(true);
    expect(data.akun.map((a) => a.username)).toEqual(["mustini"]);
    expect((data.catatanOperator ?? []).some((c) => c.includes("hantu,SH."))).toBe(true);
  });

  it("relaas jurusita: jumlah, dokumen, sampai >= 3 hari, penginputan <= 2 hari dihitung portal", async () => {
    const data = (await tiruan().skpJabatan({ tahun: "2026", periode: "tw3", jabatan: "jurusita" }, { hariIni: "2026-10-17" })) as unknown as DataSkpJabatan;
    expect(data.ok).toBe(true);
    // Relaas userid 99 (jurusita lain) tidak ikut akun 68.
    const fakta = data.akun[0].fakta;
    expect(fakta.find((f) => f.kunci === "js-relaas-kuantitas")?.kejadian).toHaveLength(2);
    const hasil = hitungLembarSkp({
      jenis: "jurusita",
      periode: data.periode,
      pegawai,
      pejabatPenilai: null,
      data,
      dihitungPada: data.dihitungPada,
    });
    const indikator = Object.fromEntries(hasil.lembar.rhk.flatMap((r) => r.indikator).map((i) => [i.kunci, i]));
    expect(indikator["js-relaas-kuantitas"].realisasi).toBe(2);
    expect(indikator["js-relaas-kualitas"].realisasi).toBe(50); // 1 dari 2 berdokumen
    expect(indikator["js-relaas-waktu"].realisasi).toBe(50); // sidang 10 Agt: relaas 1 Agt (9 hari) ya, 8 Agt (2 hari) tidak
    expect(indikator["js-input-kualitas"].realisasi).toBe(50); // diinput 1 hari ya, 4 hari tidak
    expect(indikator["js-input-waktu"].realisasi).toBe(2.5); // rata-rata (1 + 4) / 2
    expect(indikator["js-relaas-kuantitas"].sumber).toBe("sipp");
  });

  it("bagian SIPP gagal dibaca -> indikator '—' (null), bukan 0", async () => {
    const data = (await tiruan({ tabelAda: async (n: string) => n !== "perkara_pelaksanaan_relaas" }).skpJabatan(
      { tahun: "2026", periode: "tw3", jabatan: "jurusita" },
      { hariIni: "2026-10-17" }
    )) as unknown as DataSkpJabatan;
    const hasil = hitungLembarSkp({ jenis: "jurusita", periode: data.periode, pegawai, pejabatPenilai: null, data, dihitungPada: data.dihitungPada });
    const indikator = hasil.lembar.rhk.flatMap((r) => r.indikator).find((i) => i.kunci === "js-relaas-kuantitas");
    expect(indikator?.realisasi).toBeNull();
    expect(indikator?.realisasiTeks).toBe("—");
  });
});

// ===========================================================================
// PERIODE BULANAN
// ===========================================================================

describe("periode bulanan di bot", () => {
  it("b01..b12 satu bulan kalender penuh; tw dan tahun lama tidak berubah", () => {
    expect(eviden.susunPeriode("b09", 2026)).toMatchObject({ mulai: "2026-09-01", selesai: "2026-09-30", bulan: 1, labelPanjang: "September 2026" });
    expect(eviden.susunPeriode("b02", 2028).selesai).toBe("2028-02-29");
    expect(eviden.susunPeriode("tw3", 2026)).toMatchObject({ mulai: "2026-07-01", selesai: "2026-09-30", bulan: 3, labelPanjang: "Triwulan III Tahun 2026" });
    expect(eviden.susunPeriode("tahun", 2026)).toMatchObject({ mulai: "2026-01-01", selesai: "2026-12-31", bulan: 12 });
  });

  it("jalur hakim lama: b09 kini sah, tw5 tetap ditolak", () => {
    expect(eviden.periksaMasukan({ peran: "hakim", id: "31", tahun: "2026", periode: "b09" }, "2026-10-17").ok).toBe(true);
    const tolak = eviden.periksaMasukan({ peran: "hakim", id: "31", tahun: "2026", periode: "tw5" }, "2026-10-17");
    expect(tolak.ok).toBe(false);
    expect(tolak.alasan).toBe("periode_tidak_dikenal");
  });

  it("jendela BHT Panmud Hukum: satu triwulan lebih awal (bulanan sebulan, tahunan 3 bulan)", () => {
    expect(layanan.jendelaBht(eviden.susunPeriode("tw3", 2026) as never)).toEqual({ mulai: "2026-04-01", selesai: "2026-06-30" });
    expect(layanan.jendelaBht(eviden.susunPeriode("b01", 2026) as never)).toEqual({ mulai: "2025-12-01", selesai: "2025-12-31" });
    expect(layanan.jendelaBht(eviden.susunPeriode("tahun", 2026) as never)).toEqual({ mulai: "2025-10-01", selesai: "2026-09-30" });
  });
});
