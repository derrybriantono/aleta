// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALAMAT_ALETA,
  KATALOG_CHECKLIST,
  KUNCI_PERAN,
  type KunciPeran,
  katalogPeran,
} from "@/lib/checklist-milestone-katalog";
import {
  type AktaFakta,
  type AntreanChecklist,
  type ArsipFakta,
  BATAS_BUTIR_PER_JENIS,
  type BerjalanFakta,
  type EcourtDokumenFakta,
  type EfilingFakta,
  type IkrarFakta,
  KUNCI_ATURAN,
  type KonteksChecklist,
  type MediasiFakta,
  type PanjarFakta,
  type PenetapanGagalFakta,
  type PerkaraTertentuFakta,
  type PmhFakta,
  type PutusTanpaPutusanFakta,
  type PutusanFakta,
  type ReturFakta,
  type SaksiFakta,
  type SidangFakta,
  type SisaPanjarFakta,
  type TeleponFakta,
  type TunjukanKonsep,
  hariBht,
  hariKe150,
  isoTenggat,
  jalankanAturan,
  kelompokDari,
  nilaiChecklist,
  tunjukanMilikSaya,
} from "@/lib/checklist-milestone";

/**
 * ============================================================================
 * CHECKLIST MILESTONE - ATURAN TIAP JENIS
 * ============================================================================
 *
 * Tiap jenis diuji dua arah: kapan perkara MASUK menjadi butir, dan kapan
 * butirnya HILANG SENDIRI karena pekerjaannya selesai (termasuk hitungan
 * "selesai hari ini" untuk bilah kemajuan). Faktanya tiruan, dibentuk sama
 * dengan keluaran aleta_bot/services/checklistMilestoneService.js; bentuk
 * sungguhannya diukur atas sipp_donggala (lihat laporan pembangunannya).
 *
 * Hari acuan: Kamis 10 September 2026 (WITA).
 */

const HARI = "2026-09-10";

function konteks(jam = "10:00:00", tanggal = HARI): KonteksChecklist {
  return { kini: new Date(`${tanggal}T${jam}+08:00`), tanggal, jam };
}

