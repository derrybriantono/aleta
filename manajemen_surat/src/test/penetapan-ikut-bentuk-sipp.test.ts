/**
 * Penetapan ditulis dalam BENTUK SIPP, bukan bentuk yang masuk akal sendiri.
 *
 * Ketiganya berasal dari satu perkara sungguhan - 567/Pdt.G/2026/PA.Dgl -
 * yang penetapannya dikerjakan lewat panel lalu dibandingkan baris demi baris
 * dengan tetangganya yang dikerjakan tangan:
 *
 *   1. status sesudah PHS berbunyi "Sidang pertama", bukan nama penetapannya
 *   2. audit tidak menyebut tabel yang SIPP sendiri tidak pernah catat
 *   3. tahapan sesudah bongkar berbunyi "Pendaftaran", statusnya "Pendaftaran
 *      Perkara" - dua nama berbeda yang mudah tertukar
 *
 * Tidak satu pun dari ketiganya pernah menimbulkan galat. Semuanya hanya
 * membuat perkara yang dikerjakan ALETA berdiri sendiri di layar SIPP.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const tulis = baca("aleta_bot/services/penetapanTulisService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const permintaan = baca("manajemen_surat/src/server/shared/request.ts");

/**
 * Komentar dibuang sebelum penjaga MENYANGKAL sesuatu.
 *
 * Berkas ini menjelaskan panjang lebar mengapa perkara_proses tidak lagi
 * diaudit - dan penjelasan itu menyebut "perkara_proses" berkali-kali. Tanpa
 * pembuangan ini, penjaga yang melarang keberadaannya justru tersandung pada
 * kalimat yang menerangkan pelarangannya.
 */
function tanpaKomentar(sumber: string) {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("//"))
    .join("\n");
}

const tulisTanpaKomentar = tanpaKomentar(tulis);

describe("status sesudah PHS - butir 1", () => {
  it("PHS punya langkah lanjutan: proses 81 Sidang pertama", () => {
    // Terukur pada basis data satker: 37 perkara yang berhenti di tahapan
    // penetapan SELURUHNYA berbunyi "Sidang pertama"; nol berbunyi nama
    // penetapannya.
    expect(tulis).toContain("lanjutan: {");
    expect(tulis).toContain("prosesId: 81,");
    expect(tulis).toContain('prosesText: "Sidang pertama",');
  });

  it("baris kedua bertanggal tanggal SIDANG, bukan tanggal penetapan", () => {
    // 615 dari 617 baris proses 81 memakai tanggal sidang; nol memakai
    // tanggal penetapan. Baris itu menyatakan kapan sidangnya digelar.
    expect(tulis).toContain("tanggalDariSidang: true,");
    expect(tulis).toContain(
      "tanggal: jejak.lanjutan.tanggalDariSidang ? minta.tanggalSidang : minta.tanggalPenetapan,"
    );
  });

  it("tabel perkara diperbarui DUA KALI untuk PHS, sekali untuk yang lain", () => {
    // Terhitung pada sys_audittrail 2026: formulir Tambah Penetapan Sidang
    // Pertama meninggalkan 1.636 baris UPDATE perkara untuk 818 penetapan.
    expect(tulis).toContain("const tahap = jejak.lanjutan ? [jejak, jejak.lanjutan] : [jejak];");
    expect(tulis).toContain("for (const langkahTahap of tahap) {");
  });

  it("keadaan akhirnya yang menang - lanjutan ditulis paling belakang", () => {
    const daftar = tulis.indexOf("const tahap = jejak.lanjutan");
    const potong = tulis.slice(daftar, daftar + 200);
    // [jejak, jejak.lanjutan], bukan sebaliknya: yang terakhir dijalankan
    // adalah yang tersimpan.
    expect(potong).toContain("[jejak, jejak.lanjutan]");
  });
});

describe("audit tidak menyebut tabel yang SIPP tidak pernah catat - butir 2", () => {
  it("tidak ada baris audit untuk perkara_proses", () => {
    // Nol baris ditulis SIPP sejak 2016, ratusan ribu baris audit diperiksa.
    // Menyaring audit menurut tablename memulangkan tepat pekerjaan ALETA.
    expect(tulisTanpaKomentar).not.toContain('tabel: "perkara_proses",\n        formulir:');
    expect(tulisTanpaKomentar).not.toContain('tabel: "perkara_proses",\n      formulir:');
  });

  it("tidak ada baris audit untuk perkara_smartmajelis", () => {
    expect(tulisTanpaKomentar).not.toContain('tabel: "perkara_smartmajelis",\n        formulir:');
  });

  it("riwayatnya SENDIRI tetap ditulis - yang dicabut catatan auditnya", () => {
    // Tanpa perkara_proses, tab Riwayat Perkara pada SIPP kosong. Yang
    // dihapus catatan pemeriksaannya, bukan riwayatnya.
    expect(tulis).toContain("langkah.push(\n      barisRiwayat({");
    expect(tulis).toContain('tabel: "perkara_proses",\n      aksi: "DELETE",');
  });

  it("dua tabel diaudit memakai id barisnya sendiri, seperti SIPP", () => {
    // SIPP menulis [id=20117] dan [id=23650] pada kedua tabel ini, bukan
    // [perkara_id=...] - satu perkara punya banyak jadwal sidang.
    expect(tulis).toContain('kunciSendiri: "id=#ID#",');
    expect(tulis).toContain('kunciDariLangkah: { "#ID#": indeksJadwal },');
    expect(tulis).toContain('"#ID#": indeksHariSidang, "#IDJADWAL#": indeksJadwal');
  });

  it("penanda yang id-nya tidak lahir DIBIARKAN, tidak ditebak", () => {
    // Baris audit yang menyebut kunci keliru lebih buruk daripada baris yang
    // tampak belum selesai: yang pertama terbaca sebagai fakta.
    expect(tulis).toContain("if (!idKunci) continue;");
  });

  it("membongkar PHS membongkar KEDUA baris riwayatnya", () => {
    // Membongkar satu saja menyisakan "Sidang pertama" pada perkara yang hari
    // sidangnya sudah dibatalkan.
    expect(tulis).toContain(
      "const prosesRiwayat = [jejak.prosesId].concat(jejak.lanjutan ? [jejak.lanjutan.prosesId] : []);"
    );
  });
});

