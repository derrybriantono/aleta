// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  type KeadaanPimpinan,
  type UsulanPenetapan,
  normalisasiUsulan,
  rakitRencana,
} from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { type AkunSiapPakai } from "@/server/modules/aleta-ecourt/pemetaan-jabatan";

/**
 * Perakit rencana kerja penetapan.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Ini otak yang memutuskan akun siapa untuk langkah apa. Salah di sini berarti
 * penetapan dikerjakan atas nama yang keliru - maka yang diuji paling keras:
 *
 *   - PMH memakai akun PIMPINAN, PPP/PJS memakai PANITERA, PHS memakai KETUA
 *     MAJELIS perkara itu - persis aturan yang berlaku,
 *
 *   - akun PHS ditandai TENTATIF, karena ketua majelis baru pasti setelah PMH
 *     tersimpan; tanda ini yang menyuruh ekstensi membacanya ulang,
 *
 *   - urutannya Data Umum -> PMH -> PPP -> PJS -> PHS, tak dapat dibalik,
 *
 *   - nilai yang belum pasti (panitera pengganti berpilihan, bentuk majelis
 *     belum tentu) TIDAK ditebak - dikosongkan dengan sebab yang terbaca,
 *
 *   - rencana tidak dinyatakan bisa dijalankan bila ada akun yang belum siap.
 */

const peta = (jenis: string, medan: Array<[string, string, string, number]>) =>
  medan.map(([m, penunjuk, j, wajib]) => ({ medan: m, penunjuk, jenis: j, wajib: Boolean(wajib) }));

const PETA_MEDAN: Record<string, ReturnType<typeof peta>> = {
  "data-umum": peta("data-umum", [["posita", "#posita", "kaya", 1]]),
  pmh: peta("pmh", [
    ["tgl_penetapan_majelis", "#tgl_penetapan_majelis", "tanggal", 1],
    ["pilihan_majelis", 'select[name="pilihan_majelis"]', "pilih", 1],
    ["hakim_ketua", "#hakim_ketua", "pilih", 1],
    ["hakim_anggota1", "#hakim_anggota1", "pilih", 0],
    ["hakim_anggota2", "#hakim_anggota2", "pilih", 0],
    ["hakim_tunggal", "#hakim_tunggal", "pilih", 0],
  ]),
  ppp: peta("ppp", [
    ["tgl_penunjukan_panitera", "#tgl_penunjukan_panitera", "tanggal", 1],
    ["panitera1", "#panitera1", "pilih", 1],
  ]),
  pjs: peta("pjs", [
    ["tgl_penunjukan_juru_sita", "#tgl_penunjukan_juru_sita", "tanggal", 1],
    ["juru_sita1", "#juru_sita1", "pilih", 1],
  ]),
  phs: peta("phs", [
    ["tgl_penetapan_sidang_pertama", "#tgl_penetapan_sidang_pertama", "tanggal", 1],
    ["tgl_sidang_pertama", "#tgl_sidang_pertama", "tanggal", 1],
  ]),
};

const akun = (
  username: string,
  pejabatId: string,
  jabatan: "hakim" | "panitera" | "jurusita",
  grup: string,
  peranAleta: string | null,
  siap = true,
  pemilikUserId: string | null = null
): AkunSiapPakai => ({
  pemilikUserId,
  username,
  namaLengkap: `${username} lengkap`,
  grup,
  pejabatId,
  kode: jabatan === "hakim" ? "B" : "",
  nama: username,
  nip: "",
  aktif: true,
  diblokir: false,
  kedaluwarsa: false,
  terakhirMasuk: "2026-09-03T00:00:00.000Z",
  jabatan,
  adaKredensial: siap,
  keadaanKredensial: siap ? "verified" : "not_tested",
  pemilikAleta: username,
  peranAleta,
  siap,
  sebabBelumSiap: siap ? "" : "Password belum pernah diuji.",
});

const AKUN_LENGKAP: AkunSiapPakai[] = [
  akun("fahri", "32", "hakim", "Ketua/Wakil Ketua", "ketua"),
  akun("sudarmin", "33", "hakim", "Ketua/Wakil Ketua", "wakil-ketua"),
  akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "panitera"),
];

