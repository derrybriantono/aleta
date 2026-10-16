"use strict";

/**
 * ============================================================================
 * a-abt-klien.js - KLIEN ABT UNTUK EKSTENSI ALETA (Tahap A, 16 Okt 2026)
 * ============================================================================
 *
 * Fungsi JS murni yang memanggil rute-rute ABT (aps_badilag / "Blangko Tambahan
 * SIPP") dari balik layar, supaya tampilan "Blangko ABT by Derry Briantono"
 * dapat menjalankan langkah ABT tanpa petugas membuka halaman ABT-nya.
 * Peta lengkap beserta alasan tiap keputusan: A-PETA-ABT.md (folder yang sama).
 *
 * BENTUK
 *   - Bagian 1: PENGURAI. HTML jawaban ABT -> objek. Tanpa DOM, tanpa fetch,
 *     hanya regex atas teks, sehingga jalan sama di skrip isi ekstensi, di
 *     pekerja latar, dan di Node (uji).
 *   - Bagian 2: KLIEN. abtKlienBuat({ ambil, asal }) -> objek berisi fungsi
 *     async. `ambil` = fetch yang membawa kuki sesi ABT dan MENGIKUTI
 *     pengalihan (fetch bawaan peramban dengan credentials:"include" sudah
 *     begitu). Klien tidak pernah memegang sandi atau kuki sendiri.
 *   - Dipakai di ekstensi dengan menyalin berkas ini ke ekstensi-sipp/ (semua
 *     nama diawali `abtKlien` supaya tidak bentrok dengan lingkup global
 *     skrip isi lain) ATAU memuatnya lewat require() di uji.
 *
 * ATURAN YANG DITEGAKKAN DI SINI (semuanya terukur di ABT lokal, lihat peta)
 *   - Tidak ada fungsi menulis yang berjalan tanpa dipanggil eksplisit.
 *   - Penulisan selalu lewat rute yang sama dengan jendela sembul ABT sendiri
 *     (edit_data, tanyajawab_perkara_edit?aksi=simpan, validasi_bas).
 *   - Jawaban ABT selalu HTML/teks berstatus 200 - keberhasilan dibaca dari
 *     KALIMATNYA ("DATA DISIMPAN", "Tanya Jawab Disimpan"), bukan dari status.
 *   - Tidak ada rute HAPUS yang dibungkus (main/tanyajawab_template?hapus=
 *     adalah GET yang menghapus; sengaja tidak dibungkus).
 *   - Yang BERAT (halaman main/view = menghitung SEMUA variabel blangko, ±5
 *     menit untuk blangko 88 variabel di mesin ini) diberi nama jelas
 *     (abtKlien.bacaTampilanBlangko) dan TIDAK dipakai oleh jalur cepat.
 */

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 1 - PENGURAI (murni)
// ═══════════════════════════════════════════════════════════════════════════

/** Entitas HTML yang dijumpai di jawaban ABT -> karakter. */
function abtKlienEntitas(teks) {
  return String(teks == null ? "" : teks)
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/gi, "&");
}

