"use strict";

/**
 * ============================================================================
 * UKUR KASIR PER KEJADIAN ATAS JURNAL NYATA (11 Okt 2026) - HANYA MEMBACA
 * ============================================================================
 *
 * Basis data SIPP LOKAL (salinan satker sipp_donggala). Tidak ada satu pun
 * tulisan: pool MySQL dipakai lewat buatLayanan({ kueri }) dan transaksi
 * tiruan yang selalu menolak.
 *
 * Dua bagian:
 *
 *   A. KEBIASAAN PER KEJADIAN - jurnal UTUH perkara yang sudah ditutup
 *      (ada Pengembalian Sisa Panjar) digolongkan ke kejadiannya oleh
 *      susunKejadian (pembanding mesin usulan + jenis/tanggal). Per jenis
 *      kejadian: komponen (jenis biaya, berapa persen kejadian memuatnya),
 *      urutan tulis (menurut id), tarif terbanyak, tanggal transaksi relatif
 *      tanggal kejadian. Ditambah pendaftaran (siapa yang menulis: SIPP saat
 *      daftar atau kasir lewat Tambah), mediasi, tambahan panjar.
 *
 *   B. UJI BALIK PER KEJADIAN - tiap kejadian perkara yang sudah selesai
 *      dijalankan SEOLAH jurnal kejadian itu (dan sesudahnya) belum ditulis:
 *      jurnal = baris milik kejadian SEBELUMNYA, sidang/relaas/putusan
 *      dipotong ke saat kejadian itu, hari ini = tanggal baris kejadiannya.
 *      Usulan tercentang untuk kejadian itu dibandingkan dengan yang ditulis
 *      kasir: jenis (multiset), jenis+jumlah, tanggal, presisi, cakupan.
 *      Kejadian yang tidak ditulisi apa pun ikut diuji (usulan harus kosong).
 *
 *   node tools/ukur-kasir-kejadian.js [--db sipp_donggala] [--dari 2025-07-01]
 *        [--sampai 2026-10-10] [--batas 3000]
 *        [--contoh ../manajemen_surat/src/test/kasir-kejadian-nyata.json]
 *
 * Catatan jujur: penggolongan baris ke kejadian (bagian A) memakai pembanding
 * mesin itu sendiri, jadi uji balik B mengukur ketepatan usulan PER KEJADIAN
 * atas penggolongan itu. Baris yang tidak tergolong ("lain") dilaporkan.
 */

const path = require("path");
const fs = require("fs");
const mysql = require("mysql");
const kasir = require("../services/kasirJurnalService");

function argumen(nama, bawaan) {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : bawaan;
}

const DB = argumen("db", "sipp_donggala");
const DARI = argumen("dari", "2025-07-01");
const SAMPAI = argumen("sampai", "2026-10-10");
const BATAS = Number(argumen("batas", "3000"));
const CONTOH = argumen("contoh", "");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: DB,
  connectionLimit: 6,
  dateStrings: true,
});
const kueri = (sql, params = []) => {
  if (/^\s*(insert|update|delete|replace|alter|drop|create|truncate)/i.test(sql)) return Promise.reject(new Error("ukur hanya membaca"));
  return new Promise((selesai, gagal) => pool.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil))));
};

const layanan = kasir.buatLayanan({
  kueri,
  tabelAda: async () => true,
  jeda: async () => {},
  transaksi: async () => {
    throw new Error("ukur hanya membaca");
  },
});

const salin = (x) => JSON.parse(JSON.stringify(x));
const hari = (a, b) => (a && b ? Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5) : null);

function multiset(daftar) {
  const m = {};
  for (const x of daftar) m[x] = (m[x] || 0) + 1;
  return m;
}

function bandingkan(usul, nyata) {
  const a = multiset(usul);
  const b = multiset(nyata);
  let cocok = 0;
  for (const k of Object.keys(a)) cocok += Math.min(a[k], b[k] || 0);
  return { cocok, usul: usul.length, nyata: nyata.length, tepat: cocok === usul.length && cocok === nyata.length };
}

function tambahHitung(peta, kunci, n = 1) {
  peta[kunci] = (peta[kunci] || 0) + n;
}

function modal(peta) {
  let terbaik = null;
  let n = 0;
  let total = 0;
  for (const [k, v] of Object.entries(peta)) {
    total += v;
    if (v > n) {
      terbaik = k;
      n = v;
    }
  }
  return { nilai: terbaik, n, total };
}

