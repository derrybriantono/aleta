/**
 * ============================================================================
 * NAMA UNDUHAN ABT, DAN LENCANA YANG DIBENTANGKAN KEMBALI
 * ============================================================================
 *
 * Dua keluhan petugas pada 17 September 2026, dan keduanya terukur.
 *
 * NAMA BERKAS. Pada folder unduhan terlihat "download (9).rtf", "download
 * (4).pdf" - nama bawaan peramban. Yang diminta satker: nomor perkara - jenis
 * perkara - status putusan. Dua sebab, dua tempat:
 *
 *   - papan massal sudah menerima jenisPerkara dari daftar sidang tetapi
 *     MEMBUANGNYA, lalu tempatnya diisi ringkasBlangkoAbt() - potongan kepala
 *     halaman blangko, yang bukan jenis perkara dan berubah tiap halaman;
 *   - halaman satu perkara tidak punya sumbernya sama sekali; tidak ada satu
 *     pun permintaan yang memulangkan jenis perkara atau status putusan.
 *
 * LENCANA. Panel yang diciutkan menyembunyikan seluruh anaknya dengan
 * display:none, sehingga membentangkannya menata ulang SEMUA isinya sekaligus.
 * Diukur atas replika panel, 25 putaran tiap ukuran, tiap putaran dipaksa
 * menghitung tata letaknya:
 *
 *       simpul        sebelum        sesudah
 *          200        7,90 ms        1,20 ms
 *          800       34,10 ms        4,80 ms
 *        2.000       87,60 ms       15,10 ms
 *        5.000      265,90 ms       35,90 ms   (terburuk 565,80 -> 82,70)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const abt = baca("ekstensi-sipp/abt.js");
const latar = baca("ekstensi-sipp/latar.js");
const css = baca("ekstensi-sipp/panel.css");
const perkakas = baca("ekstensi-sipp/panel-alat.js");
const layanan = baca("aleta_bot/services/abtUsulanService.js");

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

type Keadaan = { jenisPerkara?: string; statusPutusan?: string; verstek?: boolean };

function muatNamaBerkas(peta: Map<string, Keadaan>) {
  const sumber = potongFungsi(abt, ["sebutStatusPutusan", "sebutJenisPerkara", "namaBerkas"]);
  const buat = new Function("statusPutusanPerkara", `${sumber}\nreturn namaBerkas;`);
  return buat(peta) as (nomor: string, akhiran: string, jenis: string) => string;
}

function muatNamaUnduhan() {
  const sumber = potongFungsi(latar, ["namaUnduhanAbt"]);
  return new Function(`${sumber}\nreturn namaUnduhanAbt;`)() as (
    nama: string,
    konteks: { nomor: string; jenisPerkara: string; statusPutusan: string }
  ) => string;
}

describe("nama berkas unduhan panel", () => {
  it("nomor perkara - jenis perkara - status putusan", () => {
    const peta = new Map<string, Keadaan>([
      ["600/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "Dikabulkan", verstek: false }],
    ]);
    const namaBerkas = muatNamaBerkas(peta);
    expect(namaBerkas("600/Pdt.G/2026/PA.Dgl", "rtf", "putusan")).toBe(
      "600_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan.rtf"
    );
  });

  it("verstek disebut sekali, tidak diulang bila statusnya sudah memuatnya", () => {
    const namaA = muatNamaBerkas(
      new Map([["1/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Talak", statusPutusan: "Dikabulkan", verstek: true }]])
    );
    expect(namaA("1/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toContain("Dikabulkan verstek");

    const namaB = muatNamaBerkas(
      new Map([
        ["2/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "DIKABULKAN (verstek)", verstek: true }],
      ])
    );
    expect(namaB("2/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toBe(
      "2_Pdt.G_2026_PA.Dgl - Cerai Gugat - DIKABULKAN (verstek).pdf"
    );
  });

  it("anonim tetap berpenanda supaya tidak menimpa putusannya", () => {
    const peta = new Map<string, Keadaan>([
      ["3/Pdt.G/2026/PA.Dgl", { jenisPerkara: "Cerai Gugat", statusPutusan: "Dikabulkan" }],
    ]);
    const namaBerkas = muatNamaBerkas(peta);
    const putusan = namaBerkas("3/Pdt.G/2026/PA.Dgl", "rtf", "putusan");
    const anonim = namaBerkas("3/Pdt.G/2026/PA.Dgl", "rtf", "anonimisasi");
    expect(anonim).not.toBe(putusan);
    expect(anonim).toContain(" - anonimisasi.rtf");
    expect(putusan).not.toContain("anonim");
    expect(namaBerkas("3/Pdt.G/2026/PA.Dgl", "pdf", "putusan")).toBe(putusan.replace(/\.rtf$/, ".pdf"));
  });

  it("perkara yang belum dikenal tetap memakai nomornya, bukan mengarang", () => {
    const namaBerkas = muatNamaBerkas(new Map());
    expect(namaBerkas("4/Pdt.G/2026/PA.Dgl", "rtf", "putusan")).toBe("4_Pdt.G_2026_PA.Dgl.rtf");
  });

  it("kepala halaman blangko tidak lagi dipakai sebagai jenis perkara", () => {
    expect(potongFungsi(abt, ["namaBerkas"])).not.toContain("ringkasBlangkoAbt()");
  });
});

describe("nama unduhan yang diterbitkan ABT sendiri", () => {
  it("bentuknya sama dengan nama berkas panel", () => {
    const namaUnduhanAbt = muatNamaUnduhan();
    expect(
      namaUnduhanAbt("download (9).rtf", {
        nomor: "600/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        statusPutusan: "Dikabulkan",
      })
    ).toBe("600_Pdt.G_2026_PA.Dgl - Cerai Gugat - Dikabulkan.rtf");
  });

  it("tidak lagi menempelkan kata putusan pada tiap berkas", () => {
    const badan = potongFungsi(latar, ["namaUnduhanAbt"]);
    expect(badan).not.toContain('"putusan"');
    expect(badan).toContain("konteks.jenisPerkara");
    expect(badan).toContain("konteks.statusPutusan");
  });

  it("konteks yang dikirim halaman ABT membawa kedua medan itu", () => {
    expect(abt).toContain("jenisPerkara: sebutJenisPerkara(nomor),");
    expect(abt).toContain("statusPutusan: sebutStatusPutusan(nomor),");
    expect(latar).toContain("jenisPerkara: String(pesan.jenisPerkara || \"\").slice(0, 60),");
  });
});

describe("sumber jenis perkara pada halaman satu perkara", () => {
  it("usulan SIPP ikut memulangkan keterangan perkaranya", () => {
    expect(layanan).toContain("p.jenis_perkara_text AS jenisPerkara");
    expect(layanan).toContain("pp.status_putusan_text AS statusPutusan");
    expect(layanan).toContain("keteranganPerkara,");
  });

  it("panel mengingatnya di satu tempat yang dilewati semua pemanggil", () => {
    expect(abt).toContain("ingatKeteranganPerkara(muatan?.nomorPerkara, isi?.sipp?.keteranganPerkara);");
  });

  it("yang kosong tidak menimpa yang sudah terbaca dari daftar sidang", () => {
    const badan = potongFungsi(abt, ["ingatKeteranganPerkara"]);
    expect(badan).toContain("|| lama.jenisPerkara");
    expect(badan).toContain("|| lama.statusPutusan");
  });

  it("papan massal tidak lagi membuang jenis perkaranya", () => {
    expect(abt).toContain("jenisPerkara: s.jenis || \"\",");
  });
});

describe("lencana yang dibentangkan kembali", () => {
  it("daftar panjang menata hanya yang terlihat", () => {
    expect(css).toContain(".aleta-abt-daftar > .aleta-abt-kartu,");
    expect(css).toContain(".aleta-massal-daftar > .aleta-massal-butir {");
    expect(css).toContain("content-visibility: auto;");
    expect(css).toContain("contain-intrinsic-size: auto 64px;");
  });

  it("angka ukurannya ikut tercatat di sumbernya", () => {
    expect(css).toContain("265,90 ms");
    expect(css).toContain("35,90 ms");
  });
});

describe("lencana yang diklik sungguh membentang - 1.158.0", () => {
  /**
   * ==========================================================================
   * TANGKAPAN PENUNJUK MERAMPAS KLIK DARI LENCANA
   * ==========================================================================
   *
   * alatPasangGeser memanggil panel.setPointerCapture pada SETIAP pointerdown.
   * Selama tangkapan itu berlaku, peramban membelokkan `click` dan `dblclick`
   * ke elemen PENANGKAP - yaitu panel. Lencana hanya ANAK panel, jadi peristiwa
   * yang mendarat di induk tidak pernah turun kepadanya: pendengar yang
   * membentangkan panel tidak pernah berjalan sekali pun, dan panel yang sudah
   * diciutkan tidak dapat dibuka lagi. Tidak ada satu galat pun tercatat.
   *
   * Halaman SIPP tidak terkena sebab konten.js menggeser panelnya dengan
   * mousedown dan tidak pernah menangkap penunjuk - hanya ALETA dan ABT yang
   * berbagi perkakas ini.
   *
   * Diukur pada harness yang memuat panel-alat.js APA ADANYA, dengan klik
   * tetikus sungguhan lewat peramban:
   *
   *     sebelum : pendengar berjalan 0 kali, panel tetap terciut
   *     sesudah : panel terbentang, lebar pulih 324 (bukan 54)
   *
   * Menunda tangkapan sampai ambang 4 piksel SUDAH DICOBA dan DITOLAK - lihat
   * tuntutan di bawah.
   */
  it("pendengar pembentang terpasang pada PANEL, bukan pada lencana", () => {
    expect(perkakas).toContain('panel.addEventListener("click", bentangkan);');
    expect(perkakas).not.toContain('lencana.addEventListener("click", bentangkan);');
  });

  it("tangkapan penunjuk TETAP di pointerdown - menundanya mematikan tarikan jauh", () => {
    // Tanpa tangkapan, pointermove hanya sampai ke panel selama penunjuk masih
    // DI ATAS panel - dan lencana cuma 54x54 piksel. Terukur: tarikan pendek di
    // dalam lencana berpindah, tarikan ke seberang layar tidak bergerak sama
    // sekali. Karena itu yang dipindahkan pendengarnya, bukan tangkapannya.
    const iTekan = perkakas.indexOf('panel.addEventListener("pointerdown"');
    const iGerak = perkakas.indexOf('panel.addEventListener("pointermove"');
    const iTangkap = perkakas.indexOf("panel.setPointerCapture(peristiwa.pointerId)");
    expect(iTekan).toBeGreaterThan(-1);
    expect(iGerak).toBeGreaterThan(iTekan);
    expect(iTangkap).toBeGreaterThan(iTekan);
    expect(iTangkap, "tangkapan harus di dalam pointerdown").toBeLessThan(iGerak);
    expect(perkakas).toContain("SENGAJA TETAP DI SINI - JANGAN DITUNDA");
  });

  it("menggeser lencana tidak menghapus keadaan maupun ukuran panelnya", () => {
    // alatSimpanPosisi menulis dengan storage.local.set yang MENGGANTI seluruh
    // catatan. Bentuk lama tidak menyertakan `lencana`, sehingga sekali lencana
    // digeser penandanya lenyap dan lebarnya terisi 52.
    expect(perkakas).toContain("const jadiLencana = panel.classList.contains(KELAS_LENCANA);");
    expect(perkakas).toContain("lencana: jadiLencana,");
    expect(perkakas).toContain("lebar: jadiLencana ? lebarSemula : Math.round(kotak.width),");
  });

  it("perkakas geser tidak didaftarkan dua kali pada panel yang sama", () => {
    // Argumen kedua hanya dipakai sebagai pagar kepala.contains(...), bukan
    // sebagai tempat pendengar - jadi pendaftaran kedua tidak menambah
    // kemampuan apa pun, hanya menggandakan tulisan posisi dan tangkapan.
    expect(perkakas).not.toContain("alatPasangGeser(panel, lencana, kunci);");
    // Dihitung PEMANGGILANNYA saja - baris `function alatPasangGeser(panel, ...`
    // ikut tercocok kalau definisinya tidak dikecualikan.
    const panggilan = (perkakas.match(/^\s+alatPasangGeser\(panel, /gm) || []).length;
    expect(panggilan, "alatPasangGeser hanya dipanggil sekali").toBe(1);
  });
});

