// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  type Ketergantungan,
  type LangkahTulis,
  type MasukanKerja,
  kerjakanPenetapan,
  nilaiTulisDariUsulan,
} from "@/server/modules/aleta-ecourt/kerjakan-penetapan";

/**
 * Kerjakan penetapan satu perkara (20 Okt 2026, agen P1): perilaku atas SIPP
 * tiruan yang menyimpan keadaan penetapan, kunci per perkara, dan merekam
 * setiap penulisan. Yang dijaga: satu perkara hanya ditetapkan SEKALI -
 * semua kombinasi mode x pilihan, pekerjaan berpapasan, dan keadaan yang sudah
 * ada (dilewati, tidak dibongkar, tidak ditulis ulang).
 */

const USULAN = {
  tanggalPenetapan: "2026-10-20",
  perkara: { perkaraId: 10260, nomorPerkara: "684/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347 },
  pmh: {
    bentuk: "majelis",
    anggota: [{ hakimId: 26 }, { hakimId: 28 }, { hakimId: 31 }],
    hitungan: [{ hakimId: 26 }, { hakimId: 28 }, { hakimId: 31 }, { hakimId: 32 }],
    susunanTerpakai: [{ kunci: "32-26-31", anggota: [{ hakimId: 32 }, { hakimId: 26 }, { hakimId: 31 }] }],
  },
  ppp: { usulan: { paniteraId: 30 }, calon: [{ id: 30, paniteraId: 30 }, { id: 21, paniteraId: 21 }] },
  pjs: { usulan: { jurusitaId: 30 }, calon: [{ id: 30, jurusitaId: 30 }, { id: 28, jurusitaId: 28 }] },
  phs: { usulan: "2026-11-02" },
};

type Jenis = "pmh" | "ppp" | "pjs" | "phs";

function siapSipp(awal: Partial<Record<Jenis, boolean>> = {}, usulan: unknown = USULAN) {
  const ada: Record<Jenis, boolean> = { pmh: false, ppp: false, pjs: false, phs: false, ...awal };
  const kunci = new Map<number, string>();
  const rantai: Array<{ langkah: LangkahTulis[]; kunciToken?: string }> = [];
  const kering: string[] = [];
  let jeda = Promise.resolve();
  let nomorToken = 0;
  const keadaan = (id: number) => ({
    ok: true,
    data: {
      perkaraId: id,
      nomorPerkara: "684/Pdt.G/2026/PA.Dgl",
      langkah: Object.fromEntries((["pmh", "ppp", "pjs", "phs"] as Jenis[]).map((j) => [j, { ada: ada[j], tanggal: ada[j] ? "2026-10-20" : "", baris: ada[j] ? 1 : 0 }])),
      kunci: kunci.has(id) ? { aktif: true, oleh: "pekerjaan lain", sampai: "2026-10-20 14:10:00" } : { aktif: false },
    },
  });
  const dep: Ketergantungan & { semuaHapus?: never } = {
    bacaKeadaan: async () => keadaan(10260),
    ambilKunci: async (p) => {
      if (p.token && kunci.get(p.perkaraId) === p.token) return { ok: true, data: { token: p.token, diperpanjang: true } };
      if (kunci.has(p.perkaraId)) return { ok: false, error: "sedang_dikerjakan" };
      const t = `t${++nomorToken}`;
      kunci.set(p.perkaraId, t);
      return { ok: true, data: { token: t } };
    },
    lepasKunci: async (p) => {
      if (kunci.get(p.perkaraId) === p.token) kunci.delete(p.perkaraId);
      return { ok: true };
    },
    bacaUsulan: async () => ({ ok: true, data: usulan as Record<string, unknown> }),
    pastikanPejabat: async (_t, langkah) => {
      for (const l of langkah) if (!l.pejabatUsername) l.pejabatUsername = l.jenis === "pmh" ? "fahri" : l.jenis === "phs" ? "" : "Sri Susilowati";
      return null;
    },
    periksaLibur: async () => null,
    tulisRantai: async (p) => {
      // Bot: jeda manusia di antara langkah, lalu menulis yang BELUM ada dalam satu transaksi.
      await jeda;
      await new Promise((r) => setTimeout(r, 5));
      rantai.push({ langkah: p.langkah, kunciToken: p.kunciToken });
      const hasil = p.langkah.map((l) => {
        const j = l.jenis as Jenis;
        if (ada[j]) return { jenis: j, ok: false, sudahAda: true, alasan: `${j}_sudah_ada` };
        ada[j] = true;
        return { jenis: j, ok: true, atasNama: { username: "fahri" }, tanggalPenetapan: p.tanggalPenetapan };
      });
      return { ok: true, data: { ok: true, utuh: true, hasil } };
    },
    tulisKering: async (p) => {
      kering.push(p.jenis);
      return { ok: true, data: { ok: true, atasNama: { username: "fahri" } } };
    },
  };
  return { dep, ada, kunci, rantai, kering };
}

const dasar: MasukanKerja = {
  nomorPerkara: "684/Pdt.G/2026/PA.Dgl",
  mode: "otomatis",
  kering: false,
  olehUsername: "admin",
  operator: "SUPER ADMIN DERRY",
};

const status = (h: Awaited<ReturnType<typeof kerjakanPenetapan>>) => Object.fromEntries(h.laporan.map((x) => [x.jenis, `${x.status}${x.sebab ? `/${x.sebab}` : ""}`]));

describe("satu perkara hanya ditetapkan sekali", () => {
  it("mode otomatis menulis keempatnya, sekali, lalu melepas kunci", async () => {
    const s = siapSipp();
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(h.ok).toBe(true);
    expect(status(h)).toEqual({ pmh: "tercatat", ppp: "tercatat", pjs: "tercatat", phs: "tercatat" });
    expect(s.rantai).toHaveLength(1);
    expect(s.rantai[0].langkah.map((l) => l.jenis)).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(s.rantai[0].langkah[0].hakimId).toEqual([26, 28, 31]);
    expect(s.kunci.size).toBe(0);
  });

  it("ditekan dua kali berturut-turut: kedua kalinya semua DILEWATI dan tidak ada penulisan", async () => {
    const s = siapSipp();
    await kerjakanPenetapan(s.dep, dasar);
    const h2 = await kerjakanPenetapan(s.dep, dasar);
    expect(status(h2)).toEqual({ pmh: "dilewati/sudah_ada", ppp: "dilewati/sudah_ada", pjs: "dilewati/sudah_ada", phs: "dilewati/sudah_ada" });
    expect(h2.ok).toBe(true);
    expect(s.rantai).toHaveLength(1);
  });

  it("dua pekerjaan berpapasan (dua tab / penanda halaman + ekstensi): hanya satu menulis", async () => {
    const s = siapSipp();
    const [a, b] = await Promise.all([kerjakanPenetapan(s.dep, dasar), kerjakanPenetapan(s.dep, { ...dasar, operator: "tab kedua" })]);
    expect(s.rantai).toHaveLength(1);
    const yangMenulis = [a, b].filter((h) => h.laporan.some((x) => x.status === "tercatat"));
    const yangKalah = [a, b].filter((h) => h.laporan.every((x) => x.sebab === "sedang_dikerjakan"));
    expect(yangMenulis).toHaveLength(1);
    expect(yangKalah).toHaveLength(1);
    expect(yangKalah[0].kunci.diambil).toBe(false);
    expect(yangKalah[0].ok).toBe(false);
  });

  it("PMH sudah ditulis tangan: hanya sisanya yang ditulis, PMH tidak disentuh", async () => {
    const s = siapSipp({ pmh: true });
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(status(h)).toEqual({ pmh: "dilewati/sudah_ada", ppp: "tercatat", pjs: "tercatat", phs: "tercatat" });
    expect(s.rantai[0].langkah.map((l) => l.jenis)).toEqual(["ppp", "pjs", "phs"]);
  });

  it("keadaan basi: bot menjawab sudahAda di tengah jalan -> dilewati, bukan gagal", async () => {
    const s = siapSipp();
    const asli = s.dep.tulisRantai;
    s.dep.tulisRantai = async (p) => {
      s.ada.pmh = true; // seseorang menulis PMH persis sebelum transaksi
      return asli(p);
    };
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(h.laporan[0]).toMatchObject({ jenis: "pmh", status: "dilewati", sebab: "sudah_ada" });
    expect(h.ok).toBe(true);
  });

  it("tidak dicentang tidak disentuh; yang dicentang ikut urutan", async () => {
    const s = siapSipp();
    const h = await kerjakanPenetapan(s.dep, { ...dasar, langkah: { pmh: true, ppp: false, pjs: false, phs: true } });
    expect(status(h)).toEqual({ pmh: "tercatat", ppp: "dilewati/tidak_dicentang", pjs: "dilewati/tidak_dicentang", phs: "tercatat" });
    expect(s.rantai[0].langkah.map((l) => l.jenis)).toEqual(["pmh", "phs"]);
  });

  it("kering tidak menulis dan tidak mengunci", async () => {
    const s = siapSipp();
    const h = await kerjakanPenetapan(s.dep, { ...dasar, kering: true });
    expect(s.rantai).toHaveLength(0);
    expect(s.kering).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(h.kunci.diambil).toBe(false);
    expect(h.laporan.every((x) => x.siap === true)).toBe(true);
  });

  it("kunci yang dipegang pemanggil (peramban) dipakai ulang dan TIDAK dilepas di sini", async () => {
    const s = siapSipp();
    const k = await s.dep.ambilKunci({ perkaraId: 10260, operator: "peramban", tujuan: "x" });
    const token = String((k as { data: { token: string } }).data.token);
    const h = await kerjakanPenetapan(s.dep, { ...dasar, kunciToken: token });
    expect(h.ok).toBe(true);
    expect(s.rantai[0].kunciToken).toBe(token);
    expect(s.kunci.get(10260)).toBe(token);
  });

  it("keadaan tidak terbaca: tidak ada yang ditulis (gagal tertutup)", async () => {
    const s = siapSipp();
    s.dep.bacaKeadaan = async () => ({ ok: false, error: "putus" });
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(h.ok).toBe(false);
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan.every((x) => x.status === "gagal" && x.sebab === "keadaan_tidak_terbaca")).toBe(true);
  });
});