function persen(a, b) {
  return b ? `${((a / b) * 100).toFixed(1)}%` : "-";
}

/** Keadaan pada saat kejadian E - jurnal kejadian itu dan sesudahnya belum ditulis. */
function keadaanSebelum(k, kj, e) {
  const urut = kj.kejadian;
  const idx = urut.findIndex((x) => x.kunci === e.kunci);
  const milikSebelum = new Set();
  const nyataE = e.komponen.filter((c) => c.sumber === "jurnal");
  const idAwalE = nyataE.length ? Math.min(...nyataE.map((c) => c.jurnalId)) : Infinity;
  urut.forEach((x, i) => {
    for (const c of x.komponen) {
      if (c.sumber !== "jurnal") continue;
      if (i < idx && x.jenis !== "lain") milikSebelum.add(c.jurnalId);
      if (x.jenis === "lain" && c.jurnalId < idAwalE && c.tanggal <= (e.tanggal || "9999")) milikSebelum.add(c.jurnalId);
    }
  });
  const s = salin(k);
  s.jurnal = s.jurnal.filter((b) => milikSebelum.has(b.id));
  const biasa = s.sidang.filter((x) => !x.ikrar).sort((a, b) => a.urutan - b.urutan || a.tanggal.localeCompare(b.tanggal));
  const kosongkan = (x) => ({ ...x, dihadiriOleh: null, ditunda: false, hasil: "" });
  let hariIni = nyataE.length ? nyataE.map((c) => c.tanggal).sort().pop() : "";
  if (e.jenis === "pertama") {
    const s1 = biasa[0];
    s.sidang = [kosongkan(s1)];
    s.relaas = s.relaas.filter((r) => r.sidangId === s1.id);
    s.putusan = null;
    s.ikrar = null;
    s.pemberitahuan = [];
    hariIni = hariIni || s1.tanggal;
  } else if (e.jenis === "tunda") {
    const id = Number(e.kunci.split(":")[1]);
    const i = biasa.findIndex((x) => x.id === id);
    const potong = biasa.slice(0, i + 2);
    potong[potong.length - 1] = kosongkan(potong[potong.length - 1]);
    const ids = new Set(potong.map((x) => x.id));
    s.sidang = potong;
    s.relaas = s.relaas.filter((r) => ids.has(r.sidangId));
    s.putusan = null;
    s.ikrar = null;
    s.pemberitahuan = [];
    hariIni = hariIni || potong[potong.length - 1].tanggal;
  } else if (e.jenis === "putusan") {
    s.sidang = s.sidang.filter((x) => !x.ikrar);
    const ids = new Set(s.sidang.map((x) => x.id));
    s.relaas = s.relaas.filter((r) => ids.has(r.sidangId));
    s.ikrar = null;
    hariIni = hariIni || e.tanggal;
  } else {
    hariIni = hariIni || e.tanggal;
  }
  s.hariIni = hariIni || k.hariIni;
  return s;
}

function anonim(k) {
  const s = salin(k);
  s.perkara.nomorPerkara = `${s.perkara.perkaraId % 1000}/Pdt.X/2026/PA.Anon`;
  s.pihak = s.pihak.map((p, i) => ({ ...p, nama: `Pihak ${p.ke}-${i + 1}` }));
  s.jurusita = s.jurusita.map((j) => ({ ...j, nama: "Juru Sita Anonim" }));
  s.jurnal = s.jurnal.map((b) => ({ ...b, namaPihak: "", jurusita: "", diinputOleh: "kasir", diinputTanggal: "", keterangan: "" }));
  const dipakai = new Set([...Object.values(kasir.JB), 224, 254, 381, ...s.jurnal.map((b) => b.jenisBiayaId)].map(Number));
  for (const id of Object.keys(s.jenisBiaya)) if (!dipakai.has(Number(id))) delete s.jenisBiaya[id];
  for (const jb of Object.values(s.jenisBiaya)) delete jb.kategori;
  return s;
}

