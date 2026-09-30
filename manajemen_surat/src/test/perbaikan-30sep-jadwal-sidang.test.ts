// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bawaanTunda, pilihanTunda, tahapAgenda, type SidangRiwayat } from "@/lib/bawaan-tunda";
import { ikrarSelesai, sidangSelesaiHariIni } from "@/lib/keadaan-sidang";

/**
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 - JADWAL SIDANG (butir 12, 13, 14, 27)
 * ============================================================================
 *
 *   12  tombol PUTUS di jadwal sidang hanya menulis perkara_jadwal_sidang
 *       (+ audit jadwal itu) - TIDAK perkara_putusan, audit perkara_putusan,
 *       maupun tahapan perkara. Dijalankan SUNGGUHAN atas susunRencanaPutus
 *       dengan db_config tiruan; tidak ada MySQL yang disentuh.
 *   13  (penjaganya di catat-hasil-ringkas.test.ts)
 *   14  bawaan isian tunda dari riwayat sidang - contoh DATA SUNGGUHAN
 *       sipp_donggala (nomor, tanggal, kehadiran, agenda apa adanya).
 *   27  sidang ikrar talak yang sudah dilaksanakan terbaca SELESAI.
 */

const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

// ============================================================================
// 12 - PUTUS HANYA MENULIS JADWAL SIDANG
// ============================================================================

type Kueri = { sql: string; nilai: unknown[] };
let catatan: Kueri[] = [];

function jawab(sql: string): unknown[] {
  if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-09-30 10:24:00" }];
  if (/FROM perkara_jadwal_sidang j\s+JOIN perkara p/.test(sql)) {
    return [
      {
        jadwalId: 20500,
        perkaraId: 9900,
        tanggalSidang: "2026-09-30",
        jamSidang: "09:00:00",
        sampaiJam: null,
        agenda: "Musyawarah Majelis",
        agendaId: null,
        urutan: 5,
        ditunda: "T",
        alasanDitunda: "0",
        ruanganId: 1,
        ruangan: "Ruang Sidang 1",
        sidangKeliling: "T",
        sifatSidang: "Y",
        dihadiriOleh: null,
        verzet: "T",
        keberatan: "T",
        ikrarTalak: "T",
        nomorPerkara: "491/Pdt.G/2026/PA.Dgl",
        alurPerkaraId: 15,
        jenisPerkaraId: 347,
        jenisPerkara: "Cerai Gugat",
      },
    ];
  }
  if (/FROM perkara_panitera_pn/.test(sql)) return [{ username: "sitti", fullname: "Sitti Nurhidayah, S.H.I., M.H" }];
  if (/FROM perkara_hakim_pn/.test(sql)) return [{ username: "himawan", fullname: "Himawan Tatura Wijaya" }];
  if (/FROM status_putusan/.test(sql)) return [{ id: 62, nama: "Dikabulkan" }];
  return [];
}

function pasangTiruan() {
  for (const kunci of Object.keys(muat.cache)) {
    if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
  }
  const dbPalsu = {
    query(sql: string, nilai: unknown, cb?: (e: unknown, r: unknown) => void) {
      const selesai = typeof nilai === "function" ? (nilai as (e: unknown, r: unknown) => void) : cb;
      catatan.push({ sql: String(sql), nilai: Array.isArray(nilai) ? nilai : [] });
      selesai?.(null, jawab(String(sql)));
    },
  };
  const botDbPalsu = { query: async () => [], fromMysqlDate: () => null, toMysqlDate: () => null };
  for (const [relatif, isi] of [
    ["./db_config", dbPalsu],
    ["./services/botDbService", botDbPalsu],
  ] as const) {
    const berkas = muat.resolve(relatif);
    muat.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: isi } as unknown as NodeJS.Module;
  }
}

type Rencana = {
  ok: boolean;
  hanyaJadwal?: boolean;
  langkah: { tabel: string; aksi: string; keterangan: string; params: unknown[] }[];
  andaian: string[];
  atasNama: { username: string; putusanAtasNama?: string };
};

function layanan() {
  return muat("./services/sidangHasilService.js") as {
    susunRencanaPutus: (m: Record<string, unknown>) => Promise<Rencana>;
    jalankanRencana: (r: Rencana, o: { kering: boolean }) => Promise<{ ok: boolean; selesai?: { tabel: string }[] }>;
    riwayatSidangPerkara: (id: unknown, tgl: unknown) => Promise<unknown>;
  };
}

