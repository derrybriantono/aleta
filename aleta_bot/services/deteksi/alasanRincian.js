"use strict";

/**
 * ============================================================================
 * RINCIAN ALASAN CERAI (5227) - SEBAB KONKRET DAN RANTAI SEBAB-AKIBAT, 27 Okt 2026
 * ============================================================================
 *
 * Keputusan pengguna:
 *   1. GUGATAN/permohonan = ACUAN UTAMA: hanya alasan yang ada di sana yang diusulkan.
 *   2. Keterangan saksi Penggugat DAN Tergugat = PENGUAT (lencana "dikuatkan saksi" + siapa);
 *      yang disebut saksi tetapi tidak didalilkan TIDAK diusulkan (hanya dicatat).
 *   3. Jawab-menjawab (jawaban/replik/duplik) = MINOR: hanya keterangan "diakui/dibantah";
 *      tidak pernah memunculkan alasan baru.
 *   4. Bunyi keluaran menyebut SEBAB KONKRET beserta rantai sebab-akibatnya seperti di gugatan
 *      ("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat").
 *      "Perselisihan terus-menerus" hanya penutup bila memang didalilkan - tidak pernah
 *      menggantikan sebab konkret.
 *   5. (28 Okt) Antar-alasan disambung "dan" ("A dan B", "A, B, dan C") - tanpa ";" dan tanpa "serta".
 *      Akibat UMUM ("sehingga ... terus-menerus terjadi perselisihan dan pertengkaran") TIDAK ditempelkan
 *      ke alasan konkret (hanya pilihan bunyi); rantai sebab-akibat konkret tetap. Rincian perbuatan di
 *      gugatan ("yaitu jenis sabu-sabu", "dengan cara memukul") ikut di bunyi bawaan.
 *   6. (28 Okt, kasus 627/Pdt.G/2026) Sebab konkret yang belum dikenal kamus tidak boleh jatuh ke "perselisihan" umum:
 *      klausa sebab eksplisit ("... pertengkaran yang disebabkan karena X") dikutip sebagai butir (keyakinan ragu) -
 *      lihat kutipSebab. Penyambung sebab-akibat tidak melewati batas kalimat.
 *
 * Pola & bunyi = DATA (kamus-deteksi/awal/alasan-rincian.json + lapis database; ruas tambahan
 * `bunyi`, `peran`, `subjek`, `untuk`, `urut`, `tanpaSubjek`, `kutip`, `hanyaAkibat`). Berkas ini
 * hanya mesinnya. Murni: tidak menulis, tidak membaca basis data, tanpa kueri tambahan.
 *
 * Kinerja: pola diolah SEKALI per (versi lapis kamus, jenis cerai) dan disimpan; satu kalimat
 * diperiksa hanya bila lolos saringan kata kunci gabungan.
 */

const kamus = require("../kamusDeteksi");
const sebab = require("./sebabCerai");

const KELOMPOK = "alasan-rincian";
const BATAS_KALIMAT = 600; // potongan teks per kalimat yang dipindai (hindari regex pada teks raksasa)
const BATAS_KUTIPAN = 140;

// Penghubung antar simpul dalam satu kalimat.
const RE_AKIBAT = /\b(?:sehingga|hingga|higga|hinga|sehinga|akibatnya|sampai[\s-]*sampai|yang\s+(?:me)?nyebabkan|yang\s+mengakibatkan|yang\s+berakibat|menyebabkan|mengakibatkan|berujung|mengakibatkan|maka\s+dari\s+itu)\b/i;
const RE_KONDISI = /\b(?:bila|jika|apabila|kalau|ketika|saat)\b/i;
const RE_SEBAB = /\b(?:karena|dikarenakan|disebabkan|lantaran|akibat\s+dari)\b/i;
// Akhir klausa akibat yang dikutip dari gugatan.
const RE_AKHIR_KLAUSA = /[;.]|,\s+(?:dan|serta|sedangkan|namun|bahkan|selain|tetapi|sementara)\b|\s+dan\s+(?:tergugat|termohon|penggugat|pemohon|keluarga)\b|,\s+(?:tergugat|termohon)\b/i;
// Akibat yang bukan sebab konkret (kesimpulan).
const RE_BUKAN_SEBAB = /\b(?:bercerai|perceraian|gugatan|permohonan|pengadilan|dipertahankan|tidak\s+(?:dapat|bisa|mungkin)\s+(?:lagi\s+)?(?:rukun|bersatu|hidup)|rumah\s+tangga\s+(?:tidak|sudah|telah)|petitum)\b/i;
// Kutipan norma (Pasal 19 PP 9/1975 / Pasal 116 KHI) di gugatan bukan dalil perbuatan pihak: "salah satu pihak berbuat zina
// atau menjadi pemabuk, pemadat, penjudi ..." tidak boleh menyalakan zina/mabuk/narkoba/judi.
const RE_NORMA = /salah\s+satu\s+pihak\s+(?:berbuat|melakukan|mendapat|meninggalkan|menjadi)|menjadi\s+pemabuk,\s*pemadat/i;
const RE_BANTAH = /\b(?:tidak\s+benar|tidak\s+(?:sesuai|betul)|membantah|bantah|menyangkal|menolak\s+(?:dalil|dengan\s+tegas)|bohong|fitnah|mengada[\s-]*ada|dalil\s+(?:yang\s+)?(?:tidak|keliru))\b/i;
// 28 Okt: penanda rincian perbuatan di gugatan ("... obat-obatan terlarang yaitu jenis sabu-sabu").
const RE_PENANDA_RINCI = /\b(?:yaitu|yakni|berupa|seperti|jenis|bernama|dengan\s+cara|antara\s+lain|misalnya|di\s*antaranya|khususnya|terutama)\b/i;
// Ujung klausa perbuatan: penghubung sebab-akibat/syarat, keterangan waktu, tanda baca.
const RE_UJUNG_PERBUATAN = /\b(?:sehingga|hingga|akibatnya|karena|dikarenakan|disebabkan|lantaran|bila|jika|apabila|kalau|ketika|saat|sejak|semenjak|selama|pada\s+(?:tahun|bulan|tanggal|hari|saat|waktu)|tahun\s+\d|kurang\s+lebih|sekitar|setiap|tiap|bahkan|namun|tetapi|padahal|sedangkan|yang\s+(?:me)?nyebabkan|yang\s+mengakibatkan|yang\s+berakibat|menyebabkan|mengakibatkan|maka|sampai)\b|[;.:,]/i;
// Akibat UMUM yang tidak dikutip sebagai akibat konkret (perselisihan/pertengkaran = penutup, bukan sebab).
const RE_AKIBAT_UMUM = /\b(?:perselisihan|pertengkaran|percekcokan|cekcok|bertengkar|berselisih|keributan|ribut|tidak\s+(?:harmonis|rukun)|keharmonisan|ketidakharmonisan)\b/i;
const RE_AKUI = /\b(?:membenarkan|mengakui|diakui|benar\s+(?:bahwa|adanya)|memang|betul|tidak\s+membantah)\b/i;

// Sebutan pihak tepat di depan perbuatan (bukan objek "kepada/oleh/antara ..."), tanpa penghubung di antaranya.
const RE_SUBJEK_DEKAT = /(?<!\b(?:kepada|terhadap|oleh|dengan|antara|dan|serta|keluarga|tua)\s+)\b(tergugat|termohon|penggugat|pemohon)((?:\s+(?!(?:dan|serta|yang|karena|sehingga|bahwa|kepada|terhadap|oleh)\b)[\w-]+){0,2})\s+$/i;

let cache = { versi: -1, jenis: {} };