describe("unduhan panel tidak lagi bernama download - 1.158.1", () => {
  /**
   * ==========================================================================
   * NAMANYA DISERAHKAN, LALU DIBUANG SESUDAHNYA
   * ==========================================================================
   *
   * Jalur panel SUDAH menyusun nama lengkap dan SUDAH menyerahkannya lewat
   * properti `filename`. Ia tetap tersimpan sebagai "download (11).rtf".
   *
   * Sebabnya terbaca dari riwayat unduhan peramban: unduhan ekstensi beralamat
   * `data:` dan TANPA rujukan halaman, sehingga pagar `dariAbt` pada pendengar
   * penamaan ulang bernilai salah, pendengarnya mundur, dan nama bawaan
   * peramban yang dipakai. Sembilan dari sembilan unduhan beratribut ekstensi
   * bernama download; berkas yang SAMA yang turun lewat tautan halaman bernama
   * benar.
   *
   * Diukur pada latar.js sungguhan yang dimuat di konteks bikinan: pesan
   * `unduh` menyimpan namanya, pendengar penamaan menyarankannya untuk alamat
   * data:, namanya sekali pakai, dan nama 304 huruf terpotong menjadi 180
   * dengan akhiran .rtf-nya utuh.
   */
  it("nama yang diminta panel diantrikan untuk unduhan berikutnya", () => {
    expect(latar).toContain("function antrikanNama(nama)");
    expect(latar).toContain("antrikanNama(nama);");
  });

  it("pendengar penamaan menyarankannya untuk alamat data:", () => {
    expect(latar).toContain('if (alamat.startsWith("data:")) {');
    expect(latar).toContain('sarankan({ filename: diminta, conflictAction: "uniquify" });');
  });

  it("namanya SEKALI PAKAI - tidak menempel ke unduhan berikutnya", () => {
    // Nomor perkara dari unduhan sebelumnya yang menempel pada berkas lain
    // adalah kekeliruan yang tidak akan pernah disadari: berkasnya terbuka
    // benar, hanya namanya berbohong.
    expect(latar).toContain("const depan = antreanNama.shift();");
    const i = latar.indexOf("function ambilNamaAntrean()");
    const j = latar.indexOf("return depan ? depan.nama", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(latar.slice(i, j)).toContain("antreanNama.shift()");
  });

  it("cabang data: berjalan SEBELUM pagar dariAbt", () => {
    const iData = latar.indexOf('if (alamat.startsWith("data:")) {');
    const iAbt = latar.indexOf("const dariAbt =");
    expect(iData).toBeGreaterThan(-1);
    expect(iAbt).toBeGreaterThan(iData);
  });

  /**
   * ==========================================================================
   * UNDUHAN MASSAL - SEBAB SLOT TUNGGAL HARUS PERGI
   * ==========================================================================
   *
   * Bentuk sebelumnya menyimpan SATU nama dan menghapusnya begitu dipakai.
   * Selama unduhannya satu per satu dan pekerjanya hidup terus, itu cukup.
   * Unduhan massal melanggar KEDUA andaian itu: beberapa unduhan dapat lahir
   * sebelum yang pertama sempat dinamai sehingga slotnya tertimpa, dan pekerja
   * latar MV3 mati kira-kira tiap tiga puluh detik sedangkan unduhan massal
   * berjalan bermenit-menit.
   *
   * Penjaga di bawah melarang bentuk lamanya kembali. Penjaga yang hanya
   * DILONGGARKAN akan membiarkan slot tunggal dipasang lagi tanpa berbunyi.
   */
  it("antreannya memuat lebih dari satu nama - bukan slot tunggal", () => {
    expect(latar).toContain("let antreanNama = [];");
    expect(latar).not.toContain("let namaMenunggu");
    expect(latar).not.toContain("namaMenunggu =");
  });

  it("antreannya BERTAHAN dari pekerja latar yang mati", () => {
    // Variabel modul di latar.js hilang tiap kali pekerjanya dievaluasi ulang.
    expect(latar).toContain("chrome.storage.session.set");
    expect(latar).toContain("chrome.storage.session.get(KUNCI_ANTREAN)");
  });

  it("nama yang kedaluwarsa dibuang, tidak dipakai berkas berikutnya", () => {
    // Unduhan yang batal tidak pernah mengambil namanya. Nama yang tertinggal
    // akan dipakai berkas BERIKUTNYA - berkas yang salah nama, dan salahnya
    // diam.
    expect(latar).toContain("function bersihkanAntrean(daftar)");
    expect(latar).toContain("sekarang - Number(x.saat || 0) < UMUR_NAMA");
    expect(latar).toContain("slice(-BATAS_ANTREAN)");
  });

  it("nama panjang dipotong pada batangnya, bukan memakan akhirannya", () => {
    expect(latar).toContain("function potongNamaBerkas(nama, batas)");
    expect(latar).toContain("potongNamaBerkas(");
    expect(latar).not.toMatch(/String\(pesan\.nama \|\| "berkas"\)[^;]*\.slice\(0, 180\)/);
  });
});
