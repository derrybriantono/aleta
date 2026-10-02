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
/**
 * Pemeriksaan akar SIPP hidup di sini sejak 23 September 2026 - unggah putusan
 * dan unggah penetapan menanyakan jawaban yang sama, supaya keduanya tidak
 * pernah berselisih tentang folder mana yang berlaku.
 */
const botPenetapan = readFileSync(
  path.join(akar, "aleta_bot/services/dokumenPenetapanService.js"),
  "utf8"
);

describe("nama berkas dan letaknya meniru SIPP", () => {
  it("nomor perkara disusun TERBALIK, seperti fileupload_putusan_c.php", () => {
    // 492/Pdt.G/2026/PA.Dgl -> PA.Dgl_2026_Pdt.G_492_putusan_akhir.<ekstensi>
    expect(bot).toContain("`${bagian[3]}_${bagian[2]}_${bagian[1]}_${bagian[0]}_${akhiran}.${ext}`");
    expect(bot).toContain('.replace(/ /g, "_")');
  });

  it("ekstensinya DIBATASI - nama berkas tidak boleh menembus folder", () => {
    // Ekstensi kini datang dari bentuk berkas yang diunggah. Yang datang apa
    // adanya dari luar adalah jalan masuk bagi nama yang menembus folder
    // ("../"), dan yang ditulis di sini berada di dalam cakram SIPP.
    expect(bot).toContain('/^[a-z0-9]{1,5}$/i.test(String(ekstensi))');
  });

  it("nomor yang bentuknya lain ditolak, bukan disusun seadanya", () => {
    // Berkas bernama dari nomor yang bentuknya lain tidak akan pernah
    // ditemukan Direktori Putusan.
    expect(bot).toContain('if (bagian.length !== 4 || bagian.some((x) => !x.trim())) return "";');
  });

  it("foldernya dari TANGGAL PUTUSAN, bukan tanggal hari ini", () => {
    // Putusan bulan lalu yang diunggah hari ini akan tersimpan di folder yang
    // salah - barisnya benar, berkasnya ada, dan tetap tidak ketemu.
    // Ekstensi ditambahkan sebagai argumen keempat sejak RTF/DOC/DOCX
    // diterima: satu naskah menghasilkan dua jalur, dan keduanya berbeda
    // hanya pada akhirannya.
    expect(bot).toContain(
      'function jalurRelatif(nomorPerkara, jenis, tanggalPutusan, ekstensi = "pdf")'
    );
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
    const tulisBerkas = badan.indexOf("fs.writeFileSync(penuhAsli, pdf)");
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

  it("audit trail SIPP berbentuk SIPP, tanpa tanda ALETA (butir 14, 2 Okt 2026)", () => {
    // DIUBAH 2 Oktober 2026 atas keputusan pengguna (butir 14, kontrak K4),
    // membalik keputusan 25 September: di SIPP tidak boleh ada tanda ALETA,
    // pelakunya petugas yang login, dan jejak jujur (siapa + waktu + IP +
    // "lewat ALETA") pindah ke jejakAletaService. Penjaga yang MENJALANKAN
    // layanannya ada di unggah-audit-sipp.test.ts dan backend-2okt.test.ts.
    expect(bot).toContain("INSERT INTO sys_audittrail");
    expect(bot).toContain('formname: "UPLOAD E-DOCS PUTUSAN AKHIR"');
    expect(bot).not.toContain("FORMNAME_ALETA");
    expect(bot).not.toContain("lewat <b>ALETA");
    expect(bot).not.toContain("Ditulis otomatis oleh ALETA");
    expect(bot).not.toContain("Kelola Dokumen Elektronik (E-Doc)");
  });

  it("anonimisasi selalu published, putusan akhir tidak", () => {
    expect(bot).toContain('const published = jenis === "anonimisasi" ? 1 : 0;');
  });
});

describe("e-Doc dan Direktori Putusan adalah DUA berkas", () => {
  /**
   * Cacat struktur yang paling lama tersembunyi: kolom perkara_putusan dan
   * baris dirput_dokumen dulu diisi JALUR YANG SAMA.
   *
   * SIPP mengisinya dengan dua jalur berbeda - diperiksa pada perkara
   * September 2026 satker: perkara_id 10001 memegang
   * ..._putusan_akhir.RTF pada kolom e-Doc dan ..._putusan_akhir.PDF pada
   * dirput_dokumen. Mengisi keduanya dengan satu jalur membuat Direktori
   * Putusan menunjuk berkas yang tidak dapat dibacanya.
   */
  it("kolom perkara_putusan menerima jalur ASLI", () => {
    expect(bot).toContain("SET ${kolom} = ? WHERE perkara_id = ?`, [relatifAsli, perkaraId]");
  });

  it("dirput_dokumen menerima jalur PDF, bukan jalur aslinya", () => {
    const i = bot.indexOf("INSERT INTO dirput_dokumen");
    expect(i).toBeGreaterThan(-1);
    const blok = bot.slice(i, i + 700);
    expect(blok).toContain("path.basename(relatifPdf), relatifPdf");
    expect(blok, "jalur asli tidak boleh masuk Direktori Putusan").not.toContain(
      "path.basename(relatifAsli)"
    );
  });

  it("PDF dibuat UTUH DI MEMORI sebelum satu berkas pun ditulis", () => {
    // Inilah yang menjawab ketakutan "pengubahan yang gagal separuh": yang
    // mencegahnya URUTAN, bukan penolakan.
    const badan = bot.slice(bot.indexOf("async function unggahSatu("));
    const konversi = badan.indexOf("abtCetakService.dokumenKePdf(pdf)");
    const tulis = badan.indexOf("fs.writeFileSync(penuhAsli, pdf)");
    expect(konversi).toBeGreaterThan(-1);
    expect(tulis, "berkas ditulis sebelum konversinya selesai").toBeGreaterThan(konversi);
  });

  it("tanpa PDF, baris Direktori Putusan TIDAK ditulis - dan itu disebut", () => {
    // Ke-26 baris .rtf yang ada di dirput_dokumen satker adalah bekas
    // konversi yang gagal; salah satunya published = 1, artinya berkas yang
    // tidak dapat dibaca Direktori Putusan terlanjur terbit.
    expect(bot).toContain('alasan: "pdf_belum_dapat_dibuat"');
    expect(bot).toContain("sebagian: true");
    const i = bot.indexOf('alasan: "pdf_belum_dapat_dibuat"');
    const j = bot.indexOf("INSERT INTO dirput_dokumen");
    expect(i, "penundaan harus MENDAHULUI penulisan barisnya").toBeLessThan(j);
  });

  it("e-Doc tetap tersimpan walau soffice tidak ada", () => {
    // Menolak seluruh unggahan karena pengubahnya belum terpasang menahan
    // pekerjaan yang sebenarnya sudah dapat diselesaikan separuh - dan SIPP
    // sendiri menyimpan berkasnya lebih dulu, mengubah kemudian.
    const i = bot.indexOf('alasan: "pdf_belum_dapat_dibuat"');
    const blok = bot.slice(Math.max(0, i - 400), i + 400);
    expect(blok).toContain("ok: true");
    expect(blok).toContain("jalur: relatifAsli");
  });
});

describe("yang ditolak, beserta sebabnya", () => {
  it("bentuk berkas dikenali dari BITANYA, bukan dari nama berkasnya", () => {
    // Nama dapat diubah siapa saja; kepala berkasnya tidak.
    expect(bot).toContain("abtCetakService.kenaliDokumen(pdf)");
    expect(bot).toContain('alasan: "bentuk_tidak_dikenali"');
  });

  it("perkara yang belum diputus ditolak dengan kalimat yang menyebut jalan keluarnya", () => {
    expect(bot).toContain('alasan: "belum_ada_putusan"');
    expect(bot).toContain("Simpan Putusan Akhir lebih dulu");
  });

  it("akar SIPP yang belum disetel disebut, bukan ditebak", () => {
    // ========================================================================
    // TIGA KEADAAN, BUKAN SATU - DAN DULU KETIGANYA SATU KALIMAT
    // ========================================================================
    //
    // Penjaga ini dulu menuntut kalimatnya ada di putusanUnggahService sendiri.
    // Sejak 23 September 2026 pemeriksaannya pindah ke dokumenPenetapanService
    // supaya unggah putusan dan penetapan memakai jawaban yang sama, dan
    // sekalian membedakan tiga keadaan yang dahulu tertutup satu kalimat:
    //
    //     belum disetel   dapat diperbaiki lewat pengaturan ALETA
    //     tidak ada       mount-nya tidak sampai ke container
    //     hanya baca      menuntut mount baru dan container dijalankan ulang
    //
    // Diukur di peladen: pengaturannya memang null DAN folder SIPP terpasang
    // hanya-baca, sehingga menyetel pengaturan saja hanya memindahkan galatnya
    // satu langkah. Petugas tidak dapat membedakan ketiganya sendiri, jadi
    // pesannya yang harus membedakannya.
    expect(botPenetapan).toContain('alasan: "akar_sipp_belum_disetel"');
    expect(botPenetapan).toContain('alasan: "akar_sipp_tidak_ada"');
    expect(botPenetapan).toContain('alasan: "akar_sipp_hanya_baca"');
    // Unggah putusan menanyakannya, tidak memutuskannya sendiri - dan
    // WAJIB menyebut folder tujuannya. Bentuk tanpa argumen menguji izin
    // tulis pada AKAR SIPP, yang memang tetap hanya-baca; dengan bentuk itu
    // unggahan berhenti pada "hanya baca" selamanya walau folder putusannya
    // sudah dapat ditulis.
    expect(bot).toContain("dokumenPenetapanService.periksaAkarSipp(undefined, {");
    expect(bot, "bentuk tanpa folder tujuan tidak boleh kembali").not.toContain(
      "dokumenPenetapanService.periksaAkarSipp()"
    );
  });
});

describe("panel", () => {
  it("menerima RTF, DOC, DOCX, dan PDF", () => {
    // Diukur pada perkara_putusan.amar_putusan_dok satker, 9.903 nilai
    // terisi: .rtf 8.686 (87,7%), .docx 458, .doc 442, .pdf 315 (3,2%).
    // Menyaring ke PDF saja menolak 96,8% naskah yang sah.
    const badan = konten.slice(konten.indexOf("function bagianUnggahPutusanSipp("));
    expect(badan.slice(0, 5000)).toContain('pemilih.accept = ".rtf,.doc,.docx,.pdf";');
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
