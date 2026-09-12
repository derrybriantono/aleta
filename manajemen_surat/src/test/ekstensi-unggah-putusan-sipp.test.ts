// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Mengunggah putusan akhir dan anonimisasinya ke SIPP.
 *
 * Ini satu-satunya jalur putusan yang benar-benar MENULIS ke SIPP: berkas ke
 * cakramnya, kolom dokumen pada perkara_putusan, baris dirput_dokumen, dan
 * antrean Direktori Putusan. Karena itu yang dijaga di sini bukan tampilannya
 * melainkan KESETIAANNYA pada cara SIPP sendiri mengerjakannya - baris yang
 * berbeda bentuk akan lolos hari ini dan gagal pada hari Direktori Putusan
 * menyinkronkannya, jauh sesudah tidak ada yang ingat siapa menulisnya.
 */

const akar = path.resolve(process.cwd(), "..");
const bot = readFileSync(path.join(akar, "aleta_bot/services/putusanUnggahService.js"), "utf8");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");

describe("nama berkas dan letaknya meniru SIPP", () => {
  it("nomor perkara disusun TERBALIK, seperti fileupload_putusan_c.php", () => {
    // 492/Pdt.G/2026/PA.Dgl -> PA.Dgl_2026_Pdt.G_492_putusan_akhir.pdf
    expect(bot).toContain("`${bagian[3]}_${bagian[2]}_${bagian[1]}_${bagian[0]}_${akhiran}.pdf`");
    expect(bot).toContain('.replace(/ /g, "_")');
  });

  it("nomor yang bentuknya lain ditolak, bukan disusun seadanya", () => {
    // Berkas bernama dari nomor yang bentuknya lain tidak akan pernah
    // ditemukan Direktori Putusan.
    expect(bot).toContain('if (bagian.length !== 4 || bagian.some((x) => !x.trim())) return "";');
  });

  it("foldernya dari TANGGAL PUTUSAN, bukan tanggal hari ini", () => {
    // Putusan bulan lalu yang diunggah hari ini akan tersimpan di folder yang
    // salah - barisnya benar, berkasnya ada, dan tetap tidak ketemu.
    expect(bot).toContain("function jalurRelatif(nomorPerkara, jenis, tanggalPutusan)");
    expect(bot).toContain("SELECT tanggal_putusan FROM perkara_putusan");
    expect(bot).toContain("resources/file/${FOLDER[jenis]}/${tgl[0]}/${tgl[1]}/${berkas}");
  });

  it("dua folder yang berbeda untuk dua jenisnya", () => {
    expect(bot).toContain('const FOLDER = { putusan: "doc", anonimisasi: "anonimisasi" };');
  });
});

