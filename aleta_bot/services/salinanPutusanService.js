"use strict";

/**
 * ============================================================================
 * PDF SALINAN PUTUSAN - RTF DISUNTING SEBELUM LibreOffice (14 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna: sesudah putusan dirender, tampilkan PDF SALINAN dengan
 *
 *   a. tulisan "SALINAN" di UJUNG KANAN atas halaman pertama - blangko ABT
 *      menaruhnya dalam bingkai bertepatan (\tposx1488, kiri atas);
 *   b. "ttd" di tempat tanda tangan tiap pejabat persidangan (Ketua Majelis,
 *      Hakim Anggota, Panitera Sidang/Pengganti) - blangko [01] belum
 *      memuatnya sama sekali (0 kemunculan pada 573/Pdt.G/2026);
 *   c. GAMBAR tanda tangan Panitera di blok "Untuk Salinan / Pengadilan Agama
 *      Donggala / Panitera," tepat di atas namanya.
 *
 * KENAPA DI RTF, BUKAN DI PDF. PDF hasil LibreOffice tidak menyimpan "paragraf
 * berlabel Panitera," - yang ada hanya potongan glif berkoordinat. Mencari
 * blok "Untuk Salinan" di sana berarti menebak posisi dari potongan teks.
 * Di RTF bloknya utuh: bingkai, paragraf kosong untuk tanda tangan, lalu nama.
 * Gambar disisipkan sebagai {\pict\pngblip ...} pada paragraf kosong itu -
 * cara yang sama dengan sisipkanTandaTangan pada penetapan (dokumenPenetapan
 * Service) - sehingga ukuran dan letaknya ikut tata letak blangko.
 *
 * Fungsi di sini MURNI: tidak membaca basis data, tidak menulis ke mana pun.
 * Yang tidak ditemukan dilaporkan, bukan ditebak tempatnya.
 */

/** Teks yang tampak dari sepotong RTF (kendali dibuang, \tab menjadi \t). */
function teksTampak(rtf) {
  let hasil = "";
  let i = 0;
  const s = String(rtf || "");
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const hex = /^\\'([0-9a-fA-F]{2})/.exec(s.slice(i, i + 4));
      if (hex) {
        hasil += String.fromCharCode(parseInt(hex[1], 16));
        i += 4;
        continue;
      }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40));
      if (m) {
        if (m[1] === "tab") hasil += "\t";
        else if (m[1] === "line") hasil += "\n";
        i += m[0].length;
        continue;
      }
      // \{ \} \\ dan simbol kendali lain
      const lain = s[i + 1] || "";
      if (lain === "{" || lain === "}" || lain === "\\") hasil += lain;
      i += 2;
      continue;
    }
    if (c === "{" || c === "}" || c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    hasil += c;
    i += 1;
  }
  return hasil;
}

/** Posisi tiap \pard - batas paragraf yang dipakai seluruh berkas ini. */
function potongParagraf(rtf, dari = 0, sampai = rtf.length) {
  const potong = [];
  const pola = /\\pard(?![a-z])/g;
  pola.lastIndex = dari;
  let m;
  let awal = -1;
  while ((m = pola.exec(rtf)) && m.index < sampai) {
    if (awal >= 0) potong.push({ awal, akhir: m.index });
    awal = m.index;
  }
  if (awal >= 0) potong.push({ awal, akhir: Math.min(sampai, rtf.length) });
  return potong.map((p) => ({ ...p, teks: teksTampak(rtf.slice(p.awal, p.akhir)) }));
}

const kosong = (teks) => !String(teks || "").replace(/[\s ]+/g, "");

/**
 * Nomor warna PUTIH di \colortbl. Blangko ABT [01] menulis "SALINAN" dan blok
 * "Untuk Salinan / Pengadilan Agama Donggala / Panitera, / <nama>" berwarna
 * putih (\cf16 pada 573/Pdt.G/2026): tidak tampak pada putusan asli, dan
 * menjadi salinan dengan mewarnainya hitam - itulah yang dikerjakan tangan
 * pada salinan 395/Pdt.G/2026 (\cf0). Teks putih lain di badan putusan
 * (daftar bukti) TIDAK disentuh - pewarnaan hanya di dua wilayah itu.
 */