function usulanMajelis(overrides: Partial<UsulanPenetapan> = {}): UsulanPenetapan {
  return {
    perkaraId: "10096",
    tanggalPenetapan: "2026-09-01",
    pmh: {
      bentuk: "majelis",
      majelisKode: "B",
      ketuaHakimId: "33", // sudarmin
      anggotaHakimId: ["28", "31"],
      sebab: "usulan smart majelis",
    },
    ppp: { paniteraId: "18", sebab: "panitera pengganti Majelis B menurut SK" },
    pjs: { jurusitaId: "22", nama: "Mohammad Syukri", dugaanBerhalangan: false, sebab: "giliran" },
    phs: { tanggalSidang: "2026-09-15", sebab: "hari sidang Majelis B" },
    // Bawaannya: PMH BELUM tersimpan. Itu keadaan perkara yang baru mendaftar,
    // dan di situlah pelaksana PHS memang belum dapat dipastikan.
    tercatat: { ada: false, ketuaHakimId: "", ketuaNama: "" },
    ...overrides,
  };
}

describe("akun tiap langkah", () => {
  it("PMH memakai akun pimpinan (peran ketua)", () => {
    const r = rakitRencana({ nomorPerkara: "545/Pdt.G/2026", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const pmh = r.langkah.find((l) => l.jenis === "pmh")!;
    expect(pmh.akun?.username).toBe("fahri");
    expect(pmh.akun?.tentatif).toBe(false);
  });

  it("PPP dan PJS memakai akun Panitera", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    expect(r.langkah.find((l) => l.jenis === "ppp")?.akun?.username).toBe("Sri Susilowati");
    expect(r.langkah.find((l) => l.jenis === "pjs")?.akun?.username).toBe("Sri Susilowati");
  });

  it("PHS memakai KETUA MAJELIS perkara itu, dan ditandai TENTATIF selama PMH belum tersimpan", () => {
    // Ketua majelis usulan = hakim_id 33 = sudarmin. Bukan fahri (pimpinan).
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const phs = r.langkah.find((l) => l.jenis === "phs")!;
    expect(phs.akun?.username).toBe("sudarmin");
    expect(phs.akun?.tentatif).toBe(true);
    expect(phs.catatan.join(" ")).toMatch(/dugaan dari usulan/i);
  });

  it("Data Umum tanpa akun - dikerjakan operator sendiri", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    expect(r.langkah.find((l) => l.jenis === "data-umum")?.akun).toBeNull();
  });
});

