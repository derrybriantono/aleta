// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SESUDAH PENETAPAN, HALAMANNYA HARUS KEMBALI KE PERKARA ITU JUGA
 * ============================================================================
 *
 * location.reload() pada halaman detail perkara SIPP selalu berakhir di
 * dasbor. Nomor perkaranya tidak pernah ada di alamat; controllernya
 * mengambilnya dari flash session yang HABIS begitu dibaca:
 *
 *     $idperkara = $this->nativesession->get_flash_session('perkara_id');
 *     if(!is_numeric($idperkara)){ redirect('main'); }
 *
 * Jadi pemuatan kedua membaca sesi kosong lalu dialihkan ke 'main'. Terbaca
 * oleh petugas sebagai penetapan yang gagal - padahal keempatnya tersimpan,
 * dan halamannya saja yang pindah.
 *
 * Pintu masuk yang sah adalah perkara_detil/<enc>, dan <enc> milik halaman itu
 * sudah tercetak di halamannya sendiri pada pemuat tab Data Umum.
 *
 * Penjaga sumber, bukan uji perilaku - alasannya sama dengan berkas uji panel
 * di sebelah: konten.js hidup di dalam halaman SIPP.
 */

const berkasKonten = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const berkasPopup = path.resolve(process.cwd(), "../ekstensi-sipp/popup.html");

const konten = () => readFileSync(berkasKonten, "utf8");
const popup = () => readFileSync(berkasPopup, "utf8");

/** Pola pencari <enc> diambil dari sumbernya, bukan disalin ke sini. */
function polaEnc(): RegExp {
  const isi = konten();
  const baris = /const cocok = (\/.*\/)\.exec\(isi\);/.exec(isi);
  if (!baris) throw new Error("pola pencari enc tidak ketemu di alamatMasukPerkara");
  const badan = baris[1].slice(1, baris[1].lastIndexOf("/"));
  return new RegExp(badan);
}

describe("alamat halaman perkara yang boleh dibuka ulang", () => {
  it("membaca <enc> dan alamat pangkalnya dari pemuat tab Data Umum", () => {
    // Persis bentuk yang dicetak SIPP - lihat views/perkara/detil_perkara_agama.php:
    //     $('#tabs1').load('<?php echo base_url("open_dataumum/".$enc);?>');
    const halaman = [
      "<script>",
      "  $('#tabs1').load('http://127.0.0.1:8056/open_dataumum/dGVzdCtlbmM9');",
      "  $('#tabs4').load('http://127.0.0.1:8056/view_info_jadwal_sidang/dGVzdCtlbmM9');",
      "</script>",
    ].join("\n");

    const cocok = polaEnc().exec(halaman);
    expect(cocok).not.toBeNull();
    expect(cocok![1]).toBe("http://127.0.0.1:8056/");
    expect(cocok![2]).toBe("dGVzdCtlbmM9");
    expect(`${cocok![1]}perkara_detil/${cocok![2]}`).toBe(
      "http://127.0.0.1:8056/perkara_detil/dGVzdCtlbmM9"
    );
  });

  it("tidak ikut menelan tanda kutip maupun ruas alamat berikutnya", () => {
    // add_saksi/<enc>/add adalah bentuk yang lazim di halaman yang sama; kalau
    // polanya rakus, ruas "/add" ikut terbawa dan alamatnya menjadi 404.
    const cocok = polaEnc().exec(
      `popup_form('https://sipp.pa-donggala.go.id/index.php/add_saksi/QUJD/add')` +
        `\n$('#tabs1').load('https://sipp.pa-donggala.go.id/index.php/open_dataumum/QUJD');`
    );
    expect(cocok).not.toBeNull();
    expect(cocok![1]).toBe("https://sipp.pa-donggala.go.id/index.php/");
    expect(cocok![2]).toBe("QUJD");
  });

  it("berlaku untuk pemasangan di dalam subfolder", () => {
    const cocok = polaEnc().exec(`$('#tabs1').load('http://10.0.0.5/sipp/index.php/open_dataumum/WFla');`);
    expect(cocok![1]).toBe("http://10.0.0.5/sipp/index.php/");
    expect(cocok![2]).toBe("WFla");
  });

  it("halaman yang tidak memuatnya memulangkan kosong, bukan alamat setengah jadi", () => {
    expect(polaEnc().exec("<html><body>daftar perkara</body></html>")).toBeNull();
  });
});