function warnaPutih(rtf) {
  const m = /\{\\colortbl([^}]*)\}/.exec(String(rtf || ""));
  if (!m) return [];
  return m[1]
    .split(";")
    .map((w, i) => ({ i, w: w.replace(/\s+/g, "") }))
    .filter((x) => x.w === "\\red255\\green255\\blue255")
    .map((x) => x.i);
}

function hitamkan(potong, putih) {
  let hasil = potong;
  for (const n of putih) hasil = hasil.replace(new RegExp(`\\\\cf${n}(?![0-9])`, "g"), "\\cf0");
  return hasil;
}

/** Wilayah baris bingkai di sekitar [awal, akhir): \trowd sebelumnya sampai \row sesudahnya. */
function wilayahBaris(s, awal, akhir) {
  const trowd = s.lastIndexOf("\\trowd", awal);
  const a = trowd >= 0 && awal - trowd < 4000 ? trowd : awal;
  const row = s.indexOf("\\row", akhir);
  const b = row >= 0 && row - akhir < 4000 ? row + 4 : akhir;
  return { awal: a, akhir: b };
}

/**
 * a. "SALINAN" ke ujung kanan atas halaman pertama.
 *
 * Bila ia duduk dalam bingkai bertepatan (blangko ABT), bingkainya menjadi
 * baris tabel biasa yang dirata kanan (\trqr), teksnya dirata kanan, dan
 * warna putihnya dihitamkan - lihat catatan di dalam. Bila ia paragraf biasa,
 * cukup rata kanan. Bila tidak ada sama sekali, satu paragraf rata kanan
 * disisipkan sebelum paragraf pertama berbunyi PUTUSAN.
 */
function salinanKeKanan(rtf) {
  const s = String(rtf || "");
  const batasCari = Math.floor(s.length * 0.6);
  const daftar = potongParagraf(s, 0, batasCari);
  const tempat = daftar.find((p) => p.teks.replace(/\s+/g, " ").trim().toUpperCase() === "SALINAN");
  if (!tempat) {
    const judul = daftar.find((p) => /^P\s*U\s*T\s*U\s*S\s*A\s*N$/i.test(p.teks.replace(/\s+/g, " ").trim()));
    if (!judul) return { rtf: s, cara: "tidak_ditemukan" };
    const sisip = "\\pard\\plain\\qr{\\b\\fs24 SALINAN\\par}";
    return { rtf: `${s.slice(0, judul.awal)}${sisip}${s.slice(judul.awal)}`, cara: "disisipkan" };
  }

  const putih = warnaPutih(s);
  const rataKanan = (potong) => hitamkan(potong.replace(/\\q[lcj](?![a-z])/g, "\\qr"), putih);
  const bingkai = /\\t?posx\d+|\\t?posx[lcrio]/.test(s.slice(Math.max(0, tempat.awal - 4000), tempat.akhir + 1500));
  if (!bingkai) {
    return { rtf: `${s.slice(0, tempat.awal)}${rataKanan(s.slice(tempat.awal, tempat.akhir))}${s.slice(tempat.akhir)}`, cara: "paragraf" };
  }

  // Wilayah baris bingkai: dari \trowd terakhir sebelum SALINAN sampai \row
  // sesudahnya - definisi barisnya ada di kedua ujung.
  const { awal, akhir } = wilayahBaris(s, tempat.awal, tempat.akhir);
  let wilayah = s.slice(awal, akhir);

  // ==========================================================================
  // POSISI BINGKAI DIBUANG, BARISNYA DIRATA KANAN
  // ==========================================================================
  //
  // Diukur dengan LibreOffice di container bot (mesin PDF ALETA): \tposx
  // bingkai DIABAIKAN - tabelnya jatuh sebaris di tepi kiri, sehingga
  // memindah \tposx ke kanan tidak menggeser apa pun (SALINAN tetap di kiri,
  // hanya teksnya bergeser dalam sel). Yang dihormati semua mesin adalah
  // tabel biasa ber-\trqr (baris rata kanan) - jadi posisi bingkainya dibuang
  // dan barisnya dirata kanan. Letak tegaknya sama dengan yang dihasilkan
  // LibreOffice selama ini: baris sendiri di atas "PUTUSAN".
  wilayah = lepasBingkaiRataKanan(wilayah);
  // Rata kanan hanya pada paragraf SALINAN-nya sendiri (posisinya bergeser
  // oleh pembuangan di atas - dicari ulang).
  const relAwal = wilayah.indexOf("SALINAN");
  const relPard = relAwal >= 0 ? wilayah.lastIndexOf("\\pard", relAwal) : -1;
  if (relPard >= 0) {
    const relAkhir = wilayah.indexOf("\\cell", relAwal);
    const ujung = relAkhir >= 0 ? relAkhir : wilayah.length;
    wilayah = `${wilayah.slice(0, relPard)}${rataKanan(wilayah.slice(relPard, ujung))}${wilayah.slice(ujung)}`;
  }
  return { rtf: `${s.slice(0, awal)}${wilayah}${s.slice(akhir)}`, cara: "bingkai" };
}

