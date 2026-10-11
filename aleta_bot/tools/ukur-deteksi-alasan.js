#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * UKUR DETEKSI ALASAN (P1), FAKTA WAKTU (P2), PELAKU (P3), KESESUAIAN (S6)
 * ============================================================================
 *
 * BACA SAJA. Tidak satu pun tabel SIPP/ABT ditulis - hanya SELECT.
 *
 * Perkara yang SUDAH diputus dibaca seolah belum diputus: keterangan kedua
 * saksi (aps_badilag.abt_keterangan_saksi) + posita SIPP masuk ke mesin
 * deteksi, lalu hasilnya dibandingkan dengan yang ditulis manusia:
 *   - huruf alasan     ABT variabel 8503 (abt_data_teks)
 *   - sebab perceraian SIPP perkara_akta_cerai.faktor_perceraian_id (+ sekunder)
 *                      dan isian 5227 petugas (abt_data_teks)
 *   - fakta waktu      ABT 0222 / 0246 / 9944 (abt_data_teks)
 *
 * Pakai (dari folder aleta_bot):
 *   node tools/ukur-deteksi-alasan.js ambil <cache.json>     baca MySQL -> berkas
 *   node tools/ukur-deteksi-alasan.js ukur  <cache.json> [hasil.json]
 *   node tools/ukur-deteksi-alasan.js       (ambil + ukur langsung)
 *
 * Sambungan: env UKUR_MYSQL_HOST/PORT/USER/PASSWORD, DB SIPP UKUR_DB_SIPP
 * (bawaan sipp_donggala) dan ABT UKUR_DB_ABT (bawaan aps_badilag).
 */

const fs = require("fs");
const path = require("path");

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Kode faktor_perceraian SIPP -> kunci sebab mesin deteksi (kamus alasan.json "sebab").
const FAKTOR_SIPP = {
  1: "zina",
  2: "mabuk",
  3: "obat terlarang",
  4: "judi",
  5: "meninggalkan",
  6: "salah satu pihak menjalani pidana penjara",
  7: "kekerasan dalam rumah tangga",
  8: "cacat badan atau penyakit",
  9: "perselisihan terus-menerus",
  10: "kawin paksa",
  11: "murtad/pindah agama",
  12: "masalah ekonomi",
  13: "menikah lagi",
};