describe("12. putus dari jadwal sidang hanya menulis perkara_jadwal_sidang", () => {
  beforeEach(() => {
    catatan = [];
    pasangTiruan();
  });
  afterEach(() => {
    for (const kunci of Object.keys(muat.cache)) {
      if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
    }
  });

  const minta = {
    jadwalId: 20500,
    statusPutusanId: 62,
    tanggalPutus: "2026-09-30",
    verstek: "T",
    jamSekarang: "09:00",
    dihadiriOleh: 4,
    operator: "usr-sitti",
    ip: "192.168.10.20",
  };

  it("rencana bawaannya: jadwal sidang + audit jadwal itu saja", async () => {
    const r = await layanan().susunRencanaPutus(minta);
    expect(r.ok).toBe(true);
    expect(r.hanyaJadwal).toBe(true);
    expect(r.langkah.map((l) => `${l.tabel} ${l.aksi}`)).toEqual([
      "perkara_jadwal_sidang UPDATE",
      "sys_audittrail INSERT",
    ]);
    // Baris audit itu milik JADWAL, atas nama panitera sidang - bukan audit
    // perkara_putusan atas nama hakim (tangkapan 103: "atas nama Himawan").
    expect(JSON.stringify(r.langkah[1].params)).toContain("perkara_jadwal_sidang");
    expect(JSON.stringify(r.langkah[1].params)).not.toContain("perkara_putusan");
    expect(JSON.stringify(r.langkah)).not.toContain("himawan");
    expect(r.atasNama.username).toBe("sitti");
    expect(r.atasNama.putusanAtasNama).toBeUndefined();
    expect(r.andaian.join(" ")).toContain("Hanya hasil sidang di jadwal sidang yang dicatat");
  });

  it("hasil sidang tetap tercatat 'putus Dikabulkan' pada jadwalnya", async () => {
    const r = await layanan().susunRencanaPutus(minta);
    expect(r.langkah[0].params).toContain("putus Dikabulkan");
    expect(r.langkah[0].params).toContain("T"); // ditunda = 'T'
  });

  it("jalan tulis sungguh hanya mengirim UPDATE jadwal + INSERT audit ke MySQL", async () => {
    const L = layanan();
    const r = await L.susunRencanaPutus(minta);
    catatan = [];
    const h = await L.jalankanRencana(r, { kering: false });
    expect(h.ok).toBe(true);
    const tulis = catatan.filter((k) => /^\s*(INSERT|UPDATE|DELETE)/i.test(k.sql));
    expect(tulis).toHaveLength(2);
    expect(tulis.some((k) => /perkara_putusan/.test(k.sql))).toBe(false);
    expect(tulis.some((k) => /UPDATE perkara\s+SET tahapan/.test(k.sql))).toBe(false);
    expect((h.selesai ?? []).map((x) => x.tabel)).toEqual(["perkara_jadwal_sidang", "sys_audittrail"]);
  });

  it("penulisan putusan lengkap TIDAK dihapus - masih ada bila diminta tegas (tulisPutusan: true)", async () => {
    const r = await layanan().susunRencanaPutus({ ...minta, tulisPutusan: true });
    expect(r.hanyaJadwal).toBe(false);
    expect(r.langkah.map((l) => l.tabel)).toEqual([
      "perkara_jadwal_sidang",
      "sys_audittrail",
      "perkara_putusan",
      "sys_audittrail",
      "perkara",
    ]);
    expect(r.atasNama.putusanAtasNama).toBe("himawan");
  });

  it("gerbang hanya meneruskan tulisPutusan yang TEGAS true; portal jalur sidang tidak mengirimnya", () => {
    const gerbang = readFileSync(path.join(AKAR_BOT, "routes/internalGatewayRoutes.js"), "utf8");
    expect(gerbang).toContain("tulisPutusan: badan.tulisPutusan === true,");
    const rute = readFileSync(path.resolve(__dirname, "../app/api/aleta-ecourt/sidang-putus/route.ts"), "utf8");
    const jalurSidang = rute.slice(rute.indexOf('if (String(badan.jalur ?? "") === "sidang")'), rute.indexOf("// Jalur HAKIM"));
    expect(jalurSidang).not.toContain("tulisPutusan");
  });

  it("riwayat sidang + mediasi hanya dibaca (SELECT), dan bentuknya", async () => {
    catatan = [];
    const hasil = (await layanan().riwayatSidangPerkara(9900, "2026-09-30")) as { sidang: unknown[]; mediasi: unknown };
    expect(Array.isArray(hasil.sidang)).toBe(true);
    expect(catatan.length).toBe(2);
    for (const k of catatan) expect(k.sql.trim().startsWith("SELECT")).toBe(true);
  });
});