/** Label tempat tanda tangan pejabat persidangan (BUKAN "Panitera," salinan). */
const LABEL_PEJABAT = /^(ketua majelis|hakim ketua|hakim anggota|hakim tunggal|hakim|panitera sidang|panitera pengganti),?$/i;
const POLA_LABEL_GANTI = /(Ketua Majelis|Hakim Ketua|Hakim Anggota|Hakim Tunggal|Panitera Sidang|Panitera Pengganti|Hakim),/gi;

/**
 * b. "ttd" pada baris kosong pertama di bawah tiap baris label pejabat.
 *
 * Baris "ttd"-nya SALINAN dari baris labelnya dengan label diganti "ttd" -
 * tab dan kolomnya ikut, jadi "ttd" jatuh tepat di bawah tiap label (dua
 * kolom pada "Hakim Anggota, \tab Hakim Anggota,"). Yang sudah ber-"ttd"
 * dibiarkan dan dihitung, supaya tidak dobel.
 */
function tambahTtdPejabat(rtf) {
  let s = String(rtf || "");
  const mulai = Math.floor(s.length * 0.5);
  const batasUntukSalinan = (() => {
    const i = s.indexOf("Untuk Salinan", mulai);
    return i > 0 ? i : s.length;
  })();
  const daftar = potongParagraf(s, mulai, batasUntukSalinan);
  const ganti = [];
  let sudahAda = 0;
  for (let k = 0; k < daftar.length; k += 1) {
    const p = daftar[k];
    const bagian = p.teks.split(/\t+/).map((x) => x.trim()).filter(Boolean);
    if (!bagian.length || !bagian.every((b) => LABEL_PEJABAT.test(b))) continue;
    // Paragraf berikutnya sampai paragraf berisi (nama).
    let kosongPertama = null;
    let adaTtd = false;
    for (let j = k + 1; j < daftar.length && j <= k + 8; j += 1) {
      const t = daftar[j].teks;
      if (kosong(t)) {
        if (!kosongPertama) kosongPertama = daftar[j];
        continue;
      }
      if (/(^|\s)ttd\.?(\s|$)/i.test(t)) adaTtd = true;
      break;
    }
    if (adaTtd) {
      sudahAda += bagian.length;
      continue;
    }
    if (!kosongPertama) continue;
    const salinanLabel = s.slice(p.awal, p.akhir).replace(POLA_LABEL_GANTI, "ttd");
    if (!/ttd/.test(teksTampak(salinanLabel))) continue;
    ganti.push({ awal: kosongPertama.awal, akhir: kosongPertama.akhir, isi: salinanLabel, jumlah: bagian.length });
  }
  // Dari belakang, supaya posisi yang belum diganti tetap benar.
  for (const g of ganti.sort((a, b) => b.awal - a.awal)) s = `${s.slice(0, g.awal)}${g.isi}${s.slice(g.akhir)}`;
  return { rtf: s, ditambah: ganti.reduce((n, g) => n + g.jumlah, 0), sudahAda };
}

