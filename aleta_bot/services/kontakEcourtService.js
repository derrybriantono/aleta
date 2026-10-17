"use strict";

/**
 * ============================================================================
 * KONTAK-EC (11 Okt 2026, agen 5) - EMAIL & NOMOR HP/WA PIHAK DAN KUASA DARI e-COURT
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan deteksi email dan nomor whatsapp dari e-court
 * untuk dimasukkan datanya ke sipp dan abt", dan "buat otomatis abt mengambil
 * data juga dari aleta e-court".
 *
 * SUMBER (urut kekuatan)
 *
 *   akun     aleta_bot_ecourt_pihak (bagian "Persetujuan Pihak Menggunakan
 *            Saluran Elektronik" yang ditarik jembatan e-Court: nama, peran,
 *            email, telp) dan aleta_bot_ecourt_documents.email_pengunggah
 *            (surel AKUN e-Court yang mengunggah jawaban/replik/duplik).
 *            Pengunggah pada sisi yang BERKUASA di SIPP = kuasanya; tanpa
 *            kuasa = pihak urutan 1. Diukur 11 Okt atas salinan 9 Okt: dari 16
 *            surel pengunggah yang juga tercatat di SIPP, 16 sesuai aturan itu
 *            (7 kuasa, 9 pihak) -> "cukup" (n terlalu kecil untuk "pasti").
 *   teks     surat gugatan / jawab-menjawab / surat kuasa yang diarsipkan
 *            ALETA dan dibaca PORTAL (pembaca PDF ada di sana): pola kelompok
 *            kamus "kontak" (kamus-deteksi/awal/kontak.json). Kepemilikan
 *            ditentukan susunan identitas ("..., No. HP 08..., selanjutnya
 *            disebut sebagai Penggugat") dan bagian kuasa ("Advokat ... email
 *            ... untuk dan atas nama ..."). "ragu" sampai pola
 *            kontak-label-pihak terukur >= 95% di server.
 *
 * KE MANA
 *
 *   SIPP  usulan per orang (pihak/kuasa) untuk blangko Data Pihak/Pengacara
 *         (#pihak_email/#pihak_no_tlp, #pengacara_email/#pengacara_no_tlp) -
 *         diisi ekstensi atas klik petugas, petugas yang menekan Simpan. Nilai
 *         SIPP yang sudah terisi tidak pernah diganti tanpa konfirmasi.
 *   ABT   tabel aleta_bot_ecourt_ringkasan (database aleta_bot, MySQL yang SAMA
 *         dengan SIPP & aps_badilag di satker) dibaca variabel kueri ABT
 *         8800-8811 (paket abt-data-ecourt): SIPP lebih dulu, kosong = nilai
 *         e-Court berkeyakinan pasti/cukup. Jadi blangko terisi walau panel
 *         ABT tidak pernah dibuka.
 *
 * Nomor dinormalkan ke 08xxxxxxxxxx (borang SIPP: numeric, 5-50 angka; 84%
 * isian telepon SIPP sudah berbentuk 08...). Email divalidasi dan dibatasi 50
 * huruf (kolom pihak.email varchar(50)). Surel sistem pengadilan dibuang.
 *
 * Tidak menulis ke SIPP/ABT. Tulisan hanya ke aleta_bot_ecourt_ringkasan.
 */

const crypto = require("crypto");
const kamus = require("./kamusDeteksi");

/* ─── 1. Normalisasi (murni) ────────────────────────────────────────────── */

const BATAS_EMAIL_SIPP = 50;
const EMAIL_SAH = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;
// Surel pengadilan / sistem - bukan milik pihak.
const EMAIL_SISTEM = /(?:mahkamahagung\.go\.id|badilag\.net|badilag\.go\.id|(?:^|[.@])pa-[a-z]+\.go\.id|(?:^|[.@])pta-[a-z]+\.go\.id|noreply|no-reply|ecourt)/;
const DEPAN_BUKAN_NAMA = /^(?:elektronik|elektronic|elekronik|email|e-mail|surel|alamat|domisili|website)$/i;