// ============================================================================
// 14 - BAWAAN TUNDA DARI RIWAYAT SIDANG (contoh data sungguhan sipp_donggala)
// ============================================================================

const r = (
  jadwalId: number,
  tanggal: string,
  dihadiriOleh: number | null,
  ditunda: boolean,
  agenda: string,
  alasan: string
): SidangRiwayat => ({ jadwalId, tanggal, dihadiriOleh, ditunda, agenda, alasan, ikrar: false });

// 104/Pdt.G/2026/PA.Dgl (Cerai Gugat, alur 15 jenis 347) - Tergugat tidak pernah hadir, putus verstek.
const R104 = [
  r(18602, "2026-03-09", 2, true, "Panggil Penggugat dan Tergugat Hadir ", "Tergugat tidak Hadir "),
  r(18698, "2026-03-30", 2, true, "Panggil Tergugat ", "Tergugat tidak hadir"),
  r(18766, "2026-04-13", 2, false, "Panggil Tergugat ", "putus DIKABULKAN (verstek)"),
];
const S104 = { alurPerkaraId: 15, jenisPerkaraId: 347, nomorPerkara: "104/Pdt.G/2026/PA.Dgl" };

// 314/Pdt.G/2026/PA.Dgl (Cerai Talak, alur 15 jenis 346) - kedua pihak hadir; mediator ditunjuk
// 10 Jun 2026, mediasi diputus (T = tidak berhasil) 24 Jun 2026.
const R314 = [
  r(19227, "2026-06-10", 1, true, "Sidang Pertama", "mediasi/perdamaian"),
  r(19434, "2026-06-24", 1, true, "Perdamaian/Mediasi", "jawaban Termohon"),
  r(19435, "2026-07-01", 1, true, "Jawaban Termohon", "Jawaban Termohon"),
  r(19499, "2026-07-08", 1, true, "Replik Pemohon", "Replik Pemohon"),
  r(19553, "2026-07-15", 1, true, "duplik Termohon", "Duplik Termohon"),
];
const S314 = { alurPerkaraId: 15, jenisPerkaraId: 346, nomorPerkara: "314/Pdt.G/2026/PA.Dgl" };
const mediasi314 = (tgl: string) => ({ ada: tgl >= "2026-06-10", selesai: tgl >= "2026-06-24", berhasil: false });

// 131/Pdt.G/2026/PA.Dgl - Tergugat tidak pernah hadir sampai sidang ke-4.
const R131 = [
  r(18535, "2026-03-02", 2, true, "SIDANG PERTAMA", "Panggil Tergugat"),
  r(18648, "2026-03-16", 2, true, "Pemeriksaan Pokok Perkara", "Tergugat Tidak Hadir Karena Belum di Panggil"),
  r(18716, "2026-03-30", 2, true, "Panggil Tergugat", "panggil Tergugat"),
];

function tunda(riwayat: SidangRiwayat[], jadwalId: number, sebutan: Record<string, unknown>, mediasi = null as ReturnType<typeof mediasi314> | null, dihadiri: number | null = null) {
  const ini = riwayat.find((x) => x.jadwalId === jadwalId)!;
  return bawaanTunda({
    jadwalId,
    tanggalSidang: ini.tanggal,
    agenda: ini.agenda,
    dihadiriOlehSekarang: dihadiri,
    riwayat,
    mediasi,
    sebutan,
  });
}

