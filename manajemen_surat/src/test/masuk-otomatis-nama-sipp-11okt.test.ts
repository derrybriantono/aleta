// @vitest-environment node
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cocokkanPegawaiSipp,
  kataIntiNama,
  kunciNama,
  nipAkunAleta,
  type AkunAletaCalon,
  type PegawaiSipp,
} from "@/lib/nama-pegawai-sipp";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { DDL_TAUTAN_SIPP_SUMBER } from "@/server/db/schema";
import { bacaKredensialSipp, type KredensialSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { akunSippMilik } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import {
  getExternalCredentialSummariesForUser,
  tinjauTautanSipp,
  tulisTautanSippOtomatis,
  upsertExternalCredentialsForUser,
} from "@/server/modules/external-apps/service";
import { kosongkanBatasMasukSipp, putuskanMasukSipp, type DepsMasukSipp } from "@/server/modules/portal/masuk-sipp";
import {
  nilaiCookieSesiSipp,
  pilihAkunAletaUntukSipp,
  putuskanMasukDariSesiSipp,
  putuskanTautkanSesiSipp,
  type BahanPilih,
  type BarisJejakSesi,
  type DepsMasukSesi,
  type JawabanSesiSipp,
} from "@/server/modules/portal/masuk-sipp-nama";

/**
 * ============================================================================
 * MASUK OTOMATIS DARI SIPP KE ALETA + PENCOCOKAN NAMA (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "aleta belum bisa deteksi akun sipp nya di aleta, coba
 * kamu samakan atau cocokkan dengan nama di sipp". Yang diuji di sini PERILAKU:
 *
 *   A. normalisasi & pencocokan nama/NIP (lib/nama-pegawai-sipp.ts) - contoh
 *      diambil dari data nyata 9 Okt (gelar, ejaan, NIP salah ketik);
 *   B. cookie sesi SIPP dibuka bot dengan langkah CI2 (HMAC + Rijndael-256),
 *      ditolak bila dipalsukan/kedaluwarsa/peramban lain/belum masuk;
 *   C. pemilih akun ALETA (tautan > NIP > nama tunggal) dan penjaganya;
 *   D. keputusan masuk dari sesi SIPP dan tautkan manual;
 *   E. layar masuk ALETA: username + password SIPP tanpa tautan;
 *   F. basis data: tautan tertulis tanpa password, tidak menimpa, tampil di
 *      Manajemen Akun, ditinjau Admin; migrasi 0062 = DDL skema.
 *
 * Seluruh password/kunci di sini PALSU.
 */

const AKAR_BOT = path.resolve(process.cwd(), "..", "aleta_bot");
const muatBot = createRequire(path.join(AKAR_BOT, "services", "x.js"));

// ============================================================================
// A. NAMA
// ============================================================================

describe("A. kunci nama: gelar, tanda baca, ejaan", () => {
  it("gelar depan/belakang dan koma dibuang; urutan kata tetap", () => {
    expect(kataIntiNama("Dra. Hj. Munifa, S.H.I., M.H.")).toEqual(["munifa"]);
    expect(kataIntiNama("FAHRI SAIFUDDIN, S.H.I., M.H.")).toEqual(["fahri", "saifudin"]);
    expect(kataIntiNama("Drs. H. Karmin, M.H.")).toEqual(["karmin"]);
    expect(kataIntiNama("Muh. Idris S.H.")).toEqual(["muhamad", "idris"]);
    expect(kataIntiNama("Uji ALETA - Super Admin (lokal)")).toEqual(["uji", "aleta", "super", "admin"]);
  });

  it("inisial bertitik di tengah nama tetap bagian nama (Sudarmin H.I.M. Tang)", () => {
    expect(kunciNama("SUDARMIN H.I.M. TANG, S.H.I.,M.H")).toBe(kunciNama("Sudarmin H.I.M. Tang, S.H.I.,M.H"));
    expect(kunciNama("SUDARMIN H.I.M. TANG")).not.toBe(kunciNama("Sudarmin Tang"));
  });

  it("ejaan nama Arab & ejaan lama dilipat; spasi rapat", () => {
    expect(kunciNama("MOHAMMAD SYUKRI, S.H.")).toBe(kunciNama("Muhammad Syukri"));
    expect(kunciNama("Mochammad Syukri")).toBe(kunciNama("Muh. Syukri"));
    expect(kunciNama("Sitti Nurhidayah, S.H.I., M.H")).toBe(kunciNama("Siti Nur Hidayah"));
    expect(kunciNama("Achmad Rachman")).toBe(kunciNama("Ahmad Rahman"));
    expect(kunciNama("Abd. Rahman")).toBe(kunciNama("Abdul Rahman"));
    expect(kunciNama("Soekarno")).toBe(kunciNama("Sukarno"));
    expect(kunciNama("QADARIYAH, S.H.")).toBe(kunciNama("Kadariyah"));
    expect(kunciNama("MUHAMMAD RIFA`I, S.H.")).toBe(kunciNama("Muhammad Rifai"));
    expect(kunciNama("TANTY RESTIANTY")).toBe(kunciNama("Tanti Restianti"));
  });

  it("SAMA, bukan mirip: sebagian kata tidak cocok", () => {
    expect(kunciNama("Idris, S.H.I., M.H.")).not.toBe(kunciNama("Muh. Idris"));
    expect(kunciNama("Tiffany RS")).not.toBe(kunciNama("Tiffany Rachmawati Suranto"));
  });

  it("NIP akun ALETA dari kolom nip atau dari id usr-<satker>-<NIP>", () => {
    expect(nipAkunAleta({ id: "usr-donggala-197309012003122001", nip: "" })).toBe("197309012003122001");
    expect(nipAkunAleta({ id: "usr-x", nip: "1973 0901 2003 12 2001" })).toBe("197309012003122001");
    expect(nipAkunAleta({ id: "usr-x", nip: "-" })).toBe("");
  });
});

const akun = (id: string, name: string, roleId = "panitera-pengganti", nip: string | null = null, isActive = true): AkunAletaCalon => ({
  id,
  name,
  roleId,
  nip,
  isActive,
});
const pegawai = (username: string, namaLengkap: string, pejabat: PegawaiSipp["pejabat"] = [], sippUserId = "70"): PegawaiSipp => ({
  sippUserId,
  username,
  namaLengkap,
  pejabat,
});

describe("A. cocokkanPegawaiSipp: tunggal = yakin, selebihnya tidak", () => {
  const daftar = [
    akun("usr-a", "ANDINI PUSPITA SARI, S.Sy.", "panitera-pengganti", "198906242011012009"),
    akun("usr-b", "MUNIFA, S.H.", "panitera-pengganti", "197309012003122001"),
    akun("usr-c1", "SRI WAHYUNI, S.H."),
    akun("usr-c2", "Sri Wahyuni"),
    akun("usr-off", "NON AKTIF ORANG", "staf", null, false),
  ];

  it("nama bergelar berbeda tetap cocok tunggal", () => {
    expect(cocokkanPegawaiSipp(pegawai("andini", "Andini Puspita Sari"), daftar)).toMatchObject({ jenis: "yakin", userId: "usr-a", dasar: "nama" });
  });

  it("NIP sama menguatkan (nama+nip); NIP berbeda MEMBANTAH walau nama sama (Munifa 9 Okt: ...2001 vs ...2003)", () => {
    expect(
      cocokkanPegawaiSipp(pegawai("andini", "Andini Puspita Sari", [{ jabatan: "panitera", nama: "Andini Puspita Sari", nip: "198906242011012009" }]), daftar)
    ).toMatchObject({ jenis: "yakin", userId: "usr-a", dasar: "nama+nip" });
    expect(
      cocokkanPegawaiSipp(pegawai("munifa,SH.", "Munifa, S.H.", [{ jabatan: "panitera", nama: "Munifa", nip: "197309012003122003" }]), daftar)
    ).toEqual({ jenis: "tidak-cocok" });
  });

  it("NIP sama walau ejaan nama jauh berbeda = yakin lewat NIP", () => {
    expect(
      cocokkanPegawaiSipp(pegawai("x", "Andin P. S.", [{ jabatan: "panitera", nama: "Andin P", nip: "198906242011012009" }]), daftar)
    ).toMatchObject({ jenis: "yakin", userId: "usr-a", dasar: "nip" });
  });

  it("nama ganda tidak dipilihkan", () => {
    expect(cocokkanPegawaiSipp(pegawai("sri", "Sri Wahyuni, S.H."), daftar)).toEqual({ jenis: "ganda", calon: ["usr-c1", "usr-c2"] });
  });

  it("akun ALETA nonaktif bukan calon; nama terlalu pendek tidak dipakai", () => {
    expect(cocokkanPegawaiSipp(pegawai("x", "Non Aktif Orang"), daftar)).toEqual({ jenis: "tidak-cocok" });
    expect(cocokkanPegawaiSipp(pegawai("x", "IT"), [akun("u", "IT")])).toEqual({ jenis: "tidak-cocok" });
  });
});

// ============================================================================
// B. COOKIE SESI SIPP (bot)
// ============================================================================

type LayananTautan = {
  bukaCookieSesiSipp: (nilai: string, bahan?: unknown) => { ok: boolean; sebab?: string; serial?: string; kedaluwarsaDetik?: number };
  _uji: {
    bahanDariKunci: (b: Buffer) => unknown;
    encodeCi: (teks: string, bahan: unknown) => string;
    kedaluwarsaSesiDariConfig: (isi: string) => number;
  };
};
type LayananSesi = {
  uraiSerialPhp: (t: string) => unknown;
  periksaIsiSesi: (serial: string, o: { userAgent: string; kini?: number; kedaluwarsaDetik?: number }) => Record<string, unknown>;
  nilaiCookieSesi: (k: string) => string[];
};
const tautan = muatBot("./sippTautanService.js") as LayananTautan;
const sesi = muatBot("./sesiSippService.js") as LayananSesi;

const KUNCI_UJI = "kunci-uji-palsu-SIPP-11okt";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141 UjiAleta";

/** serialize() PHP secukupnya (string/int/bool/array datar). */
function serialPhp(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "N;";
  if (typeof nilai === "boolean") return `b:${nilai ? 1 : 0};`;
  if (typeof nilai === "number") return `i:${nilai};`;
  if (typeof nilai === "string") return `s:${Buffer.byteLength(nilai, "utf8")}:"${nilai}";`;
  const isi = Object.entries(nilai as Record<string, unknown>);
  return `a:${isi.length}:{${isi.map(([k, v]) => serialPhp(k) + serialPhp(v)).join("")}}`;
}

/** Cookie ci_session seperti Session::_set_cookie SIPP (encrypt + HMAC + urlencode). */
function cookieSipp(data: Record<string, unknown>, kunci = KUNCI_UJI) {
  const bahan = tautan._uji.bahanDariKunci(Buffer.from(kunci, "latin1"));
  const sandi = tautan._uji.encodeCi(Buffer.from(serialPhp(data), "utf8").toString("latin1"), bahan);
  const tanda = crypto.createHmac("sha1", Buffer.from(kunci, "latin1")).update(sandi).digest("hex");
  return { nilai: encodeURIComponent(sandi + tanda), bahan };
}

const kini = Math.floor(Date.now() / 1000);
const sesiPp = {
  session_id: "a".repeat(32),
  ip_address: "10.0.0.5",
  user_agent: UA,
  last_activity: kini - 60,
  fullname: "Andini Puspita Sari, S.Sy.",
  username: "andini",
  userid: "67",
  is_logged_in: true,
  login_time: "2026-10-11 08:00:00",
};

describe("B. cookie sesi SIPP dibuka dengan langkah CodeIgniter 2 SIPP", () => {
  it("cookie sah: terbuka, isinya lolos pemeriksaan sess_read", () => {
    const { nilai, bahan } = cookieSipp(sesiPp);
    const buka = tautan.bukaCookieSesiSipp(nilai, bahan);
    expect(buka.ok).toBe(true);
    const isi = sesi.periksaIsiSesi(String(buka.serial), { userAgent: UA, kedaluwarsaDetik: 3600 });
    expect(isi).toMatchObject({ terbukti: true, sippUserId: "67", username: "andini", namaLengkap: "Andini Puspita Sari, S.Sy." });
  });

  it("satu huruf diubah / kunci lain: tanda HMAC ditolak (teks halaman tidak pernah jadi bukti)", () => {
    const { nilai, bahan } = cookieSipp(sesiPp);
    const mentah = decodeURIComponent(nilai);
    const rusak = encodeURIComponent((mentah[5] === "A" ? "B" : "A") + mentah.slice(1).replace(/^./, (h) => h));
    expect(tautan.bukaCookieSesiSipp(encodeURIComponent(mentah.slice(0, 5) + (mentah[5] === "A" ? "B" : "A") + mentah.slice(6)), bahan).sebab).toBe("tanda_tidak_sah");
    expect(tautan.bukaCookieSesiSipp(rusak, bahan).ok).toBe(false);
    const lain = cookieSipp(sesiPp, "kunci-orang-lain");
    expect(tautan.bukaCookieSesiSipp(lain.nilai, bahan).sebab).toBe("tanda_tidak_sah");
    expect(tautan.bukaCookieSesiSipp("pendek", bahan).sebab).toBe("cookie_tanpa_tanda");
  });

  it("kedaluwarsa, peramban lain, belum masuk SIPP: tidak terbukti", () => {
    const tua = cookieSipp({ ...sesiPp, last_activity: kini - 4000 });
    const bukaTua = tautan.bukaCookieSesiSipp(tua.nilai, tua.bahan);
    expect(sesi.periksaIsiSesi(String(bukaTua.serial), { userAgent: UA, kedaluwarsaDetik: 3600 })).toEqual({ terbukti: false, sebab: "sesi_kedaluwarsa" });

    const { nilai, bahan } = cookieSipp(sesiPp);
    const serial = String(tautan.bukaCookieSesiSipp(nilai, bahan).serial);
    expect(sesi.periksaIsiSesi(serial, { userAgent: "Firefox/1 " + UA, kedaluwarsaDetik: 3600 })).toEqual({ terbukti: false, sebab: "peramban_berbeda" });

    const tamu = cookieSipp({ ...sesiPp, is_logged_in: false, userid: "" });
    const serialTamu = String(tautan.bukaCookieSesiSipp(tamu.nilai, tamu.bahan).serial);
    expect(sesi.periksaIsiSesi(serialTamu, { userAgent: UA, kedaluwarsaDetik: 3600 })).toEqual({ terbukti: false, sebab: "belum_masuk_sipp" });
  });

  it("serial PHP: string ber-UTF8 dihitung bait; bentuk rusak = null", () => {
    expect(sesi.uraiSerialPhp(Buffer.from(serialPhp({ nama: "Zulkarnaén", n: 3, ok: true }), "utf8").toString("latin1"))).toEqual({
      nama: "Zulkarnaén",
      n: 3,
      ok: true,
    });
    expect(sesi.uraiSerialPhp('a:1:{s:3:"abc";s:9:"terpotong";}')).toEqual({ abc: "terpotong" });
    // panjang bait tidak sesuai isi / array tidak tertutup / sisa di belakang
    expect(sesi.uraiSerialPhp('a:1:{s:3:"abc";s:12:"terpotong";}')).toBeNull();
    expect(sesi.uraiSerialPhp('a:1:{s:3:"abc";s:9:"terpotong";')).toBeNull();
    expect(sesi.uraiSerialPhp('a:0:{}sisa')).toBeNull();
    expect(sesi.uraiSerialPhp('O:8:"stdClass":0:{}')).toBeNull();
  });

  it("sess_expiration dibaca dari config SIPP (3600 di SIPP), bawaan CI2 7200", () => {
    expect(tautan._uji.kedaluwarsaSesiDariConfig("$config['sess_expiration']\t\t= 3600;")).toBe(3600);
    expect(tautan._uji.kedaluwarsaSesiDariConfig("/* $config['sess_expiration'] = 5; */")).toBe(7200);
  });

  it("portal mengambil semua ci_session dari kepala Cookie, bukan cookie lain", () => {
    expect(nilaiCookieSesiSipp("keuangan_session=abc; ci_session=XYZ%2B1; better-auth.session_token=t; ci_session=Q")).toEqual(["XYZ%2B1", "Q"]);
    expect(sesi.nilaiCookieSesi("keuangan_session=abc; ci_session=XYZ")).toEqual(["XYZ"]);
    expect(nilaiCookieSesiSipp("")).toEqual([]);
  });
});

// ============================================================================
// C. PEMILIH AKUN ALETA
// ============================================================================

const kred = (userId: string, username: string, aktif = true, keadaan = "verified"): KredensialSipp => ({ userId, username, aktif, keadaan });

describe("C. pemilih akun ALETA: tautan > NIP > nama tunggal, dengan penjaga", () => {
  const akunAleta = [
    akun("usr-andini", "ANDINI PUSPITA SARI, S.Sy."),
    akun("usr-rahma", "RAHMA ANGGOROSIWI YANU PAMUNGKAS, A.Md", "admin"),
    akun("usr-derry", "DERRY BRIANTONO, S.H.", "super-admin"),
    akun("usr-tiffany", "TIFFANY RACHMAWATI SURANTO, A.Md.M", "pelaksana"),
  ];

  it("tautan Manajemen Akun menang atas nama (walau nama menunjuk orang lain)", () => {
    const bahan: BahanPilih = { kredensial: [kred("usr-rahma", "meja1g")], akun: akunAleta };
    expect(pilihAkunAletaUntukSipp(pegawai("meja1g", "Tiffany RS"), bahan)).toEqual({ jenis: "tautan", userId: "usr-rahma" });
  });

  it("tanpa tautan: nama tunggal -> akun baru ditautkan (nama-sipp)", () => {
    const bahan: BahanPilih = { kredensial: [], akun: akunAleta };
    expect(pilihAkunAletaUntukSipp(pegawai("andini", "Andini Puspita Sari, S.Sy."), bahan)).toMatchObject({
      jenis: "baru",
      userId: "usr-andini",
      sumber: "nama-sipp",
    });
  });

  it("akun ALETA yang sudah bertaut ke username SIPP lain TIDAK diambil lewat nama (meja3p -> Rahma yang bertaut meja1g)", () => {
    const bahan: BahanPilih = { kredensial: [kred("usr-rahma", "meja1g")], akun: akunAleta };
    expect(pilihAkunAletaUntukSipp(pegawai("meja3p", "Rahma Anggorosiwi Yanu Pamungkas, A.Md"), bahan)).toMatchObject({
      jenis: "ragu",
      sebab: "sudah_bertaut_lain",
    });
  });

  it("Super Admin tidak pernah ditautkan lewat nama", () => {
    expect(pilihAkunAletaUntukSipp(pegawai("derry", "Derry Briantono, S.H."), { kredensial: [], akun: akunAleta })).toMatchObject({
      jenis: "ragu",
      sebab: "super_admin_manual",
    });
  });

  it("username SIPP disimpan dua akun ALETA setara (tanpa pemilik) = ragu, bukan nama", () => {
    const bahan: BahanPilih = { kredensial: [kred("usr-andini", "admin"), kred("usr-rahma", "admin")], akun: akunAleta };
    expect(pilihAkunAletaUntukSipp(pegawai("admin", "Andini Puspita Sari"), bahan)).toMatchObject({ jenis: "ragu", sebab: "username_diklaim_lain" });
  });

  it("tautan yang dinonaktifkan Admin tidak dihidupkan lagi lewat nama", () => {
    const bahan: BahanPilih = { kredensial: [kred("usr-tiffany", "kasir", false)], akun: akunAleta };
    expect(pilihAkunAletaUntukSipp(pegawai("kasir", "Tiffany Rachmawati Suranto, A.Md.M"), bahan)).toMatchObject({
      jenis: "ragu",
      sebab: "tautan_dinonaktifkan",
    });
  });
});

// ============================================================================
// D. KEPUTUSAN MASUK DARI SESI SIPP
// ============================================================================

function depsSesi(o: {
  jawaban: JawabanSesiSipp;
  bahan: BahanPilih;
  tulisBerhasil?: boolean;
}): DepsMasukSesi & { jejak: BarisJejakSesi[]; tulis: Array<{ userId: string; usernameSipp: string; sumber: string }> } {
  const jejak: BarisJejakSesi[] = [];
  const tulis: Array<{ userId: string; usernameSipp: string; sumber: string }> = [];
  return {
    jejak,
    tulis,
    periksaSesi: async () => o.jawaban,
    bacaBahan: async () => o.bahan,
    tulisTautan: async (p) => {
      tulis.push(p);
      return o.tulisBerhasil !== false;
    },
    catatJejak: async (b) => {
      jejak.push(b);
    },
  };
}

const sesiTerbukti = (extra: Record<string, unknown> = {}): JawabanSesiSipp => ({
  ok: true,
  data: {
    terbukti: true,
    sippUserId: "67",
    username: "andini",
    namaLengkap: "Andini Puspita Sari, S.Sy.",
    diblokir: false,
    kedaluwarsa: false,
    pejabat: [{ jabatan: "panitera", nama: "Andini Puspita Sari", nip: "" }],
    ...extra,
  },
});

describe("D. masuk dari sesi SIPP", () => {
  const bahanDasar: BahanPilih = {
    kredensial: [kred("usr-pp-uji", "uji_pp")],
    akun: [akun("usr-andini", "ANDINI PUSPITA SARI, S.Sy."), akun("usr-pp-uji", "Uji ALETA - Panitera Pengganti (lokal)")],
  };

  it("akun bertautan: masuk tanpa menulis tautan", async () => {
    const d = depsSesi({ jawaban: sesiTerbukti({ username: "uji_pp", namaLengkap: "Uji ALETA PP (lokal)", sippUserId: "902" }), bahan: bahanDasar });
    const k = await putuskanMasukDariSesiSipp(d, {});
    expect(k).toEqual({ jenis: "masuk", userId: "usr-pp-uji", usernameSipp: "uji_pp", sippUserId: "902", tautanBaru: null });
    expect(d.tulis).toEqual([]);
    expect(d.jejak).toEqual([expect.objectContaining({ aletaUserId: "usr-pp-uji", hasil: "berhasil", alasan: "sesi_sipp" })]);
  });

  it("akun ALETA tanpa tautan tetapi nama sama: tautan ditulis (perlu ditinjau) lalu masuk; jejak menyebutnya", async () => {
    const d = depsSesi({ jawaban: sesiTerbukti(), bahan: bahanDasar });
    const k = await putuskanMasukDariSesiSipp(d, {});
    expect(k).toMatchObject({ jenis: "masuk", userId: "usr-andini", tautanBaru: "nama-sipp" });
    expect(d.tulis).toEqual([{ userId: "usr-andini", usernameSipp: "andini", sumber: "nama-sipp" }]);
    expect(d.jejak.at(-1)).toMatchObject({ alasan: "sesi_sipp_tautan_nama", hasil: "berhasil" });
  });

  it("nama ganda: tidak masuk, tidak menulis, pesan menawarkan tautan manual", async () => {
    const d = depsSesi({
      jawaban: sesiTerbukti(),
      bahan: { kredensial: [], akun: [akun("usr-1", "Andini Puspita Sari"), akun("usr-2", "ANDINI PUSPITA SARI, S.Sy.")] },
    });
    const k = await putuskanMasukDariSesiSipp(d, {});
    expect(k).toMatchObject({ jenis: "ragu", sebab: "nama_ganda" });
    expect((k as { pesan: string }).pesan).toContain("tautkan");
    expect(d.tulis).toEqual([]);
    expect(d.jejak.at(-1)).toMatchObject({ hasil: "ditolak", alasan: "sesi_nama_ganda" });
  });

  it("akun SIPP diblokir/kedaluwarsa: 403, tanpa sesi ALETA", async () => {
    const d = depsSesi({ jawaban: sesiTerbukti({ diblokir: true }), bahan: bahanDasar });
    expect(await putuskanMasukDariSesiSipp(d, {})).toMatchObject({ jenis: "tolak", status: 403, kode: "SIPP_NONAKTIF" });
    const d2 = depsSesi({ jawaban: sesiTerbukti({ kedaluwarsa: true }), bahan: bahanDasar });
    expect(await putuskanMasukDariSesiSipp(d2, {})).toMatchObject({ jenis: "tolak", status: 403 });
  });

  it("akun ALETA diblokir (nonaktif): tidak masuk", async () => {
    const d = depsSesi({
      jawaban: sesiTerbukti({ username: "uji_pp", sippUserId: "902" }),
      bahan: { ...bahanDasar, akun: [akun("usr-pp-uji", "Uji PP", "panitera-pengganti", null, false)] },
    });
    expect(await putuskanMasukDariSesiSipp(d, {})).toMatchObject({ jenis: "ragu", sebab: "akun_aleta_nonaktif" });
  });

  it("cookie palsu: tidak masuk, jejak 'ditolak'; belum masuk SIPP: tanpa jejak", async () => {
    const d = depsSesi({ jawaban: { ok: true, data: { terbukti: false, sebab: "tanda_tidak_sah" } }, bahan: bahanDasar });
    expect(await putuskanMasukDariSesiSipp(d, {})).toEqual({ jenis: "tanpa-sesi", sebab: "tanda_tidak_sah" });
    expect(d.jejak).toEqual([expect.objectContaining({ hasil: "ditolak", alasan: "sesi_sipp_tanda_tidak_sah" })]);
    const d2 = depsSesi({ jawaban: { ok: true, data: { terbukti: false, sebab: "tanpa_cookie_sipp" } }, bahan: bahanDasar });
    await putuskanMasukDariSesiSipp(d2, {});
    expect(d2.jejak).toEqual([]);
  });

  it("bot tidak terjangkau: tidak masuk, tidak menulis; saklar env mematikan seluruhnya", async () => {
    const d = depsSesi({ jawaban: { ok: false, error: "mati" }, bahan: bahanDasar });
    expect((await putuskanMasukDariSesiSipp(d, {})).jenis).toBe("tak-terjangkau");
    const d2 = depsSesi({ jawaban: sesiTerbukti(), bahan: bahanDasar });
    expect(await putuskanMasukDariSesiSipp(d2, { ALETA_MASUK_SESI_SIPP: "0" })).toEqual({ jenis: "dimatikan" });
    expect(await putuskanMasukDariSesiSipp(d2, { ALETA_MASUK_SIPP: "mati" })).toEqual({ jenis: "dimatikan" });
    expect(d2.tulis).toEqual([]);
  });

  it("tautkan manual: dua sesi terbukti -> tertaut; username milik orang lain ditolak", async () => {
    const tulis: unknown[] = [];
    const deps = {
      periksaSesi: async () => sesiTerbukti(),
      bacaBahan: async () => ({ kredensial: [] as KredensialSipp[], akun: [] }),
      catatJejak: async () => undefined,
      tulisTautanManual: async (p: unknown) => {
        tulis.push(p);
        return true;
      },
    };
    expect(await putuskanTautkanSesiSipp(deps, { id: "usr-1" })).toEqual({ jenis: "tertaut", usernameSipp: "andini" });
    expect(tulis).toEqual([{ userId: "usr-1", usernameSipp: "andini" }]);
    const ditolak = await putuskanTautkanSesiSipp(
      { ...deps, bacaBahan: async () => ({ kredensial: [kred("usr-lain", "andini")], akun: [] }) },
      { id: "usr-1" }
    );
    expect(ditolak).toMatchObject({ jenis: "tolak", sebab: "username_diklaim_lain" });
  });
});

// ============================================================================
// E. LAYAR MASUK ALETA: USERNAME + PASSWORD SIPP TANPA TAUTAN
// ============================================================================

describe("E. layar masuk: username SIPP tanpa tautan dicocokkan lewat nama", () => {
  const SANDI_SIPP = "Sipp-Palsu-E-11okt";
  const SANDI_ALETA = "Aleta-Palsu-E-11okt";
  beforeEach(() => kosongkanBatasMasukSipp());

  function deps(o: { pengguna?: { id: string; roleId: string } | null; akun?: Awaited<ReturnType<NonNullable<DepsMasukSipp["akunAletaDariSipp"]>>> }) {
    const jejak: unknown[] = [];
    const d: DepsMasukSipp = {
      cariPengguna: async () => o.pengguna ?? null,
      akunSippMilik: async () => [],
      verifikasiSipp: async (_u, sandi) => ({ ok: true, data: { ditemukan: true, cocok: sandi === SANDI_SIPP, diblokir: false, kedaluwarsa: false, sippUserId: "67" } }),
      verifikasiSandiAleta: async (_id, sandi) => sandi === SANDI_ALETA,
      catatJejak: async (b) => {
        jejak.push(b);
      },
      akunAletaDariSipp: async () => o.akun ?? { ok: true, userId: "usr-andini", tautanBaru: "nama-sipp" },
    };
    return { d, jejak };
  }
  const konteks = { headers: new Headers({ "x-forwarded-for": "10.9.9.9" }) };

  it("identitas tidak dikenal ALETA + password SIPP benar -> masuk lewat SIPP (titipan ekstensi boleh)", async () => {
    const { d, jejak } = deps({});
    const k = await putuskanMasukSipp(d, { identitas: "andini", sandi: SANDI_SIPP }, konteks, {});
    expect(k).toMatchObject({ jenis: "masuk", userId: "usr-andini", lewat: "sipp", usernameSipp: "andini" });
    expect(JSON.stringify(jejak)).not.toContain(SANDI_SIPP);
    expect(jejak.at(-1)).toMatchObject({ alasan: "sandi_sipp_cocok_tautan_nama", hasil: "berhasil" });
  });

  it("password SIPP salah -> jalur lama seperti dulu (bukan-sipp)", async () => {
    const { d } = deps({});
    expect(await putuskanMasukSipp(d, { identitas: "andini", sandi: "salah" }, konteks, {})).toEqual({ jenis: "bukan-sipp", sebab: "tidak-ditemukan" });
  });

  it("password SIPP benar tetapi akun ALETA ragu -> 401 dengan sebab yang jujur", async () => {
    const { d } = deps({ akun: { ok: false, sebab: "nama_ganda", pesan: "Nama Anda di SIPP sama dengan 2 akun ALETA." } });
    const k = await putuskanMasukSipp(d, { identitas: "andini", sandi: SANDI_SIPP }, konteks, {});
    expect(k).toMatchObject({ jenis: "tolak", status: 401, kode: "AKUN_ALETA_RAGU" });
    expect((k as { pesan: string }).pesan).toContain("Password SIPP Anda benar");
  });

  it("akun ALETA ditemukan tanpa tautan + password ALETA-nya sendiri -> jalur lama tetap berlaku", async () => {
    const { d } = deps({ pengguna: { id: "usr-x", roleId: "staf" }, akun: { ok: false, sebab: "tidak_cocok", pesan: "-" } });
    // password ALETA tidak cocok dengan SIPP -> verifikasi SIPP gagal -> bukan-sipp
    expect(await putuskanMasukSipp(d, { identitas: "x", sandi: SANDI_ALETA }, konteks, {})).toEqual({ jenis: "bukan-sipp", sebab: "tanpa-tautan" });
  });

  it("identitas menunjuk akun ALETA LAIN dari pilihan SIPP -> tidak memilih (jalur lama)", async () => {
    const { d } = deps({ pengguna: { id: "usr-lain", roleId: "staf" } });
    expect(await putuskanMasukSipp(d, { identitas: "andini", sandi: SANDI_SIPP }, konteks, {})).toEqual({ jenis: "bukan-sipp", sebab: "tanpa-tautan" });
  });
});

// ============================================================================
// F. BASIS DATA
// ============================================================================

let db: AletaDatabase | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPengguna(d: AletaDatabase, id: string, nama: string, peran = "admin") {
  const waktu = new Date().toISOString();
  const jabatan = await d.queryOne<{ id: string }>(`SELECT id FROM positions LIMIT 1`);
  const role = (await d.queryOne<{ id: string }>(`SELECT id FROM roles WHERE id = ?`, [peran])) ?? (await d.queryOne<{ id: string }>(`SELECT id FROM roles LIMIT 1`));
  await d.run(
    `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at)
     VALUES (?, ?, 'x', ?, ?, '0', ?, ?, ?, ?)`,
    [id, id, nama, `${id}@uji.local`, String(role?.id), String(jabatan?.id), waktu, waktu]
  );
}

describe("F. tautan di basis data", () => {
  it("migrasi 0062 = DDL_TAUTAN_SIPP_SUMBER, terdaftar di jurnal idx 61, aman dijalankan dua kali", () => {
    const SQL = path.join(process.cwd(), "drizzle/0062_aleta_tautan_sipp_sumber.sql");
    expect(existsSync(SQL)).toBe(true);
    const pernyataan = (t: string) =>
      t
        .split("\n")
        .filter((b) => !b.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(DDL_TAUTAN_SIPP_SUMBER.kolom.map((s) => pernyataan(s)[0]));
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(j.entries.find((e) => e.tag === "0062_aleta_tautan_sipp_sumber")?.idx).toBe(61);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    const kosong = newDb();
    kosong.public.none(`CREATE TABLE external_app_credentials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)`);
    kosong.public.none(readFileSync(SQL, "utf8"));
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT tautan_sumber, tautan_ditinjau_pada FROM external_app_credentials")).toEqual([]);
  });

  it("tautan otomatis: tertulis tanpa password, dikenali akunSippMilik, tampil 'perlu ditinjau', tidak menimpa username lain", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-andini", "ANDINI PUSPITA SARI, S.Sy.", "panitera-pengganti");
    expect(await tulisTautanSippOtomatis(db, { userId: "usr-andini", usernameSipp: "andini", sumber: "nama-sipp" })).toBe(true);

    const baris = await db.queryOne<Record<string, unknown>>(
      `SELECT external_username, encrypted_password, password_md5_hash, is_enabled, last_verified_status, tautan_sumber FROM external_app_credentials WHERE user_id = 'usr-andini'`
    );
    expect(baris).toMatchObject({ external_username: "andini", encrypted_password: "", password_md5_hash: "", tautan_sumber: "nama-sipp", last_verified_status: "not_tested" });
    expect(Number(baris?.is_enabled)).toBe(1);
    expect(akunSippMilik(await bacaKredensialSipp(db), "usr-andini")).toEqual(["andini"]);

    const ringkas = await getExternalCredentialSummariesForUser(db, "usr-andini");
    expect(ringkas[0]).toMatchObject({ appId: "sipp", username: "andini", hasPassword: false, isEnabled: true, tautanSumber: "nama-sipp", tautanDitinjauPada: null });

    // username lain tidak menimpa
    expect(await tulisTautanSippOtomatis(db, { userId: "usr-andini", usernameSipp: "andini2", sumber: "nama-sipp" })).toBe(false);
    const audit = await db.queryAll<{ action: string }>(`SELECT action FROM audit_logs WHERE entity_id = 'usr-andini'`, []);
    expect(audit.map((a) => a.action)).toContain("LINK_SIPP_ACCOUNT_AUTO");
  });

  it("Admin menyetujui / mencabut; Admin tidak menyentuh tautan Super Admin", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-andini", "ANDINI", "panitera-pengganti");
    await buatPengguna(db, "usr-root", "ROOT", "super-admin");
    await tulisTautanSippOtomatis(db, { userId: "usr-andini", usernameSipp: "andini", sumber: "nama-sipp" });
    await tulisTautanSippOtomatis(db, { userId: "usr-root", usernameSipp: "root", sumber: "sesi-sipp" });

    await tinjauTautanSipp(db, { actor: { id: "usr-root", roleId: "super-admin" }, userId: "usr-andini", aksi: "setujui" });
    expect((await getExternalCredentialSummariesForUser(db, "usr-andini"))[0]).toMatchObject({ isEnabled: true, lastVerifiedStatus: "verified" });
    expect((await getExternalCredentialSummariesForUser(db, "usr-andini"))[0].tautanDitinjauPada).toBeTruthy();

    await tinjauTautanSipp(db, { actor: { id: "usr-root", roleId: "super-admin" }, userId: "usr-andini", aksi: "cabut" });
    expect((await getExternalCredentialSummariesForUser(db, "usr-andini"))[0].isEnabled).toBe(false);
    expect(akunSippMilik(await bacaKredensialSipp(db), "usr-andini")).toEqual([]);

    await expect(tinjauTautanSipp(db, { actor: { id: "usr-andini", roleId: "admin" }, userId: "usr-root", aksi: "cabut" })).rejects.toThrow(/Super Admin/);
  });

  it("menyimpan dialog akun tanpa mengubah username TIDAK mematikan tautan tanpa password; mengganti username = milik manusia", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-andini", "ANDINI", "panitera-pengganti");
    await buatPengguna(db, "usr-root", "ROOT", "super-admin");
    await tulisTautanSippOtomatis(db, { userId: "usr-andini", usernameSipp: "andini", sumber: "nama-sipp" });

    await upsertExternalCredentialsForUser(db, {
      actor: { id: "usr-root" },
      userId: "usr-andini",
      credentials: [{ appId: "sipp", username: "andini", isEnabled: true }],
    });
    expect((await getExternalCredentialSummariesForUser(db, "usr-andini"))[0]).toMatchObject({ isEnabled: true, tautanSumber: "nama-sipp" });

    await upsertExternalCredentialsForUser(db, {
      actor: { id: "usr-root" },
      userId: "usr-andini",
      credentials: [{ appId: "sipp", username: "andini.baru", isEnabled: true }],
    });
    // username baru tanpa password = tidak aktif (aturan lama), dan bukan lagi tautan buatan ALETA
    expect((await getExternalCredentialSummariesForUser(db, "usr-andini"))[0]).toMatchObject({ isEnabled: false, tautanSumber: "" });
  });
});