describe("tidak ada lagi pemuatan ulang yang terjatuh ke dasbor", () => {
  it("kedua tempat memuat ulang memanggil muatUlangHalamanPerkara", () => {
    const isi = konten();
    // Lima sejak 1.124.0:
    //
    //   1. sesudah penetapan tertulis
    //   2. sesudah satu penetapan dibongkar
    //   3. sesudah SELURUH penetapan perkara dibongkar sekaligus
    //   4. sesudah putusan dan anonimisasinya terunggah ke SIPP - kolom
    //      dokumennya baru memperlihatkan berkasnya sesudah halaman dibaca
    //      ulang, dan tanpa itu petugas melihat kolom kosong tepat sesudah
    //      diberi tahu berkasnya terunggah
    //   5. sesudah borang putusan disimpan dan SIPP terbukti mencatatnya
    //   6. sesudah edoc putusan dan edoc anonimisasi terunggah SEKALIGUS dari
    //      dua tempat terpisah (tampilan Baru & UI Baru, 1.174.1) - alasan
    //      yang sama dengan nomor 4
    //   7. (perbaikan 30 Sep 2026, butir 19, Baru & UI Baru) sesudah putusan
    //      terbukti tersimpan DAN edoc putusan + anonimisasinya terunggah dalam
    //      satu kali kerja - cabang simpanPutusanLaluBuka yang memakai
    //      opsi.sesudahTersimpan; bila edoc gagal, halaman TIDAK dimuat ulang
    //   8. (6 Okt 2026, butir 6) cabang yang sama di ANTREAN MASSAL: edoc yang
    //      gagal tetap memuat ulang (opsi.lanjutWalauEdocGagal) supaya antrean
    //      berlanjut ke perkara berikutnya - sebabnya tercatat di butirnya
    //
    // Kedelapannya lewat muatUlangHalamanPerkara, bukan location.reload() -
    // halaman borang SIPP dibuka lewat sesi kilat, dan memuat ulangnya
    // mendaratkan petugas di dasbor.
    expect(isi.split("setTimeout(muatUlangHalamanPerkara,").length - 1).toBe(8);
    expect(isi.includes("setTimeout(() => location.reload()")).toBe(false);
  });

  it("location.reload() hanya tersisa sebagai upaya terakhir di dalam pemuatnya", () => {
    const isi = konten();
    // Dua kemunculan: satu di penjelasan kepala fungsinya, satu di kodenya.
    expect(isi.split("else location.reload();").length - 1).toBe(1);
    const pemuat = /function muatUlangHalamanPerkara\(\) \{[\s\S]*?\n\}/.exec(isi);
    expect(pemuat).not.toBeNull();
    expect(pemuat![0].includes("location.assign(alamat)")).toBe(true);
    expect(pemuat![0].includes("location.reload()")).toBe(true);
  });

  it("riwayat perkara menyimpan alamat yang dapat dibuka ulang", () => {
    // Riwayat menyimpan location.href apa adanya berarti menyimpan tautan yang
    // sama tidak dapat dipakainya - ditekan, ia mendarat di dasbor.
    expect(konten().includes("url: alamatMasukPerkara() || location.href")).toBe(true);
  });
});

describe("popup ekstensi", () => {
  it("kartunya tertutup semua - tidak ada yang tersarang di kartu lain", () => {
    // Kartu "Ukuran huruf panel" pernah tidak ditutup, sehingga kartu
    // "Pembaruan ekstensi", tombol posisi panel, dan kaki popup semuanya
    // masuk ke dalamnya.
    const isi = popup();
    let dalam = 0;
    let terendah = 0;
    for (const tanda of isi.match(/<div\b|<\/div>/g) || []) {
      dalam += tanda === "</div>" ? -1 : 1;
      if (dalam < terendah) terendah = dalam;
    }
    expect(dalam).toBe(0);
    expect(terendah).toBe(0);
  });

  it("peraga ukuran huruf punya barisnya sendiri", () => {
    // Sebaris dengan tombol - dan +, di popup selebar 300 piksel ia tersisa
    // "Co..." saja.
    const isi = popup();
    expect(isi.includes('<p id="skalaContoh" class="skala-peraga">')).toBe(true);
    const baris = /<div class="skala-atur">([\s\S]*?)<\/div>/.exec(isi);
    expect(baris).not.toBeNull();
    expect(baris![1].includes("skalaContoh")).toBe(false);
  });

  it("penjelasan posisi panel ringkas satu baris", () => {
    const isi = popup();
    const ket = /Kembalikan posisi panel[\s\S]*?<p class="saklar-ket">(.*?)<\/p>/.exec(isi);
    expect(ket).not.toBeNull();
    expect(ket![1].length).toBeLessThan(90);
  });
});