describe("14. bawaan tunda - sidang pertama, pihak kedua tidak hadir (104/Pdt.G/2026)", () => {
  const u = tunda(R104, 18602, S104);

  it("sidang ke-1, kehadiran bawaan pihak pertama saja (2)", () => {
    expect(u.sidangKe).toBe(1);
    expect(u.kehadiran).toBe(2);
    expect(u.kehadiranTercatat).toBe(false);
  });

  it("alasan Panggil Tergugat, agenda Pemeriksaan Pokok Perkara (aturan pengguna)", () => {
    expect(u.alasan).toBe("Panggil Tergugat");
    expect(u.agenda).toBe("Pemeriksaan Pokok Perkara");
    expect(u.sebab).toBe("sidang-pertama");
  });

  it("tanggal: dua pekan, hari yang sama (Senin 9 Mar -> Senin 23 Mar)", () => {
    expect(u.tanggal).toBe("2026-03-23");
    expect(new Date(u.tanggal + "T00:00:00Z").getUTCDay()).toBe(new Date("2026-03-09T00:00:00Z").getUTCDay());
  });

  it("sidang ke-2, Tergugat masih belum pernah hadir: panggilan kedua (petugas menulis 'Tergugat tidak hadir')", () => {
    const d = tunda(R104, 18698, S104);
    expect(d.sidangKe).toBe(2);
    expect(d.alasan).toBe("Panggil Tergugat");
    expect(d.agenda).toBe("Pembuktian Penggugat");
    expect(d.kehadiran).toBe(2);
  });

  it("sidang ke-3 tanpa Tergugat: Pembuktian Lanjutan Penggugat (131/Pdt.G/2026)", () => {
    const d = tunda(R131, 18716, { ...S104, nomorPerkara: "131/Pdt.G/2026/PA.Dgl" });
    expect(d.sidangKe).toBe(3);
    expect(d.alasan).toBe("Pembuktian Lanjutan Penggugat");
    expect(d.agenda).toBe("Pembuktian Lanjutan Penggugat");
    expect(d.sebab).toBe("tergugat-tidak-pernah-hadir");
  });

  it("kehadiran yang SUDAH tercatat di SIPP dipakai, bukan ditebak", () => {
    const d = tunda(R104, 18602, S104, null, 4);
    expect(d.kehadiran).toBe(4);
    expect(d.kehadiranTercatat).toBe(true);
    expect(d.alasan).toBe("Panggil Penggugat dan Tergugat");
  });
});

describe("14. bawaan tunda - kedua pihak hadir + mediasi (314/Pdt.G/2026, Cerai Talak)", () => {
  it("sidang pertama, mediasi berjalan: Proses Mediasi -> laporan mediasi (petugas: 'mediasi/perdamaian')", () => {
    const u = tunda(R314, 19227, S314, mediasi314("2026-06-10"), 1);
    expect(u.alasan).toBe("Proses Mediasi");
    expect(u.agenda).toBe("Mendengarkan Laporan Hasil Mediasi");
    expect(u.sebab).toBe("hadir-keduanya-mediasi-berjalan");
  });

  it("sesudah mediasi diputus: Jawaban Termohon - sebutan dari jenis perkara 346, bukan dari kata (petugas: 'jawaban Termohon')", () => {
    const u = tunda(R314, 19434, S314, mediasi314("2026-06-24"));
    expect(u.kehadiran).toBe(1); // pernah hadir keduanya -> semua hadir
    expect(u.alasan).toBe("Jawaban Termohon");
    expect(u.agenda).toBe("Jawaban Termohon");
  });

  it("jawab-menjawab berlanjut: Replik Pemohon -> Duplik Termohon (petugas: 'Duplik Termohon')", () => {
    const u = tunda(R314, 19499, S314, mediasi314("2026-07-08"));
    expect(u.sidangKe).toBe(4);
    expect(u.alasan).toBe("Duplik Termohon");
  });

  it("kehadiran yang dipilih ulang menyusun ulang alasan", () => {
    const masukan = {
      jadwalId: 19227,
      tanggalSidang: "2026-06-10",
      agenda: "Sidang Pertama",
      riwayat: R314,
      mediasi: null,
      sebutan: S314,
    };
    expect(bawaanTunda(masukan, 2).alasan).toBe("Panggil Termohon");
    expect(bawaanTunda(masukan, 1).alasan).toBe("Proses Mediasi");
    expect(bawaanTunda(masukan, 3).alasan).toBe("Panggil Pemohon");
  });
});

describe("14. kehadiran bawaan menurut riwayat", () => {
  const dasar = (hadir: (number | null)[]) =>
    bawaanTunda({
      jadwalId: 99,
      tanggalSidang: "2026-09-30",
      agenda: "Pemeriksaan",
      riwayat: [
        ...hadir.map((h, i) => r(i + 1, `2026-09-0${i + 1}`, h, true, "x", "y")),
        r(99, "2026-09-30", null, false, "Pemeriksaan", "0"),
      ],
      sebutan: S104,
    }).kehadiran;

  it("belum ada riwayat -> pihak pertama saja", () => expect(dasar([])).toBe(2));
  it("pernah hadir keduanya -> semua hadir", () => expect(dasar([2, 1, 2])).toBe(1));
  it("hanya tergugat yang pernah hadir -> pihak kedua saja", () => expect(dasar([3, 4])).toBe(3));
  it("pihak pertama dan kedua pernah hadir terpisah (bukan 'hanya tergugat') -> pihak pertama", () =>
    expect(dasar([2, 3])).toBe(2));
});