describe("siapa yang menandatangani PMH", () => {
  /**
   * Urutannya KETUA - WAKIL - PLH, dan itu bukan pilihan rancangan melainkan
   * praktik penunjukan yang berlaku:
   *
   *   - Wakil Ketua TIDAK perlu diangkat Plh. Jabatannya sejajar; ketika Ketua
   *     tidak hadir ia menandatangani sebagai Wakil Ketua. Menuntut SK Plh untuk
   *     itu berarti menuntut surat yang tidak pernah dibuat, dan penetapan
   *     berhenti menunggu surat yang tidak akan datang.
   *
   *   - Plh baru dipakai bila Ketua DAN Wakil sama-sama tidak ada. Yang ditunjuk
   *     biasanya Hakim; bila hakim pun tidak ada, barulah Panitera/Sekretaris.
   */
  const pmhDari = (akunPemetaan: AkunSiapPakai[], keadaan?: KeadaanPimpinan | null) =>
    rakitRencana({
      nomorPerkara: "545/Pdt.G/2026",
      usulan: usulanMajelis(),
      petaMedan: PETA_MEDAN,
      akunPemetaan,
      keadaanPimpinan: keadaan,
    }).langkah.find((l) => l.jenis === "pmh")!;

  const KETUA = akun("fahri", "32", "hakim", "Ketua/Wakil Ketua", "ketua", true, "usr-fahri");
  const WAKIL = akun("sudarmin", "33", "hakim", "Ketua/Wakil Ketua", "wakil-ketua", true, "usr-sudarmin");
  const HAKIM = akun("Himawan", "34", "hakim", "Hakim", "hakim", true, "usr-himawan");
  const PANITERA = akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "panitera", true, "usr-sri");
  const SEMUA = [KETUA, WAKIL, HAKIM, PANITERA];

  it("Ketua hadir: Ketua yang menandatangani", () => {
    const pmh = pmhDari(SEMUA);
    expect(pmh.akun?.username).toBe("fahri");
    expect(pmh.akun?.sebutan).toBe("Ketua Pengadilan");
  });

  it("Ketua cuti: WAKIL langsung, TANPA perlu SK Plh", () => {
    // Inilah perbaikannya. Sebelumnya Wakil hanya terpilih bila ada SK Plh atas
    // namanya - surat yang di praktiknya memang tidak pernah dibuat.
    const pmh = pmhDari(SEMUA, { sedangCuti: new Set(["usr-fahri"]) });
    expect(pmh.akun?.username).toBe("sudarmin");
    expect(pmh.akun?.sebutan).toBe("Wakil Ketua Pengadilan");
    expect(pmh.catatan.join(" ")).not.toMatch(/PLH/i);
  });

  it("Ketua dan Wakil cuti: barulah PLH yang dipakai, biasanya Hakim", () => {
    const pmh = pmhDari(SEMUA, {
      sedangCuti: new Set(["usr-fahri", "usr-sudarmin"]),
      penunjukan: { userId: "usr-himawan", tipe: "PLH" },
    });
    expect(pmh.akun?.username).toBe("Himawan");
    expect(pmh.akun?.sebutan).toBe("PLH Ketua Pengadilan");
  });

  it("tanpa Ketua, Wakil, dan Hakim: PLH boleh jatuh ke Panitera", () => {
    const pmh = pmhDari([KETUA, WAKIL, PANITERA], {
      sedangCuti: new Set(["usr-fahri", "usr-sudarmin"]),
      penunjukan: { userId: "usr-sri", tipe: "PLH" },
    });
    expect(pmh.akun?.username).toBe("Sri Susilowati");
    expect(pmh.akun?.sebutan).toBe("PLH Ketua Pengadilan");
  });

  it("SK PLH ada tetapi Ketua hadir: Ketua tetap menandatangani, SK-nya DISEBUT", () => {
    // Diam di sini membuat petugas mengira SK-nya tidak terbaca sistem lalu
    // membatalkannya; menurutinya membuat Ketua yang hadir tergeser oleh SK
    // lama yang lupa ditutup.
    const pmh = pmhDari(SEMUA, { penunjukan: { userId: "usr-himawan", tipe: "PLH" } });
    expect(pmh.akun?.username).toBe("fahri");
    expect(pmh.catatan.join(" ")).toMatch(/tidak dipakai karena pimpinan definitif/i);
  });

  it("Ketua dan Wakil cuti tanpa PLH: menyuruh menerbitkan PLH, bukan diam", () => {
    const pmh = pmhDari(SEMUA, { sedangCuti: new Set(["usr-fahri", "usr-sudarmin"]) });
    expect(pmh.catatan.join(" ")).toMatch(/Terbitkan PLH lebih dulu/i);
  });

  it("akun Ketua diblokir diperlakukan sama dengan tidak ada: Wakil yang menandatangani", () => {
    const pmh = pmhDari([{ ...KETUA, diblokir: true }, WAKIL, PANITERA]);
    expect(pmh.akun?.username).toBe("sudarmin");
    expect(pmh.akun?.sebutan).toBe("Wakil Ketua Pengadilan");
  });

  it("cuti yang belum disetujui tidak memindahkan tanda tangan", () => {
    // Dijaga di pembacaannya (status = approved); di sini dipastikan bahwa
    // tanpa penanda cuti, Ketua tetap yang menandatangani.
    const pmh = pmhDari(SEMUA, { sedangCuti: new Set() });
    expect(pmh.akun?.username).toBe("fahri");
  });
});