/** HTML -> teks datar. <br> dan </p> menjadi baris baru; tag lain dibuang. */
function abtKlienTeks(html) {
  return abtKlienEntitas(
    String(html == null ? "" : html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Teks satu baris (spasi dirapatkan) - untuk nama dan judul. */
function abtKlienSebaris(html) {
  return abtKlienTeks(html).replace(/\s+/g, " ").trim();
}

/**
 * Jawaban ABT yang BUKAN yang diminta, walau berstatus 200.
 * Pulang kalimat sebab, "" bila tidak dikenali (dianggap jawaban sah).
 *   sesi-habis   : Abt::__construct mengalihkan ke /login -> borang sandi
 *   galat-variabel: Abt_model::get_data_variabel -> die("<h3>ERROR Variabel #x#</h3>...")
 *   token-rusak  : token a/b gagal didekripsi -> die("DIREKTORI BLANGKO RTF HILANG<br>...")
 *   galat-pihak  : GetIdPerkaraPihak -> die("ERROR LOAD DATA ... masukkan ulang pihak/saksi")
 */
function abtKlienSebabBukanJawaban(teks) {
  const t = String(teks || "").slice(0, 8000);
  const galat = t.match(/ERROR\s+Variabel\s*#(\d{3,5})#/i);
  if (galat) return { jenis: "galat-variabel", pesan: `ABT berhenti menghitung variabel #${galat[1]}# (kueri patah, biasanya karena petik pada isian yang dirujuknya).` };
  if (/type=["']?password|name=["']?password|name=["']?userName/i.test(t)) return { jenis: "sesi-habis", pesan: "Sesi ABT habis - masuk ulang." };
  if (/DIREKTORI BLANGKO RTF HILANG|SALAH DIREKTORI/i.test(t)) return { jenis: "token-rusak", pesan: "Token blangko (a/b) tidak terbaca ABT - ambil ulang dari halaman kelompok blangko." };
  if (/ERROR LOAD DATA/i.test(t)) return { jenis: "galat-pihak", pesan: "ABT tidak menemukan pihak/saksi bernama itu di SIPP (masukkan ulang saksi di SIPP)." };
  if (/A PHP Error was encountered|A Database Error Occurred|<b>(Fatal error|Warning|Notice)<\/b>/i.test(t)) {
    return { jenis: "galat-php", pesan: abtKlienSebaris(t.slice(0, 600)).slice(0, 200) };
  }
  return null;
}

/**
 * Menu & kelompok blangko dari halaman main/beranda (bilah kiri).
 *   <button class="accordion">NAMA MENU</button><div class="panel">
 *      <a title="(N Blangko)" href=".../abt/main/beranda?a=TOKEN&c=">NAMA KELOMPOK</a> ...
 * Pulang { menu:[{nama, kelompok:[{nama, a, jumlahBerkas, aktif}]}], fitur:{...} }.
 * Token `a` = CI Encrypt (mcrypt, IV acak): TIAP PEMUATAN berbeda untuk isi yang
 * sama, semuanya sah selama encryption_key server sama. Simpan token yang
 * terakhir dibaca, jangan menyusun/membandingkannya.
 */
function abtKlienUraiMenu(html) {
  const teks = String(html || "");
  const menu = [];
  const bagian = teks.split(/<button class="accordion">/i).slice(1);
  for (const b of bagian) {
    const [namaMentah, sisa = ""] = b.split(/<\/button>/i);
    const panel = sisa.split(/<button class="accordion">/i)[0].split(/<div class="pricing\b/i)[0];
    const kelompok = [];
    const pola = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = pola.exec(panel))) {
      const href = (m[1].match(/href=["']([^"']*)["']/i) || [])[1] || "";
      const token = href.match(/\/abt\/main\/(?:beranda|daftar)\?a=([^"'&]+)/i);
      if (!token) continue;
      const judul = (m[1].match(/title=["']\((\d+)\s*Blangko\)["']/i) || [])[1];
      kelompok.push({
        nama: abtKlienSebaris(m[2]),
        a: token[1],
        jumlahBerkas: judul ? Number(judul) : null,
        aktif: /class=["']active["']/i.test(m[1]),
      });
    }
    menu.push({ nama: abtKlienSebaris(namaMentah), kelompok });
  }
  const ada = (potong) => teks.includes(potong);
  return {
    menu,
    fitur: {
      validasiBas: ada("/abt/main/validasi_bas"),
      anonim: ada("/abt/main/anonim"),
      qrcode: ada("/abt/main/qrcode"),
      // tampil hanya untuk userid 1 (Abt::html_menu)
      pengaturan: ada("/abt/main/tanyajawab_template") || ada("/abt/main/variabel"),
    },
  };
}

/**
 * Berkas blangko dari halaman satu kelompok (main/beranda?a=TOKEN).
 *   <p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/..../abt/main/cari", {
 *        a:"TOKEN-DIR", b:"TOKEN-BERKAS", c:"" });'># <span>NAMA BERKAS</span></a></p>
 * a = token FOLDER blangko, b = token NAMA berkas (tanpa .rtf). Keduanya
 * dibutuhkan bersama; nama berkas tidak pernah dikirim polos.
 */
function abtKlienUraiBerkas(html) {
  const teks = String(html || "");
  const judul = teks.match(/class=["'][^"']*pricing-top[^"']*["'][^>]*>\s*<h3>([\s\S]*?)<\/h3>/i);
  const kelompok = judul ? abtKlienSebaris(judul[1]) : "";
  const berkas = [];
  const tag = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = tag.exec(teks))) {
    const t = m[1].match(/\ba\s*:\s*"([^"]+)"\s*,\s*b\s*:\s*"([^"]+)"/);
    if (!t) continue;
    const nama = abtKlienSebaris(m[2]).replace(/^#\s*/, "");
    if (!nama) continue;
    const kb = (m[1].match(/ukuran file\s+(\d+)\s*kb/i) || [])[1];
    berkas.push({ berkas: nama, a: t[1], b: t[2], ukuranKb: kb ? Number(kb) : null });
  }
  return { kelompok, berkas };
}

/**
 * Halaman main/cari yang TIDAK mengalihkan = pemeriksaan hak gagal atau belum
 * ada perkara. Pulang { pesan, perkara:[{perkaraId, nomor, jenis, pihak, tahapan, proses}] }.
 * `pesan` = kalimat merah ABT (tanpa tag): "...TIDAK DAPAT MENGGUNAKAN BLANGKO INI
 * (Proses Saat Ini ...)", "User ... Tidak Ada Akses dengan Perkara Nomor ...",
 * "NOMOR PERKARA TIDAK DITEMUKAN", "USER ... TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI".
 */
function abtKlienUraiHalamanCari(html) {
  const teks = String(html || "");
  const pesanMentah = teks.match(/<h[35][^>]*color:\s*red[^>]*>([\s\S]*?)<\/h[35]>/i) || teks.match(/<p style='color:red[^>]*>([\s\S]*?)<\/p>/i);
  const perkara = [];
  const baris = teks.split(/<tr>\s*\n?\s*<td align='center'>/i).slice(1);
  for (const b of baris) {
    const id = (b.match(/\bc\s*:\s*'(\d+)'/) || [])[1];
    if (!id) continue;
    const sel = [...b.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => abtKlienSebaris(x[1]));
    perkara.push({ perkaraId: id, nomor: sel[1] || "", jenis: sel[3] || "", pihak: sel[4] || "", tahapan: sel[5] || "", proses: sel[6] || "" });
  }
  return { pesan: pesanMentah ? abtKlienSebaris(pesanMentah[1]) : "", perkara };
}

/**
 * Halaman main/view (daftar variabel satu blangko untuk satu perkara).
 * Pulang:
 *   jenisPerkara, nomorPerkara, namaBerkas (h2)
 *   perkaraId, perkTemp           dari load_form('kode','perkaraId','perkTemp')
 *   tokenFolder, tokenBerkas      a/b segar dari tautan GANTI NOMOR PERKARA / CETAK
 *   tautanCetak                   {a,b,c,e,d} - persis tautan abt/preview halaman itu
 *   perluPilihSidang, sidang[]    modal "Klik Tanggal Sidang" (muncul bila ada
 *                                 variabel multi_sidang & ?d kosong)
 *   validasiBas                   'tidak-berlaku'|'perlu-simpan'|'menunggu-hakim'|'boleh-cetak-atau-validasi'
 *   variabel[]                    {kode, nama, warnaNama, nilaiHtml, nilaiTeks, status, bisaDiedit, tanyaJawab}
 *       status: 'ada' (biru), 'kosong' (merah: DATA_TIDAK_ADA / tak terbaca), 'tanyajawab', 'qrcode', 'tak-bisa-load'
 *       warnaNama: 'hijau' = variabel bertipe (data_*), 'merah' = tidak punya tipe (isian bebas/tak terdaftar)
 *       tanyaJawab: {a,b,c,d,noVar} bila nilai = tombol "KLIK UNTUK BUKA TANYA JAWAB"
 */
function abtKlienUraiView(html) {
  const teks = String(html || "");
  const sebab = abtKlienSebabBukanJawaban(teks);
  const h3 = teks.match(/<h3 class="w3l_header[^>]*>([\s\S]*?)<\/h3>/i);
  const h3teks = h3 ? abtKlienSebaris(h3[1]) : "";
  const h3p = h3teks.split(" - ");
  const h2 = teks.match(/<h2>([\s\S]*?)<\/h2>/i);

  let perkaraId = "";
  let perkTemp = "";
  const lf = teks.match(/load_form\('(\d{4})','([^']*)','([^']*)'\)/);
  if (lf) {
    perkaraId = lf[2];
    perkTemp = lf[3];
  }

  let tautanCetak = null;
  const cet = teks.match(/href="([^"]*\/abt\/preview\?[^"]*)"/i);
  if (cet) {
    const q = new URLSearchParams(abtKlienEntitas(cet[1]).split("?")[1] || "");
    tautanCetak = { a: q.get("a") || "", b: q.get("b") || "", c: q.get("c") || "", e: q.get("e") || "", d: q.get("d") || "" };
    if (!perkaraId) perkaraId = tautanCetak.c;
  }
  const ganti = teks.match(/post\("[^"]*\/abt\/main\/cari",\s*\{\s*a:"([^"]+)",\s*b:"([^"]+)"/);

  // Daftar sidang (modal)
  const sidang = [];
  const bagianSidang = teks.split(/id="myModal"/i)[1] || "";
  if (bagianSidang) {
    const bl = bagianSidang.split(/onclick="DoNav\('/i).slice(1);
    for (const b of bl) {
      const urutan = (b.match(/^(\d+)'\)"/) || [])[1];
      if (!urutan) continue;
      const sel = [...b.matchAll(/<td[^>]*>([\s\S]*?)(?=<td|<tr|<\/table|$)/gi)].map((x) => abtKlienTeks(x[1].replace(/<\/td>/gi, "")));
      sidang.push({
        urutan: Number(urutan),
        tanggalTeks: (sel[1] || "").replace(/\n/g, " "),
        jam: sel[2] || "",
        agenda: (sel[3] || "").replace(/\n+/g, " / ").replace(/ \/ $/, ""),
        dihadiriOleh: (sel[4] || "").trim(),
      });
    }
  }

  // Keadaan tombol BAS (hanya bila blangko BAS bervalidasi)
  let validasiBas = "tidak-berlaku";
  if (/MENUNGGU VALIDASI DARI HAKIM/i.test(teks)) validasiBas = "menunggu-hakim";
  else if (/assets\/abt\/images\/simpan\.png/i.test(teks)) validasiBas = "perlu-simpan";
  else if (/assets\/abt\/images\/valid\.png/i.test(teks)) validasiBas = "boleh-cetak-atau-validasi";

  // Baris variabel
  const variabel = [];
  const baris = teks.split(/<tr valign="top">/i).slice(1);
  for (const b of baris) {
    const kode = (b.match(/^\s*<td align=center id="(\d{4,5})"/i) || [])[1];
    if (!kode) continue;
    const potong = b.split(/<\/tr>/i)[0];
    const sel = potong.split(/<td\b/i).slice(1).map((s) => s.replace(/^[^>]*>/, "").replace(/<\/td>\s*$/i, ""));
    const gaya = [...potong.matchAll(/<td style="color:([a-z]+);font-weight:bold;?"/gi)].map((x) => x[1]);
    const nilaiHtml = (sel[2] || "").replace(/<\/td>[\s\S]*$/i, "").trim();
    const nilaiTeks = abtKlienTeks(nilaiHtml);
    let status = "ada";
    let tanyaJawab = null;
    const tj = nilaiHtml.match(/href='([^']*tanyajawab_perkara_edit\?[^']*)'/i);
    if (tj) {
      status = "tanyajawab";
      const q = new URLSearchParams(abtKlienEntitas(tj[1]).split("?")[1] || "");
      tanyaJawab = { noVar: q.get("no_var") || kode, a: q.get("a") || "", b: q.get("b") || "", c: q.get("c") || "", d: q.get("d") || "" };
    } else if (/KODE QR/.test(nilaiHtml)) status = "qrcode";
    else if (/TIDAK_BISA_LOAD/.test(nilaiTeks)) status = "tak-bisa-load";
    else if (gaya[1] === "red" || /DATA_TIDAK_ADA/.test(nilaiTeks)) status = "kosong";
    variabel.push({
      kode,
      nama: abtKlienSebaris(sel[1] || ""),
      warnaNama: gaya[0] === "green" ? "hijau" : "merah",
      nilaiHtml,
      nilaiTeks,
      status,
      bisaDiedit: /load_form\('/.test(potong),
      tanyaJawab,
    });
  }

  return {
    ok: !sebab && variabel.length > 0,
    sebab,
    jenisPerkara: h3p[0] || "",
    nomorPerkara: h3p.slice(1).join(" - "),
    namaBerkas: h2 ? abtKlienSebaris(h2[1]) : "",
    perkaraId,
    perkTemp,
    tokenFolder: (ganti && ganti[1]) || (tautanCetak && tautanCetak.a) || "",
    tokenBerkas: (ganti && ganti[2]) || (tautanCetak && tautanCetak.b) || "",
    tautanCetak,
    perluPilihSidang: sidang.length > 0,
    sidang,
    validasiBas,
    variabel,
  };
}

/**
 * Jendela sembul satu isian (abt/edit_data?no_var=&perkara_id=&e=).
 * Pulang { perkaraNomor, kode, nama, tipe, nilai, nilaiTanggal, bisaDisimpan, bacaSaja, adaEditVariabel }.
 *   tipe  : data_teks | data_tanggal | data_sipp | data_sql | tanya_jawab | multi_sidang | ... ("" bila variabel tak terdaftar/tanpa tipe)
 *   nilai : isi tersimpan; bila belum ada isi tersimpan ABT menampilkan `default_data` (variabel() dihitung) -
 *           ini TIDAK bisa dibedakan dari isi tersimpan lewat jendela ini.
 *   data_tanggal: nilai datang "dd/mm/yyyy" (tgl_view) - nilaiTanggal = ISO yyyy-mm-dd.
 */
function abtKlienUraiPopupData(html) {
  const teks = String(html || "");
  const tipe = (teks.match(/name="var_type"\s+value="([^"]*)"/i) || [])[1] || "";
  const baris = (nama) => {
    const m = teks.match(new RegExp(`<td>${nama}</td>\\s*<td>:\\s*([^<]*)</td>`, "i"));
    return m ? abtKlienEntitas(m[1]).trim() : "";
  };
  let nilai = "";
  let nilaiTanggal = "";
  const tgl = teks.match(/id='tgl_form'[^>]*value='([^']*)'|value='([^']*)'[^>]*id='tgl_form'/i);
  if (tipe === "data_tanggal") {
    nilai = tgl ? abtKlienEntitas(tgl[1] || tgl[2] || "") : "";
    const p = nilai.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    nilaiTanggal = p ? `${p[3]}-${p[2]}-${p[1]}` : "";
  } else {
    const ta = teks.match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i);
    nilai = ta ? abtKlienEntitas(ta[1]).replace(/^\r?\n/, "") : "";
  }
  const sebab = abtKlienSebabBukanJawaban(teks);
  return {
    ok: !sebab && /name="var_type"/.test(teks),
    sebab,
    perkaraNomor: abtKlienSebaris((teks.match(/Nomor Perkara\s*<b>([\s\S]*?)<\/b>/i) || [])[1] || ""),
    kode: baris("Nomor Variabel"),
    nama: baris("Nama Variabel"),
    tipe,
    nilai,
    nilaiTanggal,
    bisaDisimpan: tipe === "data_teks" || tipe === "data_tanggal",
    bacaSaja: /<textarea\b[^>]*\breadonly\b/i.test(teks) || /DATA LOAD DARI SIPP, TIDAK BISA DIEDIT/.test(teks),
    adaEditVariabel: /abt\/edit_var\?no_var=/.test(teks), // tombol admin (userid 1)
  };
}

/**
 * Halaman penyunting tanya-jawab (tanyajawab_perkara_edit / tanyajawab_template_edit).
 * `ajax_data` ditulis ABT sebagai LARIK (keterangan tersimpan) atau OBJEK berkunci
 * angka (hasil load_template, replace_array_template) - dua-duanya diterima.
 * Pulang { baris:[{no, tanya, jawab}], keterangan, templates:[{nilai,kode,nama}], linkSimpan }.
 *   templates[].nilai: 'XXX' = kode kumpulan template jenis perkara; '#<saksi_id>' = salin dari saksi lain
 *   (kode tampil '#').
 */
function abtKlienUraiTanyaJawab(html) {
  const teks = String(html || "");
  const sebab = abtKlienSebabBukanJawaban(teks);
  const cocok = teks.match(/var\s+ajax_data\s*=\s*([[{][\s\S]*?[\]}])\s*(?:\r?\n|;)/);
  let mentah = [];
  let terbaca = false;
  if (cocok) {
    try {
      const j = JSON.parse(cocok[1]);
      mentah = Array.isArray(j) ? j : j && typeof j === "object" ? Object.keys(j).sort((a, b) => Number(a) - Number(b)).map((k) => j[k]) : [];
      terbaca = true;
    } catch {
      terbaca = false;
    }
  }
  const baris = mentah.map((b, i) => ({
    no: String((b && b.urutan_pertanyaan) || i + 1),
    tanya: String((b && b.pertanyaan) || ""),
    jawab: String((b && b.jawaban) || ""),
  }));
  const templates = [];
  const po = /<option value='([^']*)'>\s*\(([^)]*)\)\s*([^<]*)<\/option>/g;
  let m;
  while ((m = po.exec(teks))) templates.push({ nilai: m[1], kode: m[2].trim(), nama: abtKlienEntitas(m[3]).trim() });
  const ket = teks.match(/<div class="panel-heading">([\s\S]*?)(?:<div style='float:right;'>|<\/div>)/i);
  const simpan = teks.match(/\$\.post\(\s*'([^']+)'/);
  return {
    ok: !sebab && terbaca,
    sebab,
    baris,
    keterangan: ket ? abtKlienSebaris(ket[1]) : "",
    templates,
    linkSimpan: simpan ? abtKlienEntitas(simpan[1]) : "",
  };
}

/** Halaman main/tanyajawab_template: daftar kumpulan template. [{no, nama, jenisPerkara, kode, id}] */
function abtKlienUraiDaftarTemplate(html) {
  const hasil = [];
  const baris = String(html || "").split(/<tr>\s*\n?\s*<td align='center'>/i).slice(1);
  for (const b of baris) {
    const kode = (b.match(/tanyajawab_template_edit\?kode=([^"']+)["']/i) || [])[1];
    if (!kode) continue;
    const sel = [...b.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => abtKlienSebaris(x[1]));
    const id = (b.match(/load_form\('(\d+)'\)/) || [])[1] || "";
    hasil.push({ no: sel[0] || "", nama: sel[1] || "", jenisPerkara: sel[2] || "", kode, id });
  }
  return hasil;
}

/** Halaman main/validasi_bas: [{perkaraNomor, sidangTeks, blangko, dibuatOleh, tautanBuka:{a,b,c,d}}] + saklar. */
function abtKlienUraiValidasiBas(html) {
  const teks = String(html || "");
  const baris = [];
  const bl = teks.split(/<tr align='center'>/i).slice(1);
  for (const b of bl) {
    const buka = b.match(/href="([^"]*\/abt\/main\/view\?[^"]*)"/i);
    if (!buka) continue;
    const q = new URLSearchParams(abtKlienEntitas(buka[1]).split("?")[1] || "");
    const sel = [...b.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => abtKlienSebaris(x[1]));
    baris.push({ tanggal: sel[1] || "", perkaraNomor: sel[2] || "", sidangTeks: sel[3] || "", blangko: sel[4] || "", dibuatOleh: sel[5] || "", tautanBuka: { a: q.get("a"), b: q.get("b"), c: q.get("c"), d: q.get("d") } });
  }
  return {
    fiturAktif: !/telah dinonaktifkan oleh Admin/i.test(teks),
    saklarAdaDiHalaman: /name="aksi" value="ubah_validasi"/.test(teks),
    baris,
  };
}

/** Halaman main/anonim sesudah pemrosesan yang gagal: kalimat pesannya, "" bila tidak ada. */
function abtKlienPesanAnonim(html) {
  const m = String(html || "").match(/<h5 style='color:([^;']+);[^>]*>([\s\S]*?)<\/h5>/i);
  return m ? { warna: m[1], pesan: abtKlienSebaris(m[2]) } : { warna: "", pesan: "" };
}

/** Nama berkas dari header Content-Disposition (RFC 5987 diterima). */
function abtKlienNamaDariHeader(nilai) {
  const t = String(nilai || "");
  const u = t.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (u) {
    try {
      return decodeURIComponent(u[1]);
    } catch {
      return u[1];
    }
  }
  const m = t.match(/filename\s*=\s*"?([^";]+)"?/i);
  return m ? m[1] : "";
}

/** Penanda #dddd# / #ddddd# yang masih tertinggal di RTF hasil, dan jumlah "..." (data kosong). */
function abtKlienPeriksaRtf(isiLatin1) {
  const t = String(isiLatin1 || "");
  const sisa = [...new Set([...t.matchAll(/#(\d{4,5})#/g)].map((x) => x[1]))];
  const titik = (t.match(/\.\.\./g) || []).length;
  return { diawaliRtf: t.startsWith("{\\rtf"), penandaSisa: sisa, jumlahTitikTiga: titik, panjang: t.length };
}

/** d/m/Y untuk edit_data data_tanggal (tgl_sql ABT = DateTime::createFromFormat('d/m/Y')). "" bila tak terbaca. */
function abtKlienTanggalAbt(nilai) {
  const t = String(nilai || "").trim();
  const dua = (n) => String(n).padStart(2, "0");
  const sah = (h, b, y) => {
    const d = new Date(Number(y), Number(b) - 1, Number(h));
    return d.getFullYear() === Number(y) && d.getMonth() === Number(b) - 1 && d.getDate() === Number(h) ? `${dua(h)}/${dua(b)}/${y}` : "";
  };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (m) return sah(m[3], m[2], m[1]);
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return sah(m[1], m[2], m[3]);
  return "";
}

/**
 * Petik dan garis miring terbalik pada data_teks MEMATAHKAN kueri data_sql yang
 * merujuk variabel itu (str_replace tanpa escape di Abt_model::variabel_var_data)
 * dan membuat SELURUH view/preview perkara itu berhenti (die ERROR Variabel).
 * Petik diganti U+2019 (ABT sendiri mengubahnya kembali ke ' saat cetak),
 * garis miring terbalik diganti "/".
 */
function abtKlienNetralkanPetik(nilai) {
  return String(nilai == null ? "" : nilai).replace(/\\/g, "/").replace(/["']/g, "’");
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 2 - KLIEN
// ═══════════════════════════════════════════════════════════════════════════

const ABT_KLIEN_JEDA_TULIS_MS = 0;

/**
 * @param {object}   opsi
 * @param {Function} opsi.ambil  fetch-kompatibel: (url, init) => Promise<Response>. WAJIB membawa kuki sesi ABT
 *                               (peramban: credentials:"include") dan mengikuti pengalihan. Di Node uji: lihat
 *                               a-abt-klien.uji.js (toples kuki).
 * @param {string}   opsi.asal   alamat dasar rute ABT, mis. "http://host/aps_badilag/index.php/abt" atau
 *                               "http://host/aps_badilag/abt" - sama dengan asalAbt() di abt.js.
 * @param {Function} [opsi.jeda] async (nama, url) => void - kait jeda-menulis ekstensi (a2JedaTulis) bila ada.
 */
function abtKlienBuat(opsi) {
  const ambil = opsi.ambil;
  const asal = String(opsi.asal).replace(/\/+$/, "");
  const jeda = typeof opsi.jeda === "function" ? opsi.jeda : async () => {};
  const bentukForm = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
  const q = (o) => bentukForm(o).toString();
  const header = { "Content-Type": "application/x-www-form-urlencoded" };

  async function teksDari(url, init) {
    const r = await ambil(url, { credentials: "include", cache: "no-store", ...(init || {}) });
    const t = await r.text();
    return { r, t, status: r.status };
  }
  const gagal = (pesan, ekstra) => ({ ok: false, pesan, ...(ekstra || {}) });

  const klien = {
    asal,

    // ── (0) sesi ───────────────────────────────────────────────────────────
    /** Sesi ABT hidup? main/beranda ringan (±1 dtk). */
    async periksaSesi() {
      const { t, status } = await teksDari(`${asal}/main/beranda`);
      const sebab = abtKlienSebabBukanJawaban(t);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      if (sebab) return gagal(sebab.pesan, { jenis: sebab.jenis });
      return { ok: /class="accordion"/.test(t) || /Beranda/.test(t) };
    },

    // ── (1) menu, kelompok, berkas + token a/b ─────────────────────────────
    /** Seluruh menu & kelompok yang BOLEH dilihat akun ini (Abt_model::daftar_menu menyaring per group_id). */
    async daftarMenu() {
      const { t, status } = await teksDari(`${asal}/main/beranda`);
      const sebab = abtKlienSebabBukanJawaban(t);
      if (status >= 400 || sebab) return gagal(sebab ? sebab.pesan : `ABT menjawab ${status}.`);
      return { ok: true, ...abtKlienUraiMenu(t) };
    },
    /** Berkas satu kelompok. `a` dari daftarMenu(). Hasil tiap berkas membawa token a/b SEGAR. */
    async daftarBerkas(tokenKelompok) {
      const { t, status } = await teksDari(`${asal}/main/beranda?${q({ a: tokenKelompok, c: "" })}`);
      const sebab = abtKlienSebabBukanJawaban(t);
      if (status >= 400 || sebab) return gagal(sebab ? sebab.pesan : `ABT menjawab ${status}.`);
      return { ok: true, ...abtKlienUraiBerkas(t) };
    },

    // ── (2) cari perkara & buka blangko ────────────────────────────────────
    /**
     * Cari perkara menurut AWALAN nomor ("601/Pdt.G/2026"). Rute yang sama dengan isian-otomatis ABT.
     * putus=true : hanya perkara yang sudah ada putusannya (+ status putusan di label) - dipakai Anonimisasi.
     * Maks 20 baris. Pulang [{perkaraId, nomor, label}].
     */
    async cariPerkara(awalanNomor, { putus = false } = {}) {
      const { t, status } = await teksDari(`${asal}/${putus ? "get_nomor_perkara_putus" : "get_nomor_perkara"}`, {
        method: "POST",
        headers: header,
        body: q({ noperk: awalanNomor }),
      });
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      try {
        const j = JSON.parse(t);
        return { ok: true, perkara: j.map((x) => ({ perkaraId: String(x.perkara_id), nomor: x.value, label: x.label })) };
      } catch {
        const sebab = abtKlienSebabBukanJawaban(t);
        return gagal(sebab ? sebab.pesan : "Jawaban pencarian bukan JSON.", { jenis: sebab && sebab.jenis });
      }
    },
    /** Satu perkara menurut nomor LENGKAP ("601/Pdt.G/2026/PA.Dgl") atau tanpa kode pengadilan. */
    async perkaraDariNomor(nomor, opsi2) {
      const h = await klien.cariPerkara(nomor, opsi2);
      if (!h.ok) return h;
      const persis = h.perkara.find((p) => p.nomor === nomor) || (h.perkara.length === 1 ? h.perkara[0] : null);
      return persis ? { ok: true, ...persis } : gagal(h.perkara.length ? "Nomor tidak tunggal - perjelas." : "NOMOR PERKARA TIDAK DITEMUKAN", { calon: h.perkara });
    },
    /**
     * Periksa HAK membuka blangko X untuk perkara Y - tepat seperti tombol kartu blangko ABT
     * (POST main/cari {a,b,c}). Hak dicek ABT: group menu, user_cek (pejabat perkara), rentang
     * proses_terakhir_id, rentang jenis/alur. Berhasil = ABT MENGALIHKAN ke main/view.
     *
     * TIDAK memuat main/view (berat): di peramban redirect:"manual" memberi respons `opaqueredirect`
     * (status 0), di Node status 3xx - keduanya = DIIZINKAN. Respons 200 = ditolak, kalimat alasannya
     * dikembalikan. `ambil` yang selalu mengikuti pengalihan (mis. pembungkus uji) tetap benar tetapi
     * lambat: ia ikut menghitung main/view.
     */
    async periksaHakBuka({ a, b, perkaraId, sidang }) {
      const r = await ambil(`${asal}/main/cari`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        redirect: "manual",
        headers: header,
        body: q({ a, b, c: perkaraId }),
      });
      const dialihkan = r.type === "opaqueredirect" || (r.status >= 300 && r.status < 400);
      if (dialihkan) {
        const lok = r.headers && r.headers.get ? r.headers.get("location") : "";
        const ke = lok || "";
        const bukanView = ke && !/main\/view/.test(ke);
        if (bukanView) return gagal(`Dialihkan ke ${ke} (bukan main/view) - biasanya sesi habis.`, { jenis: /login/.test(ke) ? "sesi-habis" : "alih-lain" });
        return { ok: true, diizinkan: true, urlView: ke ? new URL(ke, asal).toString() : "", sidang: sidang || "" };
      }
      const t = await r.text();
      const sebab = abtKlienSebabBukanJawaban(t);
      if (sebab) return gagal(sebab.pesan, { jenis: sebab.jenis });
      const h = abtKlienUraiHalamanCari(t);
      return { ok: false, diizinkan: false, pesan: h.pesan || "ABT tidak mengalihkan ke blangko (alasan tidak terbaca).", jenis: "ditolak" };
    },
    /**
     * BERAT: memuat main/view dan menghitung SEMUA variabel blangko untuk perkara itu
     * (±3,4 dtk per variabel di mesin ini => blangko 88 variabel ≈ 5 menit; produksi MariaDB 5.5 juga lambat).
     * Gunanya: daftar variabel + nilainya + daftar sidang + keadaan tombol validasi BAS.
     * `sidang` = urutan sidang ("1","2"...) -> &d=; kosong = ABT menampilkan modal pilih sidang bila blangko
     * punya variabel multi_sidang. Tanpa pilihan sidang variabel multi_sidang memakai sidang URUTAN 1.
     */
    async bacaTampilanBlangko({ a, b, perkaraId, perkTemp, sidang }) {
      const kueri = perkaraId ? { b, c: perkaraId, a } : { b, e: perkTemp, a };
      if (sidang) kueri.d = sidang;
      const { t, status } = await teksDari(`${asal}/main/view?${q(kueri)}`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const v = abtKlienUraiView(t);
      return v.ok ? { ...v, ok: true } : gagal(v.sebab ? v.sebab.pesan : "Halaman blangko tidak memuat variabel.", { jenis: v.sebab && v.sebab.jenis, tampilan: v });
    },

    // ── (3) isian satu variabel ────────────────────────────────────────────
    /**
     * Baca satu variabel lewat jendela sembul edit_data (ringan: satu variabel saja, ±0,2-2 dtk).
     * `sidang` (urutan, "1","2"...) dikirim sebagai &d= : untuk variabel multi_sidang (0033 tanggal sidang, 1142 agenda,
     * 0090 dihadiri oleh, 0050 sidang ke-, 0079 alasan tunda ...) nilainya ikut sidang itu. Tanpa d = sidang URUTAN 1.
     */
    async bacaIsian(kode, perkaraId, perkTemp, sidang) {
      const kueri = { no_var: kode, perkara_id: perkaraId || "", e: perkTemp || "" };
      if (sidang !== undefined && sidang !== null && sidang !== "") kueri.d = sidang;
      const { t, status } = await teksDari(`${asal}/edit_data?${q(kueri)}`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const p = abtKlienUraiPopupData(t);
      return p.ok ? { ...p, ok: true } : gagal(p.sebab ? p.sebab.pesan : "Jendela isian tidak terbaca.", { jenis: p.sebab && p.sebab.jenis });
    },
    /**
     * Daftar sidang perkara TANPA memuat main/view: tiap sidang dibaca dari variabel multi_sidang lewat edit_data&d=N
     * (0050 sidang ke-, 0033 tanggal, 1142 agenda, 0090 dihadiri oleh). Berhenti di sidang pertama yang tidak ada
     * (ABT menjawab nilai kosong / urutan tidak sama) atau di `maks` (bawaan 12, sama dengan abt.js).
     * Pulang { ok, sidang:[{urutan, tanggalIso, agenda, dihadiriOleh}] }.
     */
    async daftarSidang(perkaraId, maks = 12) {
      const hasil = [];
      for (let n = 1; n <= maks; n += 1) {
        const urut = await klien.bacaIsian("0050", perkaraId, "", n);
        if (!urut.ok) return hasil.length ? { ok: true, sidang: hasil, catatan: urut.pesan } : urut;
        if (String(urut.nilai).trim() !== String(n)) break;
        const [tgl, agenda, hadir] = await Promise.all([
          klien.bacaIsian("0033", perkaraId, "", n),
          klien.bacaIsian("1142", perkaraId, "", n),
          klien.bacaIsian("0090", perkaraId, "", n),
        ]);
        hasil.push({ urutan: n, tanggalIso: tgl.ok ? tgl.nilai : "", agenda: agenda.ok ? agenda.nilai : "", dihadiriOleh: hadir.ok ? hadir.nilai : "" });
      }
      return { ok: true, sidang: hasil };
    },
    /** Sidang urutan N ada? (penjaga sebelum membaca/menulis tanya-jawab: d yang tidak ada = ABT membaca SEMUA sidang). */
    async sidangAda(perkaraId, urutan) {
      const r = await klien.bacaIsian("0050", perkaraId, "", urutan);
      return r.ok && String(r.nilai).trim() === String(urutan);
    },

    // ── (4a) simpan satu isian (teks / tanggal) ────────────────────────────
    /**
     * Simpan satu variabel bertipe data_teks / data_tanggal (satu-satunya yang bisa diisi tangan).
     * Tipe DIBACA dulu dari edit_data (tidak ditebak); menulis var_type salah menyimpan ke tabel lain tanpa
     * keluhan. Tanggal dikirim "d/m/Y". Teks: petik/garis miring dinetralkan (abtKlienNetralkanPetik).
     * `verifikasi` (bawaan true): baca ulang dan bandingkan.
     * Menulis: REPLACE INTO abt_data_teks|abt_data_tanggal (no_var, perkara_id) - tertimpa tanpa riwayat.
     */
    async simpanIsian(kode, perkaraId, nilai, { perkTemp = "", verifikasi = true } = {}) {
      const lama = await klien.bacaIsian(kode, perkaraId, perkTemp);
      if (!lama.ok) return lama;
      if (!lama.bisaDisimpan) return gagal(`Variabel ${kode} bertipe ${lama.tipe || "tanpa tipe"} - tidak dapat diisi tangan.`, { tipe: lama.tipe });
      let kirim = nilai;
      if (lama.tipe === "data_tanggal") {
        kirim = abtKlienTanggalAbt(nilai);
        if (!kirim) return gagal(`"${nilai}" tidak terbaca sebagai tanggal (contoh 15/10/2026).`);
      } else kirim = abtKlienNetralkanPetik(nilai);
      const alamat = `${asal}/edit_data?${q({ no_var: kode, perkara_id: perkaraId || "", e: perkTemp || "" })}`;
      await jeda("simpan", alamat);
      const { t, status } = await teksDari(alamat, { method: "POST", headers: header, body: q({ aksi: "Simpan", value: kirim, var_type: lama.tipe }) });
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      if (/DATA TIDAK TERSIMPAN/i.test(t)) return gagal("ABT menolak menyimpan.");
      if (!/DATA DISIMPAN/i.test(t)) {
        const sebab = abtKlienSebabBukanJawaban(t);
        return gagal(sebab ? `Belum tersimpan - ${sebab.pesan}` : "Jawaban ABT tidak dikenali - anggap belum tersimpan.");
      }
      if (verifikasi) {
        const baru = await klien.bacaIsian(kode, perkaraId, perkTemp);
        const sama = baru.ok && (lama.tipe === "data_tanggal" ? baru.nilai === kirim : baru.nilai.replace(/\r\n/g, "\n").trimEnd() === String(kirim).replace(/\r\n/g, "\n").trimEnd());
        return { ok: sama, tersimpan: true, terverifikasi: sama, nilaiLama: lama.nilai, nilaiBaru: baru.ok ? baru.nilai : null, pesan: sama ? "tersimpan" : "tersimpan tetapi bacaan ulang berbeda" };
      }
      return { ok: true, tersimpan: true, terverifikasi: false, nilaiLama: lama.nilai, pesan: "tersimpan" };
    },

    // ── (4b) tanya jawab per saksi / pihak ─────────────────────────────────
    /**
     * Baca tanya-jawab satu variabel tanya_jawab (mis. 5058 TanyaJwb Saksi 1 P, 6112 Jawaban Lisan) untuk
     * SATU sidang (urutan). a/b hanya dipakai ABT untuk menyusun tautan "Kembali" - boleh kosong.
     * Sidang yang tidak ada -> galat PHP dari ABT (data_sidang()[0] kosong): dikembalikan sebagai gagal.
     */
    async bacaTanyaJawab({ kode, perkaraId, sidang, a = "", b = "" }) {
      const { t, status } = await teksDari(`${asal}/tanyajawab_perkara_edit?${q({ no_var: kode, a, b, c: perkaraId, d: sidang })}`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const h = abtKlienUraiTanyaJawab(t);
      return h.ok ? { ...h, ok: true } : gagal(h.sebab ? h.sebab.pesan : "Daftar tanya-jawab tidak terbaca (sidang tidak ada atau variabel bukan tanya_jawab).", { jenis: h.sebab && h.sebab.jenis });
    },
    /**
     * Isi templat TANPA menyimpan (POST load_template): kode kumpulan ('A01') atau '#<saksi_id>' (salin dari saksi
     * lain perkara ini). Variabel #xxxx# di templat dihitung ABT untuk perkara ini (nama pihak dsb.).
     */
    async muatTemplat({ kode, perkaraId, sidang, templat, a = "", b = "" }) {
      const { t, status } = await teksDari(`${asal}/tanyajawab_perkara_edit?${q({ no_var: kode, a, b, c: perkaraId, d: sidang })}`, {
        method: "POST",
        headers: header,
        body: q({ load_template: templat }),
      });
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const h = abtKlienUraiTanyaJawab(t);
      return h.ok ? { ...h, ok: true } : gagal(h.sebab ? h.sebab.pesan : "Templat tidak terbaca.");
    },
    /**
     * Simpan SELURUH daftar tanya-jawab satu saksi/pihak pada satu sidang (menghapus lalu menulis ulang).
     * baris: [{ no, tanya, jawab }] ; `no` WAJIB unik naik (kunci unik perkara+sidang+saksi+urutan).
     * Daftar KOSONG = menghapus semua keterangan saksi itu di sidang itu - ditolak kecuali `bolehKosong`.
     * Tanda baca: ABT membuang semua tag selain <br> dan rtrim.
     */
    async simpanTanyaJawab({ kode, perkaraId, sidang, baris, a = "", b = "", bolehKosong = false, lewatiCekSidang = false }) {
      if (!Array.isArray(baris)) return gagal("baris harus larik.");
      if (baris.length === 0 && !bolehKosong) return gagal("Daftar kosong akan MENGHAPUS keterangan - perlu bolehKosong:true.");
      if (!lewatiCekSidang && !(await klien.sidangAda(perkaraId, sidang))) return gagal(`Sidang urutan ${sidang} tidak ada pada perkara ini - tidak ditulis (ABT akan menulis dengan sidang kosong).`);
      const nomor = new Set();
      const bersih = baris.map((x, i) => {
        let no = String((x && x.no) || i + 1);
        while (nomor.has(no)) no = String(Number(no) + 1);
        nomor.add(no);
        return { no, tanya: String((x && x.tanya) || ""), jawab: String((x && x.jawab) || "") };
      });
      const alamat = `${asal}/tanyajawab_perkara_edit?${q({ aksi: "simpan", no_var: kode, a, b, c: perkaraId, d: sidang })}`;
      await jeda("simpan", alamat);
      const { t, status } = await teksDari(alamat, { method: "POST", headers: header, body: q({ data: JSON.stringify(bersih) }) });
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      if (!/Tanya\s*Jawab\s*Disimpan/i.test(t)) return gagal(`ABT tidak mengatakan tersimpan: ${abtKlienSebaris(t).slice(0, 200)}`);
      const lagi = await klien.bacaTanyaJawab({ kode, perkaraId, sidang, a, b });
      const sama = lagi.ok && lagi.baris.length === bersih.length;
      return { ok: sama, tersimpan: true, jumlahDikirim: bersih.length, jumlahTerbaca: lagi.ok ? lagi.baris.length : null, pesan: sama ? "tersimpan" : "tersimpan tetapi jumlah baris bacaan ulang berbeda" };
    },

    // ── (5) pratinjau & cetak (RTF) ────────────────────────────────────────
    /**
     * CETAK = GET abt/preview?a=&b=&c=&d= : ABT mengisi seluruh #penanda# blangko dan mengirim RTF
     * (Content-Disposition attachment "<nomor> - <berkas>.rtf"). TIDAK ada langkah "pratinjau" terpisah:
     * pratinjau = RTF yang sama. Rute ini TIDAK memeriksa hak menu/proses (hanya sudah login) - periksa
     * lebih dulu dengan periksaHakBuka bila perlu.
     * `sidang` = urutan sidang untuk variabel multi_sidang & tanya jawab BAS (d).
     * Pulang { ok, rtf:ArrayBuffer, nama, ukuran, periksa:{penandaSisa, jumlahTitikTiga} } .
     */
    async cetak({ a, b, perkaraId, perkTemp, sidang }) {
      const kueri = { a, b, c: perkaraId || "", e: perkTemp || "", d: sidang || "" };
      const r = await ambil(`${asal}/preview?${q(kueri)}`, { credentials: "include", cache: "no-store" });
      if (r.status >= 400) return gagal(`ABT menjawab ${r.status}.`);
      const buf = await r.arrayBuffer();
      const awal = new TextDecoder("latin1").decode(new Uint8Array(buf).subarray(0, 6));
      if (!awal.startsWith("{\\rtf")) {
        const teks = new TextDecoder("latin1").decode(new Uint8Array(buf).subarray(0, 8000));
        const sebab = abtKlienSebabBukanJawaban(teks);
        return gagal(sebab ? sebab.pesan : "ABT tidak mengembalikan RTF.", { jenis: sebab && sebab.jenis });
      }
      const isi = new TextDecoder("latin1").decode(new Uint8Array(buf));
      return {
        ok: true,
        rtf: buf,
        nama: abtKlienNamaDariHeader(r.headers.get("content-disposition")),
        ukuran: buf.byteLength,
        periksa: abtKlienPeriksaRtf(isi),
      };
    },

    // ── (6) anonim ─────────────────────────────────────────────────────────
    /**
     * Anonimisasi putusan (main/anonim): ABT menggantikan nama, alamat, pekerjaan pihak (dari SIPP, bukan dari
     * teks) di RTF yang diunggah. Berkas disimpan sementara di assets/abt/ lalu dihapus ABT. Hanya .rtf/.docx;
     * di Windows/PC lokal hanya .rtf (docx -> "Proses Anonim Gagal" karena butuh soffice Linux).
     * `rtf` = ArrayBuffer/Uint8Array/Blob. Pulang { ok, rtf:ArrayBuffer, nama } atau gagal + pesan ABT.
     */
    async anonim({ perkaraId, nomor, rtf, namaBerkas }) {
      const blob = rtf instanceof Blob ? rtf : new Blob([rtf], { type: "application/rtf" });
      const form = new FormData();
      form.set("perkara_id", String(perkaraId));
      form.set("perkara_no", nomor);
      form.set("file_putusan", blob, namaBerkas || "putusan.rtf");
      await jeda("anonim", `${asal}/main/anonim`);
      const r = await ambil(`${asal}/main/anonim`, { method: "POST", credentials: "include", cache: "no-store", body: form });
      if (r.status >= 400) return gagal(`ABT menjawab ${r.status}.`);
      const buf = await r.arrayBuffer();
      const awal = new TextDecoder("latin1").decode(new Uint8Array(buf).subarray(0, 6));
      if (!awal.startsWith("{\\rtf")) {
        const p = abtKlienPesanAnonim(new TextDecoder().decode(new Uint8Array(buf)));
        return gagal(p.pesan || "ABT tidak mengembalikan RTF anonim.", { warna: p.warna });
      }
      return { ok: true, rtf: buf, nama: abtKlienNamaDariHeader(r.headers.get("content-disposition")), ukuran: buf.byteLength };
    },

    // ── (7) template tanya jawab (kumpulan) ────────────────────────────────
    /** Daftar kumpulan template (halaman main/tanyajawab_template). TIDAK melewati main?hapus= . */
    async daftarTemplate() {
      const { t, status } = await teksDari(`${asal}/main/tanyajawab_template`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const sebab = abtKlienSebabBukanJawaban(t);
      if (sebab) return gagal(sebab.pesan, { jenis: sebab.jenis });
      return { ok: true, templat: abtKlienUraiDaftarTemplate(t), jenisKertas: ((t.match(/<option selected value="([^"]+)">/) || [])[1]) || "" };
    },
    /** Isi mentah satu kumpulan (tanyajawab_template_edit?kode=): jawaban masih berisi #xxxx#. */
    async bacaTemplat(kodeKumpulan) {
      const { t, status } = await teksDari(`${asal}/tanyajawab_template_edit?${q({ kode: kodeKumpulan })}`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      const h = abtKlienUraiTanyaJawab(t);
      return h.ok ? { ...h, ok: true } : gagal(h.sebab ? h.sebab.pesan : "Templat tidak terbaca.");
    },
    /**
     * Simpan satu kumpulan (admin/Super Admin): DELETE seluruh baris kode itu lalu INSERT batch. Satu-satunya
     * rute tulis template yang dibungkus; wajib PRASYARAT-CADANGAN di sisi pemanggil (baca dulu -> simpan
     * cadangan -> baru tulis). Daftar kosong ditolak kecuali bolehKosong.
     */
    async simpanTemplat({ kodeKumpulan, baris, bolehKosong = false }) {
      if (!Array.isArray(baris) || (baris.length === 0 && !bolehKosong)) return gagal("Daftar kosong ditolak (akan menghapus kumpulan).");
      const bersih = baris.map((x, i) => ({ no: String((x && x.no) || i + 1), tanya: String((x && x.tanya) || ""), jawab: String((x && x.jawab) || "") }));
      const alamat = `${asal}/tanyajawab_template_edit?${q({ aksi: "simpan", kode: kodeKumpulan })}`;
      await jeda("simpan", alamat);
      const { t, status } = await teksDari(alamat, { method: "POST", headers: header, body: q({ data: JSON.stringify(bersih) }) });
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      return /Template Tanya Jawab Disimpan/i.test(t) ? { ok: true, jumlah: bersih.length } : gagal(`ABT: ${abtKlienSebaris(t).slice(0, 200)}`);
    },

    // ── (8) validasi BAS ───────────────────────────────────────────────────
    /** Antrian validasi BAS yang terlihat akun ini (hakim: perkaranya; PP: perkaranya; admin: semua). */
    async daftarValidasiBas() {
      const { t, status } = await teksDari(`${asal}/main/validasi_bas`);
      if (status >= 400) return gagal(`ABT menjawab ${status}.`);
      return { ok: true, ...abtKlienUraiValidasiBas(t) };
    },
    /**
     * PP "menyimpan" BAS untuk divalidasi (tombol simpan.png di main/view): POST validasi_bas?aksi=tambah_data.
     * Satu baris per (perkara, sidang_ke) - unik. tglSidang = HTML "Kamis, 01 Okt. 2026<br>Sidang Ke-1" apa adanya
     * dari view ("#0032#, #0033#<br>Sidang Ke-N"); dibuat dari data SIPP oleh pemanggil.
     */
    async ajukanValidasiBas({ perkaraId, sidangKe, tglSidang, direktori, dirBlangko, namaBerkas, dibuatOleh }) {
      const alamat = `${asal}/main/validasi_bas?aksi=tambah_data`;
      await jeda("simpan", alamat);
      const tgl = new Date();
      const dua = (n) => String(n).padStart(2, "0");
      const sekarang = `${tgl.getFullYear()}-${dua(tgl.getMonth() + 1)}-${dua(tgl.getDate())} ${dua(tgl.getHours())}:${dua(tgl.getMinutes())}:${dua(tgl.getSeconds())}`;
      const { status } = await teksDari(alamat, {
        method: "POST",
        headers: header,
        body: q({ perkara_id: perkaraId, sidang_ke: sidangKe, tgl_sidang: tglSidang, direktori, dir_blangko: dirBlangko, file_name: namaBerkas, dibuat_tanggal: sekarang, dibuat_oleh: dibuatOleh }),
      });
      return status < 400 ? { ok: true } : gagal(`ABT menjawab ${status}.`);
    },
    /** Hakim memvalidasi: POST validasi_bas?aksi=valid_data {perkara_id, file_name, sidang_ke}. Hak dicek hanya di tampilan, BUKAN di rute. */
    async validasiBas({ perkaraId, sidangKe, namaBerkas }) {
      const alamat = `${asal}/main/validasi_bas?aksi=valid_data`;
      await jeda("simpan", alamat);
      const { status } = await teksDari(alamat, { method: "POST", headers: header, body: q({ perkara_id: perkaraId, sidang_ke: sidangKe, file_name: namaBerkas }) });
      return status < 400 ? { ok: true } : gagal(`ABT menjawab ${status}.`);
    },
    /** Tombol "batal" di antrian: POST validasi_bas?aksi=hapus_data {perkara_id, file_name, sidang_ke} - menghapus BARIS antrian validasi (bukan blangko). */
    async batalkanValidasiBas({ perkaraId, sidangKe, namaBerkas }) {
      const alamat = `${asal}/main/validasi_bas?aksi=hapus_data`;
      await jeda("simpan", alamat);
      const { status } = await teksDari(alamat, { method: "POST", headers: header, body: q({ perkara_id: perkaraId, sidang_ke: sidangKe, file_name: namaBerkas }) });
      return status < 400 ? { ok: true } : gagal(`ABT menjawab ${status}.`);
    },
  };
  return klien;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    abtKlienBuat,
    abtKlienUraiMenu,
    abtKlienUraiBerkas,
    abtKlienUraiHalamanCari,
    abtKlienUraiView,
    abtKlienUraiPopupData,
    abtKlienUraiTanyaJawab,
    abtKlienUraiDaftarTemplate,
    abtKlienUraiValidasiBas,
    abtKlienPesanAnonim,
    abtKlienNamaDariHeader,
    abtKlienPeriksaRtf,
    abtKlienTanggalAbt,
    abtKlienNetralkanPetik,
    abtKlienSebabBukanJawaban,
    abtKlienTeks,
    abtKlienSebaris,
  };
}