describe("semua kombinasi pilihan menghasilkan penulisan yang benar", () => {
  const kerja = async (masuk: Partial<MasukanKerja>, usulan: unknown = USULAN) => {
    const s = siapSipp({}, usulan);
    const h = await kerjakanPenetapan(s.dep, { ...dasar, ...masuk });
    return { s, h, l: (j: Jenis) => s.rantai[0]?.langkah.find((x) => x.jenis === j) };
  };

  it("manual per majelis: susunan menang, kursinya urut", async () => {
    const { l, h } = await kerja({ mode: "manual", pilihan: { majelis: "32-26-31" } });
    expect(h.ok).toBe(true);
    expect(l("pmh")?.hakimId).toEqual([32, 26, 31]);
  });

  it("manual per orang: satu kursi diganti, dua lainnya tetap usulan", async () => {
    const { l } = await kerja({ mode: "manual", pilihan: { pmhKursi: ["", 32, ""] } });
    expect(l("pmh")?.hakimId).toEqual([26, 32, 31]);
  });

  it("per orang yang menunjuk hakim tak dikenal ditolak, tidak diganti usulan; tidak ada yang ditulis", async () => {
    const { s, h } = await kerja({ mode: "manual", pilihan: { pmhKursi: [999] } });
    expect(s.rantai).toHaveLength(0);
    expect(h.ok).toBe(false);
    expect(h.laporan[0]).toMatchObject({ status: "gagal", sebab: "pilihan_hakim_tidak_ketemu" });
    expect(h.laporan[1]).toMatchObject({ status: "gagal", sebab: "dibatalkan_rantai" });
  });

  it("hakim kembar ditolak", async () => {
    const { s, h } = await kerja({ mode: "manual", pilihan: { pmhKursi: [26, 26, 26] } });
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan[0].sebab).toBe("hakim_kembar");
  });

  it("hakim tunggal: satu id, bukan majelis", async () => {
    const tunggal = { ...USULAN, pmh: { bentuk: "tunggal", anggota: [{ hakimId: 31 }], hitungan: [{ hakimId: 31 }] } };
    const { l, h } = await kerja({}, tunggal);
    expect(h.ok).toBe(true);
    expect(l("pmh")?.hakimId).toEqual([31]);
  });

  it("majelis yang hanya terbaca dua kursi ditolak (tidak menulis majelis cacat)", async () => {
    const cacat = { ...USULAN, pmh: { ...USULAN.pmh, anggota: [{ hakimId: 26 }, { hakimId: 28 }] } };
    const { s, h } = await kerja({}, cacat);
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan[0].sebab).toBe("majelis_tidak_lengkap");
  });

  it("sidang keliling + jam + tanggal pilihan sendiri sampai ke bot", async () => {
    const { l, h } = await kerja({ mode: "manual", pilihan: { phs: "2026-11-04", ruangan: 3, jam: "10:30" } });
    expect(h.ok).toBe(true);
    expect(l("phs")).toMatchObject({ tanggalSidang: "2026-11-04", ruanganId: 3, jamSidang: "10:30" });
  });

  it("jam 09:00 tidak dikirim (bawaan mesin tulis); mode otomatis mengabaikan pilihan", async () => {
    const a = await kerja({ mode: "manual", pilihan: { jam: "09:00" } });
    expect(a.l("phs")).toEqual({ jenis: "phs", tanggalSidang: "2026-11-02", pejabatUsername: "" });
    const b = await kerja({ mode: "otomatis", pilihan: { majelis: "32-26-31", phs: "2026-12-01", ppp: 21 } });
    expect(b.l("pmh")?.hakimId).toEqual([26, 28, 31]);
    expect(b.l("phs")?.tanggalSidang).toBe("2026-11-02");
    expect(b.l("ppp")?.petugasId).toBe(30);
  });

  it("tanggal sidang pilihan yang mendahului penetapan ditolak", async () => {
    const { s, h } = await kerja({ mode: "manual", pilihan: { phs: "2026-10-10" } });
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan.find((x) => x.jenis === "phs")?.sebab).toBe("sidang_mendahului_penetapan");
  });

  it("PPP/PJS bergiliran: usulan, atau pilihan dari calon; pilihan tak dikenal ditolak", async () => {
    const a = await kerja({ mode: "manual", pilihan: { ppp: 21, pjs: 28 } });
    expect(a.l("ppp")?.petugasId).toBe(21);
    expect(a.l("pjs")?.petugasId).toBe(28);
    const b = await kerja({ mode: "manual", pilihan: { ppp: 77 } });
    expect(b.s.rantai).toHaveLength(0);
    expect(b.h.laporan[1].sebab).toBe("pilihan_panitera_tidak_ketemu");
  });

  it("pejabat pilihan diteruskan; yang tidak sah menghentikan semuanya", async () => {
    const a = await kerja({ mode: "manual", pilihan: { pejabat: { pmh: "sudarmin" } } });
    expect(a.l("pmh")?.pejabatUsername).toBe("sudarmin");
    const s = siapSipp();
    s.dep.pastikanPejabat = async () => ({ alasan: "pejabat_tidak_sah", jenis: "pmh", username: "orangLain" });
    const h = await kerjakanPenetapan(s.dep, { ...dasar, mode: "manual", pilihan: { pejabat: { pmh: "orangLain" } } });
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan[0]).toMatchObject({ status: "gagal", sebab: "pejabat_tidak_sah" });
  });

  it("hari libur menahan seluruh rantai", async () => {
    const s = siapSipp();
    s.dep.periksaLibur = async () => ({ alasan: "tanggal_sidang_hari_libur", diminta: "2026-11-02" });
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(s.rantai).toHaveLength(0);
    expect(h.laporan.find((x) => x.jenis === "phs")?.sebab).toBe("tanggal_sidang_hari_libur");
  });

  it("di luar jam kerja: tidak ada yang ditulis, pemanggil diminta memilih", async () => {
    const s = siapSipp();
    s.dep.tulisRantai = async () => ({ ok: false, error: "di_luar_jam_kerja", badan: { perluPilihan: true, pesan: "Sekarang di luar jam kerja." } });
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(h.perluPilihanJamKerja).toBe(true);
    expect(h.ok).toBe(false);
    expect(h.laporan.every((x) => x.status === "dilewati" && x.sebab === "di_luar_jam_kerja")).toBe(true);
  });

  it("rantai gagal di PJS: tidak ada yang tercatat, sebab di langkah yang gagal", async () => {
    const s = siapSipp();
    s.dep.tulisRantai = async () => ({ ok: false, error: "akun_pejabat_ganda", badan: { ok: false, alasan: "akun_pejabat_ganda", jenisGagal: "pjs", dipulihkan: true, hasil: [] } });
    const h = await kerjakanPenetapan(s.dep, dasar);
    expect(h.ok).toBe(false);
    expect(h.laporan.find((x) => x.jenis === "pjs")).toMatchObject({ status: "gagal", sebab: "akun_pejabat_ganda" });
    expect(h.laporan.find((x) => x.jenis === "pmh")).toMatchObject({ status: "gagal", sebab: "dibatalkan_rantai" });
    expect(s.kunci.size).toBe(0);
  });
});

describe("nilaiTulisDariUsulan", () => {
  it("tanpa usulan PP/JS: belum_ada_usulan", () => {
    expect(nilaiTulisDariUsulan("ppp", {}, {}, false)).toEqual({ ok: false, alasan: "belum_ada_usulan" });
    expect(nilaiTulisDariUsulan("phs", { tanggalPenetapan: "2026-10-20" }, {}, false)).toEqual({ ok: false, alasan: "belum_ada_usulan" });
  });
});