describe("siapa yang menandatangani PPP dan PJS", () => {
  /**
   * Rantainya PANITERA - PLH, tanpa perantara, dan pendeknya disengaja.
   *
   * Ketua punya Wakil yang jabatannya sejajar; Panitera TIDAK. Panitera Muda
   * dan Panitera Pengganti bukan wakilnya - mereka jabatan lain, dan tidak satu
   * pun dengan sendirinya berwenang menandatangani PPP ketika Panitera
   * berhalangan. Karena itu di sini yang dijaga paling keras justru KEBALIKAN
   * dari rantai pimpinan: bahwa ALETA TIDAK menggeser tanda tangan ke pegawai
   * kepaniteraan mana pun tanpa SK.
   */
  const pppDari = (akunPemetaan: AkunSiapPakai[], keadaan?: KeadaanPimpinan | null) =>
    rakitRencana({
      nomorPerkara: "545/Pdt.G/2026",
      usulan: usulanMajelis(),
      petaMedan: PETA_MEDAN,
      akunPemetaan,
      keadaanPanitera: keadaan,
    }).langkah.find((l) => l.jenis === "ppp")!;

  const KETUA = akun("fahri", "32", "hakim", "Ketua/Wakil Ketua", "ketua", true, "usr-fahri");
  const PANITERA = akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "panitera", true, "usr-sri");
  const PANMUD = akun("Nurhayati", "27", "panitera", "Panitera/Wakil Panitera", "panitera-muda", true, "usr-nur");
  const SEMUA = [KETUA, PANITERA, PANMUD];

  it("Panitera hadir: Panitera yang menandatangani", () => {
    const ppp = pppDari(SEMUA);
    expect(ppp.akun?.username).toBe("Sri Susilowati");
    expect(ppp.akun?.sebutan).toBe("Panitera");
  });

  it("Panitera cuti dengan PLH tercatat: PLH yang menandatangani", () => {
    const ppp = pppDari(SEMUA, {
      sedangCuti: new Set(["usr-sri"]),
      penunjukan: { userId: "usr-nur", tipe: "PLH" },
    });
    expect(ppp.akun?.username).toBe("Nurhayati");
    expect(ppp.akun?.sebutan).toBe("PLH Panitera");
  });

  it("Panitera cuti TANPA PLH: TIDAK digeser ke Panitera Muda, dan disuruh terbitkan PLH", () => {
    // Inti penjagaannya. Panitera Muda ada, punya akun SIPP hidup, dan hadir -
    // tetapi tidak pernah ditunjuk. Menggesernya ke sana berarti ALETA
    // mengarang kewenangan, dan penetapannya tetap tercatat di SIPP.
    const ppp = pppDari(SEMUA, { sedangCuti: new Set(["usr-sri"]) });
    expect(ppp.akun?.username).not.toBe("Nurhayati");
    expect(ppp.catatanPenetap.join(" ")).toMatch(/belum ada PLH Panitera yang tercatat/i);
    expect(ppp.catatanPenetap.join(" ")).toMatch(/Terbitkan PLH lebih dulu/i);
  });

  it("SK PLH ada tetapi Panitera hadir: Panitera tetap, SK-nya DISEBUT", () => {
    const ppp = pppDari(SEMUA, { penunjukan: { userId: "usr-nur", tipe: "PLH" } });
    expect(ppp.akun?.username).toBe("Sri Susilowati");
    expect(ppp.catatanPenetap.join(" ")).toMatch(/tidak dipakai karena Panitera masih dapat menandatangani/i);
  });

  it("PLH Panitera dijalankan orang di luar kepaniteraan: dipakai, tetapi disebutkan", () => {
    // SK-nya sah - yang menentukan kewenangan memang SK, bukan tabel tempat
    // akunnya terdaftar. Yang perlu diketahui petugas: formulirnya belum tentu
    // terbuka pada akun itu.
    const ppp = pppDari([KETUA, PANITERA], {
      sedangCuti: new Set(["usr-sri"]),
      penunjukan: { userId: "usr-fahri", tipe: "PLT" },
    });
    expect(ppp.akun?.username).toBe("fahri");
    expect(ppp.akun?.sebutan).toBe("PLT Panitera");
    expect(ppp.catatanPenetap.join(" ")).toMatch(/bukan pengguna kepaniteraan/i);
  });

  it("PLH tercatat tetapi orangnya tidak punya akun SIPP: sebabnya terbaca", () => {
    const ppp = pppDari([KETUA, PANITERA], {
      sedangCuti: new Set(["usr-sri"]),
      penunjukan: { userId: "usr-entah", tipe: "PLH" },
    });
    expect(ppp.catatanPenetap.join(" ")).toMatch(/belum punya akun SIPP yang terpakai/i);
  });

  it("PJS memakai penetap yang sama dengan PPP", () => {
    const r = rakitRencana({
      nomorPerkara: "545",
      usulan: usulanMajelis(),
      petaMedan: PETA_MEDAN,
      akunPemetaan: SEMUA,
      keadaanPanitera: { sedangCuti: new Set(["usr-sri"]), penunjukan: { userId: "usr-nur", tipe: "PLH" } },
    });
    const pjs = r.langkah.find((l) => l.jenis === "pjs")!;
    expect(pjs.akun?.username).toBe("Nurhayati");
    expect(pjs.akun?.sebutan).toBe("PLH Panitera");
  });

  it("penunjukan Ketua TIDAK menjadikan siapa pun PLH Panitera", () => {
    // Dua SK yang berbeda untuk dua jabatan yang berbeda. Mencampurnya berarti
    // satu SK memindahkan dua tanda tangan sekaligus.
    const r = rakitRencana({
      nomorPerkara: "545",
      usulan: usulanMajelis(),
      petaMedan: PETA_MEDAN,
      akunPemetaan: SEMUA,
      keadaanPimpinan: { sedangCuti: new Set(["usr-fahri"]), penunjukan: { userId: "usr-nur", tipe: "PLH" } },
      keadaanPanitera: { sedangCuti: new Set(["usr-fahri"]) },
    });
    expect(r.langkah.find((l) => l.jenis === "ppp")?.akun?.username).toBe("Sri Susilowati");
    expect(r.langkah.find((l) => l.jenis === "ppp")?.akun?.sebutan).toBe("Panitera");
  });

  it("kredensial yang belum ditautkan ke pengguna ALETA tetap berjalan seperti dulu", () => {
    // Pemasangan lama tidak punya peran sama sekali. Menuntutnya di situ akan
    // mematikan PPP/PJS yang selama ini berjalan.
    const tanpaPeran = [akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", null)];
    const ppp = pppDari(tanpaPeran);
    expect(ppp.akun?.username).toBe("Sri Susilowati");
    expect(ppp.akun?.sebutan).toBe("Panitera");
  });

  it("akun Panitera diblokir diperlakukan sama dengan tidak ada", () => {
    const ppp = pppDari([{ ...PANITERA, diblokir: true }, PANMUD], {
      penunjukan: { userId: "usr-nur", tipe: "PLH" },
    });
    expect(ppp.akun?.username).toBe("Nurhayati");
    expect(ppp.akun?.sebutan).toBe("PLH Panitera");
  });

  it("akun Panitera diblokir TANPA PLH: tidak jatuh ke akun kepaniteraan mana pun", () => {
    // Persis cara pemilihan yang lama menggeser tanda tangan tanpa SK: akun
    // Panitera diblokir karena mutasi, lalu akun kepaniteraan pertama yang
    // ketemu dipakai diam-diam.
    const r = rakitRencana({
      nomorPerkara: "545",
      usulan: usulanMajelis(),
      petaMedan: PETA_MEDAN,
      akunPemetaan: [KETUA, { ...PANITERA, diblokir: true }, PANMUD],
    });
    const ppp = r.langkah.find((l) => l.jenis === "ppp")!;
    expect(ppp.akun).toBeNull();
    expect(ppp.catatanPenetap.join(" ")).toMatch(/diblokir atau kedaluwarsa/i);
    expect(r.bisaDijalankan).toBe(false);
  });

  it("peran pemilik kredensial bukan panitera: dipakai apa adanya, seperti dulu", () => {
    // Keadaan yang benar-benar berjalan di pemasangan: kredensial SIPP Panitera
    // disimpan pengguna ALETA yang perannya lain - operator, admin, sekretaris.
    // Tidak ada satu pun akun yang tertaut sebagai Panitera, jadi penautannya
    // memang belum ada untuk dibaca. Menahan PPP/PJS di situ berarti mematikan
    // yang selama ini berjalan.
    const lain = [akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "super-admin", true, "usr-super")];
    const ppp = pppDari(lain);
    expect(ppp.akun?.username).toBe("Sri Susilowati");
    expect(ppp.akun?.sebutan).toBe("Panitera");
  });
});

