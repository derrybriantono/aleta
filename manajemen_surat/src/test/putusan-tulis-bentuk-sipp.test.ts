/**
 * ============================================================================
 * MENULIS PUTUSAN DENGAN BENTUK YANG SAMA PERSIS
 * ============================================================================
 *
 * Tulisan paling berat yang dikerjakan ALETA. Yang dicatat dibaca pengadilan
 * tingkat banding, dipakai menyusun akta cerai, dan dikirim ke Direktori
 * Putusan. Bentuknya karena itu tidak dikarang - seluruhnya diukur dari satu
 * sesi memutus sungguhan di salinan satker:
 *
 *   500580 14:59:22 derry briantono  perkara_putusan             tambah
 *   500581 14:59:22 derry briantono  perkara_pertimbangan_hukum  tambah
 *   500582 14:59:48 derry briantono  perkara_putusan             UNGGAH
 *
 * Baris ketiga BUKAN bagian memutus.
 *
 * ============================================================================
 * TIGA HAL YANG HAMPIR DIKARANG, DAN DICEGAH OLEH PENGUKURAN
 * ============================================================================
 *
 * 1. JUDUL AUDITNYA. Seluruh modul SIPP lain menulis "AKSI table <b>x</b> dari
 *    halaman <b>y</b> dengan Primary Key [...]". Modul putusan tidak:
 *
 *        tambah Data Putusan Akhir <br />dengan perkara_id [id=10049]
 *
 * 2. JAMNYA DUA BELAS. `diinput_tanggal` tercatat 02:59:22 untuk peristiwa
 *    pukul 14:59:22. Bagian baris berjam >= 13:
 *
 *        perkara_putusan               5,0%   perkara_penetapan      42,0%
 *        perkara_pertimbangan_hukum    0,0%   perkara_jadwal_sidang  33,7%
 *                                             perkara_proses         38,5%
 *
 *    Khas modul putusan, BUKAN sifat SIPP - penulis penetapan dan penundaan
 *    ALETA sudah benar dengan 24-jam dan tidak boleh ikut diubah. Dan bukan
 *    sisa bagi dua belas: jam 12 ada 1.045 baris, jam 0 tidak ada satu pun.
 *
 * 3. JENIS PERKARANYA TIDAK DICOCOKKAN. `status_putusan.jenis_perkara_id`
 *    bernilai 1..5; `perkara.jenis_perkara_id` bernilai 346 Cerai Talak, 347
 *    Cerai Gugat, 360 Pengesahan Perkawinan, dan seterusnya. Kolom senama,
 *    hitungan berbeda. Pencocokan yang terasa benar itu MENOLAK SELURUH
 *    PUTUSAN - terjadi sekali saat berkas ini ditulis, dan ketahuan hanya
 *    karena dijalankan atas perkara sungguhan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/putusanTulisService.js");
const penetapan = baca("aleta_bot/services/penetapanTulisService.js");
const tunda = baca("aleta_bot/services/sidangHasilService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-putus/route.ts");
// Layar panitera sidang - satu berkas untuk tunda dan putus sekaligus. Jalur
// HAKIM yang dijaga berkas ini tidak punya layar tersendiri di portal; yang
// dituntut di sini hanya bahwa daftar status putusannya dibaca dari data.
const layar = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kode = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

describe("dua baris, satu detik, satu akun", () => {
  it("dua tabel yang ditulis, tidak lebih", () => {
    expect(kode).toContain("INSERT INTO perkara_putusan");
    expect(kode).toContain("INSERT INTO perkara_pertimbangan_hukum");
  });

  it("keduanya memakai cap waktu yang sama, dan jamnya dari BASIS DATA", () => {
    // Satu `saat`, dipakai kedua langkah - bukan dua panggilan jam.
    const panggilan = kode.match(/penetapan\.waktuBasisData\(\)/g) || [];
    expect(panggilan.length).toBe(1);

    // waktuMysql() membaca jam CONTAINER, dan Node di dalam container jatuh ke
    // UTC bila env TZ tidak diset - terukur: basis data menjawab 13:15 WITA
    // sementara Node menjawab 05:15. Seluruh baris audit ALETA akan tercatat
    // delapan jam sebelum kejadiannya, berselisih dengan baris SIPP di tabel
    // yang sama yang jamnya benar.
    expect(kode).not.toContain("penetapan.waktuMysql()");
  });

  it("riwayat perkara TIDAK disentuh - terukur 0 baris sedetik", () => {
    expect(kode).not.toContain("perkara_proses");
    expect(layanan).toContain("0 baris sedetik dengan putusan");
  });

  it("pemberitahuan putusan bukan bagian memutus", () => {
    expect(kode).not.toContain("perkara_putusan_pemberitahuan_putusan");
    expect(layanan).toContain("langkah\n *                     JURUSITA");
  });

  it("mengunggah berkasnya punya jalannya sendiri", () => {
    expect(kode).not.toContain("UNGGAH");
    expect(layanan).toContain("putusanUnggahService");
  });
});

describe("judul auditnya seperti modul putusan, bukan seperti modul lain", () => {
  it("judulnya disusun sendiri", () => {
    expect(kode).toContain("judulSendiri: `tambah Data Putusan Akhir <br />dengan perkara_id [id=${perkara.perkaraId}]`");
    expect(kode).toContain(
      "judulSendiri: `tambah Data Pertimbangan Hukum <br />dengan perkara_id [id=${perkara.perkaraId}]`"
    );
  });

  it("barisAudit menerimanya tanpa mengubah pemanggil lama", () => {
    expect(penetapan).toContain("judulSendiri,");
    expect(penetapan).toContain(
      "judulSendiri || `${aksi} table <b>${tabel}</b> dari halaman <b>${judulHalaman || formulir}</b>${kunci}`"
    );
  });

  it("nama halamannya persis yang ditulis SIPP", () => {
    expect(kode).toContain('const FORM_PUTUSAN = "TAMBAH DATA PUTUSAN AKHIR";');
    expect(kode).toContain('const FORM_PERTIMBANGAN = "TAMBAH DATA PERTIMBANGAN HUKUM";');
  });
});

describe("jam dua belas pada diinput_tanggal", () => {
  it("bukan sisa bagi dua belas", () => {
    // `% 12` menuliskan tengah hari sebagai 00 - jam yang tidak pernah muncul
    // sekali pun pada 9.993 baris tabel ini.
    expect(kode).toContain("const jam = ((Number(cocok[2]) + 11) % 12) + 1;");
    expect(kode).not.toMatch(/Number\(cocok\[2\]\)\s*%\s*12\s*;/);
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(layanan).toContain("jam 12 : 1.045 baris");
    expect(layanan).toContain("jam 0 : TIDAK ADA satu pun");
  });

  it("hanya kolomnya yang 12-jam - cap sys_audittrail tetap 24-jam", () => {
    expect(layanan).toContain("Cap waktu `sys_audittrail` tetap 24-jam");
    // Cap audit memakai `saat`, kolomnya memakai `saatKolom`.
    expect(kode).toContain("const saatKolom = waktuPutusan(saat);");
    expect(kode).toContain("diinput_tanggal: saatKolom,");
  });

  it("penulis penetapan dan penundaan TIDAK ikut diubah", () => {
    // Keduanya terukur 24-jam pada data satker; mengubahnya justru membuat
    // barisnya menonjol.
    expect(penetapan).not.toContain("waktuPutusan");
    expect(tunda).not.toContain("waktuPutusan");
    expect(tunda).toContain("diinput_tanggal: saat,");
  });
});

describe("jenis perkara tidak dicocokkan, dan sebabnya tercatat", () => {
  it("statusSah tidak lagi menerima jenis perkara", () => {
    expect(kode).toContain("async function statusSah(statusPutusanId) {");
    expect(kode).not.toContain("statusSah(minta.statusPutusanId, perkara.jenisPerkaraId)");
  });

  it("dua taksonomi yang bernama sama disebut di sumbernya", () => {
    expect(layanan).toContain("status_putusan.jenis_perkara_id     1 .. 5");
    expect(layanan).toContain("347 Cerai Gugat");
  });

  it("status tetap diperiksa terhadap tabel rujukannya", () => {
    expect(kode).toContain("FROM status_putusan WHERE id = ? AND aktif = 'Y'");
  });

  it("daftar status dibaca dari data, tidak disalin ke dalam kode", () => {
    expect(kode).toContain("async function daftarStatusPutusan()");
    expect(kode).toContain("JOIN perkara_putusan pp ON pp.status_putusan_id = sp.id");
    expect(layar).toContain("/api/aleta-ecourt/sidang-putus");
  });
});

describe("yang ditolak sebelum satu baris pun ditulis", () => {
  it("perkara yang sudah diputus tidak ditulisi lagi", () => {
    expect(kode).toContain('return {\n      ok: false,\n      alasan: "perkara_sudah_diputus"');
    expect(layanan).toContain("meniru penyuntingan adalah pekerjaan yang");
  });

  it("putusan bertanggal esok ditolak, bertanggal lampau boleh", () => {
    expect(kode).toContain('alasan: "tanggal_putusan_di_depan"');
    expect(layanan).toContain("sesudah diucapkan");
  });

  it("amar dan pertimbangan wajib berisi", () => {
    expect(kode).toContain('alasan: "amar_putusan_kosong"');
    expect(kode).toContain('alasan: "pertimbangan_hukum_kosong"');
  });

  it("akun SIPP harus benar-benar ada", () => {
    expect(kode).toContain('alasan: "akun_sipp_tidak_ketemu"');
    expect(kode).toContain("FROM sys_users WHERE username = ?");
  });
});

describe("kering sebagai bawaan, tiap lapis", () => {
  it("gerbang", () => {
    const potongan = gerbang.slice(gerbang.indexOf('router.post("/sidang/putus"'));
    expect(potongan).toContain("const kering = badan.kering !== false;");
  });

  it("rute portal", () => {
    expect(rute).toContain("kering: badan.kering !== false,");
  });

  it("layar - TIAP tombol tulis terkunci sampai rencananya dibaca", () => {
    expect(layar).toContain("const rencanaKering = hasil?.ok === true && hasil.kering === true;");
    expect(layar).toContain("disabled={!rencanaKering || sibuk || sudahTertulis || atasNama?.ok === false}");

    // ====================================================================
    // YANG DIJAGA BUKAN JUMLAHNYA, MELAINKAN PENGUNCINYA
    // ====================================================================
    //
    // Berkas ini kini berisi DUA komponen yang menulis ke SIPP: borang
    // lengkapnya, dan CatatHasilRingkas yang dipakai langsung dari baris
    // antrian. Keduanya terkunci sampai rencananya dibaca - hanya caranya
    // berbeda: yang satu tombol yang dinonaktifkan, yang lain tombol yang
    // belum digambar sama sekali.
    //
    // Menghitung kemunculannya karena itu salah sasaran. Yang dimaksud bukan
    // "hanya ada satu tombol tulis" melainkan "tidak ada tombol tulis yang
    // TIDAK terkunci" - dan itulah yang dituntut di bawah. Tombol tulis
    // ketiga yang lupa dikunci tetap merah.
    const semua = [...layar.matchAll(/kirim\(false\)/g)];
    expect(semua.length, "tidak ada satu pun tombol tulis").toBeGreaterThan(0);
    for (const cocok of semua) {
      const i = cocok.index ?? 0;
      const sebelum = layar.slice(Math.max(0, i - 400), i);
      expect(
        sebelum,
        `pemanggilan kering=false pada huruf ke-${i} tidak terkunci rencanaKering`
      ).toContain("rencanaKering");
    }
  });

  it("percobaan yang ditolak ikut tercatat di jejak ALETA", () => {
    const potongan = gerbang.slice(gerbang.indexOf('router.post("/sidang/putus"'));
    expect(potongan).toContain('aksi: "putus"');
    expect(potongan).toContain("berhasil: false,");
  });
});

describe("mesin penulisnya satu", () => {
  it("rencana dijalankan penjalan milik penulis penetapan", () => {
    expect(kode).toContain("jalankanRencana: penetapan.jalankanRencana");
    expect(kode).toContain("penetapan.barisAudit({");
  });

  it("dua tabel baru masuk daftar putih, bukan daftarnya dilonggarkan", () => {
    expect(penetapan).toContain('"perkara_putusan",');
    expect(penetapan).toContain('"perkara_pertimbangan_hukum",');
    expect(penetapan).toContain("if (!DAFTAR_TABEL.has(tabel)) throw new Error(");
  });
});

describe("kewenangan dan bungkus jawaban", () => {
  it("rute menuntut kapabilitas panel pada baca dan tulis", () => {
    const panel = rute.match(/pastikanKapabilitas\(db, actorUserId, "panel"\)/g) || [];
    expect(panel.length).toBe(2);
  });

  it("akun SIPP wajib, dan operator portal disimpan terpisah", () => {
    expect(rute).toContain("Akun SIPP yang menuliskannya wajib disebut");
    expect(rute).toContain('operator: actorUserId || "portal"');
  });

  it("layar membuka bungkus { ok, data }", () => {
    expect(layar).toContain("async function bukaBungkus<T>(balasan: Response)");
    expect(layar).toContain("?.data ?? ({} as T)");
  });
});
