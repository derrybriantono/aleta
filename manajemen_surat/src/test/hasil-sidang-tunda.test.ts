/**
 * ============================================================================
 * MENUNDA SIDANG - BENTUKNYA DISALIN DARI SIPP, DAN DIHITUNG DARI DATANYA
 * ============================================================================
 *
 * Sampai 2.20.4 yang ditulis ALETA ke SIPP hanya PENETAPAN. Penundaan lain
 * sifatnya: ia melahirkan BARIS SIDANG BARU, dan baris sidang yang salah
 * tanggal berarti pihak dipanggil untuk hari yang salah.
 *
 * Bentuknya dibaca dari kode SIPP sendiri - jadwal_sidang_c.php::validateTunda,
 * jadwal_sidang_m::tunda_sidang, riwayat_perkara_m::updateproses,
 * manageAntrian.php - lalu DIHITUNG dari 4.242 penundaan yang sungguh ada di
 * basis data satker:
 *
 *     4242  UPDATE  perkara_jadwal_sidang    halaman PENUNDAAN JADWAL SIDANG
 *     4242  INSERT  perkara_jadwal_sidang
 *     4173  UPDATE  perkara
 *
 * Selisih 69 pada baris ketiga bukan kebocoran: itu penundaan sidang ikrar
 * talak, yang menurut kodenya memang tidak memperbarui riwayat. Angka datanya
 * cocok dengan kodenya - dan itulah yang membuat bentuk ini dapat dipercaya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/sidangHasilService.js");
const penetapan = baca("aleta_bot/services/penetapanTulisService.js");

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();
  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }
  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Keadaan = { verzet?: string; ikrarTalak?: string };

function muatProses() {
  const tetapan = [
    "const PROSES_PERSIDANGAN = 200;",
    "const PROSES_VERZET = 261;",
    "const PROSES_VERZET_JENIS3 = 116;",
    "const PROSES_IKRAR_TALAK = 294;",
  ];
  for (const t of tetapan) expect(layanan, t).toContain(t);
  const kode = [tetapan.join("\n"), potongFungsi(layanan, ["bersih", "prosesUntukTunda"])].join("\n\n");
  return new Function(`${kode}\nreturn prosesUntukTunda;`)() as (
    keadaan: Keadaan,
    jenisPengadilan: number
  ) => { prosesId: number; perbaruiRiwayat: boolean };
}

describe("proses yang dicatat riwayat pada penundaan", () => {
  const prosesUntukTunda = muatProses();

  it("sidang biasa: Persidangan 200, riwayat diperbarui", () => {
    expect(prosesUntukTunda({}, 0)).toEqual({ prosesId: 200, perbaruiRiwayat: true });
  });

  it("verzet: 261, dan 116 pada peradilan jenis 3", () => {
    expect(prosesUntukTunda({ verzet: "Y" }, 0)).toEqual({ prosesId: 261, perbaruiRiwayat: true });
    expect(prosesUntukTunda({ verzet: "Y" }, 3)).toEqual({ prosesId: 116, perbaruiRiwayat: true });
  });

  it("ikrar talak: 294, dan riwayatnya TIDAK diperbarui", () => {
    // Inilah yang menjelaskan selisih 69 baris pada data satker. Kalau syarat
    // ini lepas, tiap penundaan ikrar talak akan menulis satu baris perkara
    // yang tidak pernah ditulis SIPP.
    expect(prosesUntukTunda({ ikrarTalak: "Y" }, 0)).toEqual({
      prosesId: 294,
      perbaruiRiwayat: false,
    });
  });

  it("ikrar talak menang atas verzet - urutannya sama dengan SIPP", () => {
    expect(prosesUntukTunda({ ikrarTalak: "Y", verzet: "Y" }, 0).prosesId).toBe(294);
  });
});

describe("bentuk tulisannya sama dengan SIPP", () => {
  it("nama halaman persis yang ditulis SIPP", () => {
    expect(layanan).toContain('const NAMA_HALAMAN = "PENUNDAAN JADWAL SIDANG";');
  });

  it("dua baris jadwal: yang hari ini ditunda, yang berikutnya disisipkan", () => {
    const badan = potongFungsi(layanan, ["susunRencanaTunda"]);
    expect(badan).toContain('ditunda: "Y"');
    expect(badan).toContain("UPDATE perkara_jadwal_sidang");
    expect(badan).toContain("INSERT INTO perkara_jadwal_sidang");
  });

  it("id dan urutan baris baru dihitung saat menulis, bukan saat merencanakan", () => {
    const badan = potongFungsi(layanan, ["susunRencanaTunda"]);
    // perkara_jadwal_sidang tidak ber-auto_increment. Menghitung id saat
    // rencana disusun membuka jeda selebar seluruh rencana - cukup untuk dua
    // petugas melahirkan dua baris berid sama.
    expect(badan).toContain('idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: 0 }');
    expect(badan).toContain("IFNULL(MAX(urutan),0) + 1");
  });

  it("bendera perkara ikut ke baris sidang berikutnya", () => {
    const badan = potongFungsi(layanan, ["susunRencanaTunda"]);
    for (const bendera of ["verzet", "keberatan", "ikrar_talak", "sidang_keliling"]) {
      expect(badan, bendera).toContain(bendera);
    }
  });

  it("riwayat perkara lewat prosedur SIPP sendiri, bukan tiruannya", () => {
    const badan = potongFungsi(layanan, ["susunRencanaTunda"]);
    expect(badan).toContain("CALL perkara_proses_update(?,?,?,?,?,?,?,?,?)");
  });

  it("tahapan terakhir dibaca dari baris proses terbaru, urut seperti SIPP", () => {
    const badan = potongFungsi(layanan, ["susunRencanaTunda"]);
    expect(badan).toContain(
      "ORDER BY tahapan_id DESC, proses_id DESC, tanggal DESC, urutan DESC"
    );
    expect(badan).toContain("IFNULL(diperbaharui_tanggal, diinput_tanggal) DESC");
  });
});

describe("tanggal diperiksa sebelum satu baris pun ditulis", () => {
  const badan = potongFungsi(layanan, ["susunRencanaTunda"]);

  it("tanggal yang tidak maju ditolak", () => {
    expect(badan).toContain('alasan: "tanggal_berikut_tidak_maju"');
  });

  it("hari libur ditolak", () => {
    expect(badan).toContain('alasan: "tanggal_berikut_hari_libur"');
  });

  it("tahun yang daftar liburnya belum ada tidak dianggap hari kerja", () => {
    // hariLibur() memulangkan null untuk hari kerja DAN untuk tahun yang
    // daftarnya belum dimuat. Menyamakan keduanya berarti diam-diam
    // menyetujui tanggal yang tidak pernah diperiksa.
    expect(badan).toContain("hariLiburService.tahunTersedia(tahunBerikut)");
    expect(badan).toContain("belum diperiksa terhadap hari libur");
  });

  it("sidang yang sudah ditunda tidak ditunda dua kali", () => {
    // 7 Okt 2026: penundaan yang setengah jadi (tanpa sidang berikutnya)
    // disebut dengan namanya sendiri; yang utuh tetap sidang_sudah_ditunda.
    expect(badan).toContain('alasan: utuh === false ? "tunda_belum_utuh" : "sidang_sudah_ditunda"');
  });

  it("akun pejabatnya harus benar-benar ada di SIPP", () => {
    // Sebabnya berganti nama pada 2.23.0, bukan berganti maksud. Akunnya tidak
    // lagi diketik pemanggil melainkan diturunkan dari perkaranya - panitera
    // pengganti yang aktif pada perkara_panitera_pn - sehingga yang ditolak
    // bukan lagi "username yang disebut tidak ada" melainkan "perkara ini tidak
    // punya panitera sidang".
    //
    // Yang dijaga di sini tetap satu hal: TIDAK ADA baris yang ditulis tanpa
    // pejabat yang sungguh ada. Nama alasannya boleh berubah lagi; yang tidak
    // boleh hilang adalah penolakannya.
    // 7 Okt 2026 (keputusan pengguna): PP perkara, ditolak bila tidak ada /
    // ganda / tanpa akun - tanpa cadangan akun lain.
    expect(potongFungsi(layanan, ["pilihPaniteraSidang"])).toContain('alasan: "panitera_sidang_tidak_ketemu"');
    expect(badan).toContain("const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);");
    expect(badan).toContain("if (!pp.ok) return { ok: false, alasan: pp.alasan");
    expect(badan).not.toContain("akunSipp(minta.olehUsername)");
  });
});

describe("mesin penulisnya satu, tidak disalin dua kali", () => {
  it("rencana dijalankan penjalan milik penulis penetapan", () => {
    // Penjalannya tetap milik penulis penetapan, kini di dalam SATU transaksi
    // (jalankanRencanaUtuh, 7 Okt 2026 - kasus 273).
    expect(layanan).toContain("jalankanRencana: jalankanRencanaUtuh,");
    expect(layanan).toContain("await penetapan.jalankanRencana(rencana, { kering: false, kueri: lewat })");
    expect(layanan).toContain("penetapan.barisAudit({");
  });

  it("barisAudit diekspor dari satu tempat", () => {
    // Dituntut KEBERADAANNYA pada daftar ekspor, bukan letaknya di baris
    // terakhir. Tuntutan lamanya menuntut "barisAudit," diikuti langsung oleh
    // penutup "};" - artinya ia harus ekspor PALING BAWAH - dan menyala merah
    // begitu `tanggalIso` ditambahkan sesudahnya. Yang dijaga di sini satu
    // tempat, bukan urutan; tuntutan yang menuntut urutan menghukum daftar
    // yang bertambah, bukan kode yang keliru.
    const daftarEkspor = penetapan.slice(penetapan.lastIndexOf("module.exports = {"));
    expect(daftarEkspor).toContain("  barisAudit,");
    // Dan benar-benar hanya satu tempat: tidak ada salinannya di penulis hasil sidang.
    expect(layanan).not.toContain("function barisAudit(");
  });

  it("antrian masuk daftar putih tabel - satu-satunya yang baru", () => {
    expect(penetapan).toContain('  "antrian",');
  });
});

describe("antrian sidang", () => {
  it("keadaannya persis manageAntrian.php - 0 menunggu, 1 skors, 2 selesai", () => {
    expect(layanan).toContain("const ANTRIAN_MENUNGGU = 0;");
    expect(layanan).toContain("const ANTRIAN_SKORS = 1;");
    expect(layanan).toContain("const ANTRIAN_SELESAI = 2;");
  });

  it("nol baris bukan error - tidak semua perkara mengambil nomor", () => {
    const badan = potongFungsi(layanan, ["setelAntrian"]);
    expect(badan).toContain("Nol baris BUKAN error");
    expect(badan).toContain("kering: true");
  });
});