describe("14. dropdown tetap memuat semua pilihan", () => {
  it("pilihan bersebutan perkara + daftar lazim lama, tanpa kembar", () => {
    const p = pilihanTunda(S314, ["Para pihak tidak hadir", "Proses Mediasi"], ["Replik"]);
    expect(p.alasan).toContain("Panggil Termohon");
    expect(p.alasan).toContain("Para pihak tidak hadir");
    expect(p.alasan.filter((x) => x === "Proses Mediasi")).toHaveLength(1);
    expect(p.agenda).toContain("Pemeriksaan Pokok Perkara");
    expect(p.agenda).toContain("Replik");
  });

  it("setiap usulan aturan ada di dropdown-nya (tidak jatuh ke kotak ketik)", () => {
    const p = pilihanTunda(S104);
    for (const u of [tunda(R104, 18602, S104), tunda(R104, 18698, S104), tunda(R131, 18716, S104)]) {
      expect(p.alasan).toContain(u.alasan);
      expect(p.agenda).toContain(u.agenda);
    }
  });

  it("tahap agenda dibaca dari kata kuncinya", () => {
    expect(tahapAgenda("duplik Termohon")).toBe("duplik");
    expect(tahapAgenda("Pembuktian Termohon Konvensi/Penggugat Rekonvensi")).toBe("pembuktian-kedua");
    expect(tahapAgenda("Perdamaian/Mediasi")).toBe("mediasi");
  });
});

// ============================================================================
// 27 - IKRAR TALAK YANG SUDAH DILAKSANAKAN TERBACA SELESAI
// ============================================================================

describe("27. sidang ikrar talak yang sudah dilaksanakan = selesai", () => {
  // 314/Pdt.G/2026/PA.Dgl sidang ke-12 "SIDANG IKRAR TALAK", antrian SIPP
  // "Hasil Sidang: TELAH IKRAR TALAK".
  const ikrar = {
    agenda: "SIDANG IKRAR TALAK",
    sidangIkrarTalak: true,
    ditunda: false,
    alasanDitunda: "telah ikrar talak",
    sudahPutus: true,
    tanggalPutusan: "2026-08-26",
    tanggalSidang: "2026-09-30",
  };

  it("hasil sidang 'telah ikrar talak' -> selesai, keping tunda|putus hilang", () => {
    expect(ikrarSelesai(ikrar)).toBe(true);
    expect(sidangSelesaiHariIni(ikrar)).toBe(true);
  });

  it("tanggal ikrar tercatat di perkara_ikrar_talak walau hasil sidangnya '0' -> selesai", () => {
    expect(ikrarSelesai({ ...ikrar, alasanDitunda: "0", ikrarTercatat: true })).toBe(true);
    expect(sidangSelesaiHariIni({ ...ikrar, alasanDitunda: "0", ikrarTercatat: true })).toBe(true);
  });

  it("kalimat ikrar dari data lain yang juga selesai", () => {
    for (const a of ["ikrar talak", "Pengucapan Ikrar Talak", "ikrar", "TELAH IKRAR TALAK"]) {
      expect(ikrarSelesai({ ...ikrar, alasanDitunda: a }), a).toBe(true);
    }
  });

  it("sidang ikrar yang BELUM dilaksanakan tidak selesai", () => {
    expect(ikrarSelesai({ ...ikrar, alasanDitunda: "0" })).toBe(false);
    expect(ikrarSelesai({ ...ikrar, alasanDitunda: "" })).toBe(false);
    for (const a of ["Belum Ikrar", "Pemohon tidak hadir ikrar", "Ikrar Talak tunda 6 BULAN", "menunggu Pemohon ikrar", "Panggil Ikrar"]) {
      expect(ikrarSelesai({ ...ikrar, alasanDitunda: a }), a).toBe(false);
    }
    // Ditunda menang atas segalanya - termasuk tanggal ikrar yang tercatat.
    expect(ikrarSelesai({ ...ikrar, ditunda: true, ikrarTercatat: true })).toBe(false);
  });

  it("bukan sidang ikrar: aturan ini diam", () => {
    expect(ikrarSelesai({ agenda: "Pembuktian", ditunda: false, alasanDitunda: "telah ikrar talak" })).toBe(false);
  });

  it("layar Jadwal Sidang memakai aturan lib dan menyebut SELESAI", () => {
    const layar = readFileSync(path.resolve(__dirname, "../components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    expect(layar).toContain("ikrarSelesai,");
    expect(layar).toContain("Selesai · telah ikrar talak");
    expect(layar).toContain("<UmurPerkara durasi={baris.durasi} telahIkrar={ikrarSelesai(baris)} />");
    expect(layar).not.toContain("function ikrarSelesai(");
  });
});