describe("pelaksana PHS sesudah PMH tersimpan", () => {
  /**
   * PHS dikerjakan ketua majelis perkara itu, dengan akunnya sendiri. Sampai
   * PMH tersimpan, ketuanya BELUM ADA - yang ada baru usulan, dan usulan boleh
   * berubah: majelisnya diganti sebelum ditetapkan, hakimnya berhalangan, isbat
   * terpadu memakai susunan lain.
   *
   * Karena itu yang dijaga di sini: begitu perkara_hakim_pn terisi, dari
   * sanalah pelaksananya dibaca - dan selisih terhadap usulan TERBACA, bukan
   * lewat diam-diam.
   */
  const phsDari = (tercatat: UsulanPenetapan["tercatat"]) =>
    rakitRencana({
      nomorPerkara: "545",
      usulan: usulanMajelis({ tercatat }),
      petaMedan: PETA_MEDAN,
      akunPemetaan: AKUN_LENGKAP,
    }).langkah.find((l) => l.jenis === "phs")!;

  it("majelis tercatat: pelaksananya dari situ, dan TIDAK lagi tentatif", () => {
    // Yang tercatat fahri (32), sementara usulannya sudarmin (33).
    const phs = phsDari({ ada: true, ketuaHakimId: "32", ketuaNama: "Fahri Saifuddin" });
    expect(phs.akun?.username).toBe("fahri");
    expect(phs.akun?.tentatif).toBe(false);
  });

  it("selisih antara yang ditetapkan dan yang diusulkan TERBACA", () => {
    // Penetapan yang menyimpang dari smart majelis memang terjadi dan sah -
    // isbat terpadu, sidang keliling, hakim berhalangan. Yang tidak boleh
    // adalah selisihnya lewat tanpa disebutkan.
    const phs = phsDari({ ada: true, ketuaHakimId: "32", ketuaNama: "Fahri Saifuddin" });
    expect(phs.catatanPenetap.join(" ")).toMatch(/berbeda dari usulan/i);
    expect(phs.catatanPenetap.join(" ")).toMatch(/dibaca dari majelis yang tercatat/i);
  });

  it("tercatat sama dengan usulan: tidak ada peringatan selisih", () => {
    const phs = phsDari({ ada: true, ketuaHakimId: "33", ketuaNama: "Sudarmin" });
    expect(phs.akun?.username).toBe("sudarmin");
    expect(phs.catatanPenetap.join(" ")).not.toMatch(/berbeda dari usulan/i);
  });

  it("ketua tercatat tanpa akun SIPP: disebut hakim_id-nya, bukan diganti usulan", () => {
    const phs = phsDari({ ada: true, ketuaHakimId: "99", ketuaNama: "Hakim Pindahan" });
    expect(phs.akun).toBeNull();
    expect(phs.catatan.join(" ")).toMatch(/hakim_id 99/);
  });

  it("bot lama yang belum mengirim bagian tercatat: kembali tentatif", () => {
    // normalisasiUsulan mengisi tercatat.ada = false, dan yang benar di situ
    // adalah menandai dugaan - bukan memakai usulan seolah sudah pasti.
    const usulan = normalisasiUsulan({
      ok: true,
      perkaraId: "10096",
      tanggalPenetapan: "2026-09-01",
      pmh: { bentuk: "majelis", majelisKode: "B", anggota: [{ hakimId: 33 }] },
    })!;
    expect(usulan.tercatat.ada).toBe(false);
    const phs = rakitRencana({
      nomorPerkara: "545",
      usulan,
      petaMedan: PETA_MEDAN,
      akunPemetaan: AKUN_LENGKAP,
    }).langkah.find((l) => l.jenis === "phs")!;
    expect(phs.akun?.tentatif).toBe(true);
  });

  it("hakim_id 0 dari bot dibaca sebagai belum tercatat, bukan sebagai hakim", () => {
    const usulan = normalisasiUsulan({
      ok: true,
      perkaraId: "10096",
      pmh: { bentuk: "majelis", anggota: [{ hakimId: 33 }] },
      tercatat: { ada: true, ketuaHakimId: 0, ketuaNama: "" },
    })!;
    expect(usulan.tercatat.ada).toBe(false);
    expect(usulan.tercatat.ketuaHakimId).toBe("");
  });
});

