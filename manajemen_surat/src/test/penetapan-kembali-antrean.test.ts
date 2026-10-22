// @vitest-environment node
/**
 * Penetapan kembali dari Jadwal Sidang (6 Okt 2026) - dari isian pop-up ke
 * antrean tulis: sebagian jenis per perkara, alasan sama untuk semua KECUALI
 * yang ditandai, penetap per jenis, urutan PMH-PPP-PJS-PHS, kering bawaan.
 * Ditambah penjaga sambungan: rute portal, rute bot, dan satu baris tombol di
 * Jadwal Sidang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type BarisKembali,
  type PengaturanKembali,
  alasanUntuk,
  badanTulis,
  masalahAlasan,
  penetapPhs,
  sidikAntrean,
  susunAntreanKembali,
  teksAlasan,
} from "@/lib/penetapan-kembali";

const ketua = { username: "fahri", nama: "Fahri Saifuddin, S.H.I., M.H.", sebutan: "Ketua Pengadilan" };
const wakil = { username: "Waka2026", nama: "Wakil", sebutan: "Wakil Ketua Pengadilan" };
const panitera = { username: "Sri Susilowati", nama: "Sri Susilowati, S.H.", sebutan: "Panitera" };

const baris = (x: Partial<BarisKembali> & { perkaraId: number }): BarisKembali => ({
  nomorPerkara: `${x.perkaraId}/Pdt.G/2026/PA.Dgl`,
  jenis: {},
  hakimId: [32, 26, 31],
  pppId: 21,
  pjsId: 28,
  tanggalSidang: "",
  jamSidang: "09:00",
  ruanganId: 1,
  alasanSendiri: false,
  alasan: { kode: "", lainnya: "" },
  ketuaMajelis: { hakimId: 32, nama: "Fahri Saifuddin" },
  ...x,
});

const atur = (x: Partial<PengaturanKembali> = {}): PengaturanKembali => ({
  tanggalPenetapan: "2026-10-06",
  alasanSama: true,
  alasan: { kode: "cuti-tahunan", lainnya: "" },
  penetap: { pmh: ketua, ppp: panitera, pjs: panitera },
  ...x,
});

const namaHakim = (id: number) => ({ 33: "Sudarmin H.I.M. Tang, S.H.I.,M.H", 32: "Fahri Saifuddin", 26: "Himawan" } as Record<number, string>)[id] ?? "";

describe("tiap perkara boleh hanya sebagian jenis", () => {
  it("A hanya PMH, B hanya PPP, C PJS+PHS, D tanpa centang dilewati - urutan PMH, PPP, PJS, PHS per perkara", () => {
    const h = susunAntreanKembali(
      [
        baris({ perkaraId: 1, jenis: { pmh: true }, hakimId: [33, 26, 31] }),
        baris({ perkaraId: 2, jenis: { ppp: true }, pppId: 22 }),
        baris({ perkaraId: 3, jenis: { phs: true, pjs: true }, pjsId: 30, tanggalSidang: "2026-10-13", ruanganId: 3 }),
        baris({ perkaraId: 4, jenis: {} }),
      ],
      atur(),
      namaHakim
    );
    expect(h.masalah).toEqual([]);
    expect(h.butir.map((b) => b.kunci)).toEqual(["1:pmh", "2:ppp", "3:pjs", "3:phs"]);
    expect(h.butir[0].hakimId).toEqual([33, 26, 31]);
    expect(h.butir[1].petugasId).toBe(22);
    expect(h.butir[2].petugasId).toBe(30);
    expect(h.butir[3]).toMatchObject({ tanggalSidang: "2026-10-13", jamSidang: "09:00", ruanganId: 3 });
    // Jenis yang tidak dicentang tidak pernah ikut walau isiannya terisi.
    expect(h.butir.some((b) => b.perkaraId === 1 && b.jenis !== "pmh")).toBe(false);
  });
});

describe("alasan sama untuk semua, kecuali yang dipilih", () => {
  const daftar = [
    baris({ perkaraId: 1, jenis: { pmh: true }, hakimId: [33, 26, 31] }),
    baris({ perkaraId: 2, jenis: { ppp: true }, alasanSendiri: true, alasan: { kode: "izin-sakit", lainnya: "" } }),
    baris({ perkaraId: 3, jenis: { pjs: true }, pjsId: 30, alasan: { kode: "dinas-luar", lainnya: "" } }),
  ];

  it("saklar menyala: semua 'Cuti Tahunan' kecuali perkara 2 (ditandai alasan sendiri); alasan perkara 3 yang tidak ditandai diabaikan", () => {
    const h = susunAntreanKembali(daftar, atur(), namaHakim);
    expect(h.butir.map((b) => [b.perkaraId, b.alasan])).toEqual([
      [1, "Cuti Tahunan"],
      [2, "Izin Sakit"],
      [3, "Cuti Tahunan"],
    ]);
  });

  it("saklar mati: tiap perkara beralasan sendiri; yang belum memilih dilaporkan, tidak dikarang", () => {
    const h = susunAntreanKembali(daftar, atur({ alasanSama: false }), namaHakim);
    expect(h.butir.map((b) => [b.perkaraId, b.alasan])).toEqual([
      [2, "Izin Sakit"],
      [3, "Perjalanan Dinas Luar"],
    ]);
    expect(h.masalah).toEqual([{ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", pesan: "alasan belum dipilih" }]);
  });

  it("Lainnya = isian bebas; tidak boleh menyebut ALETA; lima pilihan sesuai permintaan", () => {
    expect(teksAlasan({ kode: "lainnya", lainnya: "  Mengikuti   diklat " })).toBe("Mengikuti diklat");
    expect(teksAlasan({ kode: "cuti-alasan-penting", lainnya: "x" })).toBe("Cuti Alasan Penting");
    expect(masalahAlasan("dikerjakan ALETA")).toMatch(/ALETA/);
    expect(alasanUntuk({ alasanSendiri: true, alasan: { kode: "", lainnya: "" } }, { alasanSama: true, alasan: { kode: "izin-sakit", lainnya: "" } })).toBe("");
  });
});

describe("penetap menurut jenis", () => {
  it("PMH = pilihan Ketua/Wakil; PPP & PJS = Panitera/Plh; PHS = ketua majelis perkara itu", () => {
    const h = susunAntreanKembali(
      [
        baris({ perkaraId: 1, jenis: { pmh: true, ppp: true, pjs: true, phs: true }, hakimId: [33, 26, 31], pppId: 22, pjsId: 30, tanggalSidang: "2026-10-13" }),
        baris({ perkaraId: 2, jenis: { phs: true }, tanggalSidang: "2026-10-14" }),
      ],
      atur({ penetap: { pmh: wakil, ppp: panitera, pjs: { ...panitera, sebutan: "PLH Panitera", username: "meja2" } } }),
      namaHakim
    );
    expect(h.masalah).toEqual([]);
    const p = Object.fromEntries(h.butir.map((b) => [b.kunci, b.penetap]));
    expect(p["1:pmh"]).toEqual(wakil);
    expect(p["1:ppp"]).toEqual(panitera);
    expect(p["1:pjs"]?.sebutan).toBe("PLH Panitera");
    // PMH perkara 1 ikut ditetapkan kembali -> PHS ditetapkan ketua majelis BARU.
    expect(p["1:phs"]).toMatchObject({ nama: "Sudarmin H.I.M. Tang, S.H.I.,M.H", sebutan: "Ketua Majelis" });
    // Perkara 2 hanya PHS -> ketua majelis yang sekarang tercatat.
    expect(p["2:phs"]).toMatchObject({ nama: "Fahri Saifuddin", sebutan: "Ketua Majelis" });
  });

  it("penetap yang belum dipilih menahan jenis itu saja", () => {
    const h = susunAntreanKembali(
      [baris({ perkaraId: 1, jenis: { pmh: true, ppp: true }, hakimId: [33, 26, 31] })],
      atur({ penetap: { pmh: null, ppp: panitera, pjs: panitera } }),
      namaHakim
    );
    expect(h.butir.map((b) => b.kunci)).toEqual(["1:ppp"]);
    expect(h.masalah[0]).toMatchObject({ jenis: "pmh" });
  });

  it("hakim tunggal: PHS ditetapkan sebagai Hakim Tunggal", () => {
    const b = baris({ perkaraId: 1, jenis: { pmh: true, phs: true }, hakimId: [33] });
    expect(penetapPhs(b, namaHakim)?.sebutan).toBe("Hakim Tunggal");
  });
});

describe("isian yang tidak lengkap dilaporkan, bukan dikarang", () => {
  it("susunan majelis 2 orang / ganda, PHS tanpa tanggal, sidang mendahului penetapan", () => {
    const h = susunAntreanKembali(
      [
        baris({ perkaraId: 1, jenis: { pmh: true }, hakimId: [33, 26] }),
        baris({ perkaraId: 2, jenis: { pmh: true }, hakimId: [33, 33, 26] }),
        baris({ perkaraId: 3, jenis: { phs: true } }),
        baris({ perkaraId: 4, jenis: { phs: true }, tanggalSidang: "2026-10-01" }),
      ],
      atur(),
      namaHakim
    );
    expect(h.butir).toEqual([]);
    expect(h.masalah.map((m) => m.jenis)).toEqual(["pmh", "pmh", "phs", "phs"]);
  });
});

describe("kering bawaan", () => {
  it("badanTulis tanpa opsi = kering: true; menulis hanya bila kering:false disebut", () => {
    const [b] = susunAntreanKembali([baris({ perkaraId: 1, jenis: { ppp: true }, pppId: 22 })], atur()).butir;
    expect(badanTulis(b).kering).toBe(true);
    expect(badanTulis(b, { kering: false }).kering).toBe(false);
    expect(badanTulis(b, { akunSipp: "derry briantono" }).akunSipp).toBe("derry briantono");
    expect(badanTulis(b).pejabatUsername).toBe("Panitera: Sri Susilowati, S.H.");
  });

  it("sidik berubah bila isian berubah - pratinjau kedaluwarsa", () => {
    const a = susunAntreanKembali([baris({ perkaraId: 1, jenis: { ppp: true }, pppId: 22 })], atur()).butir;
    const b = susunAntreanKembali([baris({ perkaraId: 1, jenis: { ppp: true }, pppId: 23 })], atur()).butir;
    expect(sidikAntrean(a)).not.toBe(sidikAntrean(b));
  });
});

describe("sambungan: portal, bot, dan satu baris tombol", () => {
  const AKAR = path.resolve(process.cwd(), "..");
  const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8").replace(/\r\n/g, "\n");

  it("rute portal: kemampuan 'penunjukan', akun SIPP milik sendiri, operator dari sesi, kering kecuali tegas", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/penetapan-kembali/route.ts");
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "penunjukan")');
    expect(rute).toContain("akunSippPengguna(db, aktor.id, badan.akunSipp)");
    expect(rute).toContain("olehUsername: akun.username");
    expect(rute).toContain("const kering = badan.kering !== false;");
    expect(rute).not.toMatch(/operator:\s*badan\./);
  });

  it("bot: rute terpasang, jeda sebelum menulis, jejak 'kembali' di aleta_bot_jejak_penetapan", () => {
    expect(baca("aleta_bot/app.js")).toContain('app.use("/internal/aleta-bot/penetapan-kembali", require("./routes/penetapanKembaliRoutes"));');
    const r = baca("aleta_bot/routes/penetapanKembaliRoutes.js");
    expect(r).toContain('if (!kering) await jedaManusiaService.jeda("simpan", { kering });');
    expect(r).toContain('aksi: "kembali"');
    expect(r).toContain("const kering = badan.kering !== false;");
  });

  it("Jadwal Sidang: butir Menu 'Penetapan kembali' tepat sebelum 'Daftarkan ke antrian' (22 Okt 2026)", () => {
    const s = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    const butir = s.indexOf('kunci: "penetapan-kembali"');
    const antrian = s.indexOf('kunci: "daftar-antrian"');
    expect(butir).toBeGreaterThan(0);
    expect(antrian).toBeGreaterThan(butir);
    // Hak dan saklar tampilannya tetap menjaga butir ini; dialognya dipegang layar, di luar menu.
    expect(s).toContain('if (tampil(tampilan, "tombol-penetapan-kembali") && bolehPenetapanKembali) {');
    expect(s).toContain("<PopupPenetapanKembali sidang={sidang}");
  });
});