describe("tahapan sesudah bongkar - butir 3", () => {
  it('tahapannya "Pendaftaran", statusnya "Pendaftaran Perkara"', () => {
    // Dua nama berbeda untuk satu langkah. Ditiru dari salinan cadangan
    // satker, yang seluruh isinya tulisan SIPP sendiri.
    expect(tulis).toContain(
      'return { tahapanId: 10, tahapanText: "Pendaftaran", prosesId: 10, prosesText: "Pendaftaran Perkara" };'
    );
  });

  it("keduanya memang BERBEDA - itulah seluruh isi butir ini", () => {
    const baris = tulis
      .split("\n")
      .find((x) => x.includes("tahapanId: 10, tahapanText:"));
    expect(baris).toBeTruthy();
    const tahapan = /tahapanText: "([^"]+)"/.exec(baris || "")?.[1];
    const proses = /prosesText: "([^"]+)"/.exec(baris || "")?.[1];
    expect(tahapan).toBe("Pendaftaran");
    expect(proses).toBe("Pendaftaran Perkara");
    expect(tahapan).not.toBe(proses);
  });

  it("PHS yang TERSISA kembali menjadi Sidang pertama, bukan nama penetapannya", () => {
    expect(tulis).toContain("return JEJAK_PROSES[jenis].lanjutan || JEJAK_PROSES[jenis];");
  });

  it("nilai auditnya menyebut tahapan_terakhir_text yang berubah", () => {
    const fungsi = tulis.slice(tulis.indexOf("const kembali = tahapanSetelahHapus("));
    expect(fungsi.slice(0, 1600)).toContain("tahapan_terakhir_text: kembali.tahapanText,");
  });
});

describe("alamat pada baris audit - peramban petugas, bukan peti ALETA", () => {
  it("portal menentukan alamatnya di satu tempat, dan hanya IPv4", () => {
    // Kolomnya varchar(15): alamat IPv6 akan terpotong di tengah dan menjadi
    // alamat lain yang keliru.
    expect(permintaan).toContain("export function alamatIpPeramban(");
    expect(permintaan).toContain("bersih.length <= 15");
  });

  it("entri TERAKHIR yang dipakai - yang pertama dapat dikarang peramban", () => {
    // Apache menambahkan alamat pengirim ke ujung X-Forwarded-For yang sudah
    // ada. Peramban yang mengirim header itu sendiri menentukan entri
    // pertamanya, dan alamat karangan pada baris audit atas nama pejabat lebih
    // buruk daripada alamat yang keliru tetapi jujur.
    expect(permintaan).toContain("diteruskan[diteruskan.length - 1],");
    expect(permintaan).not.toContain('ambil("x-forwarded-for").split(",")[0]');
  });

  it("yang tidak sah dipulangkan KOSONG, bukan alamat karangan", () => {
    // Potongannya dihitung sampai ujung fungsinya, bukan sekian ratus huruf:
    // catatan di dalamnya memanjang, dan penjaga yang memotong sekian huruf
    // akan gagal karena panjang komentar - bukan karena kodenya salah.
    const mulai = permintaan.indexOf("export function alamatIpPeramban(");
    const fungsi = permintaan.slice(mulai, permintaan.indexOf("\n}", mulai));
    expect(fungsi).toContain('return "";');
  });

  it("bot mendahulukan alamat kiriman portal, dengan jalan mundur", () => {
    expect(gerbang).toContain("function alamatAudit(req) {");
    expect(gerbang).toContain("const dariPortal = String((req.body && req.body.ip) || \"\").trim();");
    // Jalan mundurnya tetap ada: portal lama yang belum mengirim alamat tidak
    // boleh membuat penetapannya gagal.
    expect(gerbang).toContain("return String(req.ip || (req.socket && req.socket.remoteAddress)");
  });

  it("ketiga rute penetapan mengirimkannya", () => {
    for (const rute of ["tulis", "hapus", "hapus-semua"]) {
      const isi = baca(`manajemen_surat/src/app/api/aleta-bot/penunjukan/${rute}/route.ts`);
      expect(isi, rute).toContain("ip: alamatIpPeramban(request),");
    }
  });
});
