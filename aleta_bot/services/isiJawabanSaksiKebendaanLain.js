"use strict";

/**
 * ============================================================================
 * POLA POSITA/PETITUM TAMBAHAN: WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH (agen W2a-K2, 21 Okt 2026)
 * ============================================================================
 *
 * Melengkapi isiJawabanSaksiPositaLain.js (hibah, wakaf, eksyar) dan memberi wasiat pola sendiri untuk katalog saksi versi 2
 * (ekstensi-sipp/saksi-katalog/{wasiat,hibah,wakaf,ekonomi-syariah}.json). MURNI (tanpa jaringan, tanpa pustaka lain) agar
 * dapat dimuat dari Fakta/PositaLain/Variabel tanpa lingkar impor.
 *
 *   1. Fakta dari posita (kunci fakta -> variabel ABT di isiJawabanSaksiVariabel.js):
 *        wasiat  bentukWasiat 9478 | objekWasiat 9479 | penerimaWasiat 9480
 *        hibah   bentukHibah 9794 | penerimaHibah 9796
 *        wakaf   bentukIkrar 9825 | nazhir 9824 (nama benar, bukan kata "Nadzir")
 *        eksyar  akad 9340 (akad berjenis ganda "Akad Jual Beli Murabahah Nomor ... tanggal ...") |
 *                rincianPembiayaan 4765 | angsuranJatuhTempo 4766 | suratPeringatan 4767 | agunan 4768
 *   2. Saran KEADAAN katalog (pilihan borang "Susun saksi") dari posita dan petitum: saranKeadaan(posita, petitum, jenis).
 *
 * Aturan "otomatisasi berdasar": SEMUA keluaran berkeyakinan "ragu" (saran, tampil sebagai "ragu - periksa"). Pola ini baru
 * diukur atas 5 gugatan nyata (1 wasiat, 2 ekonomi syariah gugatan sederhana PA Donggala; 2 wakaf PA Bungku) dan fixture;
 * belum ada isian petugas pembanding (0 isian pada variabel 9340-9355, 9475-9493, 9790-9841 di server 21 Okt 2026), sehingga
 * belum ada yang layak "cukup" atau "pasti". Yang tidak tertulis di posita tidak pernah dikarang.
 */

const BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Pebruari|Nopember";
const TGL = `\\d{1,2}\\s+(?:${BULAN})\\s+(?:19|20)\\d{2}`;
const NAMA_KATA = "[A-Z][A-Za-z.'’`-]*";
const NAMA = `${NAMA_KATA}(?:\\s+(?:${NAMA_KATA}|bin|binti|alias|Bin|Binti|Alias)){0,6}(?:,\\s*[A-Z][A-Za-z.]{1,8})?`;

const rapat = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
const potongBatas = (t, maks = 170) => {
  const s = rapat(t);
  if (s.length <= maks) return s;
  const p = s.slice(0, maks);
  return p.slice(0, Math.max(p.lastIndexOf(","), p.lastIndexOf(" "))).trim();
};
const bersihTepi = (t) => rapat(t).replace(/^[\s:;,.\-–]+|[\s:;,.\-–]+$/g, "");
const f = (kunci, nilai, ket) => {
  const n = bersihTepi(nilai);
  return n && !/aleta/i.test(n) ? { kunci, nilai: n, yakin: "ragu", ket: ket || "" } : null;
};
const tanpaNull = (daftar) => daftar.filter(Boolean);

/** Daftar butir (a., b., 1), -) yang mengikuti butir pembuka berakhir titik dua. */
function daftarSesudah(butir, polaPembuka, maks = 6) {
  for (let i = 0; i < butir.length; i += 1) {
    if (!polaPembuka.test(butir[i])) continue;
    const hasil = [];
    for (let k = i + 1; k < butir.length && hasil.length < maks; k += 1) {
      const x = /^\s*(?:[-•*]|\d{1,2}[.)]|[a-z][.)])\s*(.+)$/i.exec(butir[k]);
      if (!x) break;
      hasil.push(potongBatas(x[1], 140).replace(/[;,.]+$/, ""));
    }
    if (hasil.length) return hasil;
  }
  return [];
}

// ============================================================================
// Wasiat
// ============================================================================