async function pendaftaran() {
  const baris = await kueri(
    `SELECT pb.jenis_biaya_id AS jb, pb.urutan, COUNT(*) AS n,
            SUM(ABS(TIMESTAMPDIFF(SECOND, pb.diinput_tanggal, p.diinput_tanggal)) <= 5) AS sedetik,
            SUM(pb.tanggal_transaksi = p.tanggal_pendaftaran) AS tanggalDaftar,
            GROUP_CONCAT(DISTINCT CAST(pb.jumlah AS UNSIGNED) ORDER BY pb.jumlah SEPARATOR ',') AS jumlah
       FROM perkara_biaya pb JOIN perkara p ON p.perkara_id = pb.perkara_id
      WHERE pb.tahapan_id = 10 AND p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran < ? AND pb.jenis_biaya_id IN (1, 61, 155)
      GROUP BY pb.jenis_biaya_id, pb.urutan ORDER BY pb.jenis_biaya_id, pb.urutan`,
    [DARI, SAMPAI]
  );
  const mediasi = await kueri(
    `SELECT COUNT(*) AS mediasi,
            SUM(EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = m.perkara_id AND b.jenis_biaya_id = 381)) AS berbiaya
       FROM perkara_mediasi m WHERE m.penetapan_penunjukan_mediator >= ? AND m.penetapan_penunjukan_mediator < ?`,
    [DARI, SAMPAI]
  );
  return { baris, mediasi: mediasi[0] };
}