function geser(hari: number, dari = HARI): string {
  const t = new Date(`${dari}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

function sidang(ubah: Partial<SidangFakta> = {}): SidangFakta {
  return {
    sidangId: "s1",
    perkaraId: "p1",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalSidang: HARI,
    jamSidang: "09:00",
    agenda: "Pemeriksaan pokok perkara",
    urutan: 2,
    ditunda: false,
    alasanDitunda: "",
    dihadiriOleh: null,
    adaBas: false,
    sidangIkrarTalak: false,
    ikrarTercatat: false,
    putusanTerbaca: true,
    ikrarTerbaca: true,
    berikutTerbaca: true,
    sudahPutus: false,
    tanggalPutusan: "",
    tanggalSidangBerikut: "",
    sidangBerikutId: "",
    jabatanSaya: 1,
    majelisKode: "C1",
    jurusitaNama: "",
    paniteraNama: "",
    panggilanTerbaca: true,
    panggilan: null,
    panggilanBerikut: null,
    ...ubah,
  };
}

function putusan(ubah: Partial<PutusanFakta> = {}): PutusanFakta {
  return {
    perkaraId: "p1",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalPutusan: HARI,
    diinputTanggal: HARI,
    verstek: false,
    statusPutusanId: 62,
    tanggalBht: "",
    adaDok: false,
    adaAnonim: false,
    dihadiriSaatPutus: 1,
    pbtPihak1: "",
    pbtPihak2: "",
    adaPihak2: true,
    tanggalBanding: "",
    jabatanSaya: 1,
    ...ubah,
  };
}

const panggil = (sisi: number[]) => ({
  wajibDipanggil: sisi,
  sisiBelumDipanggil: sisi,
  belumDipanggil: sisi.length,
  retur: 0,
});

function jalan(
  kunci: string,
  fakta: Record<string, unknown>,
  opsi: { peran?: KunciPeran; jam?: string; antrean?: AntreanChecklist[]; konsep?: TunjukanKonsep[] } = {}
) {
  const peran = opsi.peran ?? (kunci.split(".")[0] as KunciPeran);
  return jalankanAturan(kunci, {
    peran,
    konteks: konteks(opsi.jam),
    fakta,
    tambahan: { antrean: opsi.antrean ?? [], konsep: opsi.konsep ?? [] },
  });
}

/** Butir akhir (dengan kelompok) untuk satu peran, dari fakta tiruan. */
function nilai(
  peran: KunciPeran,
  fakta: Record<string, unknown>,
  opsi: { jam?: string; antrean?: AntreanChecklist[]; konsep?: TunjukanKonsep[]; gagal?: Record<string, string> } = {}
) {
  return nilaiChecklist({
    peran,
    konteks: konteks(opsi.jam),
    fakta,
    gagalKoleksi: opsi.gagal ?? {},
    tambahan: { antrean: opsi.antrean ?? [], konsep: opsi.konsep ?? [] },
    sebabTakTertaut: "",
  });
}

// ============================================================================
describe("katalog", () => {
  it("tiap peran paling banyak 10 jenis, kuncinya berawalan peran", () => {
    for (const peran of KUNCI_PERAN) {
      const daftar = katalogPeran(peran);
      expect(daftar.length, peran).toBeGreaterThan(0);
      expect(daftar.length, peran).toBeLessThanOrEqual(10);
      for (const j of daftar) expect(j.kunci.startsWith(`${peran}.`), j.kunci).toBe(true);
    }
  });

  it("jenis yang tersedia persis sama dengan jenis yang punya aturan", () => {
    const tersedia = KATALOG_CHECKLIST.filter((j) => j.tersedia).map((j) => j.kunci).sort();
    expect([...KUNCI_ATURAN].sort()).toEqual(tersedia);
  });

  it("jenis yang tidak tersedia selalu membawa sebab; acc BAS oleh hakim sengaja tidak ada", () => {
    for (const j of KATALOG_CHECKLIST) {
      if (!j.tersedia) expect(j.sebab.length, j.kunci).toBeGreaterThan(40);
      expect(j.kunci).not.toMatch(/acc/);
    }
  });

  it("tujuan Kerjakan memakai kunci halaman yang disepakati, dan alamat ALETA-nya sungguh ada", () => {
    const abt = ["blangko-putusan", "blangko-penetapan", "blangko-bas", "blangko-relaas", "blangko-akta"];
    const sipp = [
      "perkara",
      "penetapan",
      "jadwal-sidang",
      "putusan",
      "relaas",
      "akta-cerai",
      "keuangan",
      "saksi",
      "mediasi",
      "ikrar",
      // Menu SIPP, bukan tab halaman perkara (uji rilis U2c 9 Okt 2026).
      "pendaftaran-online",
      "arsip-perkara",
    ];
    for (const j of KATALOG_CHECKLIST) {
      if (!j.tersedia) continue;
      const k = j.kerjakan;
      if (k.tujuan === "abt") expect(abt, j.kunci).toContain(k.halaman);
      if (k.tujuan === "sipp") expect(sipp, j.kunci).toContain(k.halaman);
      if (k.tujuan === "aleta") expect(k.alamat.startsWith("/aleta/"), j.kunci).toBe(true);
    }
    // Alamat portal -> berkas halaman Next.js. basePath /aleta dibuang.
    for (const alamat of Object.values(ALAMAT_ALETA)) {
      const jalur = alamat.replace(/^\/aleta/, "");
      const berkas = path.resolve(__dirname, "../app/(portal)", `.${jalur}`, "page.tsx");
      expect(existsSync(berkas), alamat).toBe(true);
    }
  });

  it("konseptor ditugaskan mengarah ke blangko putusan ABT (permintaan pengguna)", () => {
    const konsep = KATALOG_CHECKLIST.find((j) => j.kunci === "hakim.konsep-putusan");
    expect(konsep?.tersedia && konsep.kerjakan).toEqual({ tujuan: "abt", halaman: "blangko-putusan" });
  });
});

// ============================================================================
describe("kelompok dan tenggat (WITA)", () => {
  it("15:00:00 tepat sudah lewat; 14:59:59 masih hari ini", () => {
    const t = { tanggal: HARI, jam: "15:00:00" };
    expect(kelompokDari(t, { tanggal: HARI, jam: "14:59:59" }, false)).toBe("hari-ini");
    expect(kelompokDari(t, { tanggal: HARI, jam: "15:00:00" }, false)).toBe("lewat");
  });

  it("minggu-ini sampai 7 hari; lebih jauh hanya untuk butir penugasan", () => {
    const k = { tanggal: HARI, jam: "10:00:00" };
    expect(kelompokDari({ tanggal: geser(7) }, k, false)).toBe("minggu-ini");
    expect(kelompokDari({ tanggal: geser(8) }, k, false)).toBeNull();
    expect(kelompokDari({ tanggal: geser(8) }, k, true)).toBe("minggu-ini");
    expect(kelompokDari(null, k, false)).toBe("minggu-ini");
    expect(kelompokDari({ tanggal: geser(-1) }, k, false)).toBe("lewat");
  });

  it("tenggat ISO dihitung dari WITA (UTC+8)", () => {
    expect(isoTenggat({ tanggal: HARI, jam: "15:00:00" })).toBe("2026-09-10T07:00:00.000Z");
    expect(isoTenggat({ tanggal: HARI })).toBe("2026-09-10T15:59:59.000Z");
  });
});

// ============================================================================
describe("hakim", () => {
  it("konsep-putusan: masuk sampai putus; tenggat sidang musyawarah; tanpa jadwal tetap tampil", () => {
    const perkaraTertentu: PerkaraTertentuFakta[] = [
      {
        perkaraId: "p1",
        nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        tanggalPutusan: "",
        diinputPutusan: "",
        sidangMendatang: [
          { tanggal: geser(4), agenda: "Pembuktian" },
          { tanggal: geser(11), agenda: "Musyawarah Majelis" },
        ],
        jabatanSaya: 2,
      },
      { perkaraId: "p2", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", jenisPerkara: "", tanggalPutusan: "", diinputPutusan: "", sidangMendatang: [], jabatanSaya: null },
      { perkaraId: "p3", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", jenisPerkara: "", tanggalPutusan: HARI, diinputPutusan: HARI, sidangMendatang: [], jabatanSaya: 1 },
    ];
    const konsep: TunjukanKonsep[] = ["p1", "p2", "p3", "p9"].map((id) => ({
      perkaraId: id,
      nomorPerkara: "",
      nama: "Fulan",
      pengguna: "fulan",
      ditetapkanOleh: "Ketua",
      ditetapkanAt: "2026-09-01T01:00:00.000Z",
    }));
    const h = jalan("hakim.konsep-putusan", { perkaraTertentu }, { konsep });
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal ?? null])).toEqual([
      ["p1", geser(11)],
      ["p2", null],
    ]);
    expect(h.selesaiHariIni).toBe(1);

    // Tenggat 11 hari lagi tetap tampil - ia penugasan, bukan pemantauan.
    const akhir = nilai("hakim", { perkaraTertentu }, { konsep });
    const butir = akhir.butir.filter((b) => b.jenis === "hakim.konsep-putusan");
    expect(butir.map((b) => b.kelompok)).toEqual(["minggu-ini", "minggu-ini"]);
    expect(butir[0].kerjakan).toEqual({ tujuan: "abt", halaman: "blangko-putusan" });
  });

  it("tunjukan dicocokkan lewat username, lalu nama baku - username orang lain tidak pernah cocok lewat nama", () => {
    const saya = { usernames: ["Sudarmin"], nama: ["SUDARMIN H.I.M. TANG, S.H.I.,M.H"] };
    expect(tunjukanMilikSaya({ nama: "", pengguna: "sudarmin" }, saya)).toBe(true);
    expect(tunjukanMilikSaya({ nama: "Sudarmin H.I.M. Tang", pengguna: "" }, saya)).toBe(true);
    expect(tunjukanMilikSaya({ nama: "Sudarmin H.I.M. Tang", pengguna: "idris" }, saya)).toBe(false);
    expect(tunjukanMilikSaya({ nama: "Idris", pengguna: "" }, saya)).toBe(false);
    expect(tunjukanMilikSaya({ nama: "", pengguna: "" }, saya)).toBe(false);
  });

  it("putusan-belum-unggah: putusan 7 hari terakhir yang dipimpin; lewat sesudah hari pembacaan; hilang bila dokumen ada", () => {
    const fakta = {
      putusan: [
        putusan({ perkaraId: "a", tanggalPutusan: HARI }),
        putusan({ perkaraId: "b", tanggalPutusan: geser(-1) }),
        putusan({ perkaraId: "c", tanggalPutusan: geser(-2) }),
        putusan({ perkaraId: "d", tanggalPutusan: HARI, jabatanSaya: 2 }),
        putusan({ perkaraId: "e", tanggalPutusan: HARI, adaDok: true }),
        putusan({ perkaraId: "f", tanggalPutusan: geser(-7) }),
        putusan({ perkaraId: "g", tanggalPutusan: geser(-8) }),
      ],
    };
    const h = jalan("hakim.putusan-belum-unggah", fakta);
    expect(h.calon.map((c) => c.perkaraId)).toEqual(["a", "b", "c", "f"]);
    expect(h.selesaiHariIni).toBe(1);
    expect(h.calon.find((c) => c.perkaraId === "c")?.keterangan).toMatch(/^Dibacakan 8 Sep 2026;/);
    const akhir = nilai("hakim", fakta).butir.filter((b) => b.jenis === "hakim.putusan-belum-unggah");
    expect(Object.fromEntries(akhir.map((b) => [b.perkara?.id, b.kelompok]))).toEqual({
      a: "hari-ini",
      b: "lewat",
      c: "lewat",
      f: "lewat",
    });
  });

  it("putusan-belum-unggah: putusan Jumat tanpa naskah masih ditagih hari Senin (bukti pemeriksa akhir-pekan.ts)", () => {
    const fakta = { putusan: [putusan({ perkaraId: "jumat", tanggalPutusan: "2026-09-11" })] };
    const senin = nilaiChecklist({
      peran: "hakim",
      konteks: konteks("08:00:00", "2026-09-14"),
      fakta,
      gagalKoleksi: {},
      tambahan: { antrean: [], konsep: [] },
      sebabTakTertaut: "",
    });
    const butir = senin.butir.filter((b) => b.jenis === "hakim.putusan-belum-unggah");
    expect(butir.map((b) => [b.perkara?.id, b.kelompok])).toEqual([["jumat", "lewat"]]);
  });

  it("penetapan-tunggal: permohonan tunggal/ketua dengan sidang dalam 7 hari; selesai saat diucapkan", () => {
    const dasar = { alurPerkaraId: 16, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", jabatanSaya: 3 };
    const fakta = {
      sidang: [
        sidang({ ...dasar, perkaraId: "a", sidangId: "a1", tanggalSidang: geser(3) }),
        sidang({ ...dasar, perkaraId: "a", sidangId: "a2", tanggalSidang: geser(5) }),
        sidang({ ...dasar, perkaraId: "b", sidangId: "b1", tanggalSidang: geser(3), alurPerkaraId: 15 }),
        sidang({ ...dasar, perkaraId: "c", sidangId: "c1", tanggalSidang: geser(3), jabatanSaya: 2 }),
        sidang({ ...dasar, perkaraId: "d", sidangId: "d1", tanggalSidang: geser(9) }),
        sidang({ ...dasar, perkaraId: "e", sidangId: "e1", tanggalSidang: HARI, sudahPutus: true, tanggalPutusan: HARI }),
        sidang({ ...dasar, perkaraId: "f", sidangId: "f1", tanggalSidang: geser(2), jenisPerkara: "Dispensasi Kawin" }),
      ],
    };
    const h = jalan("hakim.penetapan-tunggal", fakta);
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal])).toEqual([
      ["a", geser(3)],
      ["f", geser(2)],
    ]);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("phs-menunggu: hanya titipan PHS pada perkara yang dipimpin; dikerjakan hari ini dihitung selesai", () => {
    const antrean: AntreanChecklist[] = [
      { id: "q1", perkaraId: "a", nomorPerkara: "A", jenis: "phs", keadaan: "menunggu", disiapkanAt: "2026-09-10T01:00:00.000Z", dikerjakanAt: "" },
      { id: "q2", perkaraId: "b", nomorPerkara: "B", jenis: "phs", keadaan: "menunggu", disiapkanAt: "2026-09-10T01:00:00.000Z", dikerjakanAt: "" },
      { id: "q3", perkaraId: "a", nomorPerkara: "A", jenis: "phs", keadaan: "dikerjakan", disiapkanAt: "2026-09-09T01:00:00.000Z", dikerjakanAt: "2026-09-10T02:00:00.000Z" },
      { id: "q4", perkaraId: "a", nomorPerkara: "A", jenis: "pmh", keadaan: "menunggu", disiapkanAt: "2026-09-10T01:00:00.000Z", dikerjakanAt: "" },
    ];
    const perkaraTertentu = [
      { perkaraId: "a", nomorPerkara: "A", jenisPerkara: "", tanggalPutusan: "", diinputPutusan: "", sidangMendatang: [], jabatanSaya: 1 },
      { perkaraId: "b", nomorPerkara: "B", jenisPerkara: "", tanggalPutusan: "", diinputPutusan: "", sidangMendatang: [], jabatanSaya: 2 },
    ];
    const h = jalan("hakim.phs-menunggu", { perkaraTertentu }, { antrean });
    expect(h.calon.map((c) => c.kunci)).toEqual(["q1"]);
    expect(h.calon[0].tenggat).toEqual({ tanggal: HARI });
    expect(h.selesaiHariIni).toBe(1);
  });

  it("ecourt-verifikasi: hanya atas tarikan segar; tautan ke e-Court bila ada, ke ALETA bila tidak", () => {
    const dokumen: EcourtDokumenFakta["dokumen"] = [
      { kunci: "d1", nomorPerkara: "A", perkaraId: "a", jenisDokumen: "Jawaban", agenda: "Jawaban", tanggalSidang: geser(2), diunggahPada: `${geser(-1)} 09:00:00`, sumberUrl: "https://ecourt.example/d1" },
      { kunci: "d2", nomorPerkara: "B", perkaraId: "b", jenisDokumen: "Replik", agenda: "", tanggalSidang: "", diunggahPada: `${HARI} 08:00:00`, sumberUrl: "" },
    ];
    const segar = (jamLalu: number | null) => ({
      terakhirBerhasil: jamLalu === null ? "" : new Date(konteks().kini.getTime() - jamLalu * 3_600_000).toISOString(),
      terakhirDicoba: "",
      jadwalAktif: true,
      jarakJam: 2,
      jamMulai: 7,
      jamSelesai: 17,
    });
    const baik = jalan("hakim.ecourt-verifikasi", { ecourtDokumen: { segar: segar(2), dokumen } });
    expect(baik.tidakTersedia).toBeUndefined();
    expect(baik.calon.map((c) => [c.kunci, c.tenggat?.tanggal, c.kerjakan])).toEqual([
      ["d1", geser(2), { tujuan: "ecourt", alamat: "https://ecourt.example/d1" }],
      ["d2", HARI, { tujuan: "aleta", alamat: ALAMAT_ALETA.verifikasiDokumen }],
    ]);
    expect(jalan("hakim.ecourt-verifikasi", { ecourtDokumen: { segar: segar(30), dokumen } }).tidakTersedia).toMatch(/30 jam/);
    expect(jalan("hakim.ecourt-verifikasi", { ecourtDokumen: { segar: segar(null), dokumen } }).tidakTersedia).toMatch(/Belum pernah/);
  });

  it("hasil-sidang-belum-dicatat: hari ini sebelum 15.00, lewat sesudahnya; hilang bila ditunda/putus/lanjutan ada", () => {
    const fakta = {
      sidang: [
        sidang({ sidangId: "belum" }),
        sidang({ sidangId: "tunda", perkaraId: "p2", ditunda: true, alasanDitunda: "Panggil Tergugat" }),
        sidang({ sidangId: "lanjut", perkaraId: "p3", tanggalSidangBerikut: geser(7) }),
        sidang({ sidangId: "putus", perkaraId: "p4", sudahPutus: true, tanggalPutusan: HARI }),
        sidang({ sidangId: "anggota", perkaraId: "p5", jabatanSaya: 2 }),
        sidang({ sidangId: "depan", perkaraId: "p6", tanggalSidang: geser(1) }),
        sidang({ sidangId: "kemarin", perkaraId: "p7", tanggalSidang: geser(-1) }),
      ],
    };
    const h = jalan("hakim.hasil-sidang-belum-dicatat", fakta);
    expect(h.calon.map((c) => c.kunci)).toEqual(["belum", "kemarin"]);
    expect(h.selesaiHariIni).toBe(3);

    const pagi = nilai("hakim", fakta, { jam: "10:00:00" }).butir.filter((b) => b.jenis === "hakim.hasil-sidang-belum-dicatat");
    expect(pagi.map((b) => [b.id.split(":").pop(), b.kelompok])).toEqual([
      ["kemarin", "lewat"],
      ["belum", "hari-ini"],
    ]);
    const sore = nilai("hakim", fakta, { jam: "15:00:00" }).butir.filter((b) => b.jenis === "hakim.hasil-sidang-belum-dicatat");
    expect(sore.every((b) => b.kelompok === "lewat")).toBe(true);
  });

  it("hasil-sidang-belum-dicatat gagal-tertutup: peta putusan atau lanjutan tak terbaca tidak menuduh", () => {
    const fakta = {
      sidang: [sidang({ sidangId: "x", putusanTerbaca: false }), sidang({ sidangId: "y", perkaraId: "p2", berikutTerbaca: false })],
    };
    const h = jalan("hakim.hasil-sidang-belum-dicatat", fakta);
    expect(h.calon).toEqual([]);
    expect(h.tidakTersedia).toMatch(/gagal dibaca/);
  });

  it("lima-bulan: hari ke-150 menghitung hari daftar dan mengeluarkan mediasi; hanya yang dipimpin", () => {
    expect(hariKe150("2026-04-15", 0)).toBe("2026-09-11");
    expect(hariKe150("2026-04-15", 10)).toBe("2026-09-21");
    const berjalan: BerjalanFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-04-15", hariMediasi: 0, durasiTerbaca: true, jabatanSaya: 1 },
      { perkaraId: "b", nomorPerkara: "B", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-04-15", hariMediasi: 10, durasiTerbaca: true, jabatanSaya: 1 },
      { perkaraId: "c", nomorPerkara: "C", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-03-01", hariMediasi: 0, durasiTerbaca: true, jabatanSaya: 3 },
      { perkaraId: "d", nomorPerkara: "D", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-03-01", hariMediasi: 0, durasiTerbaca: true, jabatanSaya: 2 },
      { perkaraId: "e", nomorPerkara: "E", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-03-01", hariMediasi: 0, durasiTerbaca: false, jabatanSaya: 1 },
    ];
    const akhir = nilai("hakim", { berjalan }).butir.filter((b) => b.jenis === "hakim.lima-bulan");
    expect(Object.fromEntries(akhir.map((b) => [b.perkara?.id, b.kelompok]))).toEqual({ a: "minggu-ini", c: "lewat" });
  });

  it("lima-bulan: umur yang gagal dibaca (durasi) membuat jenisnya TIDAK TERSEDIA, bukan kosong; sebagian gagal disebut di error", () => {
    const b = (ubah: Partial<BerjalanFakta>): BerjalanFakta => ({
      perkaraId: "a",
      nomorPerkara: "A",
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-03-01",
      hariMediasi: 0,
      durasiTerbaca: true,
      jabatanSaya: 1,
      ...ubah,
    });
    const semua = nilai("ketua", { berjalan: [b({ durasiTerbaca: false }), b({ perkaraId: "b", durasiTerbaca: false })] });
    expect(semua.jenisTidakTersedia.find((x) => x.jenis === "ketua.lima-bulan-per-majelis")?.sebab).toMatch(
      /Umur 2 perkara .*gagal dibaca dari SIPP/
    );
    expect(nilai("hakim", { berjalan: [b({ durasiTerbaca: false })] }).jenisTidakTersedia.map((x) => x.jenis)).toContain(
      "hakim.lima-bulan"
    );

    const sebagian = nilai("ketua", { berjalan: [b({}), b({ perkaraId: "b", durasiTerbaca: false })] });
    expect(sebagian.butir.filter((x) => x.jenis === "ketua.lima-bulan-per-majelis").map((x) => x.perkara?.id)).toEqual(["a"]);
    expect(sebagian.jenisTidakTersedia.map((x) => x.jenis)).not.toContain("ketua.lima-bulan-per-majelis");
    expect(sebagian.galat.join(" ")).toMatch(/Umur 1 perkara .*belum lengkap/);
  });

  it("mediasi-30-hari: tenggat PERMA, hilang saat laporan mediator masuk", () => {
    const mediasi: MediasiFakta[] = [
      { mediasiId: "m1", perkaraId: "a", nomorPerkara: "A", penetapanMediator: geser(-28), dimulaiMediasi: geser(-20), laporanMediator: "", tenggatPerma: geser(2) },
      { mediasiId: "m2", perkaraId: "b", nomorPerkara: "B", penetapanMediator: geser(-40), dimulaiMediasi: "", laporanMediator: HARI, tenggatPerma: geser(-10) },
      { mediasiId: "m3", perkaraId: "c", nomorPerkara: "C", penetapanMediator: geser(-5), dimulaiMediasi: "", laporanMediator: "", tenggatPerma: geser(25) },
    ];
    const h = jalan("hakim.mediasi-30-hari", { mediasi });
    expect(h.calon.map((c) => c.kunci)).toEqual(["m1", "m3"]);
    expect(h.selesaiHariIni).toBe(1);
    const akhir = nilai("hakim", { mediasi }).butir.filter((b) => b.jenis === "hakim.mediasi-30-hari");
    expect(akhir.map((b) => b.id)).toEqual(["hakim.mediasi-30-hari:m1"]);
  });

  it("ikrar-talak: sidang ikrar belum ditetapkan ditagih sejak BHT; yang sudah ditetapkan hanya menjelang 180 hari", () => {
    const ikrar: IkrarFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", tanggalBht: geser(-2), statusPutusanId: 62, penetapanSidangIkrar: "", tanggalIkrar: "", sidangIkrarBerikut: "", jabatanSaya: 1 },
      { perkaraId: "b", nomorPerkara: "B", tanggalBht: geser(-176), statusPutusanId: 62, penetapanSidangIkrar: geser(-170), tanggalIkrar: "", sidangIkrarBerikut: "", jabatanSaya: 1 },
      { perkaraId: "c", nomorPerkara: "C", tanggalBht: geser(-20), statusPutusanId: 62, penetapanSidangIkrar: geser(-18), tanggalIkrar: "", sidangIkrarBerikut: geser(5), jabatanSaya: 1 },
      { perkaraId: "d", nomorPerkara: "D", tanggalBht: geser(-30), statusPutusanId: 62, penetapanSidangIkrar: geser(-28), tanggalIkrar: HARI, sidangIkrarBerikut: "", jabatanSaya: 1 },
      { perkaraId: "e", nomorPerkara: "E", tanggalBht: geser(-2), statusPutusanId: 63, penetapanSidangIkrar: "", tanggalIkrar: "", sidangIkrarBerikut: "", jabatanSaya: 1 },
      { perkaraId: "f", nomorPerkara: "F", tanggalBht: geser(-2), statusPutusanId: 62, penetapanSidangIkrar: "", tanggalIkrar: "", sidangIkrarBerikut: "", jabatanSaya: 2 },
    ];
    const akhir = nilai("hakim", { ikrar }).butir.filter((b) => b.jenis === "hakim.ikrar-talak");
    expect(Object.fromEntries(akhir.map((b) => [b.perkara?.id, b.kelompok]))).toEqual({ a: "lewat", b: "minggu-ini" });
    expect(akhir.find((b) => b.perkara?.id === "a")?.keterangan).toMatch(/belum ditetapkan; sisa tenggang 178 hari/);
    expect(jalan("hakim.ikrar-talak", { ikrar }).selesaiHariIni).toBe(1);
  });
});

// ============================================================================
describe("panitera pengganti", () => {
  it("bas-belum: sidang hari ini dan kemarin tanpa BAS; tunggakan-bas untuk yang lebih tua", () => {
    const fakta = {
      sidang: [
        sidang({ sidangId: "ini", jabatanSaya: null }),
        sidang({ sidangId: "kemarin", tanggalSidang: geser(-1), jabatanSaya: null }),
        sidang({ sidangId: "lusa-lalu", tanggalSidang: geser(-2), jabatanSaya: null }),
        sidang({ sidangId: "beres", adaBas: true, jabatanSaya: null }),
      ],
    };
    const bas = jalan("panitera-pengganti.bas-belum", fakta);
    expect(bas.calon.map((c) => c.kunci)).toEqual(["ini", "kemarin"]);
    expect(bas.selesaiHariIni).toBe(1);
    expect(jalan("panitera-pengganti.tunggakan-bas", fakta).calon.map((c) => c.kunci)).toEqual(["lusa-lalu"]);
  });

  it("hasil-sidang-belum-dicatat tidak menyaring jabatan hakim", () => {
    const h = jalan("panitera-pengganti.hasil-sidang-belum-dicatat", { sidang: [sidang({ jabatanSaya: null })] });
    expect(h.calon).toHaveLength(1);
  });

  it("putusan-akhir-belum-diisi: sidang tertulis putus tanpa tanggal putusan", () => {
    const baris = (ubah: Partial<PutusTanpaPutusanFakta>): PutusTanpaPutusanFakta => ({
      sidangId: "s",
      perkaraId: "p",
      nomorPerkara: "N",
      tanggalSidang: geser(-2),
      ditunda: false,
      alasanDitunda: "putus DIKABULKAN (verstek)",
      tanggalPutusan: "",
      diinputPutusan: "",
      ...ubah,
    });
    const h = jalan("panitera-pengganti.putusan-akhir-belum-diisi", {
      putusTanpaPutusan: [
        baris({ perkaraId: "a" }),
        baris({ perkaraId: "b", ditunda: true }),
        baris({ perkaraId: "c", alasanDitunda: "Panggil Tergugat" }),
        baris({ perkaraId: "d", tanggalPutusan: geser(-2), diinputPutusan: HARI }),
      ],
    });
    expect(h.calon.map((c) => c.perkaraId)).toEqual(["a"]);
    expect(h.calon[0].tenggat).toEqual({ tanggal: geser(-2) });
    expect(h.selesaiHariIni).toBe(1);
  });

  it("putusan-belum-unggah: tenggat H+2; selesai bila naskah DAN anonimisasi ada", () => {
    const h = jalan("panitera-pengganti.putusan-belum-unggah", {
      putusan: [
        putusan({ perkaraId: "a", tanggalPutusan: geser(-1), adaDok: true, adaAnonim: false }),
        putusan({ perkaraId: "b", tanggalPutusan: HARI, adaDok: true, adaAnonim: true }),
      ],
    });
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal])).toEqual([["a", geser(1)]]);
    expect(h.calon[0].keterangan).toMatch(/anonimisasi belum/);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("saksi-belum-lengkap: tiga isian SK 048 I.12; lengkap hari ini dihitung selesai", () => {
    const saksi = (ubah: Partial<SaksiFakta>): SaksiFakta => ({
      saksiId: "x",
      perkaraId: "p",
      nomorPerkara: "N",
      sisi: 1,
      urutan: 1,
      diinputTanggal: geser(-3),
      pihakDiperbarui: "",
      adaJenisIdentitas: true,
      adaNomorIdentitas: true,
      adaTelepon: true,
      ...ubah,
    });
    const h = jalan("panitera-pengganti.saksi-belum-lengkap", {
      saksi: [saksi({ saksiId: "a", adaTelepon: false }), saksi({ saksiId: "b", diinputTanggal: HARI })],
    });
    expect(h.calon.map((c) => c.kunci)).toEqual(["a"]);
    expect(h.calon[0].keterangan).toMatch(/belum ada telepon/);
    expect(h.selesaiHariIni).toBe(1);
  });
});

// ============================================================================
describe("juru sita", () => {
  const faktaPanggilan = () => ({
    sidang: [
      // Ditunda kemarin dengan perintah panggil; sidang lanjutannya 12 hari lagi.
      sidang({
        sidangId: "t1",
        perkaraId: "a",
        tanggalSidang: geser(-1),
        ditunda: true,
        alasanDitunda: "Panggil Tergugat",
        sidangBerikutId: "t2",
        tanggalSidangBerikut: geser(12),
        panggilanBerikut: panggil([2]),
      }),
      // Sidang pertama 6 hari lagi.
      sidang({ sidangId: "p1", perkaraId: "b", urutan: 1, tanggalSidang: geser(6), panggilan: panggil([1, 2]) }),
      // Sidang lanjutan 2 hari lagi (batas H-3 sudah lewat).
      sidang({ sidangId: "d1", perkaraId: "c", tanggalSidang: geser(2), panggilan: panggil([2]) }),
      // Sidang lanjutan 5 hari lagi.
      sidang({ sidangId: "w1", perkaraId: "d", tanggalSidang: geser(5), panggilan: panggil([2]) }),
      // Sudah dipanggil.
      sidang({ sidangId: "ok", perkaraId: "e", tanggalSidang: geser(5), panggilan: panggil([]) }),
    ],
  });

  it("empat jenis panggilan dari satu penyisiran, tanpa tagihan ganda", () => {
    const f = faktaPanggilan();
    expect(jalan("jurusita.perintah-panggil-tunda", f).calon.map((c) => c.kunci)).toEqual(["t2"]);
    expect(jalan("jurusita.panggilan-sidang-pertama", f).calon.map((c) => c.kunci)).toEqual(["p1"]);
    expect(jalan("jurusita.relaas-belum-diinput", f).calon.map((c) => c.kunci)).toEqual(["d1"]);
    expect(jalan("jurusita.belum-dipanggil-7-hari", f).calon.map((c) => c.kunci)).toEqual(["w1"]);

    const akhir = nilai("jurusita", f).butir;
    expect(Object.fromEntries(akhir.map((b) => [b.id, b.kelompok]))).toEqual({
      "jurusita.relaas-belum-diinput:d1": "lewat",
      "jurusita.panggilan-sidang-pertama:p1": "minggu-ini",
      "jurusita.belum-dipanggil-7-hari:w1": "minggu-ini",
      "jurusita.perintah-panggil-tunda:t2": "minggu-ini",
    });
  });

  it("peta panggilan gagal dibaca: jenis panggilan TIDAK TERSEDIA, bukan kosong (bukti pemeriksa telan.ts: 9/7/2 butir menjadi 0/0/0)", () => {
    const rusak = {
      sidang: faktaPanggilan().sidang.map((s) => ({ ...s, panggilan: null, panggilanBerikut: null, panggilanTerbaca: false })),
    };
    const h = nilai("jurusita", rusak);
    const tak = Object.fromEntries(h.jenisTidakTersedia.map((x) => [x.jenis, x.sebab]));
    expect(tak["jurusita.panggilan-sidang-pertama"]).toMatch(/Keadaan panggilan \(relaas\) 1 sidang mendatang gagal dibaca/);
    expect(tak["jurusita.relaas-belum-diinput"]).toMatch(/gagal dibaca/);
    expect(tak["jurusita.belum-dipanggil-7-hari"]).toMatch(/Keadaan panggilan \(relaas\) 2 sidang/);
    expect(tak["jurusita.perintah-panggil-tunda"]).toMatch(/1 sidang yang ditunda dengan perintah panggil/);
    expect(h.butir).toEqual([]);

    // Peta sidang lanjutan saja yang gagal: hanya perintah-panggil-tunda yang tak tersedia.
    const tanpaLanjutan = {
      sidang: faktaPanggilan().sidang.map((s) => ({ ...s, sidangBerikutId: "", tanggalSidangBerikut: "", panggilanBerikut: null, berikutTerbaca: false })),
    };
    const h2 = nilai("jurusita", tanpaLanjutan);
    expect(h2.jenisTidakTersedia.find((x) => x.jenis === "jurusita.perintah-panggil-tunda")?.sebab).toMatch(/Sidang lanjutan/);
    expect(h2.butir.map((b) => b.id)).toContain("jurusita.relaas-belum-diinput:d1");

    // Sebagian gagal: yang terbaca tetap ditagih, kekurangannya disebut SEKALI di galat.
    const sebagian = faktaPanggilan();
    sebagian.sidang[1] = { ...sebagian.sidang[1], urutan: 2, sidangId: "p9", tanggalSidang: geser(1), panggilan: null, panggilanTerbaca: false };
    const h3 = nilai("jurusita", sebagian);
    expect(h3.butir.map((b) => b.id)).toContain("jurusita.relaas-belum-diinput:d1");
    expect(h3.jenisTidakTersedia.map((x) => x.jenis)).not.toContain("jurusita.relaas-belum-diinput");
    expect(h3.galat.filter((g) => /Keadaan panggilan \(relaas\) 1 sidang mendatang gagal dibaca.*belum lengkap/.test(g))).toHaveLength(1);
  });

  it("sidang ikrar talak ditagih walau perkaranya sudah putus: suami dan istri dipanggil (Pasal 70 ayat (3) UU 7/1989)", () => {
    const f = {
      sidang: [
        // Sidang ikrar besok; putusan sebulan lalu dihadiri semua pihak; belum ada relaas.
        sidang({ sidangId: "ik1", perkaraId: "ct1", jenisPerkara: "Cerai Talak", urutan: 8, tanggalSidang: geser(1), agenda: "SIDANG IKRAR TALAK", sidangIkrarTalak: true, sudahPutus: true, tanggalPutusan: geser(-30), panggilan: panggil([1, 2]) }),
        // Sidang ikrar kemarin ditunda untuk memanggil Pemohon; lanjutannya 5 hari lagi.
        sidang({ sidangId: "ik2", perkaraId: "ct2", jenisPerkara: "Cerai Talak", tanggalSidang: geser(-1), agenda: "Sidang Ikrar Talak", sidangIkrarTalak: true, sudahPutus: true, ditunda: true, alasanDitunda: "Panggil Pemohon", sidangBerikutId: "ik3", tanggalSidangBerikut: geser(5), sidangBerikutIkrar: true, panggilanBerikut: panggil([1]) }),
        // Sidang BUKAN ikrar pada perkara yang sudah putus: tetap tidak ditagih.
        sidang({ sidangId: "biasa", perkaraId: "cg", tanggalSidang: geser(2), sudahPutus: true, panggilan: panggil([2]) }),
        sidang({ sidangId: "t9", perkaraId: "cg2", tanggalSidang: geser(-1), sudahPutus: true, ditunda: true, alasanDitunda: "panggil Tergugat", sidangBerikutId: "t10", tanggalSidangBerikut: geser(4), panggilanBerikut: panggil([2]) }),
      ],
    };
    const akhir = nilai("jurusita", f).butir;
    expect(akhir.map((b) => b.id).sort()).toEqual(["jurusita.perintah-panggil-tunda:ik3", "jurusita.relaas-belum-diinput:ik1"]);
    expect(akhir.find((b) => b.id.endsWith(":ik1"))?.keterangan).toMatch(
      /pihak pertama dan pihak kedua belum punya relaas di SIPP\. Sidang ikrar talak: suami dan istri dipanggil \(Pasal 70 ayat \(3\)/
    );
    // Panitera dan ketua (sidang 0-3 hari ke depan) memakai pengecualian yang sama.
    for (const kunci of ["panitera.panggilan-belum-patut", "ketua.sidang-terancam-panggilan"]) {
      const h = jalan(kunci, { sidangPanggilan: f.sidang });
      expect(h.calon.map((c) => c.kunci), kunci).toEqual(["ik1"]);
      expect(h.calon[0].keterangan).toMatch(/\(sidang ikrar talak\)/);
    }
  });

  it("sidang lanjutan dari perintah panggil yang juga jatuh dalam 7 hari tidak ditagih dua kali", () => {
    const f = {
      sidang: [
        sidang({ sidangId: "t1", tanggalSidang: geser(-1), ditunda: true, alasanDitunda: "panggil Termohon", sidangBerikutId: "t2", tanggalSidangBerikut: geser(5), panggilanBerikut: panggil([2]) }),
        sidang({ sidangId: "t2", tanggalSidang: geser(5), panggilan: panggil([2]) }),
      ],
    };
    const ids = nilai("jurusita", f).butir.map((b) => b.id);
    expect(ids).toEqual(["jurusita.perintah-panggil-tunda:t2"]);
  });

  it("retur: ditagih sampai ada susulan; bila sidang lanjutannya sudah ditagih sebagai panggilan, cukup dicatat di sana", () => {
    const retur = (ubah: Partial<ReturFakta>): ReturFakta => ({
      relaasId: "r",
      perkaraId: "x",
      nomorPerkara: "X",
      sidangId: "sx",
      tanggalSidang: geser(-2),
      tanggalRelaas: geser(-9),
      tanggalPutusan: "",
      sidangBerikut: geser(12),
      adaSusulan: false,
      susulanDiinput: "",
      ...ubah,
    });
    const f = {
      ...faktaPanggilan(),
      retur: [
        retur({ relaasId: "r1", perkaraId: "x" }),
        retur({ relaasId: "r2", perkaraId: "d" }),
        retur({ relaasId: "r3", perkaraId: "y", adaSusulan: true, susulanDiinput: HARI }),
        retur({ relaasId: "r4", perkaraId: "z", tanggalPutusan: geser(-1) }),
      ],
    };
    const h = jalan("jurusita.retur-gagal", f);
    expect(h.calon.map((c) => c.kunci)).toEqual(["r1"]);
    expect(h.selesaiHariIni).toBe(1);
    const tujuh = jalan("jurusita.belum-dipanggil-7-hari", f).calon[0];
    expect(tujuh.keterangan).toMatch(/sebelumnya retur/);
  });

  it("PBT: sisi tidak hadir tanpa pemberitahuan; verstek lama menjadi tunggakan; BHT terisi tidak ditagih", () => {
    const f = {
      putusan: [
        putusan({ perkaraId: "baru", tanggalPutusan: geser(-2), dihadiriSaatPutus: 2, verstek: true }),
        putusan({ perkaraId: "lama", tanggalPutusan: geser(-30), dihadiriSaatPutus: 2, verstek: true }),
        putusan({ perkaraId: "lama-bukan-verstek", tanggalPutusan: geser(-30), dihadiriSaatPutus: 3 }),
        putusan({ perkaraId: "hadir", tanggalPutusan: geser(-2), dihadiriSaatPutus: 1 }),
        putusan({ perkaraId: "sudah", tanggalPutusan: geser(-2), dihadiriSaatPutus: 2, pbtPihak2: HARI }),
        putusan({ perkaraId: "bht", tanggalPutusan: geser(-40), dihadiriSaatPutus: 2, verstek: true, tanggalBht: geser(-20) }),
        putusan({ perkaraId: "tak-tercatat", tanggalPutusan: geser(-2), dihadiriSaatPutus: null }),
        putusan({ perkaraId: "volunter", tanggalPutusan: geser(-2), dihadiriSaatPutus: 2, adaPihak2: false }),
      ],
    };
    const baru = jalan("jurusita.pbt-tidak-hadir", f);
    expect(baru.calon.map((c) => c.perkaraId)).toEqual(["baru", "lama-bukan-verstek"]);
    expect(baru.calon[0].tenggat).toEqual({ tanggal: geser(1) });
    expect(baru.selesaiHariIni).toBe(1);
    expect(jalan("jurusita.tunggakan-pbt-verstek", f).calon.map((c) => c.perkaraId)).toEqual(["lama"]);
  });
});

// ============================================================================
describe("panitera", () => {
  it("ppp-pjs-menunggu dari antrean; PHS dan PMH bukan urusannya", () => {
    const antrean: AntreanChecklist[] = [
      { id: "1", perkaraId: "a", nomorPerkara: "A", jenis: "ppp", keadaan: "menunggu", disiapkanAt: "2026-09-09T02:00:00.000Z", dikerjakanAt: "" },
      { id: "2", perkaraId: "a", nomorPerkara: "A", jenis: "pjs", keadaan: "dikerjakan", disiapkanAt: "2026-09-09T02:00:00.000Z", dikerjakanAt: "2026-09-10T03:00:00.000Z" },
      { id: "3", perkaraId: "b", nomorPerkara: "B", jenis: "phs", keadaan: "menunggu", disiapkanAt: "2026-09-10T02:00:00.000Z", dikerjakanAt: "" },
    ];
    const h = jalan("panitera.ppp-pjs-menunggu", {}, { antrean });
    expect(h.calon.map((c) => c.kunci)).toEqual(["1"]);
    expect(h.selesaiHariIni).toBe(1);
    const akhir = nilai("panitera", {}, { antrean }).butir.filter((b) => b.jenis === "panitera.ppp-pjs-menunggu");
    expect(akhir[0].kelompok).toBe("lewat");
  });

  /**
   * Batas hari mengikuti WITA, bukan UTC. Titipan yang dikerjakan pukul 00.30
   * WITA (16.30 UTC hari sebelumnya) terhitung "selesai hari ini"; yang
   * dikerjakan 23.59 WITA kemarin tidak. Pemeriksa mandiri menemukan mutan yang
   * mengganti +08:00 dengan Z lolos dari semua uji - uji ini menjaganya.
   */
  it("selesai hari ini dihitung menurut hari WITA: 00.30 WITA masuk, 23.59 WITA kemarin tidak", () => {
    const antrean: AntreanChecklist[] = [
      { id: "dini", perkaraId: "a", nomorPerkara: "A", jenis: "ppp", keadaan: "dikerjakan", disiapkanAt: "2026-09-09T02:00:00.000Z", dikerjakanAt: "2026-09-09T16:30:00.000Z" },
      { id: "kemarin", perkaraId: "b", nomorPerkara: "B", jenis: "pjs", keadaan: "dikerjakan", disiapkanAt: "2026-09-09T02:00:00.000Z", dikerjakanAt: "2026-09-09T15:59:59.000Z" },
      { id: "malam", perkaraId: "c", nomorPerkara: "C", jenis: "ppp", keadaan: "dikerjakan", disiapkanAt: "2026-09-10T02:00:00.000Z", dikerjakanAt: "2026-09-10T15:59:59.000Z" },
    ];
    // HARI = 2026-09-10 WITA: "dini" (00.30) dan "malam" (23.59.59) masuk = 2.
    // Menurut UTC hanya "malam" yang jatuh 10 Sep = 1 - datanya sengaja tidak
    // simetris, supaya hari UTC dan hari WITA tidak kebetulan berjumlah sama.
    expect(jalan("panitera.ppp-pjs-menunggu", {}, { antrean }).selesaiHariIni).toBe(2);
  });

  it("bht-belum-diisi: hadir -> putus+15; tidak hadir -> PBT terakhir+15; tanpa PBT atau banding tidak ditagih", () => {
    expect(hariBht(putusan({ tanggalPutusan: "2026-08-31", dihadiriSaatPutus: 1 }))?.tanggal).toBe("2026-09-15");
    expect(hariBht(putusan({ tanggalPutusan: "2026-08-18", dihadiriSaatPutus: 2, pbtPihak2: "2026-08-27" }))?.tanggal).toBe("2026-09-11");
    expect(hariBht(putusan({ dihadiriSaatPutus: 4, pbtPihak1: "2026-08-20", pbtPihak2: "2026-08-25" }))?.tanggal).toBe("2026-09-09");
    expect(hariBht(putusan({ dihadiriSaatPutus: 2 }))).toBeNull();
    expect(hariBht(putusan({ dihadiriSaatPutus: null }))).toBeNull();

    const h = jalan("panitera.bht-belum-diisi", {
      putusan: [
        putusan({ perkaraId: "a", tanggalPutusan: geser(-16), dihadiriSaatPutus: 1 }),
        putusan({ perkaraId: "b", tanggalPutusan: geser(-16), dihadiriSaatPutus: 1, tanggalBanding: geser(-3) }),
        putusan({ perkaraId: "c", tanggalPutusan: geser(-16), dihadiriSaatPutus: 2 }),
        putusan({ perkaraId: "d", tanggalPutusan: geser(-15), dihadiriSaatPutus: 1, tanggalBht: HARI }),
      ],
    });
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal])).toEqual([["a", geser(-1)]]);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("direktori-putusan: dirput gagal, anonimisasi hilang (batas 14), naskah lewat H+2", () => {
    const h = jalan("panitera.direktori-putusan", {
      "penjaga:dirput-gagal": [{ perkaraId: "a", nomorPerkara: "A", jenisPerkara: "", tanggalAcuan: geser(-100), statusPutusanId: null, keterangan: "gagal" }],
      "penjaga:anonimisasi-hilang": [{ perkaraId: "b", nomorPerkara: "B", jenisPerkara: "", tanggalAcuan: geser(-20), statusPutusanId: 62 }],
      putusan: [putusan({ perkaraId: "c", tanggalPutusan: geser(-3), adaDok: false }), putusan({ perkaraId: "d", adaDok: true })],
    });
    expect(h.calon.map((c) => [c.kunci, c.tenggat?.tanggal])).toEqual([
      ["dirput:a", geser(-100)],
      ["anonim:b", geser(-6)],
      ["naskah:c", geser(-1)],
    ]);
  });

  it("akta-cerai-belum-terbit: batas 14 hari dari penjaga tenggat; hanya yang dikabulkan", () => {
    const h = jalan("panitera.akta-cerai-belum-terbit", {
      "penjaga:akta-cerai-gugat": [
        { perkaraId: "a", nomorPerkara: "A", jenisPerkara: "Cerai Gugat", tanggalAcuan: geser(-10), statusPutusanId: 62, keterangan: "BHT" },
        { perkaraId: "x", nomorPerkara: "X", jenisPerkara: "Cerai Gugat", tanggalAcuan: geser(-10), statusPutusanId: 63 },
      ],
      "penjaga:akta-cerai-talak": [{ perkaraId: "b", nomorPerkara: "B", jenisPerkara: "Cerai Talak", tanggalAcuan: geser(-20), statusPutusanId: 62 }],
      aktaHariIni: [{ perkaraId: "z", nomorPerkara: "Z", tanggalAkta: HARI, adaDok: true, diperbarui: HARI }] as AktaFakta[],
    });
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal])).toEqual([
      ["a", geser(4)],
      ["b", geser(-6)],
    ]);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("arsip-bht: BHT+5; arsip diinput hari ini dihitung selesai", () => {
    const arsip: ArsipFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", tanggalBht: geser(-10), arsipDiinput: "" },
      { perkaraId: "b", nomorPerkara: "B", tanggalBht: geser(-10), arsipDiinput: HARI },
    ];
    const h = jalan("panitera.arsip-bht", { arsip });
    expect(h.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal])).toEqual([["a", geser(-5)]]);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("panggilan-belum-patut: sidang 0-3 hari ke depan dengan sisi belum berelaas", () => {
    const h = jalan("panitera.panggilan-belum-patut", {
      sidangPanggilan: [
        sidang({ sidangId: "a", tanggalSidang: geser(1), panggilan: panggil([2]), jurusitaNama: "JS Satu" }),
        sidang({ sidangId: "b", tanggalSidang: geser(1), panggilan: panggil([]) }),
        sidang({ sidangId: "c", tanggalSidang: geser(4), panggilan: panggil([2]) }),
        sidang({ sidangId: "d", tanggalSidang: geser(1), panggilan: panggil([1]), sudahPutus: true }),
      ],
    });
    expect(h.calon.map((c) => c.kunci)).toEqual(["a"]);
    expect(h.calon[0].keterangan).toMatch(/pihak kedua belum punya relaas · juru sita JS Satu/);
  });
});

// ============================================================================
describe("ketua", () => {
  it("pmh-hari-ini: tanpa PMH ditagih sejak hari daftar; PMH diinput hari ini selesai; titipan disebut", () => {
    const pmh: PmhFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", jenisPerkara: "Cerai Gugat", tanggalDaftar: HARI, tanggalPmh: "", diinputPmh: "" },
      { perkaraId: "b", nomorPerkara: "B", jenisPerkara: "Cerai Gugat", tanggalDaftar: geser(-2), tanggalPmh: "", diinputPmh: "" },
      { perkaraId: "c", nomorPerkara: "C", jenisPerkara: "Cerai Gugat", tanggalDaftar: HARI, tanggalPmh: HARI, diinputPmh: HARI },
    ];
    const antrean: AntreanChecklist[] = [
      { id: "1", perkaraId: "a", nomorPerkara: "A", jenis: "pmh", keadaan: "menunggu", disiapkanAt: "2026-09-10T01:00:00.000Z", dikerjakanAt: "" },
    ];
    const h = jalan("ketua.pmh-hari-ini", { pmh }, { antrean });
    expect(h.calon.map((c) => c.perkaraId)).toEqual(["a", "b"]);
    expect(h.calon[0].keterangan).toMatch(/dititipkan/);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("lima-bulan-per-majelis tidak menyaring jabatan dan menyebut majelis", () => {
    const berjalan: BerjalanFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-04-15", hariMediasi: 0, durasiTerbaca: true, jabatanSaya: null, majelisKode: "B" },
    ];
    const h = jalan("ketua.lima-bulan-per-majelis", { berjalan });
    expect(h.calon).toHaveLength(1);
    expect(h.calon[0].keterangan).toMatch(/majelis B/);
  });

  it("ikrar-akta menggabungkan ikrar dan akta", () => {
    const h = jalan("ketua.ikrar-akta", {
      ikrar: [{ perkaraId: "a", nomorPerkara: "A", tanggalBht: geser(-1), statusPutusanId: 62, penetapanSidangIkrar: "", tanggalIkrar: "", sidangIkrarBerikut: "", jabatanSaya: null }],
      "penjaga:akta-cerai-gugat": [{ perkaraId: "b", nomorPerkara: "B", jenisPerkara: "Cerai Gugat", tanggalAcuan: geser(-15), statusPutusanId: 62 }],
    });
    expect(h.calon.map((c) => c.perkaraId)).toEqual(["a", "b"]);
  });
});

// ============================================================================
describe("PTSP", () => {
  it("ecourt-belum-register: dibayar tanpa nomor perkara; terdaftar hari ini selesai", () => {
    const efiling: EfilingFakta[] = [
      { efilingId: "1", nomorRegister: "PA.DGL-X", jenisPerkara: "Cerai Gugat", tanggalBayar: geser(-1), nomorPerkara: "", perkaraId: "", tanggalDaftar: "", status: "Menunggu Pendaftaran" },
      { efilingId: "2", nomorRegister: "PA.DGL-Y", jenisPerkara: "Cerai Gugat", tanggalBayar: HARI, nomorPerkara: "9/Pdt.G/2026/PA.Dgl", perkaraId: "9", tanggalDaftar: HARI, status: "" },
    ];
    const h = jalan("ptsp.ecourt-belum-register", { efiling });
    expect(h.calon.map((c) => [c.kunci, c.perkaraId ?? null])).toEqual([["1", null]]);
    expect(h.selesaiHariIni).toBe(1);
  });

  it("panjar-habis: di bawah ambang sebelum sidang; perkara tanpa transaksi tidak ditagih", () => {
    const panjar: PanjarFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", sidangBerikut: geser(2), saldo: 0, transaksi: 3, terakhirMasuk: "", ambang: 100000 },
      { perkaraId: "b", nomorPerkara: "B", sidangBerikut: geser(2), saldo: 150000, transaksi: 3, terakhirMasuk: "", ambang: 100000 },
      { perkaraId: "c", nomorPerkara: "C", sidangBerikut: geser(2), saldo: null, transaksi: 0, terakhirMasuk: "", ambang: 100000 },
    ];
    const h = jalan("ptsp.panjar-habis", { panjar });
    expect(h.calon.map((c) => c.perkaraId)).toEqual(["a"]);
    expect(h.calon[0].keterangan).toMatch(/habis/);
  });

  it("data-umum-belum-lengkap, sisa-panjar, akta-belum-unggah", () => {
    const telepon: TeleponFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", tanggalDaftar: geser(-1), teleponLengkap: false, pihakDiperbarui: "" },
      { perkaraId: "b", nomorPerkara: "B", tanggalDaftar: HARI, teleponLengkap: true, pihakDiperbarui: HARI },
    ];
    const t = jalan("ptsp.data-umum-belum-lengkap", { telepon });
    expect([t.calon.map((c) => c.perkaraId), t.selesaiHariIni]).toEqual([["a"], 1]);

    const sisaPanjar: SisaPanjarFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", tanggalPutusan: geser(-30), saldo: 93000, keluarTerakhir: "", ambang: 1000 },
      { perkaraId: "b", nomorPerkara: "B", tanggalPutusan: geser(-30), saldo: 0, keluarTerakhir: HARI, ambang: 1000 },
    ];
    const s = jalan("ptsp.sisa-panjar", { sisaPanjar });
    expect([s.calon.map((c) => c.perkaraId), s.selesaiHariIni]).toEqual([["a"], 1]);

    const akta: AktaFakta[] = [
      { perkaraId: "a", nomorPerkara: "A", tanggalAkta: HARI, adaDok: false, diperbarui: HARI },
      { perkaraId: "b", nomorPerkara: "B", tanggalAkta: HARI, adaDok: true, diperbarui: HARI },
    ];
    const a = jalan("ptsp.akta-belum-unggah", { akta });
    expect([a.calon.map((c) => [c.perkaraId, c.tenggat?.tanggal]), a.selesaiHariIni]).toEqual([[["a", geser(1)]], 1]);
  });
});

// ============================================================================
describe("operator", () => {
  const segar = (ubah: Partial<EcourtDokumenFakta["segar"]> = {}) => ({
    terakhirBerhasil: "2026-09-10T00:00:00.000Z",
    terakhirDicoba: "",
    jadwalAktif: true,
    jarakJam: 2,
    jamMulai: 7,
    jamSelesai: 17,
    ...ubah,
  });

  it("sesi-ecourt: basi lebih dari 2x jarak jam pada jam kerja; segar atau di luar jam kerja diam", () => {
    // 10:00 WITA = 02:00Z; tarikan 00:00Z = 2 jam lalu -> segar.
    expect(jalan("operator.sesi-ecourt", { ecourt: segar() }).calon).toEqual([]);
    const basi = jalan("operator.sesi-ecourt", { ecourt: segar({ terakhirBerhasil: "2026-09-09T20:00:00.000Z" }) });
    expect(basi.calon.map((c) => c.kunci)).toEqual(["tarikan-basi"]);
    expect(jalan("operator.sesi-ecourt", { ecourt: segar({ terakhirBerhasil: "2026-09-09T20:00:00.000Z" }) }, { jam: "18:00:00" }).calon).toEqual([]);
    expect(jalan("operator.sesi-ecourt", { ecourt: segar({ jadwalAktif: false }) }).calon.map((c) => c.kunci)).toEqual(["jadwal-mati"]);
  });

  it("penetapan-gagal: satu butir per perkara dan jenis; susulan berhasil hari ini dihitung selesai", () => {
    const penetapanGagal: PenetapanGagalFakta[] = [
      { id: "1", waktu: "2026-09-10T01:00:00.000Z", jenis: "phs", perkaraId: "7", nomorPerkara: "N7", alasan: "x", berhasilSesudah: "" },
      { id: "2", waktu: "2026-09-10T01:05:00.000Z", jenis: "phs", perkaraId: "7", nomorPerkara: "N7", alasan: "y", berhasilSesudah: "" },
      { id: "3", waktu: "2026-09-09T01:00:00.000Z", jenis: "pmh", perkaraId: "8", nomorPerkara: "N8", alasan: "z", berhasilSesudah: "2026-09-10T02:00:00.000Z" },
    ];
    const h = jalan("operator.penetapan-gagal", { penetapanGagal });
    expect(h.calon.map((c) => c.kunci)).toEqual(["7:phs"]);
    expect(h.selesaiHariIni).toBe(1);
  });
});

// ============================================================================
describe("penyusun jawaban", () => {
  it("jenis tak tersedia dari katalog selalu disebut; koleksi yang gagal membuat jenisnya tak tersedia, bukan kosong", () => {
    const h = nilai("panitera-pengganti", { sidang: [], putusan: [], putusTanpaPutusan: [], saksi: [] }, { gagal: { sidang: "ETIMEDOUT" } });
    const tak = Object.fromEntries(h.jenisTidakTersedia.map((x) => [x.jenis, x.sebab]));
    expect(tak["panitera-pengganti.pbt-belum-diserahkan"]).toMatch(/tidak tercatat/);
    expect(tak["panitera-pengganti.bas-belum"]).toMatch(/sidang gagal dibaca/);
    expect(tak["panitera-pengganti.putusan-belum-unggah"]).toBeUndefined();
    expect(h.galat.join(" ")).toMatch(/ETIMEDOUT/);
  });

  it("bot mati: jenis berfakta SIPP tak tersedia, jenis ALETA tetap dinilai", () => {
    const antrean: AntreanChecklist[] = [
      { id: "1", perkaraId: "a", nomorPerkara: "A", jenis: "ppp", keadaan: "menunggu", disiapkanAt: "2026-09-10T01:00:00.000Z", dikerjakanAt: "" },
    ];
    const h = nilaiChecklist({
      peran: "panitera",
      konteks: konteks(),
      fakta: null,
      galatBot: "aleta_bot tidak merespons",
      gagalKoleksi: {},
      tambahan: { antrean, konsep: [] },
      sebabTakTertaut: "",
    });
    expect(h.butir.map((b) => b.jenis)).toEqual(["panitera.ppp-pjs-menunggu"]);
    expect(h.jenisTidakTersedia.find((x) => x.jenis === "panitera.bht-belum-diisi")?.sebab).toMatch(/tidak merespons/);
    expect(h.galat[0]).toMatch(/Fakta SIPP tidak terbaca/);
  });

  it("belum tertaut ke pejabat SIPP: jenis yang butuh perkara milik pengguna tak tersedia beserta sebabnya", () => {
    const h = nilaiChecklist({
      peran: "hakim",
      konteks: konteks(),
      fakta: {},
      gagalKoleksi: {},
      tambahan: { antrean: [], konsep: [] },
      sebabTakTertaut: "Akun ALETA Anda belum tertaut ke akun SIPP hakim.",
    });
    const tak = h.jenisTidakTersedia.map((x) => x.jenis);
    expect(tak).toContain("hakim.hasil-sidang-belum-dicatat");
    expect(tak).not.toContain("hakim.konsep-putusan");
  });

  it("ringkas menghitung seluruh butir walau daftar dipotong; totalHariIni = lewat + hari ini + selesai", () => {
    const arsip: ArsipFakta[] = Array.from({ length: BATAS_BUTIR_PER_JENIS + 5 }, (_, i) => ({
      perkaraId: `a${i}`,
      nomorPerkara: `${i + 1}/Pdt.G/2026/PA.Dgl`,
      tanggalBht: geser(-30 + i),
      arsipDiinput: "",
    }));
    arsip.push({ perkaraId: "selesai", nomorPerkara: "X", tanggalBht: geser(-3), arsipDiinput: HARI });
    const h = nilai("panitera", { arsip, putusan: [], sidangPanggilan: [], aktaHariIni: [] });
    const milik = h.butir.filter((b) => b.jenis === "panitera.arsip-bht");
    expect(milik).toHaveLength(BATAS_BUTIR_PER_JENIS + 1);
    expect(milik.at(-1)?.id).toBe("panitera.arsip-bht:lainnya");
    expect(milik.at(-1)?.perkara).toBeNull();
    expect(milik.at(-1)?.keterangan).toMatch(/dan 5 perkara lain/);
    expect(h.ringkas.lewat).toBe(BATAS_BUTIR_PER_JENIS + 5);
    expect(h.ringkas.selesaiHariIni).toBe(1);
    expect(h.ringkas.totalHariIni).toBe(h.ringkas.lewat + h.ringkas.hariIni + h.ringkas.selesaiHariIni);
  });

  it("urutan: lewat, hari ini, minggu ini; di dalamnya tenggat terdekat lebih dulu", () => {
    const h = nilai("panitera-pengganti", {
      sidang: [sidang({ sidangId: "ini", jabatanSaya: null, adaBas: false }), sidang({ sidangId: "kemarin", tanggalSidang: geser(-1), jabatanSaya: null })],
      putusan: [putusan({ perkaraId: "u", tanggalPutusan: HARI, adaDok: false })],
      putusTanpaPutusan: [],
      saksi: [],
    });
    const urutan = h.butir.map((b) => b.kelompok);
    const angka = { lewat: 0, "hari-ini": 1, "minggu-ini": 2 } as const;
    expect([...urutan].sort((a, b) => angka[a] - angka[b])).toEqual(urutan);
    for (const b of h.butir) {
      expect(Object.keys(b).sort()).toEqual(["id", "jenis", "judul", "kelompok", "kerjakan", "keterangan", "perkara", "tenggat"]);
    }
  });
});