/** Email -> huruf kecil tanpa tanda baca penutup; "" bila tidak sah atau milik sistem. */
function bakuEmail(teks) {
  const e = String(teks == null ? "" : teks)
    .trim()
    .replace(/^[<("'“‘]+|[>)"'”’.,;:]+$/g, "")
    .replace(/\s*@\s*/, "@")
    .toLowerCase();
  if (!EMAIL_SAH.test(e)) return "";
  if (EMAIL_SISTEM.test(e)) return "";
  return e;
}

/**
 * Nomor -> { nilai: "08...", jenis: "hp" | "telepon" } atau null.
 *   +62 812-3456-7890, 62812..., (0812) 345 678, 0812.3456.7890 -> 081234567890
 *   0451 421234 -> telepon (bukan WhatsApp)
 */
function bakuNomor(teks) {
  let d = String(teks == null ? "" : teks).replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("62")) d = `0${d.slice(2)}`;
  else if (d.startsWith("8") && d.length >= 9 && d.length <= 12) d = `0${d}`;
  if (/^08[1-9]\d{7,10}$/.test(d)) return { nilai: d, jenis: "hp" };
  if (/^0[2-7]\d{7,10}$/.test(d)) return { nilai: d, jenis: "telepon" };
  return null;
}

/** Isian telepon SIPP -> daftar nomor baku (SIPP kadang memuat dua nomor dalam satu kolom). */
function nomorSipp(teks) {
  const hasil = [];
  for (const potong of String(teks || "").split(/[,;/]|\s{2,}|\bdan\b/)) {
    const b = bakuNomor(potong);
    if (b && !hasil.some((x) => x.nilai === b.nilai)) hasil.push(b);
  }
  return hasil;
}

/** Huruf saja, huruf kecil, tanpa "bin/binti ..." dan gelar - pembanding nama SIPP vs e-Court/borang. */
function bakuNama(nama) {
  return String(nama || "")
    .toLowerCase()
    .replace(/\b(?:bin|binti)\b.*$/, "")
    .replace(/,?\s*\b(?:s\.?\s?h|m\.?\s?h|s\.?\s?h\.?\s?i|s\.?\s?ag|m\.?\s?kn|s\.?\s?e|s\.?\s?pd|h|hj|dr|ir|drs)\b\.?/g, " ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sebutan pihak -> sisi SIPP: 1 Penggugat/Pemohon/Pelawan, 2 Tergugat/Termohon/Terlawan, 0 lainnya. */
function sisiDari(teks) {
  // "TER MO HON" (salinan PDF) dibaca sebagai termohon.
  const t = String(teks || "").toLowerCase().replace(/\s+/g, "");
  if (/turut/.test(t)) return 0;
  if (/tergugat|termohon|terlawan|terbanding/.test(t)) return 2;
  if (/penggugat|pemohon|pelawan|pembanding/.test(t)) return 1;
  return 0;
}

/* ─── 2. Deteksi dari teks (murni, pola dari kamus) ─────────────────────── */

function polaPeran(peran) {
  return kamus.polaKelompok("kontak").filter((p) => p.peran === peran);
}

function global(re) {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
}

/** Semua kecocokan [mulai, akhir, m] seluruh pola satu peran, urut posisi. */
function semuaCocok(teks, peran) {
  const hasil = [];
  for (const p of polaPeran(peran)) {
    const re = global(p.re);
    let m;
    while ((m = re.exec(teks)) !== null) {
      hasil.push({ mulai: m.index, akhir: m.index + m[0].length, m, kode: p.kode, yakin: p.yakin || "ragu" });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  return hasil.sort((a, b) => a.mulai - b.mulai);
}

function adaDi(teks, peran, dari, sampai) {
  if (sampai <= dari) return null;
  const potong = teks.slice(Math.max(0, dari), sampai);
  let terakhir = null;
  for (const c of semuaCocok(potong, peran)) terakhir = { ...c, mulai: c.mulai + Math.max(0, dari), akhir: c.akhir + Math.max(0, dari) };
  return terakhir;
}

const JENDELA_MAJU = 700;
const JENDELA_MUNDUR = 700;

/**
 * Kontak di satu teks berkas e-Court.
 * @param {string} teks
 * @param {object} opsi  { sisiPengunggah: 1|2|0 } - sisi pemilik berkas (gugatan/replik = 1, jawaban/duplik = 2)
 * @returns [{ jenis: "email"|"hp"|"telepon", nilai, milik: "pihak"|"kuasa"|"", sisi: 0|1|2, domisili, kutipan, kodePola, yakinLabel }]
 */
function kontakDariTeks(teks, opsi) {
  const o = opsi || {};
  const rapi = String(teks || "").replace(/\r/g, "").replace(/\f/g, "\n");
  if (!rapi.trim()) return [];
  const label = semuaCocok(rapi, "label-pihak");
  const kopAda = Boolean(adaDi(rapi, "kop", 0, Math.min(500, rapi.length)));

  const calon = [];
  for (const c of semuaCocok(rapi, "email")) calon.push({ jenis: "email", nilai: bakuEmail(c.m[0]), mulai: c.mulai, akhir: c.akhir, kode: c.kode });
  for (const c of semuaCocok(rapi, "email-renggang")) {
    if (DEPAN_BUKAN_NAMA.test(c.m[1])) continue;
    if (calon.some((x) => x.jenis === "email" && x.mulai <= c.akhir && x.akhir >= c.mulai)) continue;
    calon.push({ jenis: "email", nilai: bakuEmail(`${c.m[1]}@${c.m[2]}`), mulai: c.mulai, akhir: c.akhir, kode: c.kode });
  }
  for (const c of semuaCocok(rapi, "hp")) {
    const b = bakuNomor(c.m[0]);
    if (b) calon.push({ jenis: b.jenis, nilai: b.nilai, mulai: c.mulai, akhir: c.akhir, kode: c.kode });
  }
  for (const c of semuaCocok(rapi, "telepon")) {
    const b = bakuNomor(c.m[1] || c.m[0]);
    if (!b || calon.some((x) => x.nilai === b.nilai && x.mulai <= c.akhir && x.akhir >= c.mulai)) continue;
    calon.push({ jenis: b.jenis, nilai: b.nilai, mulai: c.mulai, akhir: c.akhir, kode: c.kode });
  }

  const hasil = [];
  for (const k of calon.sort((a, b) => a.mulai - b.mulai)) {
    if (!k.nilai) continue;
    // Bagian identitas tempat kontak berada: sesudah sebutan pihak sebelumnya.
    const sebelum = label.filter((l) => l.akhir <= k.mulai).pop();
    const awalBagian = Math.max(sebelum ? sebelum.akhir : 0, k.mulai - JENDELA_MUNDUR);
    const maju = label.find((l) => l.mulai >= k.akhir && l.mulai - k.akhir <= JENDELA_MAJU);
    const kataKuasa = adaDi(rapi, "kuasa", awalBagian, k.mulai);
    const pemberi = kataKuasa ? adaDi(rapi, "pemberi", kataKuasa.akhir, k.mulai) : null;
    let milik = "pihak";
    let sisi = maju ? sisiDari(maju.m[1]) : 0;
    if (kataKuasa && !pemberi) milik = "kuasa";
    if (kopAda && k.mulai < 500 && (!maju || maju.mulai - k.akhir > 300)) {
      milik = "kuasa";
      sisi = Number(o.sisiPengunggah) || 0;
    }
    if (!maju && milik === "pihak") sisi = 0; // identitas tanpa sebutan: pemilik tidak diketahui
    const domisili = k.jenis === "email" && Boolean(adaDi(rapi, "domisili", Math.max(0, k.mulai - 80), k.mulai));
    hasil.push({
      jenis: k.jenis,
      nilai: k.nilai,
      milik: sisi ? milik : "",
      sisi,
      domisili,
      kutipan: rapi
        .slice(Math.max(0, k.mulai - 90), Math.min(rapi.length, k.akhir + 60))
        .replace(/\s+/g, " ")
        .trim(),
      kodePola: [k.kode, maju ? maju.kode : "", milik === "kuasa" ? (kataKuasa ? kataKuasa.kode : "kontak-kop-kuasa") : ""].filter(Boolean).join(","),
      yakinLabel: maju ? maju.yakin : "ragu",
      // Teks identitas SEBELUM kontak (nama pemiliknya biasanya di sini) - pemilih orang bila sisi berpihak/berkuasa lebih dari satu.
      segmen: rapi.slice(awalBagian, k.mulai),
    });
  }
  // Satu baris per (jenis, nilai, milik, sisi) - kemunculan pertama.
  const kenal = new Set();
  return hasil.filter((h) => {
    const kunci = `${h.jenis}|${h.nilai}|${h.milik}|${h.sisi}`;
    if (kenal.has(kunci)) return false;
    kenal.add(kunci);
    return true;
  });
}

/* ─── 3. Penyusun per orang (murni) ─────────────────────────────────────── */

const PANGKAT = { pasti: 3, cukup: 2, ragu: 1 };

function sisiBerkas(peran, penuntutKode) {
  if (penuntutKode === "0046") return 1;
  if (penuntutKode === "0047") return 2;
  const p = String(peran || "").toLowerCase();
  if (/jawab|duplik/.test(p)) return 2;
  if (/gugat|replik|kuasa/.test(p)) return 1;
  return 0;
}

/**
 * @param {object} m
 *   pihak        [{ pihakKe, urutan, pihakId, nama, email, telepon }]   SIPP perkara_pihak1/2 + pihak
 *   kuasa        [{ pihakKe, urutan, pengacaraId, nama, email, telepon }] SIPP perkara_pengacara aktif + pihak
 *   ecourtPihak  [{ nama, peran, email, telp }]                          aleta_bot_ecourt_pihak
 *   pengunggah   [{ peran, email }]                                       aleta_bot_ecourt_documents
 *   dokumen      [{ judul, peran, penuntutKode, teks }]                   teks berkas (dari portal)
 *   ukur         true = tanpa "cocokkan dengan isian SIPP" (alat ukur)
 * @returns { orang: [...], domisili: {1, 2}, tanpaPemilik: [...] }
 */
function susunKontak(m) {
  const masuk = m || {};
  const orang = [];
  for (const p of Array.isArray(masuk.pihak) ? masuk.pihak : []) {
    orang.push({
      jenis: "pihak",
      pihakKe: Number(p.pihakKe) || 0,
      urutan: Number(p.urutan) || 1,
      idSipp: p.pihakId == null ? "" : String(p.pihakId),
      nama: String(p.nama || "").trim(),
      sipp: { email: bakuEmail(p.email) || "", telepon: nomorSipp(p.telepon).map((x) => x.nilai), teleponAsli: String(p.telepon || "").trim(), emailAsli: String(p.email || "").trim() },
      calon: { email: [], hp: [] },
    });
  }
  for (const k of Array.isArray(masuk.kuasa) ? masuk.kuasa : []) {
    orang.push({
      jenis: "kuasa",
      pihakKe: Number(k.pihakKe) || 0,
      urutan: Number(k.urutan) || 1,
      idSipp: k.pengacaraId == null ? "" : String(k.pengacaraId),
      nama: String(k.nama || "").trim(),
      sipp: { email: bakuEmail(k.email) || "", telepon: nomorSipp(k.telepon).map((x) => x.nilai), teleponAsli: String(k.telepon || "").trim(), emailAsli: String(k.email || "").trim() },
      calon: { email: [], hp: [] },
    });
  }
  const di = (jenis, sisi) => orang.filter((o) => o.jenis === jenis && o.pihakKe === sisi).sort((a, b) => a.urutan - b.urutan);
  const tanpaPemilik = [];
  const taruh = (o, jenis, nilai, sumber) => {
    if (!o || !nilai) return;
    const wadah = jenis === "email" ? o.calon.email : o.calon.hp;
    wadah.push({ nilai, ...sumber });
  };
  const nilaiSippDi = (o, jenis) => (jenis === "email" ? (o.sipp.email ? [o.sipp.email] : []) : o.sipp.telepon);
  /**
   * Tempatkan satu kontak bersisi ke orang SIPP:
   *   1. nilainya SAMA dengan isian SIPP seseorang di sisi itu -> orang itu;
   *   2. hanya satu orang yang cocok golongannya -> orang itu (keyakinan sumber);
   *   3. lebih dari satu: nama yang tersebut di teks identitas sebelum kontak;
   *   4. kuasa sekantor (beberapa advokat, satu surel/telepon kantor) -> diusulkan
   *      "ragu" kepada setiap kuasa sisi itu yang kolomnya masih kosong;
   *   selain itu tidak diusulkan (tanpaPemilik).
   * milik "" (akun pengunggah): sisi berkuasa -> kuasa, selain itu pihak.
   */
  const tempatkan = (sisi, milik, jenis, nilai, sumber, segmen) => {
    const kuasa = sisi ? di("kuasa", sisi) : [];
    const pihak = sisi ? di("pihak", sisi) : [];
    const golongan = milik === "kuasa" ? kuasa : milik === "pihak" ? pihak : kuasa.length ? kuasa : pihak;
    if (!nilai) return;
    if (!golongan.length) {
      tanpaPemilik.push({ jenis, nilai, milik, sisi, ...sumber, keyakinan: "ragu" });
      return;
    }
    // masuk.ukur: aturan 1 dimatikan supaya ukuran ketepatan tidak melingkar.
    const sama = masuk.ukur ? [] : golongan.filter((o) => nilaiSippDi(o, jenis).includes(nilai));
    if (sama.length) {
      for (const o of sama) taruh(o, jenis, nilai, sumber);
      return;
    }
    if (golongan.length === 1) {
      taruh(golongan[0], jenis, nilai, sumber);
      return;
    }
    const teksNama = ` ${bakuNama(segmen || "")} `;
    const bernama = segmen ? golongan.filter((o) => bakuNama(o.nama).length >= 4 && teksNama.includes(` ${bakuNama(o.nama)} `)) : [];
    if (bernama.length === 1) {
      taruh(bernama[0], jenis, nilai, sumber);
      return;
    }
    if (golongan === kuasa) {
      const kosong = kuasa.filter((o) => !nilaiSippDi(o, jenis).length);
      for (const o of kosong) taruh(o, jenis, nilai, { ...sumber, keyakinan: "ragu", label: `${sumber.label} - kantor kuasa (dipakai bersama)` });
      if (kosong.length) return;
    }
    tanpaPemilik.push({ jenis, nilai, milik, sisi, ...sumber, keyakinan: "ragu" });
  };

  // akun: persetujuan pihak e-Court (nama + peran)
  for (const e of Array.isArray(masuk.ecourtPihak) ? masuk.ecourtPihak : []) {
    const peran = String(e.peran || "");
    const kuasa = /kuasa|advokat|pengacara/i.test(peran);
    const sisi = sisiDari(peran);
    const sumber = { asal: "akun", label: `akun e-Court ${peran || "pihak"}`.trim(), keyakinan: "cukup", kutipan: "", kodePola: "" };
    const email = bakuEmail(e.email);
    const hp = bakuNomor(e.telp);
    const n = bakuNama(e.nama);
    const o = n ? orang.find((x) => x.jenis === (kuasa ? "kuasa" : "pihak") && bakuNama(x.nama) === n) : null;
    if (o) {
      taruh(o, "email", email, sumber);
      if (hp) taruh(o, "hp", hp.nilai, { ...sumber, jenisNomor: hp.jenis });
      continue;
    }
    // Nama tidak sama: ditempatkan menurut sisi, dengan nama e-Court sebagai petunjuk.
    tempatkan(sisi, kuasa ? "kuasa" : "pihak", "email", email, sumber, e.nama);
    if (hp) tempatkan(sisi, kuasa ? "kuasa" : "pihak", "hp", hp.nilai, { ...sumber, jenisNomor: hp.jenis }, e.nama);
  }
  // akun: surel pengunggah dokumen e-Court
  const sudah = new Set();
  for (const u of Array.isArray(masuk.pengunggah) ? masuk.pengunggah : []) {
    const email = bakuEmail(u.email);
    const sisi = sisiDari(u.peran);
    if (!email || !sisi || sudah.has(`${sisi}|${email}`)) continue;
    sudah.add(`${sisi}|${email}`);
    const berkuasa = di("kuasa", sisi).length > 0;
    tempatkan(sisi, "", "email", email, {
      asal: "akun",
      label: `akun e-Court yang mengunggah berkas sebagai ${u.peran}${berkuasa ? " (sisi ini berkuasa - surel kuasanya)" : ""}`,
      keyakinan: "cukup",
      kutipan: "",
      kodePola: "",
    });
  }
  // teks berkas
  for (const d of Array.isArray(masuk.dokumen) ? masuk.dokumen : []) {
    const sisiPengunggah = sisiBerkas(d.peran, d.penuntutKode);
    for (const k of kontakDariTeks(d.teks, { sisiPengunggah })) {
      const sumber = {
        asal: "teks",
        label: `e-Court: ${String(d.judul || "berkas").slice(0, 120)}${k.domisili ? " (domisili elektronik)" : ""}`,
        keyakinan: k.yakinLabel === "pasti" ? "cukup" : "ragu",
        kutipan: k.kutipan,
        kodePola: k.kodePola,
        jenisNomor: k.jenis === "email" ? undefined : k.jenis,
        domisili: k.domisili,
      };
      if (!k.sisi) {
        tanpaPemilik.push({ jenis: k.jenis === "email" ? "email" : "hp", nilai: k.nilai, milik: k.milik, sisi: 0, ...sumber, keyakinan: "ragu" });
        continue;
      }
      tempatkan(k.sisi, k.milik, k.jenis === "email" ? "email" : "hp", k.nilai, sumber, k.segmen);
    }
  }

  // Pilih satu usulan per kolom: sumber terkuat; nilai yang berselisih menurunkan keyakinan.
  const pilih = (daftar, nilaiSipp, jenisKolom) => {
    if (!daftar.length) return null;
    const urut = [...daftar].sort((a, b) => {
      const pa = (PANGKAT[a.keyakinan] || 0) * 10 + (a.asal === "akun" ? 2 : 0) + (a.jenisNomor === "telepon" ? -5 : 0);
      const pb = (PANGKAT[b.keyakinan] || 0) * 10 + (b.asal === "akun" ? 2 : 0) + (b.jenisNomor === "telepon" ? -5 : 0);
      return pb - pa;
    });
    const atas = urut[0];
    const nilaiLain = [...new Set(urut.map((x) => x.nilai))].filter((v) => v !== atas.nilai);
    const setingkat = urut.filter((x) => x.nilai !== atas.nilai && x.keyakinan === atas.keyakinan && x.asal === atas.asal);
    const keyakinan = setingkat.length ? "ragu" : atas.keyakinan;
    const sipp = Array.isArray(nilaiSipp) ? nilaiSipp : nilaiSipp ? [nilaiSipp] : [];
    const terhadapSipp = !sipp.length ? "kosong" : sipp.includes(atas.nilai) ? "sama" : "beda";
    return {
      nilai: atas.nilai,
      keyakinan,
      terhadapSipp,
      jenisNomor: jenisKolom === "hp" ? atas.jenisNomor || "hp" : undefined,
      domisili: urut.some((x) => x.nilai === atas.nilai && x.domisili),
      sumber: urut.filter((x) => x.nilai === atas.nilai).map((x) => ({ asal: x.asal, label: x.label, kutipan: x.kutipan || "", kodePola: x.kodePola || "" })),
      nilaiLain,
      terlaluPanjang: jenisKolom === "email" && atas.nilai.length > BATAS_EMAIL_SIPP,
    };
  };

  const hasilOrang = orang.map((o) => ({
    jenis: o.jenis,
    pihakKe: o.pihakKe,
    urutan: o.urutan,
    idSipp: o.idSipp,
    nama: o.nama,
    sipp: { email: o.sipp.emailAsli, telepon: o.sipp.teleponAsli },
    usulan: { email: pilih(o.calon.email, o.sipp.email, "email"), hp: pilih(o.calon.hp, o.sipp.telepon, "hp") },
  }));

  // Domisili elektronik per sisi: email kuasa bila sisi itu berkuasa, selain itu email pihak urutan 1.
  const domisili = {};
  for (const sisi of [1, 2]) {
    const kuasa = hasilOrang.find((o) => o.jenis === "kuasa" && o.pihakKe === sisi);
    const pihak = hasilOrang.filter((o) => o.jenis === "pihak" && o.pihakKe === sisi).sort((a, b) => a.urutan - b.urutan)[0];
    const sumberO = kuasa || pihak;
    if (!sumberO) {
      domisili[sisi] = null;
      continue;
    }
    const emailSipp = bakuEmail(sumberO.sipp.email);
    const u = sumberO.usulan.email;
    domisili[sisi] = emailSipp
      ? { email: emailSipp, milik: sumberO.jenis, asal: "sipp", keyakinan: "pasti", nama: sumberO.nama }
      : u
        ? { email: u.nilai, milik: sumberO.jenis, asal: u.sumber[0] ? u.sumber[0].asal : "", keyakinan: u.keyakinan, nama: sumberO.nama }
        : { email: "", milik: sumberO.jenis, asal: "", keyakinan: "", nama: sumberO.nama };
  }
  return { orang: hasilOrang, domisili, tanpaPemilik };
}

/**
 * Baris tabel ringkasan dari hasil susunKontak - HANYA nilai dari e-Court
 * (SIPP dibaca langsung oleh variabel ABT, jadi isian petugas selalu menang).
 *   kontak.p<ke>.<urutan>.email | .hp     pihak
 *   kontak.k<ke>.<urutan>.email | .hp     kuasa
 */
function barisRingkasan(susun) {
  const baris = [];
  for (const o of (susun && susun.orang) || []) {
    if (!o.pihakKe) continue;
    const awalan = `kontak.${o.jenis === "kuasa" ? "k" : "p"}${o.pihakKe}.${o.urutan}`;
    for (const kolom of ["email", "hp"]) {
      const u = o.usulan[kolom];
      if (!u || !u.nilai || u.terlaluPanjang) continue;
      if (kolom === "hp" && u.jenisNomor === "telepon") continue;
      baris.push({
        kunci: `${awalan}.${kolom}`,
        nilai: u.nilai,
        keyakinan: u.keyakinan,
        asal: u.sumber[0] ? u.sumber[0].asal : "",
        sumber: (u.sumber[0] ? u.sumber[0].label : "").slice(0, 250),
      });
    }
  }
  return baris;
}

/** Usulan B2 (isi-gugatan) -> baris ringkasan abt.<kode> (data mentah untuk variabel ABT berikutnya). */
function barisDariUsulanAbt(usulan) {
  const baris = [];
  for (const u of Array.isArray(usulan) ? usulan : []) {
    if (!u || !/^\d{4}$/.test(String(u.kode || "")) || !String(u.nilai || "").trim()) continue;
    baris.push({
      kunci: `abt.${u.kode}`,
      nilai: String(u.nilai).slice(0, 4000),
      keyakinan: u.keyakinan || "ragu",
      asal: "teks",
      sumber: String((u.sumber && u.sumber[0] && u.sumber[0].kalimat) || "").slice(0, 250),
    });
  }
  return baris;
}

/* ─── 4. Basis data ─────────────────────────────────────────────────────── */

const TABEL_RINGKASAN = "aleta_bot_ecourt_ringkasan";

/**
 * Satu baris per (nomor perkara, kunci). Kunci alaminya diringkas menjadi id
 * sha256 - dua kolom teks utf8mb4 melewati batas kunci 767 byte MySQL lama
 * (pola yang sama dengan aleta_bot_ecourt_pihak). DDL yang SAMA dipasang paket
 * ABT abt-data-ecourt (CREATE TABLE IF NOT EXISTS) supaya variabel ABT tidak
 * pernah galat walau bot belum sempat menulis.
 */
const DDL_RINGKASAN = `CREATE TABLE IF NOT EXISTS ${TABEL_RINGKASAN} (
  id CHAR(64) NOT NULL PRIMARY KEY,
  perkara_id BIGINT NULL,
  nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
  kunci VARCHAR(64) NOT NULL,
  nilai TEXT,
  keyakinan VARCHAR(16) NOT NULL DEFAULT 'ragu',
  asal VARCHAR(16) NOT NULL DEFAULT '',
  sumber VARCHAR(255) NOT NULL DEFAULT '',
  diperbarui DATETIME NOT NULL,
  INDEX idx_aber_perkara (perkara_id, kunci),
  INDEX idx_aber_nomor (nomor_perkara)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

function idBaris(nomor, kunci) {
  return crypto.createHash("sha256").update(`${nomor}\u0000${kunci}`).digest("hex");
}

let skemaSiap = null;
function botDb() {
  return require("./botDbService");
}

async function pastikanSkema() {
  if (!skemaSiap) {
    skemaSiap = (async () => {
      await botDb().query(DDL_RINGKASAN);
      // diperbarui disimpan UTC; isi lama (jam proses) dipindah dulu.
      if (typeof botDb().pastikanUtc === "function") await botDb().pastikanUtc();
      return true;
    })().catch((e) => {
      skemaSiap = null;
      throw e;
    });
  }
  return skemaSiap;
}

/**
 * Tulis baris ringkasan satu perkara.
 * @param opsi.hapusAsal  asal ('teks' / 'akun') yang barisnya - berawalan sama - dihapus bila tidak ada lagi
 * @param opsi.awalan     awalan kunci yang dikelola tulisan ini ('kontak.' / 'abt.')
 */
async function simpanRingkasan(perkaraId, nomorPerkara, baris, opsi) {
  const o = opsi || {};
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return { ditulis: 0 };
  await pastikanSkema();
  const sekarang = botDb().toMysqlDate(new Date());
  let ditulis = 0;
  for (const b of baris) {
    await botDb().query(
      `INSERT INTO ${TABEL_RINGKASAN} (id, perkara_id, nomor_perkara, kunci, nilai, keyakinan, asal, sumber, diperbarui)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE perkara_id = VALUES(perkara_id), nilai = VALUES(nilai), keyakinan = VALUES(keyakinan),
         asal = VALUES(asal), sumber = VALUES(sumber), diperbarui = VALUES(diperbarui)`,
      [idBaris(nomor, b.kunci), perkaraId || null, nomor, b.kunci, b.nilai, b.keyakinan || "ragu", b.asal || "", b.sumber || "", sekarang]
    );
    ditulis += 1;
  }
  if (o.awalan && Array.isArray(o.hapusAsal) && o.hapusAsal.length) {
    const tetap = baris.map((b) => b.kunci);
    await botDb().query(
      `DELETE FROM ${TABEL_RINGKASAN} WHERE nomor_perkara = ? AND kunci LIKE ? AND asal IN (?)${tetap.length ? " AND kunci NOT IN (?)" : ""}`,
      tetap.length ? [nomor, `${o.awalan}%`, o.hapusAsal, tetap] : [nomor, `${o.awalan}%`, o.hapusAsal]
    );
  }
  return { ditulis };
}

function sippQuery(sql, params) {
  const db = require("../db_config");
  return new Promise((ok, gagal) => db.query(sql, params || [], (e, r) => (e ? gagal(e) : ok(r))));
}

/** Perkara SIPP dari nomor (atau perkara_id). */
async function cariPerkara({ nomorPerkara, perkaraId }) {
  if (perkaraId) {
    const r = await sippQuery("SELECT perkara_id, nomor_perkara FROM perkara WHERE perkara_id = ? LIMIT 1", [perkaraId]);
    return r && r[0] ? { perkaraId: Number(r[0].perkara_id), nomorPerkara: String(r[0].nomor_perkara) } : null;
  }
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const r = await sippQuery("SELECT perkara_id, nomor_perkara FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
  return r && r[0] ? { perkaraId: Number(r[0].perkara_id), nomorPerkara: String(r[0].nomor_perkara) } : null;
}

/** Perkara e-Court terbaru tempat orang bernama itu menjadi pihak/kuasa (borang Data Pihak di luar halaman perkara). */
async function cariPerkaraDariNama(nama) {
  const n = String(nama || "").trim();
  if (n.length < 3) return { perkara: null, sebab: "nama_kosong" };
  const r = await sippQuery(
    `SELECT x.perkara_id, x.nomor_perkara FROM (
       SELECT p.perkara_id, p.nomor_perkara FROM perkara_pihak1 pp JOIN perkara p ON p.perkara_id = pp.perkara_id
         JOIN perkara_efiling_id e ON e.perkara_id = p.perkara_id AND e.efiling_id <> '' WHERE pp.nama = ?
       UNION SELECT p.perkara_id, p.nomor_perkara FROM perkara_pihak2 pp JOIN perkara p ON p.perkara_id = pp.perkara_id
         JOIN perkara_efiling_id e ON e.perkara_id = p.perkara_id AND e.efiling_id <> '' WHERE pp.nama = ?
       UNION SELECT p.perkara_id, p.nomor_perkara FROM perkara_pengacara pa JOIN perkara p ON p.perkara_id = pa.perkara_id
         JOIN perkara_efiling_id e ON e.perkara_id = p.perkara_id AND e.efiling_id <> '' WHERE pa.nama = ?
     ) x ORDER BY x.perkara_id DESC LIMIT 3`,
    [n, n, n]
  );
  if (!r || !r.length) return { perkara: null, sebab: "tidak_ada_perkara_ecourt" };
  return { perkara: { perkaraId: Number(r[0].perkara_id), nomorPerkara: String(r[0].nomor_perkara) }, lain: r.length - 1 };
}

/** Bahan dari SIPP dan database ALETA untuk satu perkara. Hanya SELECT. */
async function bahanPerkara(perkara) {
  const id = perkara.perkaraId;
  const [pihak, kuasa] = await Promise.all([
    sippQuery(
      `SELECT 1 AS pihak_ke, pp.urutan, pp.pihak_id, pp.nama, p.email, p.telepon
         FROM perkara_pihak1 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ?
       UNION ALL
       SELECT 2 AS pihak_ke, pp.urutan, pp.pihak_id, pp.nama, p.email, p.telepon
         FROM perkara_pihak2 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ?`,
      [id, id]
    ),
    sippQuery(
      `SELECT pa.pihak_ke, pa.urutan, pa.pengacara_id, pa.nama, p.email, p.telepon
         FROM perkara_pengacara pa LEFT JOIN pihak p ON p.id = pa.pengacara_id
        WHERE pa.perkara_id = ? AND (pa.aktif IS NULL OR pa.aktif = 'Y') AND pa.pihak_ke IN (1, 2)`,
      [id]
    ),
  ]);
  let ecourtPihak = [];
  let pengunggah = [];
  try {
    const { normalizeCaseNumber } = require("./ecourtTextService");
    const nomor = normalizeCaseNumber(perkara.nomorPerkara);
    [ecourtPihak, pengunggah] = await Promise.all([
      botDb().query("SELECT nama, peran, email, telp FROM aleta_bot_ecourt_pihak WHERE nomor_perkara = ?", [nomor]),
      botDb().query(
        `SELECT DISTINCT peran_pengunggah AS peran, email_pengunggah AS email FROM aleta_bot_ecourt_documents
          WHERE (perkara_id = ? OR nomor_perkara = ?) AND email_pengunggah <> ''`,
        [id, nomor]
      ),
    ]);
  } catch {
    // tanpa database ALETA: SIPP + teks saja
  }
  return {
    pihak: (pihak || []).map((b) => ({ pihakKe: Number(b.pihak_ke), urutan: Number(b.urutan) || 1, pihakId: b.pihak_id, nama: b.nama, email: b.email, telepon: b.telepon })),
    kuasa: (kuasa || []).map((b) => ({ pihakKe: Number(b.pihak_ke), urutan: Number(b.urutan) || 1, pengacaraId: b.pengacara_id, nama: b.nama, email: b.email, telepon: b.telepon })),
    ecourtPihak: ecourtPihak || [],
    pengunggah: pengunggah || [],
  };
}

/* === ELITIGASI-7139 17 Okt === */
/**
 * ELITIGASI-7139 (17 Okt 2026): FAKTA untuk mengisi otomatis variabel ABT #7139# (1 = e-litigasi penuh,
 * 2 = hybrid). Bot hanya memberi FAKTA; keputusan 1/2 diambil panel ABT (abt.js, blok ELITIGASI-7139) agar
 * isian manual selalu menang. Hanya SELECT.
 *
 *   lewatEcourt    perkara terdaftar lewat e-Court (perkara_efiling_id), true/false; null = tidak terbaca
 *   tergugatHadir  Tergugat (pihak kedua) pernah hadir di satu sidang: true/false; null = belum ada sidang
 *                  yang kehadirannya tercatat (jangan ditebak: perkara baru belum disidang)
 *   jumlahSidang   banyaknya sidang yang kehadirannya tercatat
 *
 * Sandi perkara_jadwal_sidang.dihadiri_oleh (borang SIPP): 1 Semua Pihak, 2 Pihak Pertama saja, 3 Pihak Kedua
 * saja, 4 Para Pihak Tidak Hadir, 8 T+Intervensi, 9 P+T (ada intervensi), 11 Sebagian Tergugat, 15 T+Turut T.
 * Yang lain (5, 7, 10, 13, 14) tidak menyebut Tergugat hadir.
 */
const SANDI_TERGUGAT_HADIR = Object.freeze([1, 3, 8, 9, 11, 15]);

/** Murni: baris sidang [{ dihadiri }] -> { tergugatHadir: true|false|null, jumlahSidang }. */
function tergugatHadirDariSidang(baris) {
  const kode = (Array.isArray(baris) ? baris : [])
    .map((b) => Number(b && (b.dihadiri !== undefined ? b.dihadiri : b.dihadiri_oleh)))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!kode.length) return { tergugatHadir: null, jumlahSidang: 0 };
  return { tergugatHadir: kode.some((n) => SANDI_TERGUGAT_HADIR.includes(n)), jumlahSidang: kode.length };
}

async function faktaElitigasi(perkara) {
  const hasil = { lewatEcourt: null, tergugatHadir: null, jumlahSidang: 0 };
  try {
    const r = await sippQuery("SELECT 1 AS ada FROM perkara_efiling_id WHERE perkara_id = ? AND efiling_id <> '' LIMIT 1", [perkara.perkaraId]);
    hasil.lewatEcourt = Array.isArray(r) && r.length > 0;
  } catch {
    /* tidak terbaca: tetap null */
  }
  try {
    const r = await sippQuery(
      "SELECT dihadiri_oleh AS dihadiri FROM perkara_jadwal_sidang WHERE perkara_id = ? AND dihadiri_oleh IS NOT NULL AND dihadiri_oleh <> ''",
      [perkara.perkaraId]
    );
    Object.assign(hasil, tergugatHadirDariSidang(r));
  } catch {
    /* tidak terbaca: tetap null */
  }
  return hasil;
}
/* === AKHIR ELITIGASI-7139 === */

/**
 * Kontak satu perkara: bahan SIPP + ALETA (+ teks berkas bila dikirim portal),
 * lalu ringkasannya ditulis (kecuali opsi.simpan === false).
 */
async function kontakPerkara(masukan) {
  const m = masukan || {};
  let perkara = await cariPerkara({ nomorPerkara: m.nomorPerkara, perkaraId: m.perkaraId }).catch(() => null);
  let dariNama = null;
  if (!perkara && m.nama) {
    dariNama = await cariPerkaraDariNama(m.nama).catch(() => ({ perkara: null, sebab: "sipp_tidak_terbaca" }));
    perkara = dariNama.perkara;
  }
  if (!perkara) return { ok: true, ada: false, sebab: (dariNama && dariNama.sebab) || "perkara_tidak_ditemukan", orang: [], domisili: {}, tanpaPemilik: [] };
  const bahan = await bahanPerkara(perkara);
  const dokumen = (Array.isArray(m.dokumen) ? m.dokumen : []).slice(0, 10).map((d) => ({
    judul: String((d && d.judul) || "").slice(0, 160),
    peran: String((d && d.peran) || ""),
    penuntutKode: d && (d.penuntutKode === "0046" || d.penuntutKode === "0047") ? d.penuntutKode : "",
    teks: String((d && d.teks) || "").slice(0, 200000),
  }));
  const susun = susunKontak({ ...bahan, dokumen });
  let tersimpan = 0;
  if (m.simpan !== false) {
    const baris = barisRingkasan(susun);
    const r = await simpanRingkasan(perkara.perkaraId, perkara.nomorPerkara, baris, {
      awalan: "kontak.",
      // tanpa teks: baris dari teks yang pernah ditulis panel TIDAK dihapus
      hapusAsal: dokumen.length ? ["teks", "akun"] : ["akun"],
    }).catch(() => ({ ditulis: 0 }));
    tersimpan = r.ditulis;
  }
  // ELITIGASI-7139: fakta untuk #7139# (panel ABT yang memutuskan).
  const elitigasi = await faktaElitigasi(perkara).catch(() => null);
  return { ok: true, ada: true, perkaraId: perkara.perkaraId, nomorPerkara: perkara.nomorPerkara, dariNama: Boolean(dariNama), tersimpan, elitigasi, ...susun };
}

/* === STATUS-ZIP 12 Okt === */

/* ─── 4b. Kontak para pihak untuk layar Status Perkara (butir 12, 12 Okt 2026) ─── */

/**
 * "tambahkan identitas email dan nomor whatsapp pihak pada kolom para pihak, sama
 * keterangan bersedia sidang secara elektronik (dari e-court yang bersedia
 * bersidang secara e-litigasi) di status perkara".
 *
 * SUMBER (jujur, per ruas):
 *   email, HP/WhatsApp  SIPP dulu (pihak.email / pihak.telepon lewat perkara_pihakN dan
 *                       perkara_pengacara); bila kosong, usulan e-Court dari akun
 *                       (aleta_bot_ecourt_pihak, surel pengunggah) - dengan TANDA SUMBER.
 *                       Bila SIPP dan e-Court berbeda, nilai e-Court ikut disebut (`lain`).
 *   bersedia e-Litigasi aleta_bot_ecourt_pihak.persetujuan = bagian "Persetujuan Pihak
 *                       Menggunakan Saluran Elektronik" pada Detil Pendaftaran e-Court yang
 *                       ditarik jembatan e-Court: setuju (centang hijau) = ya, tidak_setuju =
 *                       tidak, belum = belum menjawab. Yang tidak terbaca TIDAK DITEBAK:
 *                       "tidak-diketahui" beserta sebabnya (bukan perkara e-Court, pihak
 *                       belum ditarik, tabel tidak terbaca). Kuasa tidak punya persetujuan
 *                       sendiri ("tidak-berlaku").
 *
 * Hanya SELECT; tidak menulis SIPP, ABT, maupun aleta_bot_ecourt_ringkasan. Nilai kontak
 * TIDAK dicatat ke log. Hak lihat dijaga PORTAL (data pribadi).
 */
/**
 * Dua nama sama bila nama bakunya sama (tanpa "bin/binti ..." dan gelar) ATAU seluruh
 * kata namanya sama dengan "bin/binti" dibuang - e-Court kerap menulis "JOKO SAMIN"
 * sedangkan SIPP "JOKO bin SAMIN".
 */
function samaNamaPihak(a, b) {
  const x = bakuNama(a);
  const y = bakuNama(b);
  if (x && x === y) return true;
  const kata = (t) =>
    String(t || "")
      .toLowerCase()
      .replace(/[^a-z]+/g, " ")
      .split(" ")
      .filter((k) => k && k !== "bin" && k !== "binti" && k !== "bte")
      .join(" ");
  const p = kata(a);
  return Boolean(p) && p === kata(b);
}

function nilaiKosongSipp(teks) {
  return /^[-0.\s]*$/.test(String(teks == null ? "" : teks));
}

/** Nilai kontak untuk tampilan: yang baku bila sah, selain itu apa adanya dengan tanda tak lazim. */
function emailTampil(asli) {
  if (nilaiKosongSipp(asli)) return null;
  const baku = bakuEmail(asli);
  return baku ? { nilai: baku, lazim: true } : { nilai: String(asli).trim().slice(0, 120), lazim: false };
}

function hpTampil(asli) {
  if (nilaiKosongSipp(asli)) return null;
  const daftar = nomorSipp(asli);
  if (daftar.length) return { nilai: daftar.map((x) => x.nilai).join(" / "), jenis: daftar[0].jenis, lazim: true };
  return { nilai: String(asli).trim().slice(0, 60), jenis: "", lazim: false };
}

/**
 * Murni: dari hasil susunKontak (`orang`) dan baris persetujuan e-Court menjadi baris layar.
 * @param {{ orang: object[], ecourtPihak: Array<{nama,peran,email,telp,persetujuan,terakhirTerlihat}>,
 *           ecourtTerbaca: boolean, lewatEcourt: boolean }} m
 */
function susunKontakStatus(m) {
  const orang = Array.isArray(m && m.orang) ? m.orang : [];
  const ecourt = Array.isArray(m && m.ecourtPihak) ? m.ecourtPihak : [];
  const ecourtTerbaca = !(m && m.ecourtTerbaca === false);
  const lewatEcourt = Boolean(m && m.lewatEcourt);

  const persetujuanDari = (o) => {
    if (o.jenis === "kuasa") {
      const kuasa = ecourt.find((e) => /kuasa|advokat|pengacara/i.test(String(e.peran || "")) && samaNamaPihak(e.nama, o.nama));
      if (!kuasa) {
        return { status: "tidak-berlaku", sumber: "", label: "Kuasa tidak mengisi persetujuan sendiri - lihat pihak yang diwakilinya.", terakhirTerlihat: null };
      }
      return jawabPersetujuan(kuasa);
    }
    if (!lewatEcourt) {
      return { status: "tidak-diketahui", sumber: "", label: "Bukan perkara e-Court - tidak ada data persetujuan e-Litigasi.", terakhirTerlihat: null };
    }
    if (!ecourtTerbaca) {
      return { status: "tidak-diketahui", sumber: "", label: "Tabel persetujuan e-Court tidak terbaca dari ALETA Bot.", terakhirTerlihat: null };
    }
    const cocok = o.nama ? ecourt.find((e) => !/kuasa|advokat|pengacara/i.test(String(e.peran || "")) && samaNamaPihak(e.nama, o.nama)) : null;
    if (!cocok) {
      return {
        status: "tidak-diketahui",
        sumber: "",
        label: "Pihak ini belum terbaca pada persetujuan e-Court - tarik perkara dari Kendali Berkas bila ingin memastikan.",
        terakhirTerlihat: null,
      };
    }
    return jawabPersetujuan(cocok);
  };
  const jawabPersetujuan = (e) => {
    const nilai = String(e.persetujuan || "belum");
    const status = nilai === "setuju" ? "ya" : nilai === "tidak_setuju" ? "tidak" : "belum";
    return {
      status,
      sumber: "ecourt",
      label:
        status === "ya"
          ? "Bersedia sidang elektronik (persetujuan saluran elektronik e-Court)."
          : status === "tidak"
            ? "Menolak sidang elektronik (persetujuan saluran elektronik e-Court)."
            : "Belum menjawab persetujuan sidang elektronik di e-Court.",
      terakhirTerlihat: e.terakhirTerlihat || null,
    };
  };

  return orang.map((o) => {
    // Pada keluaran susunKontak, sipp.email / sipp.telepon = isian SIPP APA ADANYA.
    const emailSipp = emailTampil(o.sipp && o.sipp.email);
    const hpSipp = hpTampil(o.sipp && o.sipp.telepon);
    const uEmail = o.usulan && o.usulan.email;
    const uHp = o.usulan && o.usulan.hp;
    const labelEcourt = (u) => (u && u.sumber && u.sumber[0] ? String(u.sumber[0].label || "e-Court") : "e-Court");

    const email = emailSipp
      ? { nilai: emailSipp.nilai, lazim: emailSipp.lazim, sumber: "sipp", label: "SIPP", lain: uEmail && uEmail.nilai && uEmail.nilai !== emailSipp.nilai ? [{ nilai: uEmail.nilai, sumber: "ecourt", label: labelEcourt(uEmail) }] : [] }
      : uEmail && uEmail.nilai
        ? { nilai: uEmail.nilai, lazim: true, sumber: "ecourt", label: labelEcourt(uEmail), keyakinan: uEmail.keyakinan || "ragu", lain: [] }
        : { nilai: "", lazim: true, sumber: "", label: "", lain: [] };
    const hp = hpSipp
      ? {
          nilai: hpSipp.nilai,
          jenis: hpSipp.jenis,
          lazim: hpSipp.lazim,
          sumber: "sipp",
          label: "SIPP",
          lain: uHp && uHp.nilai && !hpSipp.nilai.split(" / ").includes(uHp.nilai) ? [{ nilai: uHp.nilai, sumber: "ecourt", label: labelEcourt(uHp) }] : [],
        }
      : uHp && uHp.nilai
        ? { nilai: uHp.nilai, jenis: uHp.jenisNomor || "hp", lazim: true, sumber: "ecourt", label: labelEcourt(uHp), keyakinan: uHp.keyakinan || "ragu", lain: [] }
        : { nilai: "", jenis: "", lazim: true, sumber: "", label: "", lain: [] };

    return {
      jenis: o.jenis,
      pihakKe: o.pihakKe,
      urutan: o.urutan,
      nama: o.nama,
      email,
      // "WhatsApp" hanya untuk nomor HP (08...); telepon rumah/kantor bukan WhatsApp.
      hp: { ...hp, bisaWhatsApp: hp.jenis === "hp" },
      elitigasi: persetujuanDari(o),
    };
  });
}

async function kontakParaPihak(nomorPerkara) {
  const perkara = await cariPerkara({ nomorPerkara }).catch(() => null);
  if (!perkara) return { ok: true, ada: false, sebab: "perkara_tidak_ditemukan", orang: [] };
  const bahan = await bahanPerkara(perkara);
  const susun = susunKontak({ ...bahan, dokumen: [] });

  let ecourtPihak = [];
  let ecourtTerbaca = true;
  try {
    const { normalizeCaseNumber } = require("./ecourtTextService");
    ecourtPihak = await botDb().query(
      "SELECT nama, peran, email, telp, persetujuan, terakhir_terlihat AS terakhirTerlihat FROM aleta_bot_ecourt_pihak WHERE nomor_perkara = ?",
      [normalizeCaseNumber(perkara.nomorPerkara)]
    );
  } catch {
    ecourtTerbaca = false;
  }
  let lewatEcourt = false;
  try {
    const r = await sippQuery("SELECT 1 AS ada FROM perkara_efiling_id WHERE perkara_id = ? AND efiling_id <> '' LIMIT 1", [perkara.perkaraId]);
    lewatEcourt = Array.isArray(r) && r.length > 0;
  } catch {
    lewatEcourt = ecourtPihak.length > 0;
  }

  return {
    ok: true,
    ada: true,
    perkaraId: perkara.perkaraId,
    nomorPerkara: perkara.nomorPerkara,
    lewatEcourt,
    ecourtTerbaca,
    jumlahPersetujuanEcourt: ecourtPihak.length,
    orang: susunKontakStatus({ orang: susun.orang, ecourtPihak, ecourtTerbaca, lewatEcourt }),
  };
}

/* === AKHIR STATUS-ZIP === */

/* ─── 5. Penjadwal ringkasan (tanpa panel) ──────────────────────────────── */

const SELA_MS = Math.max(5 * 60 * 1000, Number(process.env.ALETA_RINGKASAN_ECOURT_SELA_MS || 60 * 60 * 1000));
const HARI_BELAKANG = Math.max(30, Number(process.env.ALETA_RINGKASAN_ECOURT_HARI || 400));
const BATAS_PERKARA = Math.max(10, Number(process.env.ALETA_RINGKASAN_ECOURT_BATAS || 600));
let pewaktu = null;
let jalan = false;

/** Satu putaran: kontak dari SIPP + akun e-Court untuk perkara e-Court terbaru. */
async function jalankanRingkasan() {
  if (jalan) return { dilewati: true };
  jalan = true;
  const mulai = Date.now();
  let diperiksa = 0;
  let baris = 0;
  try {
    const daftar = await sippQuery(
      `SELECT p.perkara_id, p.nomor_perkara FROM perkara_efiling_id e JOIN perkara p ON p.perkara_id = e.perkara_id
        WHERE e.efiling_id <> '' AND p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY p.perkara_id DESC LIMIT ?`,
      [HARI_BELAKANG, BATAS_PERKARA]
    );
    for (const r of daftar || []) {
      const perkara = { perkaraId: Number(r.perkara_id), nomorPerkara: String(r.nomor_perkara) };
      const bahan = await bahanPerkara(perkara);
      const susun = susunKontak(bahan);
      const tulis = barisRingkasan(susun);
      const h = await simpanRingkasan(perkara.perkaraId, perkara.nomorPerkara, tulis, { awalan: "kontak.", hapusAsal: ["akun"] });
      diperiksa += 1;
      baris += h.ditulis;
    }
    return { ok: true, diperiksa, baris, ms: Date.now() - mulai };
  } catch (e) {
    return { ok: false, diperiksa, baris, sebab: String((e && e.code) || (e && e.message) || e).slice(0, 120) };
  } finally {
    jalan = false;
  }
}

function mulai() {
  if (pewaktu || String(process.env.ALETA_RINGKASAN_ECOURT_AKTIF || "1") === "0") return false;
  const putar = () => {
    void jalankanRingkasan().then((h) => {
      if (h && h.ok === false) console.warn(`[ringkasan e-Court] putaran gagal: ${h.sebab}`);
    });
  };
  const awal = setTimeout(putar, 2 * 60 * 1000);
  if (awal.unref) awal.unref();
  pewaktu = setInterval(putar, SELA_MS);
  if (pewaktu.unref) pewaktu.unref();
  return true;
}

module.exports = {
  bakuEmail,
  bakuNomor,
  nomorSipp,
  bakuNama,
  sisiDari,
  kontakDariTeks,
  susunKontak,
  barisRingkasan,
  barisDariUsulanAbt,
  simpanRingkasan,
  kontakPerkara,
  tergugatHadirDariSidang,
  /* === STATUS-ZIP 12 Okt === */
  kontakParaPihak,
  susunKontakStatus,
  /* === AKHIR STATUS-ZIP === */
  jalankanRingkasan,
  mulai,
  DDL_RINGKASAN,
  TABEL_RINGKASAN,
  idBaris,
};