describe("urutan", () => {
  it("selalu Data Umum -> PMH -> PPP -> PJS -> PHS", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    expect(r.langkah.map((l) => l.jenis)).toEqual(["data-umum", "pmh", "ppp", "pjs", "phs"]);
    expect(r.langkah.map((l) => l.urutan)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("mengisi nilai dari usulan", () => {
  it("PMH majelis mengisi ketua dan anggota, bukan hakim tunggal", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const medan = new Map(r.langkah.find((l) => l.jenis === "pmh")!.medan.map((m) => [m.medan, m]));
    expect(medan.get("pilihan_majelis")?.nilai).toBe("majelis");
    expect(medan.get("hakim_ketua")?.nilai).toBe("33");
    expect(medan.get("hakim_anggota1")?.nilai).toBe("28");
    expect(medan.get("hakim_anggota2")?.nilai).toBe("31");
    expect(medan.get("hakim_tunggal")?.nilai).toBe(""); // tidak dipakai
  });

  it("PMH tunggal mengisi hakim_tunggal, bukan ketua/anggota", () => {
    const u = usulanMajelis({
      pmh: { bentuk: "tunggal", majelisKode: "C3", ketuaHakimId: "31", anggotaHakimId: [], sebab: "nilai di bawah ambang" },
    });
    const r = rakitRencana({ nomorPerkara: "545", usulan: u, petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const medan = new Map(r.langkah.find((l) => l.jenis === "pmh")!.medan.map((m) => [m.medan, m]));
    expect(medan.get("pilihan_majelis")?.nilai).toBe("tunggal");
    expect(medan.get("hakim_tunggal")?.nilai).toBe("31");
    expect(medan.get("hakim_ketua")?.nilai).toBe("");
  });

  it("PHS mengisi tanggal sidang dari usulan", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const medan = new Map(r.langkah.find((l) => l.jenis === "phs")!.medan.map((m) => [m.medan, m]));
    expect(medan.get("tgl_sidang_pertama")?.nilai).toBe("2026-09-15");
    expect(medan.get("tgl_penetapan_sidang_pertama")?.nilai).toBe("2026-09-01");
  });

  it("tiap nilai membawa asal-usulnya", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const ketua = r.langkah.find((l) => l.jenis === "pmh")!.medan.find((m) => m.medan === "hakim_ketua")!;
    expect(ketua.asal).toMatch(/Ketua Majelis B/);
  });
});

describe("tidak menebak yang belum pasti", () => {
  it("panitera pengganti berpilihan dikosongkan dengan sebab", () => {
    const u = usulanMajelis({ ppp: { paniteraId: "", sebab: "kode panitera majelis ini belum diatur" } });
    const r = rakitRencana({ nomorPerkara: "545", usulan: u, petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    const p1 = r.langkah.find((l) => l.jenis === "ppp")!.medan.find((m) => m.medan === "panitera1")!;
    expect(p1.nilai).toBe("");
    expect(p1.asal).toMatch(/belum diatur/);
  });

  it("bentuk majelis belum tentu menghalangi keseluruhan", () => {
    const u = usulanMajelis({
      pmh: { bentuk: "belum-tentu", majelisKode: "", ketuaHakimId: "", anggotaHakimId: [], sebab: "nilai sengketa belum diisi" },
    });
    const r = rakitRencana({ nomorPerkara: "545", usulan: u, petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    expect(r.bisaDijalankan).toBe(false);
    expect(r.halangan.join(" ")).toMatch(/belum tentu/i);
  });
});

describe("gerbang kesiapan", () => {
  it("bisa dijalankan bila semua akun siap dan peta lengkap", () => {
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: AKUN_LENGKAP });
    expect(r.bisaDijalankan).toBe(true);
    expect(r.halangan).toEqual([]);
  });

  it("akun pimpinan yang belum teruji menghalangi", () => {
    const akunBelum = [
      akun("fahri", "32", "hakim", "Ketua/Wakil Ketua", "ketua", false),
      akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "panitera"),
    ];
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: akunBelum });
    expect(r.bisaDijalankan).toBe(false);
    expect(r.halangan.join(" ")).toMatch(/fahri belum siap/i);
  });

  it("akun PHS tentatif yang belum siap TIDAK menghalangi perakitan", () => {
    // PHS diperiksa ulang saat jalan; ketidaksiapannya sekarang bukan halangan.
    const akunPhsBelum = [
      akun("fahri", "32", "hakim", "Ketua/Wakil Ketua", "ketua"),
      akun("sudarmin", "33", "hakim", "Ketua/Wakil Ketua", "wakil-ketua", false),
      akun("Sri Susilowati", "26", "panitera", "Panitera/Wakil Panitera", "panitera"),
    ];
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: PETA_MEDAN, akunPemetaan: akunPhsBelum });
    // sudarmin (PHS) belum siap, tetapi tentatif -> bukan halangan
    expect(r.halangan.join(" ")).not.toMatch(/sudarmin/i);
  });

  it("peta kolom kosong untuk satu borang menghalangi", () => {
    const petaKurang = { ...PETA_MEDAN, pmh: [] };
    const r = rakitRencana({ nomorPerkara: "545", usulan: usulanMajelis(), petaMedan: petaKurang, akunPemetaan: AKUN_LENGKAP });
    expect(r.bisaDijalankan).toBe(false);
    expect(r.halangan.join(" ")).toMatch(/Peta kolom Penetapan Majelis Hakim/i);
  });
});