function wasiat(butir) {
  const hasil = [];
  // bentuk dan tanggal: akta Notaris > surat tertulis > lisan
  let bentuk = null;
  for (const b of butir) {
    const akta = new RegExp(`akta\\s+(?:wasiat|notaris)[^.;]{0,80}?(?:nomor|no\\.?)\\s*:?\\s*([\\w/.\\-]{2,40})(?:[^.;]{0,40}?(?:tanggal|tgl\\.?)\\s*(${TGL}))?`, "i").exec(b);
    if (akta) {
      bentuk = f("bentukWasiat", `dengan akta Notaris Nomor ${akta[1].replace(/[.,]$/, "")}${akta[2] ? ` tanggal ${rapat(akta[2])}` : ""}`, "Dari kalimat tentang akta wasiat pada gugatan; periksa.");
      break;
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      const m = new RegExp(`(?:surat\\s+wasiat|wasiat\\s+tertulis|wasiat)[^.;]{0,60}?(?:tertanggal|bertanggal|tanggal)\\s*(${TGL})`, "i").exec(b);
      if (m && /surat\s+wasiat|tertulis/i.test(b)) {
        bentuk = f("bentukWasiat", `secara tertulis tertanggal ${rapat(m[1])}`, "Dari kalimat tentang surat wasiat tertanggal pada gugatan; periksa.");
        break;
      }
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      if (/wasiat\s+(?:secara\s+)?lisan|berwasiat\s+secara\s+lisan|secara\s+lisan[^.;]{0,40}berwasiat/i.test(b)) {
        const t = new RegExp(`(${TGL})`, "i").exec(b);
        bentuk = f("bentukWasiat", `secara lisan${t ? ` pada tanggal ${rapat(t[1])}` : ""}`, "Dari kalimat tentang wasiat lisan pada gugatan; periksa.");
        break;
      }
    }
  }
  if (bentuk) hasil.push(bentuk);

  // objek: daftar sesudah kalimat pembuka, atau kalimat "mewasiatkan ..."
  const daftar = daftarSesudah(butir, /(?:harta|objek|benda|tanah|rumah)[^:]{0,200}(?:antara\s+lain|sebagai\s+berikut|berupa|yaitu)\s*:\s*$/i);
  if (daftar.length) hasil.push(f("objekWasiat", daftar.join("; "), "Daftar harta yang tertulis di bawah kalimat pembuka pada gugatan; periksa kelengkapannya."));
  else {
    for (const b of butir) {
      const m = /(?:mewasiatkan|diwasiatkan|wasiat\s+berupa)\s+(?:(?:sebuah|sebidang|satu\s+unit)\s+)?(.{6,150}?)(?:\s+(?:kepada|untuk)\b|[;.]|$)/i.exec(b);
      if (m) {
        hasil.push(f("objekWasiat", m[1], "Dari kalimat 'mewasiatkan' pada gugatan; periksa."));
        break;
      }
    }
  }

  // penerima: "isi surat wasiat ... kepada X"
  for (const b of butir) {
    const m = /wasiat[^.;]{0,200}?\bkepada\s+([^()\n;]{4,110})/i.exec(b);
    if (m && !/^\s*(?:Ketua|Majelis|Pengadilan)\b/i.test(m[1])) {
      hasil.push(f("penerimaWasiat", m[1].replace(/\s+(?:yang|dan|serta)\s*$/i, ""), "Dari kalimat tentang isi wasiat pada gugatan; periksa."));
      break;
    }
  }
  return tanpaNull(hasil);
}

// ============================================================================
// Hibah
// ============================================================================

function hibah(butir) {
  const hasil = [];
  let bentuk = null;
  for (const b of butir) {
    const akta = new RegExp(`akta\\s+hibah[^.;]{0,80}?(?:nomor|no\\.?)\\s*:?\\s*([\\w/.\\-]{2,40})(?:[^.;]{0,40}?(?:tanggal|tgl\\.?)\\s*(${TGL}))?`, "i").exec(b);
    if (akta) {
      bentuk = f("bentukHibah", `dengan akta hibah Nomor ${akta[1].replace(/[.,]$/, "")}${akta[2] ? ` tanggal ${rapat(akta[2])}` : ""}`, "Dari kalimat tentang akta hibah pada gugatan; periksa.");
      break;
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      const m = new RegExp(`(?:surat\\s+hibah|hibah\\s+tertulis|surat\\s+pernyataan\\s+hibah)[^.;]{0,60}?(?:tertanggal|bertanggal|tanggal)\\s*(${TGL})`, "i").exec(b);
      if (m) {
        bentuk = f("bentukHibah", `secara tertulis tertanggal ${rapat(m[1])}`, "Dari kalimat tentang surat hibah tertanggal pada gugatan; periksa.");
        break;
      }
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      if (/hibah[^.;]{0,50}secara\s+lisan|menghibahkan[^.;]{0,100}secara\s+lisan|secara\s+lisan[^.;]{0,60}menghibahkan/i.test(b)) {
        const t = new RegExp(`(${TGL})`, "i").exec(b);
        bentuk = f("bentukHibah", `secara lisan${t ? ` pada tanggal ${rapat(t[1])}` : ""}`, "Dari kalimat tentang hibah lisan pada gugatan; periksa.");
        break;
      }
    }
  }
  if (bentuk) hasil.push(bentuk);
  for (const b of butir) {
    const m = new RegExp(`menghibahkan\\s+.{5,200}?\\s+kepada\\s+(${NAMA})`).exec(b);
    if (m) {
      hasil.push(f("penerimaHibah", m[1], "Dari kalimat 'menghibahkan ... kepada' pada gugatan; periksa."));
      break;
    }
  }
  return tanpaNull(hasil);
}

// ============================================================================
// Wakaf
// ============================================================================

const KATA_UMUM_NAZHIR = /^(?:Nazhir|Nadzir|Nadhir|Nazir|Wakif|Wakip)$/i;