/** Paragraf blok "Untuk Salinan": label "Panitera," dan nama sesudahnya. */
function blokUntukSalinan(rtf) {
  const s = String(rtf || "");
  const i = s.lastIndexOf("Untuk Salinan");
  if (i < 0) return null;
  const daftar = potongParagraf(s, Math.max(0, s.lastIndexOf("\\pard", i)), Math.min(s.length, i + 20000));
  const k = daftar.findIndex((p) => /^panitera,?$/i.test(p.teks.trim()));
  if (k < 0) return null;
  const kosongan = [];
  for (let j = k + 1; j < daftar.length && j <= k + 8; j += 1) {
    if (kosong(daftar[j].teks)) {
      kosongan.push(daftar[j]);
      continue;
    }
    return { label: daftar[k], kosongan, nama: daftar[j], namaPanitera: daftar[j].teks.replace(/\s+/g, " ").trim() };
  }
  return null;
}

/** Selisih kurung kurawal (yang tidak di-escape) - 0 berarti seimbang. */
function selisihKurung(potong) {
  let n = 0;
  for (let i = 0; i < potong.length; i += 1) {
    const c = potong[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") n += 1;
    else if (c === "}") n -= 1;
  }
  return n;
}

/** Posisi bingkai dibuang & baris dirata kanan - lihat salinanKeKanan. */
function lepasBingkaiRataKanan(potong) {
  return potong
    .replace(/\\t?pos(?:neg)?[xy](?:-?\d+|[lcrio]|in|out|b|t|c)?(?![a-z])/g, "")
    .replace(/\\t?(?:ph|pv)(?:pg|mrg|col|para)(?![a-z])/g, "")
    .replace(/\\tabsnoovrlp\d*/g, "")
    .replace(/\\trq[lc](?![a-z])/g, "\\trqr");
}

/**
 * Blok Untuk Salinan yang putih (blangko ABT) dibuat tampak - hitam - dan
 * dipindah ke AKHIR naskah sebagai baris rata kanan.
 *
 * Di blangko ia bingkai bertepatan di samping rincian biaya. LibreOffice
 * mengabaikan posisi bingkai, sehingga blok yang sudah tampak jatuh di
 * TENGAH rincian biaya (antara "1. PNBP :" dan "- Biaya Pendaftaran" -
 * terukur pada 573/Pdt.G/2026). Di akhir naskah, rata kanan, ia berada di
 * bawah rincian biaya - letak blok pengesahan salinan.
 */
function tampakkanUntukSalinan(rtf) {
  const s = String(rtf || "");
  const blok = blokUntukSalinan(s);
  if (!blok) return { rtf: s, ok: false };
  const putih = warnaPutih(s);
  const i = s.lastIndexOf("Untuk Salinan");
  const { awal, akhir } = wilayahBaris(s, s.lastIndexOf("\\pard", i), blok.nama.akhir);
  const bingkai = /\\t?posx/.test(s.slice(awal, akhir));
  if (!bingkai) return { rtf: `${s.slice(0, awal)}${hitamkan(s.slice(awal, akhir), putih)}${s.slice(akhir)}`, ok: true };
  // Ujung baris termasuk "}" penutup kelompok {\trowd ... \row }.
  const tutup = s.indexOf("}", akhir);
  const ujung = tutup >= 0 && tutup - akhir < 8 ? tutup + 1 : akhir;
  const wilayah = s.slice(awal, ujung);
  const penutupDokumen = s.lastIndexOf("}");
  if (selisihKurung(wilayah) !== 0 || penutupDokumen <= ujung) {
    // Tidak dapat dipindah dengan aman - cukup tampak di tempatnya.
    return { rtf: `${s.slice(0, awal)}${hitamkan(lepasBingkaiRataKanan(wilayah), putih)}${s.slice(ujung)}`, ok: true };
  }
  const pindah = `\\pard\\plain\\par ${hitamkan(lepasBingkaiRataKanan(wilayah), putih)}`;
  const tanpa = `${s.slice(0, awal)}${s.slice(ujung)}`;
  const akhirDok = tanpa.lastIndexOf("}");
  return { rtf: `${tanpa.slice(0, akhirDok)}${pindah}${tanpa.slice(akhirDok)}`, ok: true, dipindah: true };
}

/** Nama Panitera di blok Untuk Salinan - dipakai mencari tanda tangannya. */
function namaPaniteraSalinan(rtf) {
  const b = blokUntukSalinan(rtf);
  return b ? b.namaPanitera : "";
}

/** Lebar x tinggi piksel PNG/JPEG (0 bila tidak terbaca). */
function ukuranGambar(isi) {
  const b = Buffer.from(isi || []);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const tanda = b[i + 1];
      const panjang = b.readUInt16BE(i + 2);
      if (tanda >= 0xc0 && tanda <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tanda)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + panjang;
    }
  }
  return { w: 0, h: 0 };
}

