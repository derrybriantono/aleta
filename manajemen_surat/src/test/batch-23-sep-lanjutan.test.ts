// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  bawaanTampilAntrianPublik,
  normalkanTampilAntrianPublik,
  RUAS_ANTRIAN_PUBLIK,
  ruasPekaMenyala,
} from "@/lib/antrian-publik";

/**
 * ============================================================================
 * LANJUTAN PERMINTAAN 23 SEPTEMBER 2026
 * ============================================================================
 *
 *    1. papan "hari ini beres atau belum" - DIHAPUS 24 September 2026 atas
 *       permintaan pengguna ("fungsi itu sudah ada di perlu diperiksa");
 *       penjaganya kini menjaga PEMINDAHAN fungsinya, bukan papannya
 *    3. tanda "sudah menunggu berapa lama"
 *    4. arsip ZIP satu tekan - SIPP dan e-Court
 *    6. hitung mundur tenggang panggilan
 *   10. pranala antrian sidang tanpa login, beserta pengaturannya
 *   14. unggah putusan yang berhenti pada akar_sipp_belum_disetel
 *   15. durasi perkara berjalan, hari mediasi tidak dihitung
 *   16. saklar cetak ABT tiga berkas yang tidak menuruti keadaannya
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const jadwalBot = baca("aleta_bot/services/sippJadwalSidangService.js");
const abt = baca("ekstensi-sipp/abt.js");

// ===========================================================================
// BUTIR 1
// ===========================================================================

describe("butir 1 - papan dihapus 24 Sep 2026, fungsinya di Perlu diperiksa", () => {
  it("papan kuning Perlu ditindaklanjuti tidak ada lagi", () => {
    expect(layar).not.toContain("function PapanHariIni(");
    expect(layar).not.toContain("<PapanHariIni");
    // Diperiksa pada kode SAJA - komentar yang menerangkan penghapusannya
    // memang menyebut namanya, dan itu bukan papan yang kembali.
    const kode = layar
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(kode).not.toMatch(/ditindaklanjuti/i);
  });

  it("kelima anggota papan tetap merah - tetap dihitung Perlu diperiksa", () => {
    for (const k of [
      "retur",
      "belum-dipanggil",
      "tenggang-mepet",
      "belum-minutasi",
      "belum-unggah-putusan",
    ]) {
      const i = layar.indexOf(`kunci: "${k}"`);
      expect(i, `kotak ${k} hilang`).toBeGreaterThan(-1);
      expect(layar.slice(i, i + 400), `kotak ${k} tidak lagi merah`).toContain('nada: "bahaya"');
    }
  });

  it("nol tetap jawaban - Perlu diperiksa digambar walau nol", () => {
    // Sifat papan yang dipindahkan: kotak saringan biasa menyembunyikan yang
    // nol, kotak gabungan ini tidak lagi.
    expect(layar).not.toMatch(
      /keadaanTampak\(\s*KEADAAN_SIDANG\.filter\(\(keadaan\) => keadaan\.kunci === KUNCI_PERLU_DIPERIKSA\)/
    );
    expect(layar.split("KEADAAN_PERLU_DIPERIKSA.map(").length - 1).toBe(2);
  });

  it("tetap terlihat saat kendali diciutkan", () => {
    const i = layar.indexOf("sidang.length > 0 && kendaliCiut ? (");
    expect(i).toBeGreaterThan(-1);
    expect(layar.slice(i, i + 800)).toContain("KEADAAN_PERLU_DIPERIKSA.map(");
  });
});

// ===========================================================================
// BUTIR 3
// ===========================================================================

describe("butir 3 - sudah menunggu berapa lama", () => {
  const antrianBot = baca("aleta_bot/services/antrianSidangService.js");

  it("selisihnya dihitung basis data mesin antrian, bukan Node", () => {
    // Dua basis waktu yang bertemu menghasilkan selisih yang salah tanpa satu
    // pun galat, dan kolam koneksinya dibuat tanpa pilihan zona waktu.
    expect(antrianBot).toContain("TIMESTAMPDIFF(");
    expect(antrianBot).toContain("AS menitSejakAmbil");
  });

  it("berhenti dihitung begitu dipanggil masuk", () => {
    const i = antrianBot.indexOf("function menitMenungguBaris(");
    const blok = antrianBot.slice(i, antrianBot.indexOf("\n}", i));
    expect(blok).toContain('if (keadaan !== "menunggu") return null;');
  });

  it("yang belum mengambil nomor bernilai null, bukan nol", () => {
    // Nol berarti baru saja mengambil - keadaan yang sungguh terjadi.
    expect(antrianBot).toContain("menitMenunggu: null,");
  });

  it("ambangnya 40 menit, dan kedua sisi menyebut angka yang sama", () => {
    // Diminta pengguna 22 September 2026. Sempat dipasang 30 dengan alasan
    // yang masih berdiri - 30 dan 60 adalah batas pita jarak antar-sidang di
    // layar yang sama, diukur dari 10.989 jarak nyata - tetapi berapa lama
    // orang pantas menunggu bukan pertanyaan yang dijawab sebaran data.
    //
    // Yang dijaga: keduanya menyebut angka yang SAMA. Layar yang menandai
    // sejak 40 menit sementara bot memberitahukan sejak 30 akan membuat
    // petugas menerima pesan tentang baris yang layarnya masih diam.
    expect(layar).toContain("const AMBANG_MENUNGGU_MENIT = 40;");
    expect(antrianBot).toContain("ALETA_ANTRIAN_AMBANG_MENUNGGU || 40");
    // Alasan pengukurannya TETAP tertulis di kedua tempat, supaya angkanya
    // dapat ditimbang ulang tanpa mengulang pengukurannya.
    expect(layar).toContain("10.989 jarak nyata");
    expect(antrianBot).toContain("10.989 jarak nyata");
  });

  it("penandanya memakai pita warna yang sama dengan jeda antar-sidang", () => {
    const i = layar.indexOf("SUDAH MENUNGGU BERAPA LAMA");
    const blok = layar.slice(i, i + 1600);
    expect(blok).toContain("pitaJarak(antrian.menitMenunggu)");
    expect(blok).toContain("sebutanJarak(");
  });
});

// ===========================================================================
// BUTIR 4
// ===========================================================================

describe("butir 4 - arsip ZIP satu tekan", () => {
  // Penyusun isi ZIP dipisah ke modul bersama sejak 30 Sep 2026 (dipakai juga
  // sinkron Drive) - penjaga membaca rute DAN modulnya.
  const zip =
    baca("manajemen_surat/src/app/api/aleta-ecourt/berkas-zip/route.ts") +
    "\n" +
    baca("manajemen_surat/src/server/modules/aleta-ecourt/susun-arsip-perkara.ts");

  it("membaca DUA sumber, bukan e-Court saja", () => {
    expect(zip).toContain("getGatewayRincianSidang(nomor");
    expect(zip).toContain("getGatewayArsipRincian(nomor)");
  });

  it("berkelompok menurut jenisnya", () => {
    for (const folder of [
      "01 Gugatan/",
      "02 Relaas/",
      "03 BAS/",
      "04 Putusan/",
      "05 Lampiran/",
      "06 e-Court/",
    ]) {
      expect(zip, folder).toContain(folder);
    }
  });

  it("relaas urut tanggal, berita acara urut sidang keberapa", () => {
    // Urutan itulah yang dibaca ketika kepatutan panggilan dipersoalkan, dan
    // perkara yang sidangnya dijadwal ulang menyimpan barisnya tidak berurut.
    expect(zip).toContain("String(a.tanggalRelaas || \"\").localeCompare");
    expect(zip).toContain("(Number(a.urutanSidang) || 0) - (Number(b.urutanSidang) || 0)");
  });

  it("satu berkas gagal tidak menggagalkan seluruh ZIP", () => {
    expect(zip).toContain("dilewati.push(");
    expect(zip).toContain("DAFTAR ISI.txt");
    expect(zip).toContain("KETERANGAN.txt");
  });

  it("tiap berkas SIPP punya batas waktunya sendiri", () => {
    // Satu berkas yang menggantung tidak boleh menggantungkan seluruh
    // permintaan - di peladen ini ada satu inode XFS rusak yang memang begitu.
    expect(zip).toContain("BATAS_SATU_BERKAS_MS");
    expect(zip).toContain("new AbortController()");
    const gateway = baca(
      "manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts"
    );
    expect(gateway).toContain("signal?: AbortSignal");
  });

  it("ikrar talak dibaca dari perkara_id - tabelnya tidak punya kolom id", () => {
    expect(jadwalBot).toContain(
      "FROM perkara_ikrar_talak t WHERE t.perkara_id = ?"
    );
    expect(jadwalBot, "kunci lama masih dipakai").not.toContain(
      "FROM perkara_ikrar_talak t WHERE t.id = ?"
    );
  });
});

// ===========================================================================
// BUTIR 6
// ===========================================================================

describe("butir 6 - hitung mundur tenggang panggilan", () => {
  it("aturannya dipinjam, tidak dikarang ulang", () => {
    // Tiga jalur beserta dasar hukumnya sudah hidup di ecourtPanggilanService,
    // dan angkanya dapat disetel tanpa menyentuh kode.
    expect(jadwalBot).toContain("ecourtPanggilanService.nilaiKepatutan(");
    expect(jadwalBot).toContain("ecourtPanggilanService.bacaRelaas(");
    expect(jadwalBot, "ambang tidak boleh diketik ulang").toContain(
      'ecourtPanggilanService.ambangJalur("biasa")'
    );
  });

  it("tanggal relaas tidak dibuang lagi", () => {
    expect(jadwalBot).toContain("r.tanggal_jursit_pos AS tanggalKirimPos");
    expect(jadwalBot).toContain("r.ket_temu AS ketTemu");
  });

  it("yang dipakai pihak TERSEMPIT, bukan rata-rata", () => {
    // Satu panggilan yang tidak patut sudah cukup membatalkan sidangnya.
    const i = jadwalBot.indexOf("function nilaiTenggangSidang(");
    const blok = jadwalBot.slice(i, jadwalBot.indexOf("\n}", jadwalBot.indexOf("return { sisaHariKeSidang, tersempit, mepet };", i)));
    expect(blok).toContain("tersempit");
    expect(blok).not.toContain("rata");
  });

  it("yang belum dipanggil pun menyalakan penandanya", () => {
    expect(jadwalBot).toContain("belum_dipanggil_sidang_sudah_dekat");
  });

  it("kotak keadaannya bernada bahaya, jadi masuk 'Perlu diperiksa' sendiri", () => {
    const i = layar.indexOf('kunci: "tenggang-mepet"');
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 400);
    expect(blok).toContain('nada: "bahaya"');
    expect(blok).toContain('kelompok: "panggilan"');
  });

  it("ditulis SESUDAH Belum dipanggil dan SEBELUM Tidak perlu dipanggil", () => {
    const belum = layar.indexOf('kunci: "belum-dipanggil"');
    const mepet = layar.indexOf('kunci: "tenggang-mepet"');
    const tidak = layar.indexOf('kunci: "tidak-dipanggil"');
    expect(belum).toBeLessThan(mepet);
    expect(mepet).toBeLessThan(tidak);
  });
});

// ===========================================================================
// BUTIR 10
// ===========================================================================

describe("butir 10 - antrian sidang tanpa login", () => {
  const rute = baca("manajemen_surat/src/app/api/antrian-tampil/route.ts");
  const layanan = baca("manajemen_surat/src/server/modules/antrian-publik/service.ts");

  it("bawaannya SELURUHNYA tampil - diminta dengan tegas", () => {
    const bawaan = bawaanTampilAntrianPublik();
    for (const ruas of RUAS_ANTRIAN_PUBLIK) {
      expect(bawaan[ruas.kunci], ruas.kunci).toBe(true);
    }
  });

  it("ruas yang belum disetel mengikuti bawaan, bukan mati", () => {
    // Ruas baru yang lahir sesudah pengaturan disimpan harus mengikuti
    // keputusan yang sama dengan saudara-saudaranya.
    const hasil = normalkanTampilAntrianPublik({ namaPihak: false });
    expect(hasil.namaPihak).toBe(false);
    expect(hasil.nomorAntrian).toBe(true);
  });

  it("kunci yang tidak dikenali dibuang, bukan diteruskan", () => {
    const hasil = normalkanTampilAntrianPublik({ ruasKarangan: true });
    expect(Object.keys(hasil)).not.toContain("ruasKarangan");
  });

  it("empat ruas ditandai peka, dan penandanya dapat dibaca layar", () => {
    const peka = RUAS_ANTRIAN_PUBLIK.filter((x) => x.peka).map((x) => x.kunci);
    expect(peka.sort()).toEqual(["agenda", "majelis", "namaPihak", "nomorPerkara"]);
    expect(ruasPekaMenyala(bawaanTampilAntrianPublik())).toHaveLength(4);
    expect(ruasPekaMenyala({ ...bawaanTampilAntrianPublik(), namaPihak: false })).toHaveLength(3);
  });

  it("pengaturan yang TIDAK terbaca jatuh ke bentuk paling sempit, bukan bawaan", () => {
    // Bawaan "semua tampil" berlaku ketika pengaturannya terbaca. Ruas peka
    // yang tampil karena kegagalan pembacaan adalah ruas yang tidak pernah
    // diputuskan siapa pun.
    expect(layanan).toContain("function tampilPalingSempit()");
    expect(layanan).toContain("hasil[ruas.kunci] = !ruas.peka;");
    expect(rute).toContain("pengaturan = pengaturanTertutup();");
  });

  it("saklar induk mati berarti kosong seluruhnya, bukan sebagian", () => {
    expect(rute).toContain("if (!pengaturan.aktif)");
  });

  it("disaring dengan MENYUSUN, bukan dengan menghapus", () => {
    // Objek yang disusun ulang tidak dapat kebocoran ruas baru yang suatu
    // saat ditambahkan di hulu.
    expect(rute).toContain("const keluaran: Record<string, unknown> = {};");
    expect(rute).toContain("if (tampil.namaPihak) keluaran.pihak =");
  });

  it("rute lama yang sempit TIDAK ikut berubah", () => {
    // Televisi ruang tunggu yang sudah berjalan tidak boleh berubah isinya
    // karena pengaturan baru.
    const lama = baca("manajemen_surat/src/app/api/antrian-ruang/route.ts");
    expect(lama).not.toContain("namaPihak");
    expect(lama).not.toContain("nomorPerkara");
  });

  it("hanya Admin atau Super Admin yang dapat mengubahnya", () => {
    const admin = baca("manajemen_surat/src/app/api/aleta-ecourt/antrian-publik/route.ts");
    expect(admin).toContain("isPrivilegedAdmin(aktor)");
  });

  it("migrasi 0049 diklaim dan terdaftar", () => {
    const jurnal = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entri = jurnal.entries.find((x) => x.idx === 49);
    expect(entri?.tag).toBe("0049_antrian_publik");
    // Tabelnya juga ada di skema pemasangan - migrasi saja tidak cukup bagi
    // pemasangan baru yang dibangun dari schema.ts.
    expect(baca("manajemen_surat/src/server/db/schema.ts")).toContain(
      "CREATE TABLE IF NOT EXISTS aleta_antrian_publik"
    );
  });
});

// ===========================================================================
// BUTIR 14
// ===========================================================================

describe("butir 14 - unggah putusan yang berhenti pada akar SIPP", () => {
  const penetapan = baca("aleta_bot/services/dokumenPenetapanService.js");
  const unggah = baca("aleta_bot/services/putusanUnggahService.js");

  it("akar SIPP punya cadangan dari folder yang memang terpasang", () => {
    expect(penetapan).toContain("AKAR_SIPP_CADANGAN");
    expect(penetapan).toContain("ALETA_BOT_SIPP_DOCUMENT_ROOTS");
  });

  it("cadangannya tidak menebak - hanya folder yang benar-benar ada", () => {
    const i = penetapan.indexOf("for (const calon of AKAR_SIPP_CADANGAN)");
    const blok = penetapan.slice(i, i + 300);
    expect(blok).toContain("fs.existsSync(calon)");
    expect(blok).toContain("isDirectory()");
  });

  it("hanya-baca dibedakan dari belum-disetel", () => {
    // Yang satu diperbaiki lewat pengaturan; yang lain menuntut mount baru
    // dan container dijalankan ulang. Petugas tidak dapat membedakannya
    // sendiri, jadi pesannya yang harus membedakannya.
    expect(penetapan).toContain('alasan: "akar_sipp_hanya_baca"');
    expect(penetapan).toContain('alasan: "akar_sipp_tidak_ada"');
    // Pemanggilnya WAJIB menyebut folder tujuannya. Bentuk lama tanpa
    // argumen menguji izin tulis pada AKAR SIPP - yang memang tetap
    // hanya-baca - sehingga unggahan berhenti pada "hanya baca" selamanya,
    // walau folder putusannya sudah dapat ditulis.
    expect(unggah).toContain("dokumenPenetapanService.periksaAkarSipp(undefined, {");
    expect(unggah, "bentuk tanpa folder tujuan tidak boleh kembali").not.toContain(
      "dokumenPenetapanService.periksaAkarSipp()"
    );
  });

  it("dua folder putusan dapat ditulis di docker-compose", () => {
    const compose = baca("docker-compose.yml");
    expect(compose).toContain("/var/www/html/SIPP/resources/file/doc:/usr/src/app/SIPP/resources/file/doc");
    expect(compose).toContain(
      "/var/www/html/SIPP/resources/file/anonimisasi:/usr/src/app/SIPP/resources/file/anonimisasi"
    );
    // Pohon SIPP selebihnya TETAP hanya-baca.
    expect(compose).toContain("/var/www/html/SIPP:/usr/src/app/SIPP:ro");
  });

  it("kode alasannya diterjemahkan ke kalimat yang dapat dikerjakan", () => {
    const konten = baca("ekstensi-sipp/konten.js");
    expect(konten).toContain("PESAN_GAGAL_UNGGAH");
    expect(konten).toContain("akar_sipp_hanya_baca:");
    // Kode yang tidak dikenali tetap ditampilkan - menyembunyikannya di balik
    // "terjadi kesalahan" menghapus satu-satunya keterangan yang tersisa.
    expect(konten).toContain('return `${kode.replace(/_/g, " ")}');
  });
});

// ===========================================================================
// BUTIR 15
// ===========================================================================

describe("butir 15 - durasi perkara, hari mediasi tidak dihitung", () => {
  it("dasarnya disebut, bukan angkanya saja", () => {
    expect(jadwalBot).toContain("PERMA 1/2016");
    expect(jadwalBot).toContain("const AMBANG_DURASI_HARI = 150;");
  });

  it("dibaca dari perkara_mediasi, bukan dari view", () => {
    // Impor dump SIPP memulihkan tabel tetapi tidak satu pun view - jalur
    // view mati diam-diam pada pemasangan hasil impor.
    const i = jadwalBot.indexOf("async function durasiBanyakPerkara(");
    const blok = jadwalBot.slice(i, i + 3000);
    expect(blok).toContain("FROM perkara_mediasi m");
    expect(blok).not.toContain("v_durasi_mediasi");
  });

  it("baris mediasi kembar tidak dihitung dua kali", () => {
    // Satu perkara di satker ini punya tiga baris mediasi bertanggal mulai
    // sama persis; menjumlahkannya menghitung rentang yang sama tiga kali.
    expect(jadwalBot).toContain("const perMulai = new Map();");
    expect(jadwalBot).toContain("const berujung = kelompok.filter((m) => m.selesai);");
  });

  it("mediasi yang menggantung tidak berjalan sampai hari ini pada perkara yang sudah putus", () => {
    // Diukur: tanpa penjepitan ini, perkara 1495 berumur 87 hari menghasilkan
    // "mediasi 3.488 hari" dan durasi bersih nol.
    const i = jadwalBot.indexOf("function hariMediasiBersih(");
    const blok = jadwalBot.slice(i, jadwalBot.indexOf("\n}", jadwalBot.indexOf("return { hari, dibatasi: false };", i)));
    expect(blok).toContain("selesaiMentah < batasAkhir ? selesaiMentah : batasAkhir");
    expect(blok).toContain("mulaiMentah > batasAwal ? mulaiMentah : batasAwal");
  });

  it("potongannya dibatasi 60 hari - 30 hari ditambah perpanjangan", () => {
    expect(jadwalBot).toContain("const BATAS_POTONG_MEDIASI_HARI = 60;");
    // Berbeda dari BATAS_MEDIASI_HARI yang bernilai 30 - tenggat mediasi.
    // Menyatukannya akan memberi potongan dua kali lipat.
    expect(jadwalBot).toContain("const BATAS_MEDIASI_HARI = 30;");
  });

  it("hasil mediasi dibaca dari sandi kolomnya, bukan ditebak", () => {
    for (const sandi of ["Y1:", "Y2:", "S:", "T:", "D:"]) {
      expect(jadwalBot, sandi).toContain(sandi);
    }
  });

  it("tampil di bawah agenda DAN di panel rincian", () => {
    expect(layar).toContain("<UmurPerkara durasi={baris.durasi} telahIkrar={ikrarSelesai(baris)} />");
    // Sejak 24 September 2026 paling bawah panel, terciut sebagai bawaan,
    // dengan kunci baru - lihat antrian-dua-belas-butir "garis batas".
    expect(layar).toContain(
      '<Bagian judul="Rincian waktu perkara" kunci="sidang-durasi-v2" ciutBawaan keterangan={keteranganWaktu}>'
    );
  });

  it("panel rincian tidak menghitung ulang - angkanya dikirim dari barisnya", () => {
    expect(layar).toContain("durasi={baris.durasi}");
  });
});

// ===========================================================================
// BUTIR 16
// ===========================================================================

describe("butir 16 - saklar cetak ABT tiga berkas", () => {
  it("saklarnya dibaca ULANG sesudah klik ditahan", () => {
    // Salinan di memori dapat basi tanpa satu pun tanda: tab yang dibekukan
    // peramban tidak menerima onChanged, dan ekstensi yang dimuat ulang
    // meninggalkan tab lama tanpa pendengar sama sekali.
    expect(abt).toContain("async function saklarCetakSekarang()");
    expect(abt).toContain("if (await saklarCetakSekarang()) {");
  });

  it("gagal membaca dianggap MATI, bukan menyala", () => {
    const i = abt.indexOf("async function saklarCetakSekarang()");
    const blok = abt.slice(i, abt.indexOf("\n}", abt.indexOf("return nyala;", i)));
    expect(blok).toContain("return false;");
  });

  it("ketika mati, tautan ABT-nya tetap dijalankan - satu berkas", () => {
    // Yang diminta: "kalau tidak dicentang maka download blangko dari abt
    // saja". Menahan klik lalu tidak melakukan apa-apa berarti tombol CETAK
    // yang mati total.
    const i = abt.indexOf("if (await saklarCetakSekarang()) {");
    const blok = abt.slice(i, i + 900);
    expect(blok).toContain("document.createElement(\"a\")");
    expect(blok).toContain("pengganti.click();");
  });

  it("penerbitnya punya pagar sendiri", () => {
    const i = abt.indexOf("async function terbitkanTigaBerkas(");
    const blok = abt.slice(i, i + 900);
    expect(blok).toContain("if (!(await saklarCetakSekarang()))");
  });

  it("unduhan yang diblokir peramban terdeteksi, bukan dikira berhasil", () => {
    // Chrome memulangkan id lalu memblokirnya kemudian. Panel yang hanya
    // membaca id mengira berhasil, dan cadangannya tidak pernah dipakai.
    const latar = baca("ekstensi-sipp/latar.js");
    expect(latar).toContain("function ikutiUnduhan(");
    expect(latar).toContain('keadaan === "interrupted"');
    expect(latar).toContain("ikutiUnduhan(id, (hasil) => jawab(hasil));");
  });
});