function wakaf(butir) {
  const hasil = [];
  for (const b of butir) {
    const m = new RegExp(`(?:nazhir|nadzir|nadhir)(?:nya)?\\s*(?:adalah|ialah|bernama|:)\\s*(${NAMA})`, "i").exec(b);
    if (m && !KATA_UMUM_NAZHIR.test(m[1].trim())) {
      hasil.push(f("nazhir", m[1], "Dari kalimat 'Nadzir adalah ...' pada gugatan; periksa."));
      break;
    }
  }
  let bentuk = null;
  for (const b of butir) {
    const m = new RegExp(`akta\\s+ikrar\\s+wakaf[^.;]{0,100}?(?:tertanggal|bertanggal|tanggal)\\s*(${TGL})`, "i").exec(b);
    if (m) {
      const nomor = /(?:nomor|no\.?)\s*:?\s*([\w/.\-]{2,40})/i.exec(b);
      bentuk = f("bentukIkrar", `dengan Akta Ikrar Wakaf${nomor ? ` Nomor ${nomor[1].replace(/[.,]$/, "")}` : ""} tanggal ${rapat(m[1])}`, "Dari kalimat tentang akta ikrar wakaf pada gugatan; periksa.");
      break;
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      const m = new RegExp(`(?:surat\\s+(?:ikrar\\s+)?wakaf|ikrar\\s+wakaf\\s+tertulis)[^.;]{0,60}?(?:tertanggal|bertanggal|tanggal)\\s*(${TGL})`, "i").exec(b);
      if (m) {
        bentuk = f("bentukIkrar", `secara tertulis tertanggal ${rapat(m[1])}`, "Dari kalimat tentang surat ikrar wakaf pada gugatan; periksa.");
        break;
      }
    }
  }
  if (!bentuk) {
    for (const b of butir) {
      if (/ikrar\s+wakaf[^.;]{0,40}(?:secara\s+)?lisan|(?:berikrar|mengikrarkan)[^.;]{0,60}secara\s+lisan/i.test(b)) {
        const t = new RegExp(`(${TGL})`, "i").exec(b);
        bentuk = f("bentukIkrar", `dengan ikrar lisan${t ? ` pada tanggal ${rapat(t[1])}` : ""}`, "Dari kalimat tentang ikrar wakaf lisan pada gugatan; periksa.");
        break;
      }
    }
  }
  if (bentuk) hasil.push(bentuk);
  return tanpaNull(hasil);
}

// ============================================================================
// Ekonomi syariah
// ============================================================================

const JENIS_AKAD = "murabahah|mudharabah|musyarakah|ijarah|qardh|qard|rahn|istishna|istisna|salam|wadiah|wakalah|kafalah";
const rupiah = (t) => {
  const m = /Rp\.?\s*([\d.,]+)/i.exec(String(t || ""));
  return m ? m[1].replace(/[.,]+$/, "") : "";
};

function eksyar(butir) {
  const hasil = [];
  // akad berjenis ganda: "Akad Jual Beli Murabahah Nomor: 025/... tanggal 18 Desember 2019"
  for (const b of butir) {
    const m = new RegExp(`\\b((?:akad|perjanjian)\\s+(?:(?:jual\\s+beli|pembiayaan|kredit|sewa|bagi\\s+hasil|gadai|pinjaman|usaha)\\s+)*(?:${JENIS_AKAD}))(?:\\s+(?:nomor|no\\.?)\\s*:?\\s*([\\w/.\\-]{2,50}))?(?:[^.;]{0,50}?(?:tanggal|tgl\\.?)\\s*(${TGL}))?`, "i").exec(b);
    if (m) {
      const nilai = `${m[1].replace(/^perjanjian/i, "Akad")}${m[2] ? ` Nomor ${m[2].replace(/[.,]$/, "")}` : ""}${m[3] ? ` tanggal ${rapat(m[3])}` : ""}`;
      hasil.push(f("akad", nilai.replace(/^akad/, "Akad"), "Dari kalimat tentang akad pada gugatan (jenis, nomor dan tanggal bila tertulis); periksa."));
      break;
    }
  }
  // rincian pembiayaan: harga beli, margin, harga jual, jangka waktu
  const gabung = butir.join(" ; ");
  const beli = /harga\s+beli[^.;]{0,40}?(Rp\.?\s*[\d.,]+)/i.exec(gabung);
  const margin = /margin[^.;]{0,50}?(Rp\.?\s*[\d.,]+)/i.exec(gabung);
  const jual = /harga\s+jual[^.;]{0,60}?(Rp\.?\s*[\d.,]+)/i.exec(gabung);
  const plafon = /(?:plafon|fasilitas\s+pembiayaan|pokok\s+pembiayaan|modal)[^.;]{0,60}?(Rp\.?\s*[\d.,]+)/i.exec(gabung);
  const waktu = /jangka\s+waktu[^.;]{0,50}?(\d{1,3})\s*(?:\([^)]*\)\s*)?(bulan|tahun|hari)/i.exec(gabung);
  const bagian = [];
  if (beli) bagian.push(`harga beli Rp${rupiah(beli[1])}`);
  else if (plafon) bagian.push(`plafon pembiayaan Rp${rupiah(plafon[1])}`);
  if (margin) bagian.push(`margin Rp${rupiah(margin[1])}`);
  if (jual) bagian.push(`harga jual Rp${rupiah(jual[1])}`);
  if (waktu) bagian.push(`jangka waktu ${waktu[1]} ${waktu[2].toLowerCase()}`);
  if (bagian.length >= 2) hasil.push(f("rincianPembiayaan", bagian.join(", ").replace(/, ([^,]+)$/, " dan $1"), "Dari rincian harga dan jangka waktu pada gugatan; periksa."));

  // angsuran dan jatuh tempo
  const ang = /angsuran(?:nya)?[^.;]{0,60}?(?:sebesar|senilai|sejumlah)\s*(Rp\.?\s*[\d.,]+)(?:[^.;]{0,40}?(?:per\s+bulan|setiap\s+bulan|tiap\s+bulan))?/i.exec(gabung);
  const tempo = /(?:angsuran|pembayaran)[^.;]{0,50}?(?:setiap|tiap|pada)\s+tanggal\s+(\d{1,2})(?:\s*\([^)]*\))?(?:\s+(?:bulan\s+berjalan|setiap\s+bulan|tiap\s+bulan))?/i.exec(gabung);
  const bagianAng = [];
  if (ang) bagianAng.push(`angsuran Rp${rupiah(ang[1])} per bulan`);
  if (tempo) bagianAng.push(`jatuh tempo setiap tanggal ${tempo[1]}`);
  if (bagianAng.length) hasil.push(f("angsuranJatuhTempo", bagianAng.join(", ").replace(/, ([^,]+)$/, " dan $1"), "Dari kalimat tentang angsuran pada gugatan; periksa."));

  // surat peringatan: "Surat Nomor: 248/... tanggal 04 Oktober 2023 perihal Surat Peringatan I"
  const sp = [];
  const reSp = new RegExp(`surat\\s+(?:nomor|no\\.?)\\s*:?\\s*([\\w/.\\-]{3,50})\\s+(?:tanggal|tgl\\.?)\\s*(${TGL})(?:\\s+perihal\\s+([^;.]{3,40}?))?(?=\\s*(?:;|\\.|$|\\s+surat\\b))`, "gi");
  for (const b of butir) {
    let m;
    while ((m = reSp.exec(b)) !== null && sp.length < 5) sp.push(`Surat Nomor ${m[1].replace(/[.,]$/, "")} tanggal ${rapat(m[2])}${m[3] ? ` (${rapat(m[3])})` : ""}`);
    reSp.lastIndex = 0;
  }
  if (sp.length) hasil.push(f("suratPeringatan", sp.join("; "), "Dari daftar surat peringatan pada gugatan; periksa."));

  // agunan: sertifikat
  for (const b of butir) {
    const m = /\b((?:sebidang\s+tanah\s+(?:dan\s+bangunan\s+)?)?(?:sertifikat\s+hak\s+(?:milik|guna\s+bangunan|pakai)|SHM|SHGB|HGB)\s*(?:nomor|no\.?)\s*:?\s*[\w/.\-]+[^;]{0,180})/i.exec(b);
    if (m) {
      const ringkas = m[1].split(/\s+yang\s+(?:dalam\s+hal|objeknya|terletak)\b/i)[0].replace(/\b(\d+)\s*m\s*2\b/gi, "$1 m2");
      hasil.push(f("agunan", potongBatas(ringkas, 190), "Dari kalimat tentang agunan pada gugatan; periksa."));
      break;
    }
  }
  return tanpaNull(hasil);
}