describe("baris yang ditulis ke SIPP", () => {
  it("dokumen_ref_id dibaca dari alur perkaranya, bukan angka tetap", () => {
    // Pada perkara 492 nilainya 89 dan 79; pada alur lain berbeda.
    expect(bot).toContain("FROM perkara AS a");
    expect(bot).toContain("LEFT JOIN dirput_dokumen_ref AS b ON a.alur_perkara_id = b.alur_perkara_id");
    expect(bot).toContain("const URUTAN_REF = { putusan: 99, anonimisasi: 100 };");
  });

  it("berkas ditulis DAHULU, barisnya sesudahnya", () => {
    const badan = bot.slice(bot.indexOf("async function unggahSatu("));
    const tulisBerkas = badan.indexOf("fs.writeFileSync(penuh, pdf)");
    const tulisBaris = badan.indexOf("UPDATE perkara_putusan SET");
    expect(tulisBerkas).toBeGreaterThan(-1);
    expect(tulisBaris).toBeGreaterThan(tulisBerkas);
  });

  it("mengunggah ulang TIDAK meninggalkan baris kedua", () => {
    expect(bot).toContain("SELECT id FROM dirput_dokumen WHERE perkara_id = ? AND dokumen_ref_id = ?");
    expect(bot).toContain("UPDATE dirput_dokumen");
  });

  it("antreannya satu, bukan satu per berkas", () => {
    // insert_antrian_upload milik SIPP menaruh satu baris per unggahan, dan
    // dua baris untuk satu perkara membuat penyinkron mengerjakannya dua kali.
    expect(bot).toContain("SELECT id FROM dirput_antrian WHERE perkara_id = ? AND status = 0");
    expect(bot).toContain("INSERT INTO dirput_antrian (perkara_id, status, keterangan, tgl_masuk) VALUES (?, 0, NULL, ?)");
  });

  it("dirput_perkara SENGAJA tidak ditulis", () => {
    // putusan_id dan link_dirput diberikan Direktori Putusan MA sesudah
    // putusannya terbit. Mengarangnya berarti menautkan perkara ini ke
    // putusan orang lain saat sinkronisasi.
    // Yang dijaga KUERINYA, bukan kosakata catatannya - catatan di kepala
    // berkas justru menyebut putusan_id untuk menerangkan kenapa ia tidak
    // pernah ditulis.
    expect(bot).not.toContain("INSERT INTO dirput_perkara");
    expect(bot).not.toContain("UPDATE dirput_perkara");
    expect(bot).not.toMatch(/putusan_id\s*[=:]/);
    expect(bot).toContain("dirput_perkara");
  });

  it("audit trail ditulis, TANPA satu kata pun tentang ALETA", () => {
    // sys_audittrail catatan milik SIPP, dibaca petugas SIPP - dan tidak ada
    // satu pun baris SIPP yang menyebut alat yang dipakai mengetiknya.
    expect(bot).toContain("INSERT INTO sys_audittrail");
    expect(bot).not.toContain("[ALETA]");
    expect(bot).toContain("Kelola Dokumen Elektronik (E-Doc)");
  });

  it("anonimisasi selalu published, putusan akhir tidak", () => {
    expect(bot).toContain('const published = jenis === "anonimisasi" ? 1 : 0;');
  });
});

describe("yang ditolak, beserta sebabnya", () => {
  it("PDF dikenali dari BITANYA, bukan dari nama berkasnya", () => {
    expect(bot).toContain('pdf.slice(0, 4).toString("latin1") !== "%PDF"');
  });

  it("perkara yang belum diputus ditolak dengan kalimat yang menyebut jalan keluarnya", () => {
    expect(bot).toContain('alasan: "belum_ada_putusan"');
    expect(bot).toContain("Simpan Putusan Akhir lebih dulu");
  });

  it("akar SIPP yang belum disetel disebut, bukan ditebak", () => {
    expect(bot).toContain('alasan: "akar_sipp_belum_disetel"');
  });
});

describe("panel", () => {
  it("hanya menerima PDF", () => {
    const badan = konten.slice(konten.indexOf("function bagianUnggahPutusanSipp("));
    expect(badan.slice(0, 4000)).toContain('pemilih.accept = ".pdf,application/pdf";');
  });

  it("kewenangannya penunjukan - ini menulis ke SIPP, bukan membaca", () => {
    expect(konten).toContain('if (boleh("penunjukan")) {\n    kelPutusan.isi.appendChild(bagianUnggahPutusanSipp(konteks.nomorPerkara));');
  });

  it("akun SIPP yang tercatat, bukan akun ALETA", () => {
    const badan = konten.slice(konten.indexOf("function bagianUnggahPutusanSipp("));
    expect(badan.slice(0, 5000)).toContain('badan.append("olehUsername", namaPenggunaSipp() || "")');
  });

  it("tiap berkas dilaporkan sendiri - satu gagal di antara dua bukan gagal", () => {
    const badan = konten.slice(konten.indexOf("function bagianUnggahPutusanSipp("));
    expect(badan.slice(0, 6000)).toContain("for (const b of jawab.berkas || [])");
  });
});