/** Pola aktif untuk satu jenis cerai, siap pakai (RegExp global + saringan gabungan). Dibangun sekali per versi lapis. */
function polaUntuk(jenis) {
  const v = kamus.versi();
  if (cache.versi !== v) cache = { versi: v, jenis: {} };
  if (cache.jenis[jenis]) return cache.jenis[jenis];
  const daftar = kamus
    .polaKelompok(KELOMPOK)
    .filter((p) => (p.status || "aktif") === "aktif" && Array.isArray(p.bunyi) && p.bunyi.length && (!p.untuk || p.untuk === "semua" || p.untuk === jenis))
    .map((p) => ({
      ...p,
      reG: new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`),
      // Penolak konteks (ruas tambahan `tolakSebelum` / `tolakSesudah`): dikompilasi sekali di sini.
      reTolakSebelum: p.tolakSebelum ? new RegExp(String(p.tolakSebelum), "i") : null,
      reTolakSesudah: p.tolakSesudah ? new RegExp(String(p.tolakSesudah), "i") : null,
      // Ruas tambahan `rinci` {re, awalan}: nama/jenis perbuatan yang dibuang bunyi baku ("sabu-sabu", "togel").
      reRinci: p.rinci && p.rinci.re ? new RegExp(String(p.rinci.re), "i") : null,
      // 28 Okt: `rinci.sekitar` = rincian boleh dicari juga DI DEPAN perbuatan (keadaan pihak lain: "Kondisi Penggugat
      // yang mengidap penyakit stroke membuat Tergugat tidak bisa menerima keadaan Penggugat").
      rinciSekitar: Boolean(p.rinci && p.rinci.sekitar),
    }))
    .sort((a, b) => (a.urut || 0) - (b.urut || 0));
  // Saringan gabungan: satu RegExp "gabungan semua pola" - kalimat yang tidak lolos dilewati sekaligus.
  let gabungan = null;
  try {
    gabungan = daftar.length ? new RegExp(daftar.map((p) => `(?:${p.re.source})`).join("|"), "i") : null;
  } catch (_) {
    gabungan = null;
  }
  // Saringan bergrup: tiap pola satu grup tangkap; pencocokan tahu POLA mana yang kena dalam satu lintasan
  // (dipakai mendata sebab yang disebut saksi tetapi tidak didalilkan, tanpa memindai pola satu per satu).
  const offset = [];
  let gabunganG = null;
  try {
    let n = 0;
    const bagian = daftar.map((p) => {
      offset.push(n + 1);
      n += 1 + (new RegExp(`${p.re.source}|`).exec("").length - 1);
      return `(${p.re.source})`;
    });
    gabunganG = bagian.length ? new RegExp(bagian.join("|"), "gi") : null;
  } catch (_) {
    gabunganG = null;
  }
  const perKunci = new Map();
  for (const p of daftar) {
    if (!perKunci.has(p.kunci)) perKunci.set(p.kunci, []);
    perKunci.get(p.kunci).push(p);
  }
  const hasil = { daftar, gabungan, gabunganG, offset, perKunci };
  cache.jenis[jenis] = hasil;
  return hasil;
}

function pihakDari(pihak) {
  return {
    pelaku: String((pihak && pihak.pelaku) || "").trim() || "Tergugat",
    lawan: String((pihak && pihak.lawan) || "").trim() || "Penggugat",
  };
}

function isiBunyi(teks, ph, jenis) {
  return String(teks || "")
    .split("{pelaku}")
    .join(ph.pelaku)
    .split("{lawan}")
    .join(ph.lawan)
    .split("{lain}")
    .join(jenis === "CT" ? "laki-laki lain" : "perempuan lain");
}

/**
 * Simpul (kemunculan sebab/akibat) dalam satu kalimat. Satu simpul per kunci - kemunculan paling awal;
 * bila sama, varian berurut terkecil (paling rinci).
 * @returns {Array<{kunci, pola, idx, akhir, subjek, kata, tersirat}>}
 */
function simpulKalimat(kalimatAsli, set, opsi) {
  const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ").slice(0, BATAS_KALIMAT);
  if (!kalimat || !set.gabungan) return [];
  if (!(opsi && opsi.kunci) && !set.gabungan.test(kalimat)) return [];
  if (RE_NORMA.test(kalimat)) return [];
  const longgarNegasi = Boolean(opsi && opsi.longgarNegasi);
  // 31 Okt (sisa 79): keterangan dalam kurung ("Orang Tua Tergugat (ibu mertua Penggugat) selalu ikut campur", "Keluarga Tergugat
  // (Orangtua dan Saudara Tergugat) ketimbang Penggugat ... hingga kurang memberikan nafkah") tidak ikut menentukan subjek.
  // Panjang teks tetap (diganti spasi) sehingga letak kecocokan tidak bergeser.
  // Hanya keterangan orang (pihak/keluarga) yang dibuang; "(enam) tahun", "(memukul)", "(Tergugat)" tetap.
  const kalimatSubjek = kalimat.replace(
    /\((?=[^()]*\b(?:penggugat|tergugat|pemohon|termohon|orang\s*tua|orangtua|ibu|ayah|bapak|saudara|mertua|keluarga|kakak|adik)\b)(?!\s*(?:penggugat|tergugat|pemohon|termohon)\s*\))[^()]{1,80}\)/gi,
    (x) => " ".repeat(x.length)
  );
  const terbaik = new Map();
  const sumberPola = opsi && opsi.kunci ? [...opsi.kunci].flatMap((k) => set.perKunci.get(k) || []) : set.daftar;
  for (const p of sumberPola) {
    const re = p.reG;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(kalimat)) !== null) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const depan = kalimat.slice(Math.max(0, m.index - 40), m.index);
      const ternegasi = p.negasi !== false && sebab.RE_PENYANGKAL.test(depan);
      if (ternegasi && !longgarNegasi) continue;
      if (p.reTolakSebelum && p.reTolakSebelum.test(depan)) continue;
      if (p.reTolakSesudah && p.reTolakSesudah.test(kalimat.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
      // 28 Okt: ruas `subjekDekat` - sebutan pihak TEPAT di depan perbuatan (paling banyak dua kata) menang atas subjek
      // klausa ("Kondisi Penggugat yang sakit membuat Tergugat tidak bisa menerima ..." -> Tergugat).
      const dekat = p.subjekDekat ? RE_SUBJEK_DEKAT.exec(depan) : null;
      let sub = dekat ? { s: /^(?:tergugat|termohon)$/i.test(dekat[1]) ? "P" : "" } : sebab.terimaSubjek(p, kalimatSubjek, m.index);
      let tersirat = false;
      if (!sub.s) {
        // Tanpa pelaku yang terbaca sama sekali ("Sering mabuk-mabukan dan memukul Penggugat") dibaca
        // sebagai perbuatan pelaku, bertanda tersirat (keyakinan ragu).
        const jenisSubjek = String(p.subjek || "pelaku");
        if (jenisSubjek === "pelaku" || jenisSubjek === "pelaku/keluarga") {
          if (!sebab.subjekKlausa(kalimatSubjek, m.index).s) {
            sub = { s: "P" };
            tersirat = true;
          }
        }
      }
      if (!sub.s) continue;
      const lama = terbaik.get(p.kunci);
      if (!lama || m.index < lama.idx || (m.index === lama.idx && (p.urut || 0) < (lama.pola.urut || 0))) {
        terbaik.set(p.kunci, { kunci: p.kunci, pola: p, teks: m[0], idx: m.index, akhir: m.index + m[0].length, subjek: sub.s, kata: sub.kata || "", tersirat, ternegasi });
      }
      break; // kemunculan pertama yang diterima cukup untuk pola ini
    }
  }
  return [...terbaik.values()].sort((a, b) => a.idx - b.idx);
}

function subjekTeks(simpul, ph) {
  const p = simpul.pola;
  if (p.tanpaSubjek || simpul.subjek === "B") return "";
  if (simpul.subjek === "K") return `${simpul.kata || "keluarga"} ${ph.pelaku}`;
  if (simpul.subjek === "PK") return `${ph.pelaku} dan keluarganya`;
  return ph.pelaku;
}

function bersihkanKutipan(teks) {
  let t = String(teks || "").replace(/^[\s,:;-]+/, "").replace(/^(?:bahwa|yaitu|yakni)\s+/i, "").replace(/[\s,;:.]+$/, "").trim();
  t = t.split(RE_AKHIR_KLAUSA)[0].replace(/[\s,;:.]+$/, "").trim();
  return t;
}

/** Klausa akibat yang dikutip: teks sesudah penghubung sampai akhir klausa. */
const RE_KUTIPAN_WAKTU = /^(?:sekarang|saat\s+(?:ini|itu)|sejak|kini|pada|hingga|sampai|namun|tetapi|dan|serta|yang|di|ke|dengan|oleh|hal|akhirnya)\b/i;
const RE_KUTIPAN_PUTUS = /\b(?:namun|tetapi|akan\s+tetapi|padahal)\b/i;
const RE_PIHAK = /\b(penggugat|tergugat|pemohon|termohon)\b/gi;
function kutipanSesudah(kalimat, dari) {
  let t = bersihkanKutipan(kalimat.slice(dari, dari + BATAS_KUTIPAN + 60));
  t = t.split(RE_KUTIPAN_PUTUS)[0].replace(/[\s,;:.]+$/, "").trim();
  if (t.length < 12 || t.length > BATAS_KUTIPAN) return "";
  if (RE_BUKAN_SEBAB.test(t) || RE_KUTIPAN_WAKTU.test(t) || RE_AKIBAT_UMUM.test(t)) return "";
  if (!/^[a-z]/i.test(t) || t.split(/\s+/).length < 3) return "";
  // Sebutan pihak ditulis baku (Penggugat/Tergugat/Pemohon/Termohon).
  return t.replace(RE_PIHAK, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase());
}

/** Penghubung antara dua simpul bersebelahan: {jenis: "akibat"|"kondisi"|"sebab", dari, sampai} atau null. */
function hubungan(kalimat, a, b) {
  const antara = kalimat.slice(a.akhir, b.idx);
  if (antara.length > 160) return null;
  // 28 Okt: tidak menyambung melewati batas kalimat ("... tujuan Tergugat. Dan ... sehingga ... pisah rumah").
  if (/\.\s+[A-Z]/.test(antara)) return null;
  let m = RE_AKIBAT.exec(antara);
  if (m) return { jenis: "akibat", sampai: a.akhir + m.index + m[0].length };
  // 31 Okt (sisa 79): "Tergugat kurang memberi nafkah DAN UNTUK MEMENUHI kebutuhan sehari-hari dibantu orang tua Penggugat" -
  // akibat (peran akibat) yang disambung "dan untuk memenuhi" = akibat dari perbuatan sebelumnya.
  if ((b.pola.peran || "sebab") === "akibat" && (m = /^([\s,]*(?:dan|serta)\s+)(?:untuk|guna)\s+(?=memenuhi|mencukupi)/i.exec(antara))) {
    return { jenis: "akibat", sampai: a.akhir + m.index + m[1].length };
  }
  m = RE_SEBAB.exec(antara);
  if (m) return { jenis: "sebab", sampai: a.akhir + m.index + m[0].length };
  m = RE_KONDISI.exec(antara);
  // "bila mabuk memukul": akibat harus perbuatan berpelaku (bukan keadaan/penutup), antaranya pendek.
  if (m && !/[;.]/.test(antara) && antara.length <= 60 && (b.pola.peran || "sebab") === "sebab" && !b.pola.tanpaSubjek && !b.pola.hanyaAkibat) {
    return { jenis: "kondisi", sampai: a.akhir + m.index + m[0].length };
  }
  return null;
}

/** Penghubung akibat sesudah simpul `a` yang tidak diikuti simpul lain (akibat bebas, dikutip). */
function akibatBebas(kalimat, a, berikut) {
  const batas = berikut ? berikut.idx : kalimat.length;
  const antara = kalimat.slice(a.akhir, batas).split(/\.\s+(?=[A-Z])/)[0];
  const m = RE_AKIBAT.exec(antara);
  if (!m) return null;
  const mulai = a.akhir + m.index + m[0].length;
  const teks = kutipanSesudah(kalimat, mulai);
  return teks ? { teks } : null;
}

const RE_EKOR_SAMBUNG = /(?:[\s,;:.]+|\s+(?:dan|serta|yang|juga|pun|pula|lagi))+$/i;
const rapikanEkor = (t) => {
  let x = String(t || "").trim();
  for (let n = 0; n < 4; n++) {
    const y = x.replace(RE_EKOR_SAMBUNG, "").trim();
    if (y === x) break;
    x = y;
  }
  return x;
};
const bakuPihak = (t) => String(t || "").replace(RE_PIHAK, (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase());

/**
 * 28 Okt: rincian perbuatan satu simpul dari kalimat gugatan - {predikat, detail} atau null.
 *   detail   = "yaitu jenis sabu-sabu" (sesudah penanda rincian) atau "<awalan> <nama>" dari ruas `rinci` pola
 *              (nama yang tidak ada di bunyi baku, mis. "sabu-sabu" untuk "mengonsumsi obat-obatan terlarang").
 *   predikat = kutipan perbuatan dari gugatan sesudah sebutan pelaku sampai ujung klausa (hanya bila sebutan
 *              pelaku tepat di depan perbuatannya); bunyi bawaan = "{pelaku} <predikat>".
 * Null bila gugatan tidak memuat rincian apa pun - bunyi baku dipakai seperti biasa.
 */
function rinciPerbuatan(kalimat, s, batas) {
  const p = s.pola;
  if ((p.peran || "sebab") !== "sebab") return null;
  const ekor = kalimat.slice(s.akhir, Math.min(batas, s.akhir + 160));
  const u = RE_UJUNG_PERBUATAN.exec(ekor);
  const ujung = s.akhir + (u ? u.index : ekor.length);
  const sisa = kalimat.slice(s.akhir, ujung);
  const baku = String(p.bunyi[0] || "").toLowerCase();
  let detail = "";
  const m = RE_PENANDA_RINCI.exec(sisa);
  if (m && m.index <= 50) {
    const d = rapikanEkor(sisa.slice(m.index));
    if (d.split(/\s+/).length >= 2 && d.length <= 90 && !baku.includes(d.toLowerCase())) detail = d;
  }
  let luar = false;
  if (!detail && p.reRinci) {
    let r = p.reRinci.exec(kalimat.slice(s.idx, ujung));
    if (!r && p.rinciSekitar) {
      // Di depan perbuatan, dalam klausa yang sama (tidak melewati ";" atau ".").
      const depan = kalimat.slice(Math.max(0, s.idx - 160), s.idx).split(/[;.]/).pop();
      r = p.reRinci.exec(depan);
      luar = Boolean(r);
    }
    if (r && !baku.includes(r[0].toLowerCase())) detail = `${String((p.rinci && p.rinci.awalan) || "").trim()} ${r[0].toLowerCase()}`.trim();
  }
  if (!detail) return null;
  // Kutipan perbuatan: sebutan pelaku + paling banyak lima kata sebelum perbuatannya, tanpa penghubung di antaranya.
  let predikat = "";
  if (s.subjek === "P" && !s.tersirat && !p.tanpaSubjek) {
    const depan = kalimat.slice(Math.max(0, s.idx - 60), s.idx);
    const k = /\b(tergugat|termohon)\b((?:\s+[\w-]+){0,5})\s*$/i.exec(depan);
    const sebelum = k ? depan.slice(0, k.index) : "";
    if (
      k &&
      !/\b(?:dan|serta|bila|jika|apabila|karena|sehingga|yang|kepada|terhadap|oleh|dengan|bahwa)\b/i.test(k[2]) &&
      !/\b(?:kepada|terhadap|oleh|dengan|dan|antara|keluarga|orang\s*tua)\s*$/i.test(sebelum)
    ) {
      const t = bakuPihak(rapikanEkor(`${k[2]} ${kalimat.slice(s.idx, ujung)}`.replace(/\s+/g, " ").replace(/^\s*(?:juga|pun|pula)\b/i, "")));
      if (t.length >= 3 && t.length <= 150 && t.split(/\s+/).length <= 22) predikat = t;
    }
  }
  return { predikat, detail, luar };
}

function klausa(simpul, ph, jenis, varian, kutipan, tanpaRinci) {
  const p = simpul.pola;
  if (kutipan) return kutipan;
  const bunyi = p.bunyi[Math.min(varian, p.bunyi.length - 1)];
  const sub = subjekTeks(simpul, ph);
  const pakaiRinci = varian === 0 && !tanpaRinci && simpul.rinci;
  // 28 Okt: bunyi bertempat "{rinci}" - rincian gugatan disisipkan di tengah bunyi baku (atau dibuang bila tidak ada).
  if (String(bunyi).includes("{rinci}")) {
    const isiR = isiBunyi(String(bunyi).split("{rinci}").join(pakaiRinci ? ` ${simpul.rinci.detail}` : ""), ph, jenis).replace(/\s+/g, " ").trim();
    return sub ? `${sub} ${isiR}` : isiR;
  }
  const isi = isiBunyi(bunyi, ph, jenis);
  // 28 Okt: bunyi bawaan memuat rincian perbuatan dari gugatan (kutipan perbuatan, atau bunyi baku + rinciannya).
  if (pakaiRinci) {
    // Rincian di depan perbuatan (keadaan pihak lain) tidak termuat di kutipan perbuatan - ditempel di belakangnya.
    if (simpul.rinci.predikat && sub === ph.pelaku) return simpul.rinci.luar ? `${sub} ${simpul.rinci.predikat} ${simpul.rinci.detail}` : `${sub} ${simpul.rinci.predikat}`;
    return sub ? `${sub} ${isi} ${simpul.rinci.detail}` : `${isi} ${simpul.rinci.detail}`;
  }
  return sub ? `${sub} ${isi}` : isi;
}

/**
 * Item rincian dari satu kalimat gugatan: simpul-simpul yang berkait menjadi RANTAI, sisanya TUNGGAL.
 * @returns {Array<{jenis, simpul: object[], hubungan: string[], kutipan: string[], kalimat: string}>}
 */
function itemKalimat(kalimatAsli, set) {
  const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ").slice(0, BATAS_KALIMAT);
  const simpul = simpulKalimat(kalimat, set);
  if (!simpul.length) return [];
  simpul.forEach((s, i) => {
    s.rinci = rinciPerbuatan(kalimat, s, simpul[i + 1] ? simpul[i + 1].idx : kalimat.length);
  });
  // Sambungan sebab -> akibat antar simpul berurutan; orientasi dinormalkan (cause -> effect).
  const berikut = new Map(); // idx simpul sebab -> {ke, jenis}
  const punyaMasuk = new Set();
  for (let i = 0; i + 1 < simpul.length; i++) {
    const h = hubungan(kalimat, simpul[i], simpul[i + 1]);
    if (!h) continue;
    const [sebabIdx, akibatIdx] = h.jenis === "sebab" ? [i + 1, i] : [i, i + 1];
    // 31 Okt (sisa 79): "... pertengkaran yang disebabkan karena Tergugat tidak memberi nafkah HINGGA kebutuhan dibantu orang tua
    // Penggugat" - sambungan ke penutup umum (pertengkaran) diganti akibat konkret sesudahnya; penutup tetap dilepas seperti biasa.
    if (berikut.has(sebabIdx) && !punyaMasuk.has(akibatIdx)) {
      const lama = berikut.get(sebabIdx);
      const peranLama = simpul[lama.ke].pola.peran || "sebab";
      const peranBaru = simpul[akibatIdx].pola.peran || "sebab";
      if (peranLama === "penutup" && peranBaru !== "penutup" && !simpul[akibatIdx].pola.hanyaAkibat && !(lama.tambahan || []).length) {
        berikut.delete(sebabIdx);
        punyaMasuk.delete(lama.ke);
      }
    }
    if (berikut.has(sebabIdx) || punyaMasuk.has(akibatIdx)) continue;
    // "hanyaAkibat"/"penutup" tidak boleh menjadi sebab.
    const peranSebab = simpul[sebabIdx].pola.peran || "sebab";
    if (peranSebab !== "sebab") continue;
    // Kutipan akibat hanya bermakna bila akibatnya MENYUSUL penghubung (arah maju).
    const tambahan = [];
    // "A sehingga B dan C": C juga akibat A (bukan rantai B -> C) bila hanya "dan/serta" yang menyambungnya.
    const c = simpul[akibatIdx + 1];
    if (h.jenis === "akibat" && c && !punyaMasuk.has(akibatIdx + 1) && (c.pola.peran || "sebab") === "sebab" && /^(?:\s+[^\s,;.]+){0,2}[\s,]*(?:dan|serta)\s+(?:juga\s+)?$/i.test(kalimat.slice(simpul[akibatIdx].akhir, c.idx))) {
      tambahan.push(akibatIdx + 1);
      punyaMasuk.add(akibatIdx + 1);
    }
    berikut.set(sebabIdx, { ke: akibatIdx, tambahan, jenis: h.jenis === "sebab" ? "akibat" : h.jenis, sampai: h.jenis === "sebab" ? -1 : h.sampai });
    punyaMasuk.add(akibatIdx);
  }
  const dipakai = new Set();
  const hasil = [];
  for (let i = 0; i < simpul.length; i++) {
    if (punyaMasuk.has(i) || !berikut.has(i)) continue;
    const rantai = [i];
    const hub = [];
    const kutip = [];
    let kini = i;
    while (berikut.has(kini)) {
      const e = berikut.get(kini);
      hub.push(e.jenis);
      const s = simpul[e.ke];
      // Simpul akibat berkutip: klausanya dikutip dari gugatan (lebih tepat daripada bunyi umum).
      kutip.push(s.pola.kutip && e.sampai >= 0 ? kutipanSesudah(kalimat, e.sampai) : "");
      rantai.push(e.ke);
      for (const x of e.tambahan || []) {
        hub.push("dan");
        kutip.push("");
        rantai.push(x);
      }
      kini = e.ke;
    }
    rantai.forEach((x) => dipakai.add(x));
    // Akibat bebas di ujung rantai: "... sehingga uang belanja habis" yang bukan simpul kamus.
    hasil.push({ jenis: "rantai", simpul: rantai.map((x) => simpul[x]), hubungan: hub, kutipan: kutip, kalimat: kalimatAsli });
  }
  for (let i = 0; i < simpul.length; i++) {
    if (dipakai.has(i)) continue;
    const s = simpul[i];
    const peran = s.pola.peran || "sebab";
    if (s.pola.hanyaAkibat || peran === "akibat") continue;
    const bebas = peran === "sebab" ? akibatBebas(kalimat, s, simpul[i + 1] && !dipakai.has(i + 1) ? simpul[i + 1] : null) : null;
    if (bebas) {
      hasil.push({ jenis: "rantai", simpul: [s], hubungan: ["akibat"], kutipan: [bebas.teks], kalimat: kalimatAsli, akibatBebas: true });
    } else {
      hasil.push({ jenis: "tunggal", simpul: [s], hubungan: [], kutipan: [], kalimat: kalimatAsli });
    }
  }
  return hasil;
}

/**
 * 28 Okt: CADANGAN KUTIP. Kalimat gugatan yang menyebut perselisihan berikut klausa sebab eksplisit ("... sering terjadi
 * pertengkaran yang disebabkan karena ...") tetapi isinya tidak dikenali kamus: klausa sebab itu dikutip sebagai butir
 * konkret (keyakinan ragu, petugas memeriksa) - bukan jatuh ke penutup umum. Null bila tidak ada / tidak layak dikutip.
 */
const RE_PENANDA_SEBAB_KUTIP = /\b(?:(?:yang\s+)?(?:di)?sebabkan\s+(?:karena|oleh)(?:\s+karena)?|(?:yang\s+)?(?:di)?sebabkan|dikarenakan(?:\s+oleh)?|dipicu\s+(?:oleh|karena)|penyebab(?:nya)?\s+(?:adalah|yaitu|ialah)(?:\s+karena)?|karena|lantaran)\s+/gi;
const RE_UJUNG_KUTIP = /[;:.]|\s+(?:sehingga|akibatnya|maka|bahkan|hingga\s+(?:akhirnya|puncaknya))\b|\s+(?:namun|tetapi|akan\s+tetapi|padahal)\b(?!\s+(?:\S+\s+)?(?:penggugat|tergugat|pemohon|termohon)\b)|\s+yang\s+(?:me)?(?:nyebabkan|mengakibatkan|berakibat)\b|,?\s+(?:dan|serta)\s+(?:\S+\s+){0,3}?(?:perselisihan|pertengkaran|percekcokan|cekcok|bertengkar|keributan)\b|,\s+(?:dan|serta|oleh\s+karena\s+itu|puncaknya|sejak)\b|\s+(?:dan|serta|lalu|kemudian)\s+(?:akhirnya\s+)?(?:penggugat|pemohon|tergugat|termohon)\s+(?:\S+\s+){0,2}?(?:memutuskan|memilih|pergi|pulang|meninggalkan|keluar|kembali)\b/i;
// "X namun <pihak> Y": Y sering inti keluhannya ("Pemohon memberi nafkah namun Termohon tidak bersyukur") - hanya dipotong bila kepanjangan.
const RE_UJUNG_KUTIP_LUNAK = /\s+(?:namun|tetapi|akan\s+tetapi|padahal)\b/i;
const RE_LAWAN_MENGALAMI = /^\s+(?:(?:sudah|telah|sering|pernah|selalu|juga|tidak|kurang|lagi)\s+)*(?:mengetahui|tahu|mendapati|melihat|menemukan|memergoki|mendapatkan|mendapat|mendengar|curiga|mencurigai|merasa|tahan|menerima|diperlakukan|dipukul|dimarahi|diusir|dituduh|difitnah|diberi|dinafkahi|dihargai|dianggap|diperhatikan|dipedulikan|disakiti|ditinggalkan|diselingkuhi)\b/i;
const RE_KUTIP_TOLAK = /^(?:itu|hal\s+(?:itu|tersebut|ini)|tersebut|ini|alasan\s+tersebut|masalah\s+tersebut|hal-hal\s+(?:tersebut|di\s*atas)|sebagaimana|hal\s+yang)\b/i;
// Bukan sebab: pembuka daftar ("antara lain", "sebagai berikut"), cerita waktu ("pada bulan ..."), ucapan orang pertama.
const RE_KUTIP_BUANG = /\b(?:berikut|antara\s+lain|di\s*antaranya|saya|kami|kita|aku|di?kh?[ae]?wa?tirkan|tidak\s+diinginkan)\b|^(?:pada|sejak|setelah|sesudah|ketika|saat|waktu|selama|sewaktu|terhitung|dengan|disebabkan|dikarenakan)\b|^\S+\s+(?:penggugat|tergugat|pemohon|termohon)$/i;
// Penanda sebab yang menerangkan perbuatan lain (kepergian/pisah rumah) atau didahului pembalik, bukan perselisihannya.
const RE_KUTIP_BALIK = /\b(?:namun|tetapi|walau(?:pun)?|meski(?:pun)?|sabar|bersabar|bertahan|mempertahankan|pisah|berpisah|meninggalkan|pergi|pulang|keluar)\b/i;
const BATAS_KUTIP_SEBAB = 200;
function kutipSebab(kalimatAsli, items, ph) {
  const kalimat = String(kalimatAsli || "").replace(/\s+/g, " ").slice(0, BATAS_KALIMAT);
  if (!RE_AKIBAT_UMUM.test(kalimat) || RE_NORMA.test(kalimat)) return null;
  RE_PENANDA_SEBAB_KUTIP.lastIndex = 0;
  let m;
  while ((m = RE_PENANDA_SEBAB_KUTIP.exec(kalimat)) !== null) {
    // Penanda sebab harus menerangkan perselisihan di klausa yang sama (paling jauh 220 huruf di depannya).
    // Di antaranya tidak ada pembalik ("... pertengkaran, namun karena rasa sayang Penggugat bersabar").
    const depan = kalimat.slice(Math.max(0, m.index - 220), m.index).split(/[;.]\s/).pop();
    const umum = [...depan.matchAll(new RegExp(RE_AKIBAT_UMUM.source, "gi"))].pop();
    if (!umum || depan.length - umum.index > 160 || RE_KUTIP_BALIK.test(depan.slice(umum.index))) continue;
    const mulai = m.index + m[0].length;
    // Sebab yang sudah dikenali kamus di klausa ini: tidak dikutip lagi.
    const sisa = kalimat.slice(mulai);
    const u = RE_UJUNG_KUTIP.exec(sisa);
    const ujung = mulai + (u ? u.index : sisa.length);
    const dikenal = (items || []).some((it) => it.simpul.some((s) => (s.pola.peran || "sebab") === "sebab" && s.idx >= mulai - 1 && s.idx < ujung));
    if (dikenal) return null;
    // Klausa yang membuka rincian bernomor ("... disebabkan hal-hal sebagai berikut:") bukan sebab - tidak dikutip.
    if (u && u[0] === ":") return null;
    let t = rapikanEkor(kalimat.slice(mulai, ujung).replace(/["“”]/g, ""));
    for (let n = 0; n < 3; n++) t = t.replace(/^[\s,]+/, "").replace(/^[Kk]arena(?=[A-Z])/, "").replace(/^(?:karena|oleh|(?:di)?sebabkan|dikarenakan|adalah|yaitu)(?:\s*,\s*|\s+)/i, "");
    // Kalimat terpotong batas pindai atau cerita beruntun (banyak koma): ambil klausa pertamanya saja.
    if (ujung >= kalimat.length && String(kalimatAsli).replace(/\s+/g, " ").length > kalimat.length) return null;
    if ((t.match(/,\s/g) || []).length >= 2) t = rapikanEkor(t.split(/,\s/)[0]);
    if (t.length > BATAS_KUTIP_SEBAB) t = rapikanEkor(t.split(RE_UJUNG_KUTIP_LUNAK)[0]);
    if (t.length > BATAS_KUTIP_SEBAB) t = rapikanEkor(t.split(/,\s/)[0]);
    const kata = t.split(/\s+/).filter(Boolean);
    if (t.length < 12 || t.length > BATAS_KUTIP_SEBAB || kata.length < 2 || kata.length > 32) return null;
    if (RE_KUTIP_TOLAK.test(t) || RE_BUKAN_SEBAB.test(t) || RE_AKIBAT_UMUM.test(t) || RE_KUTIP_BUANG.test(t) || !/^[a-z]/i.test(t)) return null;
    // Berpelaku pihak yang mengajukan: hanya bila ia mengalami/mengetahui perbuatan pihak lawan ("Penggugat mendapati
    // Tergugat ...", "Penggugat tidak dinafkahi"); cerita perbuatannya sendiri ("Penggugat meminta izin ...") bukan sebab.
    const lawan = String((ph && ph.lawan) || "Penggugat");
    const pelaku = String((ph && ph.pelaku) || "Tergugat");
    const keluhan = new RegExp(`\\b(?:namun|tetapi|padahal)\\s+(?:\\S+\\s+)?${pelaku}\\b`, "i");
    if (new RegExp(`^${lawan}\\b`, "i").test(t) && !RE_LAWAN_MENGALAMI.test(t.slice(lawan.length)) && !keluhan.test(t)) return null;
    t = bakuPihak(t);
    // Huruf awal kecil kecuali sebutan pihak (bunyi disisipkan di tengah kalimat blangko).
    if (!/^(?:Penggugat|Tergugat|Pemohon|Termohon)\b/.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1);
    return { teks: t, idx: mulai };
  }
  return null;
}

/** Kata isi (>= 5 huruf, bukan sebutan pihak/kata umum) - untuk mencocokkan kutipan sebab dengan keterangan saksi. */
const KATA_UMUM = new Set(["penggugat", "tergugat", "pemohon", "termohon", "karena", "sehingga", "kepada", "terhadap", "dengan", "antara", "keadaan", "kondisi", "rumah", "tangga", "selalu", "sering", "tidak", "bahwa", "sudah", "telah", "pernah", "menjadi", "adalah", "tersebut", "dalam", "untuk", "terjadi", "perselisihan", "pertengkaran"]);
function kataIsi(teks) {
  return new Set(
    String(teks || "")
      .toLowerCase()
      .split(/[^a-z-]+/)
      .filter((k) => k.length >= 5 && !KATA_UMUM.has(k))
  );
}

const SAMBUNG = { akibat: "sehingga", kondisi: "dan apabila dalam keadaan demikian", sebab: "sehingga", dan: "dan" };

/** Satu klausa item pada varian bunyi tertentu. */
function bunyiItem(item, ph, jenis, varian, tanpaRinci) {
  const bagian = [];
  item.simpul.forEach((s, i) => {
    if (i === 0) {
      bagian.push(klausa(s, ph, jenis, varian, "", tanpaRinci));
      return;
    }
    bagian.push(SAMBUNG[item.hubungan[i - 1]] || "sehingga");
    const kutipan = item.kutipan[i - 1] || "";
    bagian.push(klausa(s, ph, jenis, varian, kutipan, tanpaRinci));
  });
  // Akibat bebas (bukan simpul kamus): klausa kutipan ditempel di ujung.
  if (item.akibatBebas) {
    bagian.push(SAMBUNG.akibat);
    bagian.push(item.kutipan[0]);
  }
  return bagian.join(" ");
}

/** Bunyi tanpa hubungan sebab-akibat (ringkas): perbuatan sebab saja. */
function bunyiRingkas(item, ph, jenis) {
  const sebabSaja = item.simpul.filter((s) => (s.pola.peran || "sebab") === "sebab");
  const pakai = sebabSaja.length ? sebabSaja : item.simpul;
  return pakai.map((s) => klausa(s, ph, jenis, 0, "")).join(" dan ");
}

function daftarBunyi(item, ph, jenis) {
  const maks = Math.max(...item.simpul.map((s) => s.pola.bunyi.length));
  const hasil = [];
  const lihat = new Set();
  for (let k = 0; k < Math.min(maks, 3); k++) {
    const nilai = bunyiItem(item, ph, jenis, k);
    if (!nilai || lihat.has(nilai)) continue;
    lihat.add(nilai);
    hasil.push({ keadaan: k === 0 ? "baku" : `alternatif ${k}`, nilai });
    // 28 Okt: bunyi baku tanpa rincian gugatan tetap tersedia sebagai pilihan.
    if (k === 0 && item.simpul.some((s) => s.rinci)) {
      const polos = bunyiItem(item, ph, jenis, 0, true);
      if (polos && !lihat.has(polos)) {
        lihat.add(polos);
        hasil.push({ keadaan: "bunyi baku (tanpa rincian gugatan)", nilai: polos });
      }
    }
  }
  if (item.jenis === "rantai") {
    const ringkas = bunyiRingkas(item, ph, jenis);
    if (ringkas && !lihat.has(ringkas)) hasil.push({ keadaan: "tanpa hubungan sebab-akibat", nilai: ringkas });
  }
  return hasil;
}

function kunciItem(item) {
  return item.simpul.map((s) => `${s.kunci}|${s.subjek}${s.kata ? `:${s.kata}` : ""}`).join(">");
}

/**
 * Kunci saksi: kunci sebab yang disebut tiap saksi (dengan subjek yang diterima).
 * @returns {Map<number, Map<string, string>>} nomor saksi -> (kunci -> kalimat keterangannya)
 */
function kunciSaksi(saksi, set, kunciGugatan) {
  const peta = new Map();
  for (const s of saksi || []) {
    // kunci -> kalimat keterangan pertama yang menyebutnya (kutipan sumber kartu).
    const him = new Map();
    for (const b of s.butir || []) for (const sm of simpulKalimat(b, set, { kunci: kunciGugatan })) if (!him.has(sm.kunci)) him.set(sm.kunci, String(b).slice(0, 300));
    peta.set(s.no, him);
  }
  return peta;
}

/** Kunci sebab yang DISEBUT saksi (satu lintasan, tanpa uji subjek) - hanya untuk catatan "tidak didalilkan". */
function kunciDisebut(saksi, set) {
  const hasil = new Map(); // kunci -> Set nomor saksi
  const g = set.gabunganG;
  if (!g) return hasil;
  for (const s of saksi || []) {
    for (const b of s.butir || []) {
      const kal = String(b || "").slice(0, BATAS_KALIMAT);
      if (!kal) continue;
      g.lastIndex = 0;
      let m;
      while ((m = g.exec(kal)) !== null) {
        if (m[0] === "") {
          g.lastIndex++;
          continue;
        }
        let i = set.offset.length - 1;
        while (i > 0 && m[set.offset[i]] === undefined) i--;
        const p = set.daftar[i];
        if (sebab.RE_PENYANGKAL.test(kal.slice(Math.max(0, m.index - 40), m.index)) && !/^(?:tidak|tak|belum)\b/i.test(m[0])) continue;
        if (!hasil.has(p.kunci)) hasil.set(p.kunci, new Set());
        hasil.get(p.kunci).add(s.no);
      }
    }
  }
  return hasil;
}

function namaSaksi(s, ph) {
  if (s.pihak === "penggugat") return `saksi ${ph.lawan}`;
  if (s.pihak === "tergugat") return `saksi ${ph.pelaku}`;
  return `saksi ${s.no}`;
}

/** Keadaan dukungan saksi untuk satu item. */
function dukungan(item, saksi, petaSaksi, ph) {
  const inti = item.simpul.filter((s) => (s.pola.peran || "sebab") === "sebab");
  const nilai = inti.length ? inti : item.simpul;
  const periksa = saksi.filter((s) => (s.butir || []).length);
  const mendukung = periksa.filter((s) => nilai.every((n) => petaSaksi.get(s.no) && petaSaksi.get(s.no).has(n.kunci)));
  // Rantai: simpul inti saja yang diperiksa; satu saksi yang menyebut sebabnya tanpa akibat tetap menguatkan sebabnya.
  return {
    diperiksa: periksa.length,
    mendukung: mendukung.map((s) => ({ no: s.no, pihak: s.pihak || "", nama: namaSaksi(s, ph), sebutan: sisiSaksi(s, ph), kalimat: petaSaksi.get(s.no).get(nilai[0].kunci) || "" })),
  };
}

/** Pihak saksi menurut sebutan perkara ("" bila tidak diketahui). */
function sisiSaksi(x, ph) {
  return x.pihak === "penggugat" ? ph.lawan : x.pihak === "tergugat" ? ph.pelaku : "";
}

/**
 * Lencana dukungan saksi yang jujur:
 *   kedua saksi sepihak   "dikuatkan kedua saksi Penggugat"
 *   kedua saksi lain pihak "dikuatkan kedua saksi (saksi Penggugat dan saksi Tergugat)"
 *   satu saksi            "dikuatkan satu saksi (saksi Penggugat)"
 *   tidak ada             "dari gugatan - belum dikuatkan saksi" / "... saksi belum diperiksa"
 * @param d {{diperiksa:number, mendukung:Array<{no:number, pihak?:string}>}}
 */
function lencana(d, jawab, ph) {
  const p = ph || pihakDari(null);
  let teks;
  let yakin;
  if (d.tidakDibaca) {
    // Jalur yang memang tidak membawa keterangan saksi (berkas e-Court): tidak boleh berkata "belum diperiksa".
    teks = "dari gugatan - keterangan saksi belum dicocokkan";
    yakin = "ragu";
  } else if (!d.diperiksa) {
    teks = "dari gugatan - saksi belum diperiksa";
    yakin = "ragu";
  } else if (d.mendukung.length >= 2) {
    const a = sisiSaksi(d.mendukung[0], p);
    const b = sisiSaksi(d.mendukung[1], p);
    teks = a && a === b ? `dikuatkan kedua saksi ${a}` : `dikuatkan kedua saksi (${[a ? `saksi ${a}` : `saksi ${d.mendukung[0].no}`, b ? `saksi ${b}` : `saksi ${d.mendukung[1].no}`].join(" dan ")})`;
    yakin = "cukup";
  } else if (d.mendukung.length === 1) {
    const a = sisiSaksi(d.mendukung[0], p);
    teks = `dikuatkan satu saksi (${a ? `saksi ${a}` : `saksi ${d.mendukung[0].no}`})`;
    yakin = "ragu";
  } else {
    teks = "dari gugatan - belum dikuatkan saksi";
    yakin = "ragu";
  }
  if (jawab) teks += `; ${jawab.status === "dibantah" ? "dibantah dalam" : jawab.status === "diakui" ? "diakui dalam" : "disebut dalam"} ${jawab.jenis}`;
  return { teks, yakin };
}

/** Jawab-menjawab: hanya keterangan atas item yang SUDAH ada dari gugatan. */
function keteranganJawab(items, jawab, set) {
  const hasil = new Map();
  for (const doc of jawab || []) {
    for (const b of doc.butir || []) {
      const sm = simpulKalimat(b, set, { longgarNegasi: true });
      if (!sm.length) continue;
      const kunci = new Set(sm.map((x) => x.kunci));
      for (const it of items) {
        const ada = it.simpul.some((s) => kunci.has(s.kunci));
        if (!ada) continue;
        const bantah = RE_BANTAH.test(b) || sm.some((x) => x.ternegasi && !/^(?:tidak|tak|belum)\b/i.test(x.pola.re.exec(b) ? x.pola.re.exec(b)[0] : ""));
        const status = bantah ? "dibantah" : RE_AKUI.test(b) ? "diakui" : "disebut";
        const lama = hasil.get(it.id);
        const bobot = { disebut: 0, diakui: 1, dibantah: 2 };
        if (!lama || bobot[status] > bobot[lama.status]) hasil.set(it.id, { status, jenis: doc.jenis || "jawaban", kalimat: String(b).slice(0, 300) });
      }
    }
  }
  return hasil;
}

/**
 * @param o.gugatan {string[]}  butir gugatan/posita (acuan utama)
 * @param o.saksi   {Array<{no:number, pihak?:"penggugat"|"tergugat"|"", butir:string[]}>}
 * @param o.jawab   {Array<{jenis:string, butir:string[]}>} jawaban/replik/duplik (minor)
 * @param o.pihak   {{pelaku:string, lawan:string}}
 */
function deteksiRincian(o) {
  const ph = pihakDari(o && o.pihak);
  const jenis = sebab.jenisCerai(ph);
  const set = polaUntuk(jenis);
  const saksi = (o && o.saksi) || [];
  const gugatan = (o && o.gugatan) || [];
  const hasil = { jenis, butir: [], diLuarGugatan: [], bacaGugatan: gugatan.length > 0 };
  if (!set.daftar.length || !gugatan.length) return hasil;

  const peta = new Map();
  for (const k of gugatan) {
    const daftarItem = itemKalimat(k, set);
    // 28 Okt: cadangan kutip - klausa sebab eksplisit yang tidak dikenali kamus menjadi butir konkret (ragu).
    const kutip = kutipSebab(k, daftarItem, ph);
    if (kutip) {
      const kunciKutip = `kutip:${kutip.teks.toLowerCase()}`;
      const pola = { kode: "rincian-kutip-gugatan", label: "sebab dikutip dari gugatan", kunci: kunciKutip, huruf: "F", peran: "sebab", tanpaSubjek: true, bunyi: [kutip.teks] };
      daftarItem.push({ jenis: "tunggal", simpul: [{ kunci: kunciKutip, pola, teks: kutip.teks, idx: kutip.idx, akhir: kutip.idx, subjek: "B", kata: "", tersirat: false, ternegasi: false }], hubungan: [], kutipan: [], kalimat: k, kutipGugatan: true });
    }
    for (const it of daftarItem) {
      const id = kunciItem(it);
      const lama = peta.get(id);
      if (!lama) {
        it.id = id;
        peta.set(id, it);
      } else if (it.kutipan.some(Boolean) && !lama.kutipan.some(Boolean)) {
        it.id = id;
        peta.set(id, it);
      }
    }
  }
  // 28 Okt: akibat UMUM (perselisihan/pertengkaran) di ujung rantai dilepas - tidak ditempelkan ke alasan konkret.
  // Rantai sebab-akibat konkret ("malas bekerja sehingga kurang memberi nafkah") tidak tersentuh.
  const penutupLepas = [];
  const peta2 = new Map();
  for (const asli of peta.values()) {
    let it = asli;
    const akhir = it.simpul[it.simpul.length - 1];
    if (it.jenis === "rantai" && it.simpul.length >= 2 && (akhir.pola.peran || "sebab") === "penutup") {
      penutupLepas.push(akhir);
      it = { ...it, simpul: it.simpul.slice(0, -1), hubungan: it.hubungan.slice(0, -1), kutipan: it.kutipan.slice(0, -1) };
      if (it.simpul.length === 1 && !it.akibatBebas) it.jenis = "tunggal";
      it.id = kunciItem(it);
    }
    const lama = peta2.get(it.id);
    if (!lama || (it.kutipan.some(Boolean) && !lama.kutipan.some(Boolean))) peta2.set(it.id, it);
  }
  let items = [...peta2.values()];
  // Tunggal yang sudah menjadi bagian rantai tidak ditampilkan lagi.
  const dalamRantai = new Set();
  for (const it of items) if (it.jenis === "rantai") for (const s of it.simpul) dalamRantai.add(`${s.kunci}|${s.subjek}${s.kata ? `:${s.kata}` : ""}`);
  items = items.filter((it) => it.jenis === "rantai" || !dalamRantai.has(kunciItem(it)));
  // 28 Okt: ruas `serap` - alasan yang maknanya sudah termuat butir lain ("pergi tanpa diketahui tujuannya" menyerap
  // "tidak diketahui keberadaannya") tidak diulang sebagai butir tersendiri.
  const terserap = new Set(items.flatMap((it) => it.simpul.flatMap((s) => (Array.isArray(s.pola.serap) ? s.pola.serap : []))));
  if (terserap.size) items = items.filter((it) => !(it.jenis === "tunggal" && terserap.has(it.simpul[0].kunci)));
  // Penutup (perselisihan) berdiri sendiri HANYA bila gugatan tidak menyebut sebab konkret apa pun; selain itu
  // ia menjadi pilihan bunyi ("... sehingga antara Penggugat dan Tergugat terus-menerus terjadi perselisihan").
  const penutup = items.filter((it) => it.simpul.length === 1 && (it.simpul[0].pola.peran || "sebab") === "penutup");
  const badan = items.filter((it) => !penutup.includes(it));
  const penutupSatu = penutup.length && !badan.length ? [penutup[0]] : [];
  const simpulPenutup = (penutup[0] && penutup[0].simpul[0]) || penutupLepas[0] || null;
  if (badan.length && simpulPenutup) hasil.penutup = [0, 1, 2].map((k) => klausa(simpulPenutup, ph, jenis, k, ""));
  items = [...badan, ...penutupSatu];

  const kunciGugatan = new Set(items.flatMap((it) => it.simpul.map((s) => s.kunci)));
  const petaSaksi = kunciSaksi(saksi, set, kunciGugatan);
  // Butir kutipan (bukan pola kamus): saksi menguatkan bila keterangannya memuat sedikitnya dua kata isi kutipan itu.
  for (const it of items.filter((x) => x.kutipGugatan)) {
    const isi = kataIsi(it.simpul[0].teks);
    if (isi.size < 2) continue;
    for (const s of saksi) {
      const him = petaSaksi.get(s.no);
      if (!him) continue;
      const b = (s.butir || []).find((x) => [...kataIsi(x)].filter((w) => isi.has(w)).length >= 2);
      if (b) him.set(it.simpul[0].kunci, String(b).slice(0, 300));
    }
  }
  const jawabPer = keteranganJawab(items, o.jawab, set);
  hasil.butir = items.map((it, n) => {
    const d = dukungan(it, saksi, petaSaksi, ph);
    if (o && o.saksiTidakDibaca === true) d.tidakDibaca = true;
    const j = jawabPer.get(it.id) || null;
    const l = lencana(d, j, ph);
    const tersirat = it.simpul.some((s) => s.tersirat);
    const kutip = it.kutipan.some(Boolean) || Boolean(it.akibatBebas) || Boolean(it.kutipGugatan);
    return {
      id: n + 1,
      jenis: it.jenis,
      penutup: penutupSatu.includes(it),
      sebab: it.simpul.map((s) => s.kunci),
      label: it.simpul.map((s) => s.pola.label.replace(/\s*\([^)]*\)$/, "")).join(" -> "),
      huruf: [...new Set(it.simpul.map((s) => s.pola.huruf).filter(Boolean))],
      bunyi: daftarBunyi(it, ph, jenis),
      kalimatGugatan: String(it.kalimat).slice(0, 400),
      dukungan: d.mendukung,
      saksiDiperiksa: d.diperiksa,
      lencana: l.teks,
      yakin: tersirat || kutip ? "ragu" : l.yakin,
      catatan: [tersirat ? "pelakunya tidak disebut di kalimat gugatan (dianggap " + ph.pelaku + ")" : "", it.kutipGugatan ? "sebabnya dikutip dari gugatan (belum dikenali kamus) - periksa" : kutip ? "akibatnya dikutip dari gugatan - periksa" : ""].filter(Boolean).join("; "),
      jawab: j,
      kodePola: it.simpul.map((s) => s.pola.kode),
      asal: "posita",
      asalLabel: ASAL_LABEL.posita,
    };
  });

  // 31 Okt (arahan pengguna, MENGUBAH keputusan 27 Okt): alasan yang disebut KEDUA saksi tetapi tidak didalilkan ikut
  // DIUSULKAN (keyakinan ragu - tidak pernah mengisi sendiri), bunyinya disusun mesin yang sama sehingga menyambung dengan
  // alasan posita ("A, B, dan C"); alasan yang setara dengan alasan posita tidak diulang. Satu saksi saja = catatan.
  const diusulkanSaksi = new Set();
  if (!(o && o.saksiTidakDibaca === true)) {
    const tambahan = alasanKeduaSaksi(saksi, set, kunciGugatan, terserap);
    for (const t of tambahan) {
      const it = t.item;
      it.simpul.forEach((s) => diusulkanSaksi.add(s.kunci));
      hasil.butir.push({
        id: hasil.butir.length + 1,
        jenis: it.jenis,
        penutup: false,
        sebab: it.simpul.map((s) => s.kunci),
        label: it.simpul.map((s) => s.pola.label.replace(/\s*\([^)]*\)$/, "")).join(" -> "),
        huruf: [...new Set(it.simpul.map((s) => s.pola.huruf).filter(Boolean))],
        bunyi: daftarBunyi(it, ph, jenis),
        kalimatGugatan: "",
        kalimatSaksi: t.kalimat.map((x) => ({ no: x.no, kalimat: x.kalimat.slice(0, 300) })),
        dukungan: t.kalimat.map((x) => {
          const s = saksi.find((y) => y.no === x.no) || { no: x.no };
          return { no: x.no, pihak: s.pihak || "", nama: namaSaksi(s, ph), sebutan: sisiSaksi(s, ph), kalimat: x.kalimat.slice(0, 300) };
        }),
        saksiDiperiksa: saksi.filter((s) => (s.butir || []).length).length,
        lencana: "dari keterangan kedua saksi - tidak didalilkan di gugatan",
        yakin: "ragu",
        catatan: "Alasan ini tidak tertulis di posita; diusulkan karena diterangkan kedua saksi. Periksa sebelum diinput.",
        jawab: null,
        kodePola: it.simpul.map((s) => s.pola.kode),
        asal: "saksi",
        asalLabel: ASAL_LABEL.saksi,
      });
    }
    // Saksi menerangkan SEBALIKNYA dari dalil posita ("tidak pernah memukul") = catatan temuan, bukan usulan.
    hasil.bertentangan = bertentanganSaksi(hasil.butir.filter((b) => b.asal === "posita"), saksi, set);
    for (const t of hasil.bertentangan) {
      const b = hasil.butir.find((x) => x.asal === "posita" && x.sebab.includes(t.kunci));
      if (b) b.catatan = [b.catatan, `saksi ${t.saksi.join(" dan ")} menerangkan sebaliknya: "${t.kalimat.slice(0, 160)}"`].filter(Boolean).join("; ");
    }
  }

  // Yang disebut SATU saksi saja (atau tidak terbaca pelakunya) dan tidak didalilkan: dicatat, TIDAK diusulkan.
  for (const [k, nomor] of kunciDisebut(saksi, set)) {
    const pola = set.perKunci.get(k)[0];
    if (kunciGugatan.has(k) || diusulkanSaksi.has(k) || terserap.has(k) || (pola.peran || "sebab") !== "sebab" || pola.hanyaAkibat) continue;
    hasil.diLuarGugatan.push({ kunci: k, label: pola.label.replace(/\s*\([^)]*\)$/, ""), saksi: [...nomor] });
  }
  return hasil;
}

const ASAL_LABEL = { posita: "dari posita", saksi: "dari keterangan kedua saksi" };
const RE_KONTEKS_PENYEBAB = /\b(?:penyebab\w*|sebab|disebabkan|karena|dikarenakan|lantaran|berselisih|bertengkar|pertengkaran|perselisihan|percekcokan|cekcok|masalah)\b/i;

/**
 * Alasan SETARA - yang satu sudah termuat di yang lain (tidak diusulkan dobel dari keterangan saksi): "berkata kasar" ~ "bersikap
 * kasar", "menikah lagi" ~ "berselingkuh", "boros" ~ "judi", "tidak memberi nafkah" ~ "kebutuhan dibantu/tidak bersyukur".
 */
const SETARA_ALASAN = {
  "kasar-sikap": ["kasar-verbal", "kdrt-fisik"],
  "kasar-verbal": ["kasar-sikap"],
  "kdrt-fisik": ["kasar-sikap"],
  selingkuh: ["menikah-lagi", "zina"],
  "menikah-lagi": ["selingkuh"],
  zina: ["selingkuh"],
  boros: ["judi"],
  nafkah: ["tidak-bersyukur", "malas-kerja", "tanpa-kerja"],
  "malas-kerja": ["tanpa-kerja"],
  "tanpa-kerja": ["malas-kerja"],
  "pergi-tanpa-kabar": ["tak-diketahui"],
  murtad: ["kembali-agama"],
  "kembali-agama": ["murtad"],
};

/**
 * Alasan konkret yang diterangkan KEDUA saksi (pelakunya pihak 0047, tidak disangkal) dan tidak didalilkan di gugatan.
 * @returns {Array<{item, kalimat: Array<{no, kalimat}>}>} satu item per alasan (rantai bila saksi menyebut sebab-akibatnya)
 */
function alasanKeduaSaksi(saksi, set, kunciGugatan, terserap) {
  const per = new Map(); // kunci -> {no: Set, item, kalimat: Map(no -> kalimat)}
  for (const s of saksi || []) {
    for (const b of s.butir || []) {
      // Hanya keterangan tentang PENYEBAB perselisihan ("penyebabnya karena Tergugat ...") - jawaban "Tergugat sudah tidak
      // pernah memberikan nafkah" (selama pisah) atau "saat ini sudah pisah, Tergugat meninggalkan kediaman" bukan alasan.
      if (!RE_KONTEKS_PENYEBAB.test(String(b))) continue;
      for (const it of itemKalimat(b, set)) {
        if (it.kutipGugatan) continue;
        for (const sm of it.simpul) {
          const peran = sm.pola.peran || "sebab";
          if (peran !== "sebab" || sm.pola.hanyaAkibat || sm.subjek !== "P" || sm.ternegasi) continue;
          // Selalu perbuatannya saja (tanpa rantai sebab-akibat dari kalimat saksi) - bunyi rapi menyambung alasan posita.
          // Bunyi baku kamus (tanpa kutipan predikat dari kalimat saksi yang sering tidak utuh).
          if (!per.has(sm.kunci)) per.set(sm.kunci, { no: new Set(), item: { jenis: "tunggal", simpul: [{ ...sm, rinci: null }], hubungan: [], kutipan: [], kalimat: String(b) }, kalimat: new Map() });
          const e = per.get(sm.kunci);
          e.no.add(s.no);
          if (!e.kalimat.has(s.no)) e.kalimat.set(s.no, String(b));
        }
      }
    }
  }
  const setara = (k) => (SETARA_ALASAN[k] || []).some((x) => kunciGugatan.has(x));
  const hasil = [];
  const dipakai = new Set();
  for (const [k, e] of per) {
    if (e.no.size < 2 || kunciGugatan.has(k) || terserap.has(k) || setara(k) || dipakai.has(k)) continue;
    const it = e.item;
    dipakai.add(k);
    it.id = `saksi:${k}`;
    hasil.push({ item: it, kalimat: [...e.kalimat].sort((a, b) => a[0] - b[0]).map(([no, kalimat]) => ({ no, kalimat })) });
  }
  return hasil;
}

/** Dalil posita yang DISANGKAL saksi ("Tergugat tidak pernah memukul Penggugat"): [{kunci, label, saksi:[no], kalimat}]. */
function bertentanganSaksi(butirPosita, saksi, set) {
  const hasil = [];
  for (const b of butirPosita) {
    for (const k of b.sebab) {
      const nomor = [];
      let kalimat = "";
      for (const s of saksi || []) {
        for (const x of s.butir || []) {
          const sm = simpulKalimat(x, set, { kunci: new Set([k]), longgarNegasi: true }).find((z) => z.kunci === k);
          if (sm && sm.ternegasi && sm.subjek === "P" && !/^(?:tidak|tak|belum)\b/i.test(sm.teks)) {
            if (!nomor.includes(s.no)) nomor.push(s.no);
            if (!kalimat) kalimat = String(x);
            break;
          }
        }
      }
      if (nomor.length && !hasil.some((h) => h.kunci === k)) hasil.push({ kunci: k, label: b.label, saksi: nomor, kalimat });
    }
  }
  return hasil;
}

/** "A", "A dan B", "A, B, dan C" - 28 Okt 2026 (pengguna): antar-alasan "dan", tanpa ";" dan tanpa "serta". */
function gabungKalimat(bagian) {
  const b = bagian.filter(Boolean);
  if (b.length <= 1) return b.join("");
  if (b.length === 2) return `${b[0]} dan ${b[1]}`;
  return `${b.slice(0, -1).join(", ")}, dan ${b[b.length - 1]}`;
}

/** Kalimat 5227 pada varian ke-k dari semua butir; "ringkas" = perbuatan sebab saja. */
function susunVarian(rincian, k, ringkas) {
  const bagian = rincian.butir.map((b) => {
    if (ringkas) {
      const r = b.bunyi.find((x) => x.keadaan === "tanpa hubungan sebab-akibat");
      return (r || b.bunyi[0] || {}).nilai || "";
    }
    return (b.bunyi[Math.min(k, b.bunyi.length - 1)] || {}).nilai || "";
  });
  return gabungKalimat(bagian);
}

/**
 * Pilihan bunyi 5227 [{keadaan, nilai}] dari rincian - tanpa duplikat.
 */
function pilihanBunyi(rincian) {
  const hasil = [];
  const lihat = new Set();
  const tambah = (keadaan, nilai) => {
    if (nilai && !lihat.has(nilai)) {
      lihat.add(nilai);
      hasil.push({ keadaan, nilai });
    }
  };
  tambah("sesuai gugatan (sebab dan akibat)", susunVarian(rincian, 0, false));
  tambah("sesuai gugatan, redaksi lain", susunVarian(rincian, 1, false));
  tambah("sesuai gugatan, redaksi lain 2", susunVarian(rincian, 2, false));
  tambah("perbuatannya saja (tanpa hubungan sebab-akibat)", susunVarian(rincian, 0, true));
  // 28 Okt: perselisihan di akhir hanya PILIHAN (bukan bawaan) bila gugatan juga menyebut sebab konkret.
  if (Array.isArray(rincian.penutup) && rincian.penutup[0] && rincian.butir.some((b) => !b.penutup)) {
    tambah("sesuai gugatan, dengan perselisihan di akhir", `${susunVarian(rincian, 0, false)} sehingga ${rincian.penutup[0]}`);
  }
  return hasil;
}


/** Ringkasan butir untuk layar (tanpa kalimat mentah panjang). */
function ringkasButir(b) {
  return {
    id: b.id,
    jenis: b.jenis,
    penutup: b.penutup,
    sebab: b.sebab,
    label: b.label,
    huruf: b.huruf,
    bunyi: b.bunyi,
    lencana: b.lencana,
    yakin: b.yakin,
    dukungan: b.dukungan.map((x) => x.nama),
    dukung: b.dukungan.map((x) => ({ no: x.no, pihak: x.pihak })),
    saksiDiperiksa: b.saksiDiperiksa,
    jawab: b.jawab ? { status: b.jawab.status, jenis: b.jawab.jenis } : null,
    catatan: b.catatan,
    kalimatGugatan: b.kalimatGugatan,
    asal: b.asal || "posita",
    asalLabel: b.asalLabel || ASAL_LABEL.posita,
    ...(Array.isArray(b.kalimatSaksi) ? { kalimatSaksi: b.kalimatSaksi } : {}),
  };
}

/**
 * Menerapkan rincian pada hasil dariKeteranganSaksi (mengubah `hasil` di tempat). Sebab konkret dari
 * gugatan menggantikan kalimat lama; kalimat lama tetap tersedia sebagai pilihan. Bila gugatan hanya
 * menyebut perselisihan (penutup), kalimat lama yang sudah ada tidak diganti.
 * @returns {boolean} true bila kartu 5227 disentuh
 */
function terapkan(hasil, rincian) {
  const u = (hasil.usulan || []).find((x) => x && x.kode === "5227");
  if (!u || !rincian || !rincian.butir.length) return false;
  const konkret = rincian.butir.filter((b) => !b.penutup);
  const pil = pilihanBunyi(rincian);
  const lama = String(u.nilai || "").trim();
  const baru = pil.length ? pil[0].nilai : "";
  if (!baru) return false;
  hasil.rincianAlasan = { jenis: rincian.jenis, butir: rincian.butir.map(ringkasButir), diLuarGugatan: rincian.diLuarGugatan, bertentangan: rincian.bertentangan || [] };
  u.rincian = hasil.rincianAlasan.butir;
  const catatan = [];
  if (konkret.length || !lama) {
    if (lama && lama !== baru) {
      pil.push({ keadaan: "cara lama (ciri dari keterangan saksi)", nilai: lama });
      u.nilaiLama = lama;
    }
    u.nilai = baru;
    u.keyakinan = rincian.butir.every((b) => b.yakin === "cukup") ? "cukup" : "ragu";
    u.dariPosita = true;
    u.dariGugatan = true;
    const sumberGugatan = [];
    for (const b of rincian.butir) if (b.kalimatGugatan && !sumberGugatan.some((x) => x.kalimat === b.kalimatGugatan)) sumberGugatan.push({ saksi: 0, asal: "posita", kalimat: b.kalimatGugatan });
    // 28 Okt: keterangan saksi yang menguatkan tiap alasan ikut menjadi sumber kartu (bukan hanya kalimat gugatan).
    const sumberSaksi = [];
    for (const b of rincian.butir) {
      for (const d of b.dukungan || []) {
        if (d.kalimat && !sumberSaksi.some((x) => x.saksi === d.no && x.kalimat === d.kalimat)) sumberSaksi.push({ saksi: d.no, kalimat: d.kalimat, ...(d.sebutan ? { pihak: d.sebutan } : {}) });
      }
    }
    const saksiLama = Array.isArray(u.sumber) ? u.sumber.filter((x) => x && x.saksi > 0 && !sumberSaksi.some((y) => y.kalimat === x.kalimat)) : [];
    u.sumber = [...sumberGugatan.slice(0, 6), ...[...sumberSaksi, ...saksiLama].slice(0, 6)];
    u.kesepakatan = "gugatan";
    u.tingkat = u.keyakinan === "cukup" ? "cukup" : "ragu";
    u.dasarTingkat = "gugatan";
    catatan.push("Sebab disusun dari gugatan (acuan utama), berikut rantai sebab-akibatnya; saksi menguatkan, lihat lencana tiap alasan. Periksa sebelum diinput.");
  } else {
    catatan.push("Gugatan hanya menyebut perselisihan; kalimat yang sudah ada dipertahankan.");
  }
  const dariSaksi = rincian.butir.filter((b) => b.asal === "saksi");
  if (dariSaksi.length) {
    catatan.push(`Ikut diusulkan dari keterangan kedua saksi (tidak didalilkan di gugatan): ${dariSaksi.map((b) => b.label).join(", ")}.`);
  }
  if ((rincian.bertentangan || []).length) {
    catatan.push(`Keterangan saksi bertentangan dengan posita: ${rincian.bertentangan.map((x) => `${x.label} (saksi ${x.saksi.join(" dan ")})`).join(", ")} - periksa pembuktiannya.`);
  }
  if (rincian.diLuarGugatan.length) {
    catatan.push(`Disebut satu saksi saja dan tidak didalilkan di gugatan (dicatat, tidak diusulkan): ${rincian.diLuarGugatan.slice(0, 5).map((x) => x.label).join(", ")}${rincian.diLuarGugatan.length > 5 ? ` dan ${rincian.diLuarGugatan.length - 5} lainnya` : ""}.`);
  }
  u.pilihan = pil;
  u.catatan = [u.catatan, ...catatan].filter(Boolean).join(" ");
  if (konkret.length && rincian.butir.some((b) => b.kodePola && b.kodePola.length)) u.kodePola = rincian.butir.find((b) => !b.penutup).kodePola[0];
  return true;
}

/**
 * Menyebut saksi menurut pihaknya ("saksi 1" -> "saksi Penggugat") SESUDAH rincian tersusun - dipakai saat pihak
 * saksi baru diketahui dari konteks perkara yang sudah dibaca layanan (tanpa kueri tambahan).
 * @param sisi {{saksi1?: string, saksi2?: string}} "penggugat" | "tergugat"
 */
function terapkanSisiSaksi(hasil, sisi, pihak) {
  const ph = pihakDari(pihak);
  const garap = (daftar) => {
    for (const b of daftar || []) {
      if (!Array.isArray(b.dukung)) continue;
      const mendukung = b.dukung.map((x) => ({ no: x.no, pihak: x.pihak || (sisi && sisi[`saksi${x.no}`]) || "" }));
      b.dukung = mendukung;
      b.lencana = lencana({ diperiksa: b.saksiDiperiksa || 0, mendukung }, b.jawab, ph).teks;
      b.dukungan = mendukung.map((x) => (sisiSaksi(x, ph) ? `saksi ${sisiSaksi(x, ph)}` : `saksi ${x.no}`));
    }
  };
  if (hasil.rincianAlasan) garap(hasil.rincianAlasan.butir);
  const u = (hasil.usulan || []).find((x) => x && x.kode === "5227");
  if (u && u.rincian && u.rincian !== (hasil.rincianAlasan && hasil.rincianAlasan.butir)) garap(u.rincian);
  // Sumber kartu menyebut pihak saksinya juga.
  for (const s of u && Array.isArray(u.sumber) ? u.sumber : []) {
    const sisiNo = s && s.saksi > 0 && !s.pihak && sisi ? sisi[`saksi${s.saksi}`] : "";
    if (sisiNo) s.pihak = sisiNo === "penggugat" ? ph.lawan : sisiNo === "tergugat" ? ph.pelaku : "";
  }
  return true;
}

module.exports = { terapkanSisiSaksi, terapkan, ringkasButir, deteksiRincian, pilihanBunyi, susunVarian, gabungKalimat, polaUntuk, simpulKalimat, itemKalimat, KELOMPOK };