function polos(html) {
  return String(html || "")
    .replace(/\r?\n/g, " ")
    .replace(/<\/(p|li|div|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .split("\n")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Jawaban saksi ABT -> teks BAS berbutir "- Bahwa ..." (bentuk yang dikirim ekstensi). */
function teksSaksi(rows) {
  return rows
    .map((r) => String(r.jawaban || ""))
    .filter((j) => j !== "" && j !== "0")
    .map((j) => `- Bahwa ${j.charAt(0).toLowerCase()}${j.slice(1)}`.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " "))
    .join("\n");
}

async function ambil() {
  const mysql = require("mysql");
  const db = mysql.createConnection({
    host: process.env.UKUR_MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.UKUR_MYSQL_PORT || 3306),
    user: process.env.UKUR_MYSQL_USER || "root",
    password: process.env.UKUR_MYSQL_PASSWORD || "",
    database: process.env.UKUR_DB_SIPP || "sipp_donggala",
  });
  const ABT = process.env.UKUR_DB_ABT || "aps_badilag";
  const q = (sql, v) => new Promise((ok, no) => db.query(sql, v || [], (e, r) => (e ? no(e) : ok(r))));
  try {
    // Hanya perkara yang SUDAH diputus dan punya keterangan saksi di ABT.
    const pk = await q(
      `SELECT p.perkara_id, p.nomor_perkara, p.posita, p.alur_perkara_id, p.jenis_perkara_id, pp.tanggal_putusan,
              ac.faktor_perceraian_id f1, ac.faktor_perceraian_sekunder_id f2
         FROM perkara p
         JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id AND pp.tanggal_putusan IS NOT NULL
         LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = p.perkara_id
        WHERE p.perkara_id IN (SELECT DISTINCT perkara_id FROM ${ABT}.abt_keterangan_saksi)`
    );
    const ids = pk.map((p) => p.perkara_id);
    if (!ids.length) return [];
    const ket = await q(
      `SELECT k.perkara_id, k.sidang_id, k.jawaban, p5.urutan
         FROM ${ABT}.abt_keterangan_saksi k JOIN perkara_pihak5 p5 ON p5.id = k.saksi_id
        WHERE k.perkara_id IN (?) ORDER BY k.perkara_id, p5.urutan, k.sidang_id, k.urutan_pertanyaan, k.id`,
      [ids]
    );
    const isian = await q(
      `SELECT perkara_id, no_var+0 no_var, data FROM ${ABT}.abt_data_teks
        WHERE no_var+0 IN (222,246,9944,5227,8503,7035) AND perkara_id IN (?) AND data IS NOT NULL AND TRIM(data) <> ''`,
      [ids]
    );
    const sid = await q(`SELECT id, tanggal_sidang FROM perkara_jadwal_sidang WHERE perkara_id IN (?)`, [ids]);
    const tglSid = new Map(sid.map((s) => [s.id, s.tanggal_sidang]));
    const saksi = new Map();
    for (const r of ket) {
      if (!saksi.has(r.perkara_id)) saksi.set(r.perkara_id, new Map());
      const m = saksi.get(r.perkara_id);
      if (!m.has(r.urutan)) m.set(r.urutan, []);
      m.get(r.urutan).push(r);
    }
    const isi = new Map();
    for (const r of isian) {
      if (!isi.has(r.perkara_id)) isi.set(r.perkara_id, {});
      isi.get(r.perkara_id)[String(r.no_var).padStart(4, "0")] = String(r.data);
    }
    return pk.map((p) => {
      const s = saksi.get(p.perkara_id);
      const urut = s ? [...s.keys()].sort((a, b) => a - b) : [];
      const sids = s ? [...new Set([...s.values()].flat().map((r) => r.sidang_id))] : [];
      const tg = sids.map((x) => tglSid.get(x)).filter(Boolean).sort().pop();
      let tanggalSidang = "";
      if (tg) {
        const d = new Date(tg);
        tanggalSidang = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
      }
      // Sebutan pihak dari alur/jenis perkara, bukan dari kata (cerai talak = Pemohon/Termohon).
      const permohonan = p.alur_perkara_id == 16 || p.jenis_perkara_id == 346 || p.jenis_perkara_id == 341;
      return {
        id: p.perkara_id,
        nomor: p.nomor_perkara,
        pihak: permohonan ? { pelaku: "Termohon", lawan: "Pemohon" } : { pelaku: "Tergugat", lawan: "Penggugat" },
        saksi1: urut[0] !== undefined ? teksSaksi(s.get(urut[0])) : "",
        saksi2: urut[1] !== undefined ? teksSaksi(s.get(urut[1])) : "",
        posita: polos(p.posita),
        tanggalSidang,
        faktor: [p.f1, p.f2].filter((x) => x !== null && x !== undefined).map(Number),
        isian: isi.get(p.perkara_id) || {},
      };
    });
  } finally {
    db.end();
  }
}

/** Huruf 8503 manusia -> himpunan huruf. "FB" = "BF". */
function hurufManusia(teks) {
  return [...new Set(String(teks || "").toUpperCase().replace(/[^A-H]/g, "").split("").filter(Boolean))].sort();
}

function persen(a, b) {
  return b ? `${((100 * a) / b).toFixed(1)}%` : "-";
}

function ukur(data) {
  const usulan = require("../services/abtUsulanService");
  const deteksi = require("../services/deteksiAlasanService");
  const kamus = require("../services/kamusDeteksi");
  const polaCiri = kamus.polaKelompok("alasan").filter((p) => p.jenis === "ciri");
  const hasil = {
    dibuat: new Date().toISOString(),
    n: data.length,
    huruf: {},
    sebab: {},
    kesesuaian: {},
    pelaku7035: {},
    petunjukWaktu: {},
    contoh: {},
  };
  const tambah = (wadah, kunci, ruas) => {
    wadah[kunci] = wadah[kunci] || { n: 0, tepat: 0, salahTangkap: 0, terlewat: 0, diusulkan: 0 };
    wadah[kunci][ruas] += 1;
  };
  const hitung = (wadah, kunci) => {
    wadah[kunci] = (wadah[kunci] || 0) + 1;
  };
  const contoh = (jenis, isi) => {
    hasil.contoh[jenis] = hasil.contoh[jenis] || [];
    if (hasil.contoh[jenis].length < 40) hasil.contoh[jenis].push(isi);
  };

  for (const p of data) {
    if (!p.saksi1 && !p.saksi2) continue;
    const r = usulan.dariKeteranganSaksi(p.saksi1, p.saksi2, p.tanggalSidang, p.pihak, p.posita, {});
    const det = r.deteksiAlasan;
    if (!det) throw new Error(`deteksiAlasan kosong (${r.deteksiAlasanGalat || "?"}) pada ${p.nomor}`);

    // ---- HURUF: usulan kartu (usulkanUntukBlangko01) vs ABT 8503, per huruf.
    const manusia = hurufManusia(p.isian["8503"]);
    if (manusia.length) {
      const usul = (r.huruf || []).map((h) => h.huruf);
      for (const h of "ABCDEFGH") {
        const m = manusia.includes(h);
        const u = usul.includes(h);
        if (m) tambah(hasil.huruf, h, "n");
        if (u) tambah(hasil.huruf, h, "diusulkan");
        if (m && u) tambah(hasil.huruf, h, "tepat");
        if (!m && u) tambah(hasil.huruf, h, "salahTangkap");
        if (m && !u) tambah(hasil.huruf, h, "terlewat");
        if (!m && u && "ABF".includes(h)) contoh(`huruf-${h}-salahTangkap`, { nomor: p.nomor, manusia: manusia.join(""), usul: usul.join("") });
        if (m && !u) contoh(`huruf-${h}-terlewat`, { nomor: p.nomor, manusia: manusia.join(""), usul: usul.join("") });
      }
      tambah(hasil.huruf, "_susunan-persis", "n");
      if (usul.slice().sort().join("") === manusia.join("")) tambah(hasil.huruf, "_susunan-persis", "tepat");
      // S6: huruf yang DIPILIH manusia - berapa yang dikuatkan kedua saksi menurut mesin.
      for (const h of manusia) {
        const k = ((r.kesesuaian && r.kesesuaian.huruf) || []).find((x) => x.huruf === h);
        hitung(hasil.kesesuaian, `huruf ${h} dipilih manusia: ${k ? k.label : "tidak diterangkan saksi"}`);
      }
      // S6 x ketepatan: usulan berstatus "kedua saksi sama" vs lainnya.
      for (const h of r.huruf || []) {
        const st = (h.kesesuaian && h.kesesuaian.status) || "-";
        tambah(hasil.kesesuaian, `usulan ${h.huruf} | ${st}`, "diusulkan");
        tambah(hasil.kesesuaian, `usulan ${h.huruf} | ${st}`, manusia.includes(h.huruf) ? "tepat" : "salahTangkap");
      }
    }

    // ---- SEBAB: faktor SIPP (primer + sekunder) terbaca di saksi/posita? baru (semua pola) vs lama (ciri saja)
    const butir = [...usulan.butirKeterangan(p.saksi1), ...usulan.butirKeterangan(p.saksi2), ...usulan.butirKeterangan(p.posita)];
    const sebabBaru = new Set((det.sebab || []).map((s) => s.sebab));
    let sebabLama = null;
    for (const f of p.faktor || []) {
      const kunci = FAKTOR_SIPP[f];
      if (!kunci) continue;
      if (!sebabLama) sebabLama = new Set(deteksi.sebabDariButir(butir, { pola: polaCiri }).map((s) => s.sebab));
      const w = (hasil.sebab[kunci] = hasil.sebab[kunci] || { n: 0, terbacaLama: 0, terbacaBaru: 0 });
      w.n += 1;
      if (sebabLama.has(kunci)) w.terbacaLama += 1;
      if (sebabBaru.has(kunci)) w.terbacaBaru += 1;
      else contoh(`sebab-terlewat-${kunci}`, p.nomor);
      if (kunci === "masalah ekonomi") {
        const e = (hasil.sebab["masalah ekonomi ATAU tidak memberi nafkah"] = hasil.sebab["masalah ekonomi ATAU tidak memberi nafkah"] || { n: 0, terbacaLama: 0, terbacaBaru: 0 });
        e.n += 1;
        if (sebabLama.has(kunci) || sebabLama.has("tidak memberi nafkah")) e.terbacaLama += 1;
        if (sebabBaru.has(kunci) || sebabBaru.has("tidak memberi nafkah")) e.terbacaBaru += 1;
      }
    }

    // ---- P3: siapa yang pergi (perbuatan "pergi" per kalimat saksi) vs isian 7035 petugas
    const m7035 = String(p.isian["7035"] || "").toLowerCase();
    const sisiManusia = /tergugat|termohon/.test(m7035) ? "pelaku" : /penggugat|pemohon/.test(m7035) ? "lawan" : "";
    if (sisiManusia) {
      const pergi = [...det.pelaku.saksi1, ...det.pelaku.saksi2].filter((x) => x.perbuatan === "pergi" && x.sisi !== "tuduhan");
      const pel = pergi.filter((x) => x.sisi === "pelaku").length;
      const law = pergi.filter((x) => x.sisi === "lawan").length;
      const p3 = pel > law ? "pelaku" : law > pel ? "lawan" : "";
      tambah(hasil.pelaku7035, "P3 perbuatan pergi (suara terbanyak)", "n");
      if (!p3) tambah(hasil.pelaku7035, "P3 perbuatan pergi (suara terbanyak)", "terlewat");
      else tambah(hasil.pelaku7035, "P3 perbuatan pergi (suara terbanyak)", p3 === sisiManusia ? "tepat" : "salahTangkap");
      const u = r.usulan.find((x) => x.kode === "7035");
      const lama = u && u.nilai ? (/tergugat|termohon/i.test(u.nilai) ? "pelaku" : "lawan") : "";
      tambah(hasil.pelaku7035, "usulan 7035 (siapaPergiDari)", "n");
      if (!lama) tambah(hasil.pelaku7035, "usulan 7035 (siapaPergiDari)", "terlewat");
      else tambah(hasil.pelaku7035, "usulan 7035 (siapaPergiDari)", lama === sisiManusia ? "tepat" : "salahTangkap");
      if (p3 && p3 !== sisiManusia) contoh("p3-pergi-salah", { nomor: p.nomor, manusia: m7035, kalimat: pergi.map((x) => `${x.sisi}: ${x.kalimat}`).slice(0, 2) });
    }

    // ---- P2: petunjuk waktu pada kartu kosong - bulan yang disebut ada di isian petugas?
    for (const kode of ["0222", "0246"]) {
      const u = r.usulan.find((x) => x.kode === kode);
      if (!u || !u.petunjukWaktu) continue;
      const m = String(p.isian[kode] || "").toLowerCase();
      for (const x of u.petunjukWaktu) {
        const kunci = `${kode} ${x.kode}${u.nilai ? " (kartu terisi)" : " (kartu kosong)"}`;
        tambah(hasil.petunjukWaktu, kunci, "diusulkan");
        if (!m) continue;
        /* === KDL2 11 Okt === */
        // Petunjuk berperkiraan (N lalu / N setelah menikah / sejak awal pernikahan): yang dinilai perkiraannya.
        // tepat = bulan+tahun sama (atau tahun sama bila perkiraannya hanya tahun); "tahun sama" dicatat terpisah.
        if (/sejak-lalu|sejak-tahun-lalu|setelah-menikah|awal-menikah/.test(x.kode)) {
          // Petugas yang menulis bunyi relatifnya apa adanya ("3 bulan setelah pernikahan") = sama bunyi.
          const bunyi = x.teks.toLowerCase().replace(/^(?:sejak|mulai|semenjak|sudah|telah|sekitar|kira-kira|kurang\s+lebih)\s+/g, "").replace(/\s+/g, " ");
          tambah(hasil.petunjukWaktu, `${kode} ${x.kode} (bunyi sama dengan isian)`, "diusulkan");
          tambah(hasil.petunjukWaktu, `${kode} ${x.kode} (bunyi sama dengan isian)`, m.replace(/\s+/g, " ").includes(bunyi) ? "tepat" : "salahTangkap");
          if (x.perkiraan) {
            const k3 = `${kode} perkiraan ${x.kode}`;
            const kecil = x.perkiraan.toLowerCase();
            const thn = (kecil.match(/(?:19|20)\d{2}/) || [""])[0];
            const bln = (kecil.match(/^bulan\s+([a-z]+)/) || [])[1];
            const mm = m.replace(/pebruari/g, "februari").replace(/nopember/g, "november");
            const tahunSama = Boolean(thn) && mm.includes(thn);
            const tepat = bln ? tahunSama && mm.includes(bln) : tahunSama;
            tambah(hasil.petunjukWaktu, k3, "diusulkan");
            tambah(hasil.petunjukWaktu, k3, tepat ? "tepat" : "salahTangkap");
            tambah(hasil.petunjukWaktu, `${k3} (tahun saja)`, "diusulkan");
            tambah(hasil.petunjukWaktu, `${k3} (tahun saja)`, tahunSama ? "tepat" : "salahTangkap");
            contoh(`perkiraan-${kode}-${x.kode}`, { nomor: p.nomor, petunjuk: x.teks, perkiraan: x.perkiraan, manusia: m.slice(0, 80), tepat });
          }
          continue;
        }
        /* === AKHIR KDL2 === */
        const bulan = (x.teks.match(/bulan\s+(\S+)/i) || [])[1];
        const sesuai = bulan ? m.includes(bulan.toLowerCase().replace("pebruari", "februari").replace("nopember", "november")) : /idul|lebaran|syawal/i.test(m);
        tambah(hasil.petunjukWaktu, kunci, sesuai ? "tepat" : "salahTangkap");
        if (x.perkiraan) {
          const k2 = `${kode} tahun perkiraan`;
          tambah(hasil.petunjukWaktu, k2, "diusulkan");
          tambah(hasil.petunjukWaktu, k2, m.replace(/^bulan\s+/, "").replace(/\s+/g, " ").includes(x.perkiraan.toLowerCase().replace(/^bulan\s+/, "")) ? "tepat" : "salahTangkap");
        }
        contoh(`petunjuk-${kode}`, { nomor: p.nomor, petunjuk: x.teks, perkiraan: x.perkiraan || "", usulan: u.nilai, manusia: m.slice(0, 80) });
      }
    }
  }

  const ringkas = (wadah) => {
    const keluar = {};
    for (const [k, v] of Object.entries(wadah)) {
      keluar[k] = typeof v === "object" && "tepat" in v ? { ...v, ketepatan: persen(v.tepat, v.tepat + v.salahTangkap), cakupan: persen(v.tepat, v.n) } : v;
    }
    return keluar;
  };
  hasil.huruf = ringkas(hasil.huruf);
  hasil.kesesuaian = ringkas(hasil.kesesuaian);
  hasil.pelaku7035 = ringkas(hasil.pelaku7035);
  hasil.petunjukWaktu = ringkas(hasil.petunjukWaktu);
  for (const v of Object.values(hasil.sebab)) {
    v.cakupanLama = persen(v.terbacaLama, v.n);
    v.cakupanBaru = persen(v.terbacaBaru, v.n);
  }
  return hasil;
}

/* === KDL2 11 Okt === */
/**
 * Salah tangkap di posita BUKAN perceraian (temuan agen 3): kalimat baku itsbat "tidak (ada) pihak ketiga
 * yang mengganggu gugat" tidak boleh menjadi sebab "pihak lain". Dihitung dengan & tanpa penyangkal letak.
 * node tools/ukur-deteksi-alasan.js itsbat
 */
async function ukurItsbat() {
  const mysql = require("mysql");
  const usulan = require("../services/abtUsulanService");
  const deteksi = require("../services/deteksiAlasanService");
  const kamus = require("../services/kamusDeteksi");
  const db = mysql.createConnection({
    host: process.env.UKUR_MYSQL_HOST || "127.0.0.1",
    user: process.env.UKUR_MYSQL_USER || "root",
    password: process.env.UKUR_MYSQL_PASSWORD || "",
    database: process.env.UKUR_DB_SIPP || "sipp_donggala",
  });
  const r = await new Promise((ok, no) =>
    db.query("SELECT nomor_perkara, posita FROM perkara WHERE (nomor_perkara LIKE '%Pdt.P%' OR jenis_perkara_text LIKE '%sbat%') AND posita IS NOT NULL", (e, x) => (e ? no(e) : ok(x)))
  );
  db.end();
  const semua = kamus.polaKelompok("alasan");
  const tanpa = semua.filter((p) => !(p.jenis === "penyangkal" && p.cakupan === "letak"));
  const hasil = {};
  for (const p of r) {
    const b = usulan.butirKeterangan(usulan.polosPosita(p.posita));
    const a = new Set(deteksi.sebabDariButir(b, { pola: tanpa }).map((s) => s.sebab));
    const s = new Set(deteksi.sebabDariButir(b, { pola: semua }).map((x) => x.sebab));
    for (const k of new Set([...a, ...s])) {
      const w = (hasil[k] = hasil[k] || { tanpaPenyangkal: 0, sekarang: 0 });
      if (a.has(k)) w.tanpaPenyangkal += 1;
      if (s.has(k)) w.sekarang += 1;
    }
  }
  console.log(`posita Pdt.P/itsbat ${r.length} - sebab yang menyala (salah tangkap: posita ini bukan gugatan cerai):`);
  console.log(JSON.stringify(hasil, null, 1));
}
/* === AKHIR KDL2 === */

async function utama() {
  const [perintah, berkas, keluaran] = process.argv.slice(2);
  /* === KDL2 11 Okt === */
  if (perintah === "itsbat") return ukurItsbat();
  /* === AKHIR KDL2 === */
  if (perintah === "ambil") {
    const data = await ambil();
    fs.writeFileSync(berkas, JSON.stringify(data));
    console.log(`tersimpan ${data.length} perkara -> ${berkas}`);
    return;
  }
  const data = perintah === "ukur" ? JSON.parse(fs.readFileSync(berkas, "utf8")) : await ambil();
  const hasil = ukur(data);
  const teks = JSON.stringify(hasil, null, 1);
  if (keluaran) fs.writeFileSync(path.resolve(keluaran), teks);
  const { contoh, ...ringkas } = hasil;
  console.log(JSON.stringify(ringkas, null, 1));
}

if (require.main === module) {
  utama().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { ambil, ukur, hurufManusia, FAKTOR_SIPP, polos, teksSaksi };