describe("normalisasiUsulan", () => {
  it("mengubah jawaban bot yang longgar menjadi bentuk pasti", () => {
    const raw = {
      ok: true,
      perkaraId: "10096",
      tanggalPenetapan: "2026-09-01",
      pmh: { bentuk: "majelis", majelisKode: "B", anggota: [{ hakimId: "33" }, { hakimId: "28" }, { hakimId: "31" }], sebab: "smart" },
      ppp: { usulan: { paniteraId: "18", nama: "Munifa" }, sebab: "giliran" },
      pjs: { usulan: { jurusitaId: "22", nama: "Syukri", dugaanBerhalangan: false }, sebab: "giliran" },
      phs: { usulan: "2026-09-15", sebab: "hari B" },
    };
    const u = normalisasiUsulan(raw)!;
    expect(u.pmh.ketuaHakimId).toBe("33");
    expect(u.pmh.anggotaHakimId).toEqual(["28", "31"]);
    expect(u.ppp.paniteraId).toBe("18"); // dari usulan giliran panitera
    expect(u.pjs.jurusitaId).toBe("22");
    expect(u.phs.tanggalSidang).toBe("2026-09-15");
  });

  it("panitera diisi dari usulan GILIRAN, bukan dari daftar calon", () => {
    // Panitera bergilir seperti juru sita: yang diisi adalah pilihan giliran
    // (paling sedikit beban), bukan hasil menebak dari daftar calon.
    const raw = {
      ok: true, perkaraId: "1", tanggalPenetapan: "2026-09-01",
      pmh: { bentuk: "majelis", majelisKode: "B", anggota: [{ hakimId: "33" }], sebab: "" },
      ppp: { usulan: { paniteraId: "26", nama: "Sri Susilowati" }, calon: [{}, {}, {}], sebab: "giliran" },
      pjs: {}, phs: {},
    };
    expect(normalisasiUsulan(raw)!.ppp.paniteraId).toBe("26");
  });

  it("panitera kosong bila giliran tak terbaca", () => {
    const raw = {
      ok: true, perkaraId: "1", tanggalPenetapan: "2026-09-01",
      pmh: { bentuk: "majelis", majelisKode: "B", anggota: [{ hakimId: "33" }], sebab: "" },
      ppp: { usulan: null, sebab: "seluruh panitera aktif ditampilkan" },
      pjs: {}, phs: {},
    };
    expect(normalisasiUsulan(raw)!.ppp.paniteraId).toBe("");
  });

  it("jawaban gagal dijawab null", () => {
    expect(normalisasiUsulan({ ok: false })).toBeNull();
    expect(normalisasiUsulan(null)).toBeNull();
  });
});