(async () => {
  const daftar = await kueri(
    `SELECT pu.perkara_id AS id
       FROM perkara_putusan pu
      WHERE pu.tanggal_putusan >= ? AND pu.tanggal_putusan < ?
        AND EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.jenis_biaya_id = 151 AND b.tahapan_id = 10)
        AND NOT EXISTS (SELECT 1 FROM perkara_biaya b WHERE b.perkara_id = pu.perkara_id AND b.id_pembiayaan <> 1)
      ORDER BY pu.tanggal_putusan DESC LIMIT ?`,
    [DARI, SAMPAI, BATAS]
  );

  const A = {}; // jenis kejadian -> statistik kebiasaan
  const B = {}; // jenis kejadian -> statistik uji balik
  const contoh = {};
  let barisSemua = 0;
  let barisLain = 0;
  const lainJenis = {};
  let perkaraDibaca = 0;
  const tambahPanjar = { nyata: 0, diusulkan: 0, tepatAda: 0, tepatJumlah: 0, salahTangkap: 0, rincian: [] };

  for (const d of daftar) {
    const baca = await layanan.bacaKeadaan(d.id);
    if (!baca.ok) continue;
    perkaraDibaca += 1;
    const k = baca.keadaan;
    const hasil = kasir.susunUsulan(salin(k));
    const kj = kasir.susunKejadian(salin(k), hasil);

    // ─── A. kebiasaan ──────────────────────────────────────────────────────
    for (const e of kj.kejadian) {
      const nyata = e.komponen.filter((c) => c.sumber === "jurnal");
      barisSemua += nyata.length;
      if (e.jenis === "lain") {
        barisLain += nyata.length;
        for (const c of nyata) tambahHitung(lainJenis, c.jenisBiayaId);
        continue;
      }
      const a = (A[e.jenis] = A[e.jenis] || { kejadian: 0, berbaris: 0, jenis: {}, urutan: {}, jumlah: {}, selisih: {}, barisPerKejadian: {} });
      a.kejadian += 1;
      if (nyata.length) a.berbaris += 1;
      tambahHitung(a.barisPerKejadian, nyata.length);
      const adaJenis = new Set();
      for (const c of nyata.sort((x, y) => x.jurnalId - y.jurnalId)) {
        adaJenis.add(c.jenisBiayaId);
        a.jumlah[c.jenisBiayaId] = a.jumlah[c.jenisBiayaId] || {};
        tambahHitung(a.jumlah[c.jenisBiayaId], c.jumlah);
        a.selisih[c.jenisBiayaId] = a.selisih[c.jenisBiayaId] || {};
        tambahHitung(a.selisih[c.jenisBiayaId], hari(c.tanggal, e.tanggal));
      }
      for (const j of adaJenis) tambahHitung(a.jenis, j);
      if (nyata.length) tambahHitung(a.urutan, nyata.map((c) => c.jenisBiayaId).join(">"));
    }

    // ─── B. uji balik ──────────────────────────────────────────────────────
    for (const e of kj.kejadian) {
      if (!["pertama", "tunda", "putusan", "ikrar"].includes(e.jenis)) continue;
      const nyata = e.komponen.filter((c) => c.sumber === "jurnal");
      // Kejadian yang memang belum dijurnal sampai salinan ini diambil tidak diuji.
      if (e.jenis === "ikrar" && !nyata.length) continue;
      const sebelum = keadaanSebelum(k, kj, e);
      const h2 = kasir.susunUsulan(salin(sebelum));
      const usul = h2.usulan.filter((u) => u.kejadian === e.kunci && u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0));
      const j = bandingkan(
        usul.map((u) => u.jenisBiayaId),
        nyata.map((c) => c.jenisBiayaId)
      );
      const jj = bandingkan(
        usul.map((u) => `${u.jenisBiayaId}|${Number(u.jumlah)}`),
        nyata.map((c) => `${c.jenisBiayaId}|${c.jumlah}`)
      );
      const jt = bandingkan(
        usul.map((u) => `${u.jenisBiayaId}|${u.tanggal}`),
        nyata.map((c) => `${c.jenisBiayaId}|${c.tanggal}`)
      );
      const b = (B[e.jenis] = B[e.jenis] || { kejadian: 0, kosong: 0, jenisTepat: 0, jumlahTepat: 0, tanggalTepat: 0, cocok: 0, usul: 0, nyata: 0, cocokTanggal: 0, meleset: [] });
      b.kejadian += 1;
      if (!nyata.length) b.kosong += 1;
      if (j.tepat) b.jenisTepat += 1;
      if (jj.tepat) b.jumlahTepat += 1;
      if (jt.tepat) b.tanggalTepat += 1;
      b.cocok += j.cocok;
      b.usul += j.usul;
      b.nyata += j.nyata;
      b.cocokTanggal += jt.cocok;
      if (!j.tepat && b.meleset.length < 8) {
        b.meleset.push({ perkara: k.perkara.nomorPerkara, kejadian: e.judul, usul: usul.map((u) => u.jenisBiayaId).join(","), nyata: nyata.map((c) => c.jenisBiayaId).join(",") });
      }
      const nyata224 = nyata.find((c) => c.jenisBiayaId === kasir.JB_TAMBAH_PANJAR);
      const usul224 = usul.find((u) => u.jenisBiayaId === kasir.JB_TAMBAH_PANJAR);
      if (nyata224) tambahPanjar.nyata += 1;
      if (usul224) tambahPanjar.diusulkan += 1;
      if (nyata224 && usul224) {
        tambahPanjar.tepatAda += 1;
        if (Number(usul224.jumlah) === nyata224.jumlah) tambahPanjar.tepatJumlah += 1;
      }
      if (usul224 && !nyata224) tambahPanjar.salahTangkap += 1;
      if (usul224 || nyata224) {
        tambahPanjar.rincian.push({ perkara: k.perkara.nomorPerkara, kejadian: e.jenis, usul: usul224 ? Number(usul224.jumlah) : null, nyata: nyata224 ? nyata224.jumlah : null });
      }
      const kunciContoh = e.jenis === "tunda" ? (nyata.length ? "tunda-dipanggil" : "tunda-tanpa-panggil") : nyata224 ? `${e.jenis}-tambah-panjar` : null;
      if (CONTOH && kunciContoh && j.tepat && jj.tepat && !contoh[kunciContoh]) {
        contoh[kunciContoh] = {
          kejadian: e.kunci,
          jenis: e.jenis,
          keadaan: anonim(sebelum),
          harap: nyata.sort((x, y) => x.jurnalId - y.jurnalId).map((c) => ({ jenisBiayaId: c.jenisBiayaId, jumlah: c.jumlah, tanggal: c.tanggal })),
        };
      }
    }
  }

  const daf = await pendaftaran();
  const keluar = [];
  const tulis = (t) => {
    keluar.push(t);
    console.log(t);
  };
  tulis(`# Ukur kasir per kejadian - ${DB}, putusan ${DARI} s.d. ${SAMPAI}, ${perkaraDibaca} perkara berjurnal tertutup`);
  tulis("");
  tulis("## Pendaftaran (siapa yang menulis)");
  for (const r of daf.baris) tulis(`jenis ${r.jb} urutan ${r.urutan}: ${r.n} baris, sedetik dengan perkara ${r.sedetik}, bertanggal daftar ${r.tanggalDaftar}, jumlah ${r.jumlah}`);
  tulis(`Mediasi: ${daf.mediasi.mediasi} mediasi, ${daf.mediasi.berbiaya} ber-Biaya Panggilan Mediasi (381)`);
  tulis("");
  tulis(`## A. Kebiasaan per kejadian (baris tergolong ${barisSemua - barisLain}/${barisSemua}; lain ${barisLain}: ${JSON.stringify(lainJenis)})`);
  const ringkasA = {};
  for (const [jenis, a] of Object.entries(A)) {
    tulis(`### ${jenis}: ${a.kejadian} kejadian, ${a.berbaris} berbaris (${persen(a.berbaris, a.kejadian)})`);
    const komponen = Object.entries(a.jenis).sort((x, y) => y[1] - x[1]);
    for (const [jb, n] of komponen) {
      const t = modal(a.jumlah[jb]);
      const s = modal(a.selisih[jb]);
      tulis(`  jenis ${jb}: ${n} kejadian (${persen(n, a.kejadian)}); tarif terbanyak ${t.nilai} (${persen(t.n, t.total)}); tanggal = kejadian ${s.nilai >= 0 ? "+" : ""}${s.nilai} hari (${persen(s.n, s.total)})`);
    }
    const urut = Object.entries(a.urutan).sort((x, y) => y[1] - x[1]).slice(0, 4);
    tulis(`  urutan tulis terbanyak: ${urut.map(([u, n]) => `${u} (${n})`).join("; ")}`);
    ringkasA[jenis] = { kejadian: a.kejadian, berbaris: a.berbaris, komponen: Object.fromEntries(komponen.slice(0, 10)), urutan: urut.map(([u, n]) => ({ urutan: u, n })) };
  }
  tulis("");
  tulis("## B. Uji balik per kejadian (seolah jurnal kejadian itu belum ditulis)");
  tulis("kejadian | n | tanpa baris | jenis tepat | jenis+jumlah tepat | tanggal tepat | presisi baris | cakupan baris | tanggal baris cocok");
  const ringkasB = {};
  for (const [jenis, b] of Object.entries(B)) {
    tulis(
      `${jenis} | ${b.kejadian} | ${b.kosong} | ${persen(b.jenisTepat, b.kejadian)} | ${persen(b.jumlahTepat, b.kejadian)} | ${persen(b.tanggalTepat, b.kejadian)} | ${persen(b.cocok, b.usul)} | ${persen(b.cocok, b.nyata)} | ${persen(b.cocokTanggal, b.cocok)}`
    );
    for (const m of b.meleset.slice(0, 4)) tulis(`    meleset ${m.perkara} [${m.kejadian}]: usul [${m.usul}] nyata [${m.nyata}]`);
    ringkasB[jenis] = {
      kejadian: b.kejadian,
      tanpaBaris: b.kosong,
      jenisTepat: b.jenisTepat,
      jumlahTepat: b.jumlahTepat,
      tanggalTepat: b.tanggalTepat,
      presisiBaris: b.usul ? Number((b.cocok / b.usul).toFixed(4)) : null,
      cakupanBaris: b.nyata ? Number((b.cocok / b.nyata).toFixed(4)) : null,
    };
  }
  tulis(
    `Tambahan panjar: nyata ${tambahPanjar.nyata}, diusulkan ${tambahPanjar.diusulkan}, keduanya ${tambahPanjar.tepatAda} (jumlah tepat ${tambahPanjar.tepatJumlah}), diusulkan padahal tidak ditulis ${tambahPanjar.salahTangkap}`
  );
  for (const r of tambahPanjar.rincian) tulis(`    ${r.perkara} [${r.kejadian}]: usul ${r.usul ?? "-"} nyata ${r.nyata ?? "-"}`);

  if (CONTOH) {
    const berkas = path.resolve(process.cwd(), CONTOH);
    fs.writeFileSync(
      berkas,
      `${JSON.stringify({ diukur: new Date().toISOString().slice(0, 10), basisData: DB, rentang: [DARI, SAMPAI], perkara: perkaraDibaca, ringkasA, ringkasB, tambahPanjar, contoh })}\n`
    );
    console.log(`contoh & ringkasan ditulis ke ${berkas}`);
  }
  pool.end();
})().catch((galat) => {
  console.error(galat);
  pool.end();
  process.exit(1);
});