/**
 * c. Gambar tanda tangan Panitera di blok Untuk Salinan, di atas namanya.
 *
 * Disisipkan ke paragraf kosong PERTAMA di antara "Panitera," dan nama -
 * ruang tanda tangan yang memang disediakan blangko. Tanpa paragraf kosong,
 * gambar ditaruh di awal paragraf nama disusul pindah baris.
 */
function sisipkanTtdPanitera(rtf, ttd, { tinggiTwip = 900, lebarMaks = 2800 } = {}) {
  const s = String(rtf || "");
  if (!ttd || !ttd.isi || !Buffer.from(ttd.isi).length) return { rtf: s, ok: false, alasan: "ttd_tidak_ada" };
  const blok = blokUntukSalinan(s);
  if (!blok) return { rtf: s, ok: false, alasan: "blok_untuk_salinan_tidak_ada" };
  const { w, h } = ukuranGambar(ttd.isi);
  const tinggi = tinggiTwip;
  const lebar = w > 0 && h > 0 ? Math.min(lebarMaks, Math.round((tinggi * w) / h)) : Math.round(tinggi * 2.4);
  const jenis = String(ttd.jenis || "").toLowerCase() === "jpg" ? "jpegblip" : "pngblip";
  const pict = `{\\pict\\${jenis}\\picwgoal${lebar}\\pichgoal${tinggi} ${Buffer.from(ttd.isi).toString("hex")}}`;
  if (blok.kosongan.length) {
    const p = blok.kosongan[0];
    const isi = s.slice(p.awal, p.akhir);
    const par = isi.lastIndexOf("\\par");
    const baru = par >= 0 ? `${isi.slice(0, par)}${pict}${isi.slice(par)}` : `${isi}${pict}`;
    return { rtf: `${s.slice(0, p.awal)}${baru}${s.slice(p.akhir)}`, ok: true, namaPanitera: blok.namaPanitera };
  }
  const n = blok.nama;
  const isi = s.slice(n.awal, n.akhir);
  const kurung = isi.indexOf("{");
  const baru = kurung >= 0 ? `${isi.slice(0, kurung)}${pict}{\\line }${isi.slice(kurung)}` : `${pict}{\\line }${isi}`;
  return { rtf: `${s.slice(0, n.awal)}${baru}${s.slice(n.akhir)}`, ok: true, namaPanitera: blok.namaPanitera };
}

/**
 * Seluruh penyuntingan salinan. `ttd` = { jenis, isi } milik Panitera yang
 * namanya di blok Untuk Salinan (SUDAH disahkan - lihat
 * tandaTanganService.untukPejabat), atau null.
 */
function susunSalinan(rtf, { ttd = null } = {}) {
  const a = salinanKeKanan(rtf);
  const b = tambahTtdPejabat(a.rtf);
  const u = tampakkanUntukSalinan(b.rtf);
  const namaPanitera = namaPaniteraSalinan(u.rtf);
  const c = sisipkanTtdPanitera(u.rtf, ttd);
  return {
    rtf: c.rtf,
    laporan: {
      salinan: a.cara,
      untukSalinan: u.ok,
      ttdDitambah: b.ditambah,
      ttdSudahAda: b.sudahAda,
      namaPanitera,
      gambarTtdPanitera: c.ok,
      alasanTanpaGambar: c.ok ? "" : c.alasan,
    },
  };
}

module.exports = {
  teksTampak,
  potongParagraf,
  salinanKeKanan,
  tambahTtdPejabat,
  tampakkanUntukSalinan,
  warnaPutih,
  namaPaniteraSalinan,
  sisipkanTtdPanitera,
  ukuranGambar,
  susunSalinan,
};