// ============================================================================
// Saran keadaan katalog dari posita dan petitum
// ============================================================================

const ada = (t, re) => re.test(t);
const s = (kunci, nilai, ket) => ({ kunci, nilai, yakin: "ragu", sumber: "gugatan", ket });

function dariPetitum(petitum) {
  const t = rapat(petitum).toLowerCase();
  const hasil = [];
  if (ada(t, /sita\s*jaminan|conservatoir|conservatoire/)) hasil.push("sita-jaminan");
  if (ada(t, /lelang/)) hasil.push("lelang-agunan");
  if (ada(t, /mengosongkan|pengosongan/)) hasil.push("pengosongan");
  if (ada(t, /uang\s*paksa|dwangsom/)) hasil.push("uang-paksa");
  if (ada(t, /serta\s*merta|uitvoerbaar/)) hasil.push("serta-merta");
  if (ada(t, /ganti\s+(?:kerugian|rugi)|kerugian\s+materiil|ta'?widh|denda/)) hasil.push("ganti-rugi");
  return hasil;
}

/**
 * Saran keadaan katalog "Susun saksi" dari posita dan petitum. Hanya yang TERTULIS; semua "ragu".
 * @param {string} posita   teks posita (polos atau HTML)
 * @param {string} petitum  teks petitum (polos atau HTML)
 * @param {"wasiat"|"hibah"|"wakaf"|"eksyar"} jenis
 * @param {{alur?: string|number}} [opsi]
 * @returns {{kunci: string, nilai: string, yakin: "ragu", sumber: "gugatan", ket: string}[]}
 */
function saranKeadaan(posita, petitum, jenis, opsi = {}) {
  const p = rapat(String(posita || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "));
  const pt = rapat(String(petitum || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "));
  const hasil = [];
  const tambahan = dariPetitum(pt);
  const petitumKe = (kunci, nilaiKe) => {
    for (const n of tambahan) if (nilaiKe[n]) hasil.push(s(kunci, nilaiKe[n], "Dari butir petitum; periksa."));
  };
  if (jenis === "eksyar") {
    if (opsi.alur !== undefined && String(opsi.alur) === "17") hasil.push(s("acara", "gugatan-sederhana", "Alur perkara 17 adalah gugatan sederhana."));
    else if (ada(p, /gugatan\s+sederhana/i)) hasil.push(s("acara", "gugatan-sederhana", "Posita menyebut gugatan sederhana; periksa."));
    const hitung = {};
    for (const j of ["murabahah", "mudharabah", "musyarakah", "ijarah", "rahn", "qardh"]) hitung[j] = (p.match(new RegExp(j === "qardh" ? "qard[h]?" : j, "gi")) || []).length;
    const unggul = Object.entries(hitung).sort((a, b) => b[1] - a[1])[0];
    if (unggul && unggul[1] > 0) hasil.push(s("jenisAkad", unggul[0], "Jenis akad yang paling sering disebut pada posita; periksa."));
    else if (ada(p, /istishna|istisna|salam|wadiah|wakalah|kafalah/i)) hasil.push(s("jenisAkad", "akad-lain", "Posita menyebut akad lain; periksa."));
    if (ada(p, /agunan|jaminan|sertifikat|hak\s+tanggungan|fidusia|gadai|BPKB/i)) {
      hasil.push(s("jaminan", "ada", "Posita menyebut agunan atau jaminan."));
      if (ada(p, /sertifikat|hak\s+tanggungan|SHM|SHGB|tanah\s+dan\s+bangunan/i)) hasil.push(s("jenisJaminan", "tanah-bangunan", "Posita menyebut sertifikat atau tanah sebagai agunan."));
      if (ada(p, /fidusia|BPKB|kendaraan/i)) hasil.push(s("jenisJaminan", "kendaraan-fidusia", "Posita menyebut fidusia, BPKB atau kendaraan."));
      if (ada(p, /penjamin|kafalah|guarantor|penanggung/i)) hasil.push(s("jenisJaminan", "penjamin-pribadi", "Posita menyebut penjamin."));
      if (ada(p, /gadai|rahn/i)) hasil.push(s("jenisJaminan", "barang-gadai", "Posita menyebut gadai."));
    }
    if (ada(p, /surat\s+peringatan|somasi|teguran\s+tertulis|peringatan\s+tertulis/i)) hasil.push(s("teguran", "surat-peringatan", "Posita menyebut surat peringatan atau somasi."));
    if (ada(p, /(?:didatangi|mendatangi|kunjungan|mengunjungi)[^.;]{0,50}(?:tagih|penagihan)|penagihan\s+langsung/i)) hasil.push(s("teguran", "kunjungan-penagihan", "Posita menyebut kunjungan penagihan."));
    if (ada(p, /restrukturisasi|penjadwalan\s+ulang|rescheduling|keringanan/i)) hasil.push(s("teguran", "restrukturisasi", "Posita menyebut restrukturisasi atau penjadwalan ulang."));
    if (ada(p, /arbitrase|basyarnas/i)) hasil.push(s("klausulaArbitrase", "ada", "Posita menyebut arbitrase."));
    petitumKe("tuntutanTambahan", { "ganti-rugi": "denda-ganti-rugi", "sita-jaminan": "sita-jaminan", "lelang-agunan": "lelang-agunan", pengosongan: "pengosongan", "uang-paksa": "uang-paksa", "serta-merta": "serta-merta" });
  } else if (jenis === "wasiat") {
    const akta = ada(p, /(?<!tidak\s)(?<!bukan\s)(?:akta\s+notaris\s+(?:nomor|no\.)|dibuat\s+(?:di\s+hadapan|oleh)\s+notaris|wasiat\s+(?:dengan|melalui)\s+akta)/i);
    const tertulis = ada(p, /surat\s+wasiat|wasiat\s+tertulis/i);
    const lisan = ada(p, /wasiat\s+(?:secara\s+)?lisan|berwasiat\s+secara\s+lisan/i);
    if (akta) hasil.push(s("bentukWasiat", "akta-notaris", "Posita menyebut akta Notaris."));
    else if (tertulis) hasil.push(s("bentukWasiat", "tertulis", "Posita menyebut surat wasiat."));
    else if (lisan) hasil.push(s("bentukWasiat", "lisan", "Posita menyebut wasiat lisan."));
    if (ada(p, /wasiat[^.;]{0,120}(?:yayasan|lembaga|masjid|panti|pesantren|badan\s+hukum)/i)) hasil.push(s("penerima", "lembaga", "Posita menyebut lembaga penerima wasiat."));
    else if (ada(p, /wasiat\s+kepada\s+(?:salah\s+satu\s+)?ahli\s+waris|diberikan\s+kepada\s+ahli\s+waris|wasiat[^.;]{0,100}(?:ahli\s+waris|keturunan)/i)) hasil.push(s("penerima", "ahli-waris", "Posita menyebut ahli waris sebagai penerima wasiat."));
    if (ada(p, /meninggal[^.;]{0,120}sebelum[^.;]{0,80}(?:wasiat|dibuat)|sebelum\s+(?:tanggal\s+)?(?:pembuatan\s+)?surat\s+wasiat/i)) hasil.push(s("dalilCacat", "pewasiat-sudah-wafat", "Posita menyebut pewasiat sudah meninggal sebelum wasiat dibuat."));
    if (ada(p, /(?:tanda\s+tangan|cap\s+jempol)[^.;]{0,60}(?:palsu|dipalsukan|bukan\s+milik|tidak\s+sama)|dipalsukan/i)) hasil.push(s("dalilCacat", "tanda-tangan-dipalsukan", "Posita menyebut pemalsuan."));
    if (ada(p, /dipaksa|ditekan|diancam|paksaan|di\s+bawah\s+tekanan/i)) hasil.push(s("dalilCacat", "ada-tekanan", "Posita menyebut paksaan atau tekanan."));
    if (ada(p, /(?:telah|sudah)\s+(?:musnah|hilang|terbakar)[^.;]{0,60}(?:benda|objek|harta|wasiat)|(?:benda|objek|harta)[^.;]{0,60}(?:telah|sudah)\s+(?:musnah|hilang|terbakar)/i)) hasil.push(s("dalilCacat", "objek-musnah", "Posita menyebut benda wasiat musnah."));
    if (ada(p, /tanpa\s+persetujuan[^.;]{0,60}ahli\s+waris|ahli\s+waris[^.;]{0,60}(?:tidak\s+menyetujui|menolak)/i)) hasil.push(s("persetujuan", "ada-yang-menolak", "Posita menyebut ahli waris tidak menyetujui."));
    else if (ada(p, /disetujui\s+(?:oleh\s+)?(?:seluruh|semua)\s+ahli\s+waris|ahli\s+waris[^.;]{0,40}menyetujui/i)) hasil.push(s("persetujuan", "disetujui-semua", "Posita menyebut ahli waris menyetujui."));
    if (ada(p, /sakit[^.;]{0,60}(?:meninggal|parah|keras)|menjelang\s+(?:meninggal|wafat)/i)) hasil.push(s("kondisiPewasiat", "sakit-menjelang-wafat", "Posita menyebut sakit menjelang meninggal."));
    if (ada(p, /pikun|tidak\s+sadar|gangguan\s+jiwa|kehilangan\s+akal/i)) hasil.push(s("kondisiPewasiat", "akal-dipersoalkan", "Posita menyebut gangguan akal."));
    if (ada(p, /(?:pewasiat|pemberi\s+wasiat|almarhum\w*)[^.;]{0,60}(?:mencabut|menarik\s+kembali|membatalkan)[^.;]{0,30}wasiat|wasiat[^.;]{0,30}telah\s+dicabut\s+oleh/i)) hasil.push(s("pencabutan", "dicabut", "Posita menyebut pencabutan wasiat."));
    if (ada(p, /tanah|rumah|sawah|bangunan/i)) hasil.push(s("jenisObjek", "tanah-bangunan", "Posita menyebut tanah atau bangunan."));
    if (ada(p, /tabungan|deposito|uang/i)) hasil.push(s("jenisObjek", "uang-tabungan", "Posita menyebut uang atau tabungan."));
    if (ada(p, /kalung|emas|perhiasan|kendaraan|mobil|motor|ternak/i)) hasil.push(s("jenisObjek", "benda-bergerak", "Posita menyebut benda bergerak."));
    petitumKe("tuntutanTambahan", { "ganti-rugi": "ganti-rugi", "sita-jaminan": "sita-jaminan", "uang-paksa": "uang-paksa" });
  } else if (jenis === "hibah") {
    if (ada(p, /akta\s+hibah|PPAT/i)) hasil.push(s("bentukHibah", "akta-ppat", "Posita menyebut akta hibah atau PPAT."));
    else if (ada(p, /surat\s+hibah|hibah\s+tertulis|surat\s+pernyataan\s+hibah/i)) hasil.push(s("bentukHibah", "tertulis", "Posita menyebut surat hibah."));
    else if (ada(p, /hibah[^.;]{0,50}secara\s+lisan|menghibahkan[^.;]{0,100}secara\s+lisan/i)) hasil.push(s("bentukHibah", "lisan", "Posita menyebut hibah lisan."));
    if (ada(p, /(?:almarhum|alm\.?)[^.;]{0,50}(?:penghibah|menghibahkan)|penghibah[^.;]{0,40}(?:meninggal|almarhum|wafat)/i)) hasil.push(s("statusPenghibah", "sudah-meninggal", "Posita menyebut penghibah sudah meninggal."));
    if (ada(p, /sakit[^.;]{0,60}(?:meninggal|parah|keras)|menjelang\s+(?:meninggal|wafat)/i)) hasil.push(s("kondisiPenghibah", "sakit-menjelang-wafat", "Posita menyebut sakit menjelang meninggal."));
    if (ada(p, /pikun|tidak\s+sadar|gangguan\s+jiwa/i)) hasil.push(s("kondisiPenghibah", "akal-dipersoalkan", "Posita menyebut gangguan akal."));
    if (ada(p, /tanah|rumah|sawah|bangunan/i)) hasil.push(s("jenisObjek", "tanah-bangunan", "Posita menyebut tanah atau bangunan."));
    if (ada(p, /mobil|motor|kendaraan|BPKB/i)) hasil.push(s("jenisObjek", "kendaraan", "Posita menyebut kendaraan."));
    if (ada(p, /tabungan|deposito|uang\s/i)) hasil.push(s("jenisObjek", "uang-tabungan", "Posita menyebut uang atau tabungan."));
    if (ada(p, /menelantarkan|mengabaikan|tidak\s+(?:merawat|mengurus)/i)) hasil.push(s("sebabTarik", "menelantarkan-penghibah", "Posita menyebut penelantaran."));
    if (ada(p, /(?:menjual|menggadaikan|menjaminkan)[^.;]{0,60}(?:objek|tanah|rumah|benda|hibah)/i)) hasil.push(s("sebabTarik", "menjual-atau-menjaminkan-objek", "Posita menyebut penjualan atau penjaminan benda hibah."));
    if (ada(p, /tidak\s+sesuai\s+(?:dengan\s+)?(?:tujuan|maksud)/i)) hasil.push(s("sebabTarik", "tidak-sesuai-tujuan", "Posita menyebut pemakaian tidak sesuai tujuan hibah."));
    if (ada(p, /dipaksa|ditekan|diancam|paksaan/i)) hasil.push(s("dalilCacat", "ada-paksaan", "Posita menyebut paksaan."));
    if (ada(p, /(?:tanda\s+tangan|cap\s+jempol)[^.;]{0,60}(?:palsu|dipalsukan|bukan)|dipalsukan/i)) hasil.push(s("dalilCacat", "tanda-tangan-dipalsukan", "Posita menyebut pemalsuan."));
    if (ada(p, /bukan\s+(?:hak|milik)\s+penghibah|harta\s+bersama|milik\s+orang\s+lain/i)) hasil.push(s("dalilCacat", "objek-bukan-hak", "Posita menyebut benda bukan milik penghibah."));
    if (ada(p, /tanpa\s+(?:dua\s+orang\s+)?saksi/i)) hasil.push(s("dalilCacat", "tanpa-saksi", "Posita menyebut hibah tanpa saksi."));
    if (ada(p, /tetap\s+(?:dikuasai|menguasai)[^.;]{0,50}(?:penghibah|sampai\s+meninggal)|belum\s+diserahkan/i)) hasil.push(s("dalilCacat", "belum-diserahkan", "Posita menyebut benda belum diserahkan."));
    if (ada(p, /titipan|pinjam|pura-pura|bukan\s+hibah/i)) hasil.push(s("dalilCacat", "hibah-pura-pura", "Posita menyebut pemberian itu bukan hibah."));
    if (ada(p, /tanpa\s+persetujuan[^.;]{0,60}ahli\s+waris|ahli\s+waris[^.;]{0,60}(?:tidak\s+menyetujui|menolak)/i)) hasil.push(s("persetujuan", "ada-yang-menolak", "Posita menyebut ahli waris tidak menyetujui."));
    petitumKe("tuntutanTambahan", { "ganti-rugi": "ganti-rugi", "sita-jaminan": "sita-jaminan", pengosongan: "pengosongan", "uang-paksa": "uang-paksa" });
  } else if (jenis === "wakaf") {
    if (ada(p, /akta\s+ikrar\s+wakaf|PPAIW/i)) hasil.push(s("bentukIkrar", "akta-ikrar-wakaf", "Posita menyebut akta ikrar wakaf atau PPAIW."));
    else if (ada(p, /surat\s+(?:ikrar\s+)?wakaf|ikrar\s+wakaf\s+tertulis/i)) hasil.push(s("bentukIkrar", "tertulis", "Posita menyebut surat ikrar wakaf."));
    else if (ada(p, /ikrar\s+wakaf[^.;]{0,40}(?:secara\s+)?lisan|(?:berikrar|mengikrarkan)[^.;]{0,60}secara\s+lisan/i)) hasil.push(s("bentukIkrar", "lisan", "Posita menyebut ikrar lisan."));
    if (ada(p, /(?:wakif|alm\.?|almarhum)[^.;]{0,60}meninggal|meninggal\s+dunia[^.;]{0,60}(?:wakif|ahli\s+waris)/i)) hasil.push(s("statusWakif", "sudah-meninggal", "Posita menyebut wakif sudah meninggal."));
    if (ada(p, /pikun|tidak\s+sadar|gangguan\s+jiwa/i)) hasil.push(s("kondisiWakif", "akal-dipersoalkan", "Posita menyebut gangguan akal."));
    if (ada(p, /tanah|bangunan|sawah|kebun/i)) hasil.push(s("jenisHarta", "tanah-bangunan", "Posita menyebut tanah atau bangunan."));
    if (ada(p, /uang\s+wakaf|wakaf\s+uang/i)) hasil.push(s("jenisHarta", "uang", "Posita menyebut wakaf uang."));
    if (ada(p, /(?:nazhir|nadzir)[^.;]{0,80}(?:tidak\s+(?:terdaftar|didaftar)|belum\s+(?:terdaftar|didaftar))|(?:tidak|belum)\s+(?:terdaftar|didaftar)[^.;]{0,60}(?:nazhir|nadzir)/i)) hasil.push(s("keadaanNazhir", "belum-terdaftar", "Posita menyebut nazhir tidak terdaftar."));
    if (ada(p, /(?:nazhir|nadzir)[^.;]{0,100}(?:lalai|menyalahgunakan|tidak\s+beres|ketidakberesan|kejanggalan)/i)) hasil.push(s("keadaanNazhir", "tidak-amanah", "Posita menyebut kelalaian atau ketidakberesan pengelolaan nazhir."));
    if (ada(p, /(?:nazhir|nadzir)[^.;]{0,60}meninggal/i)) hasil.push(s("keadaanNazhir", "sudah-meninggal", "Posita menyebut nazhir meninggal."));
    if (ada(p, /belum\s+(?:terdaftar|didaftar|bersertipikat|disertipikatkan)|tidak\s+(?:terdaftar|didaftar)\s+(?:sebagai\s+)?(?:wakaf|harta)/i)) hasil.push(s("pendaftaranWakaf", "belum-terdaftar", "Posita menyebut harta wakaf belum terdaftar."));
    if (ada(p, /tanpa\s+akta|di\s*bawah\s+tangan|bukan\s+akta\s+otentik|tidak\s+memiliki\s+nomor|tidak\s+mencantumkan\s+nomor/i)) hasil.push(s("dalilBatal", "ikrar-tanpa-akta", "Posita menyebut ikrar tanpa akta bernomor atau di bawah tangan."));
    if (ada(p, /tanpa\s+(?:dua\s+orang\s+)?saksi/i)) hasil.push(s("dalilBatal", "tanpa-saksi", "Posita menyebut ikrar tanpa saksi."));
    if (ada(p, /bukan\s+milik\s+wakif|harta\s+bersama|milik\s+orang\s+lain/i)) hasil.push(s("dalilBatal", "bukan-milik-wakif", "Posita menyebut harta bukan milik wakif."));
    if (ada(p, /(?:tanda\s+tangan|cap\s+jempol)[^.;]{0,60}(?:palsu|dipalsukan|bukan)|dipalsukan/i)) hasil.push(s("dalilBatal", "tanda-tangan-dipalsukan", "Posita menyebut pemalsuan."));
    if (ada(p, /(?:dijual|dihibahkan|diwariskan|ditukar)[^.;]{0,50}(?:objek|tanah|harta|wakaf)|(?:menjual|menghibahkan)[^.;]{0,50}(?:objek|tanah|harta)\s+wakaf/i)) hasil.push(s("bentukPengalihan", "dijual-dihibahkan", "Posita menyebut penjualan atau pengalihan harta wakaf."));
    if (ada(p, /dijaminkan|digadaikan|agunan/i)) hasil.push(s("bentukPengalihan", "dijaminkan", "Posita menyebut penjaminan harta wakaf."));
    if (ada(p, /ganti\s+rugi[^.;]{0,80}(?:pemerintah|pembebasan|pengadaan\s+tanah)|(?:pemerintah|pembebasan)[^.;]{0,80}ganti\s+rugi/i)) hasil.push(s("bentukPengalihan", "ganti-rugi-pemerintah", "Posita menyebut ganti rugi oleh pemerintah."));
    petitumKe("tuntutanTambahan", { "ganti-rugi": "ganti-rugi", "sita-jaminan": "sita-jaminan", pengosongan: "pengosongan", "uang-paksa": "uang-paksa" });
  }
  // satu saran per pasangan kunci-nilai
  const sudah = new Set();
  return hasil.filter((x) => {
    const k = `${x.kunci}=${x.nilai}`;
    if (sudah.has(k)) return false;
    sudah.add(k);
    return true;
  });
}

/** Kode variabel ABT -> kunci fakta (isian blangko yang diketik petugas ikut menjadi fakta bagi jawaban saksi). */
const KODE_FAKTA = Object.freeze({
  9793: "penghibah",
  9794: "bentukHibah",
  9795: "objekHibah",
  9796: "penerimaHibah",
  9823: "wakif",
  9824: "nazhir",
  9825: "bentukIkrar",
  9826: "hartaWakaf",
  9827: "peruntukanWakaf",
  9841: "penguasaWakaf",
  9478: "bentukWasiat",
  9479: "objekWasiat",
  9480: "penerimaWasiat",
  9340: "akad",
  9341: "jumlahUtang",
  4765: "rincianPembiayaan",
  4766: "angsuranJatuhTempo",
  4767: "suratPeringatan",
  4768: "agunan",
});

const LABEL_FAKTA = Object.freeze({
  penghibah: "penghibah",
  bentukHibah: "bentuk dan tanggal hibah",
  objekHibah: "benda yang dihibahkan",
  penerimaHibah: "penerima hibah",
  wakif: "wakif",
  nazhir: "nazhir",
  bentukIkrar: "bentuk dan tanggal ikrar wakaf",
  hartaWakaf: "harta benda wakaf",
  peruntukanWakaf: "peruntukan wakaf",
  penguasaWakaf: "pihak yang menguasai harta wakaf",
  bentukWasiat: "bentuk dan tanggal wasiat",
  objekWasiat: "benda yang diwasiatkan",
  penerimaWasiat: "penerima wasiat",
  akad: "akad yang disengketakan",
  jumlahUtang: "jumlah kewajiban",
  rincianPembiayaan: "rincian pembiayaan",
  angsuranJatuhTempo: "angsuran dan jatuh tempo",
  suratPeringatan: "surat peringatan",
  agunan: "agunan",
});

/** Fakta tambahan dari posita menurut jenis kode ("wasiat"|"hibah"|"wakaf"|"eksyar"); [] untuk jenis lain. */
function tambahanDariPosita(butir, jenis) {
  try {
    if (jenis === "wasiat") return wasiat(butir);
    if (jenis === "hibah") return hibah(butir);
    if (jenis === "wakaf") return wakaf(butir);
    if (jenis === "eksyar") return eksyar(butir);
  } catch (_galat) {
    /* tidak pernah menggagalkan penyusunan */
  }
  return [];
}

module.exports = { wasiat, hibah, wakaf, eksyar, saranKeadaan, tambahanDariPosita, KODE_FAKTA, LABEL_FAKTA, daftarSesudah };
