"use strict";

/**
 * ============================================================================
 * KELENGKAPAN HARI SIDANG - PEMBACA FAKTANYA (N1, 1 Nov 2026) - HANYA SELECT
 * ============================================================================
 *
 * Tiap pagi hari kerja portal menanyakan satu hal: perkara yang bersidang HARI INI dan hari kerja BERIKUTNYA, sudah
 * lengkapkah bahannya? Berkas ini HANYA mengumpulkan fakta; yang menilai hijau/kuning/merah dan siapa yang diberi
 * tahu adalah portal (manajemen_surat/src/lib/kelengkapan-sidang.ts) - pembagian yang sama dengan penjaga tenggat.
 *
 * TIDAK ADA ATURAN BARU DI SINI. Setiap fakta datang dari mesin yang sudah dipakai layar lain:
 *
 *   panggilan / relaas   daftarSidang -> keadaanPanggilanSidang + nilaiTenggangSidang (ecourtPanggilanService: tiga
 *                        jalur, tenggang, retur) - sama dengan penanda panggilan Jadwal Sidang
 *   mediasi, kuasa,      daftarSidang (mediasiBanyakPerkara, kuasaBanyakPerkara, saksi, majelis/panitera/jurusita)
 *   saksi, petugas
 *   dokumen e-Court      ecourtVerifikasiHarianService.keadaanHari (simpanan bot - TIDAK menarik e-Court)
 *   panjar               kasirJurnalService.usulanPerkara (mesin Kasir yang sama; "Tambahan Panjar" ditawarkan = kurang)
 *
 * Yang baru hanya dua kueri kecil berindeks perkara_id: BAS sidang SEBELUMNYA (perkara_jadwal_sidang.edoc_bas) dan
 * register surat kuasa (perkara_pengacara.nomor_kuasa/tanggal_kuasa).
 *
 * KINERJA: satu daftarSidang untuk rentang dua hari (kueri yang sama dengan layar Jadwal Sidang), dua kueri batch
 * (IN perkara_id), satu pembacaan simpanan e-Court per hari, dan Kasir hanya untuk perkara non-prodeo yang agendanya
 * bukan hari putus - berurutan (satu perkara satu kali), dengan batas waktu total; yang tidak sempat dibaca ditandai
 * `terbaca: false` (bukan "aman").
 */

const BATAS_PERKARA = 120;
/** Batas waktu total pembacaan panjar (Kasir) - sepuluh SELECT kecil per perkara. */
const BATAS_MS_PANJAR = 25000;

const bersih = (x) => String(x === null || x === undefined ? "" : x).trim();
const tanggalSah = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(bersih(x).slice(0, 10)) ? bersih(x).slice(0, 10) : "");

function jalankanBawaan(sql, nilai = []) {
  const db = require("../db_config");
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(Array.isArray(baris) ? baris : [])));
  });
}

/** Sumber bawaan (kerja sungguhan). Uji menyuntik sumber palsu lewat parameter `sumber`. */
function sumberBawaan() {
  return {
    jalankan: jalankanBawaan,
    tabelAda: (t) => require("./sippSkemaService").tabelAda(t),
    jadwal: (arg) => require("./sippJadwalSidangService").daftarSidang(arg),
    ecourtHari: (tanggal) => require("./ecourtVerifikasiHarianService").keadaanHari(tanggal),
    kasir: (perkaraId) => require("./kasirJurnalService").usulanPerkara(perkaraId),
    JB: () => require("./kasirJurnalService").JB,
    JB_TAMBAH_PANJAR: () => require("./kasirJurnalService").JB_TAMBAH_PANJAR,
    sekarang: () => Date.now(),
  };
}

const IN = (daftar) => daftar.map(() => "?").join(", ");

/**
 * BAS sidang SEBELUMNYA tiap perkara untuk satu tanggal sidang sasaran: sidang terakhir yang tanggalnya < tanggal sasaran.
 * `jatuhTempo`: tanggalnya sebelum hari ini - BAS sidang hari ini baru dibuat SESUDAH sidangnya, jadi sidang besok yang
 * sidang sebelumnya berlangsung hari ini belum boleh ditagih BAS-nya.
 */
async function basSebelumnya(s, perkaraId, tanggalSasaran, hariIni) {
  if (perkaraId.length === 0) return {};
  const baris = await s.jalankan(
    `SELECT j.perkara_id AS perkaraId, DATE_FORMAT(j.tanggal_sidang, '%Y-%m-%d') AS tanggal, j.agenda AS agenda,
            j.edoc_bas AS edocBas, j.dihadiri_oleh AS dihadiriOleh, j.ditunda AS ditunda
       FROM perkara_jadwal_sidang j
       JOIN (SELECT perkara_id, MAX(tanggal_sidang) AS t FROM perkara_jadwal_sidang
              WHERE perkara_id IN (${IN(perkaraId)}) AND tanggal_sidang < ? GROUP BY perkara_id) m
         ON m.perkara_id = j.perkara_id AND m.t = j.tanggal_sidang
      ORDER BY j.perkara_id, j.id`,
    [...perkaraId, tanggalSasaran]
  );
  const hasil = {};
  for (const b of baris) {
    const k = String(b.perkaraId);
    const lama = hasil[k];
    hasil[k] = {
      terbaca: true,
      tanggal: tanggalSah(b.tanggal),
      agenda: bersih(b.agenda),
      // Beberapa baris pada tanggal yang sama: ada bila SALAH SATU berBAS.
      ada: Boolean((lama && lama.ada) || bersih(b.edocBas)),
      hasilTercatat: Boolean((lama && lama.hasilTercatat) || (b.dihadiriOleh !== null && b.dihadiriOleh !== undefined)),
      jatuhTempo: tanggalSah(b.tanggal) !== "" && tanggalSah(b.tanggal) < hariIni,
    };
  }
  return hasil;
}

/**
 * Register surat kuasa: PER SISI. Sisi yang SEMUA kuasa aktifnya tanpa nomor DAN tanggal register dilaporkan; sisi yang
 * punya satu kuasa berregister tidak (baris kuasa lain di sisi itu mungkin kuasa lama/salinan - peringatan yang sering
 * keliru berhenti dibaca). Nama ganda dilipat (diukur: satu kantor hukum tercatat 25 baris bernama sama).
 */
async function registerKuasa(s, perkaraId) {
  if (perkaraId.length === 0) return {};
  const baris = await s.jalankan(
    `SELECT perkara_id AS perkaraId, pihak_ke AS pihakKe, nama,
            nomor_kuasa AS nomorKuasa, DATE_FORMAT(tanggal_kuasa, '%Y-%m-%d') AS tanggalKuasa
       FROM perkara_pengacara
      WHERE perkara_id IN (${IN(perkaraId)}) AND aktif = 'Y'
      ORDER BY perkara_id, pihak_ke, urutan, id`,
    perkaraId
  );
  const peta = {};
  for (const b of baris) {
    const k = String(b.perkaraId);
    if (!peta[k]) peta[k] = { jumlah: 0, sisi: {} };
    peta[k].jumlah += 1;
    const sisi = Number(b.pihakKe) || 0;
    if (!peta[k].sisi[sisi]) peta[k].sisi[sisi] = { terdaftar: false, nama: [] };
    const tgl = bersih(b.tanggalKuasa);
    if (bersih(b.nomorKuasa) || (tgl && !tgl.startsWith("0000"))) peta[k].sisi[sisi].terdaftar = true;
    else {
      const nama = bersih(b.nama).slice(0, 120);
      if (nama && !peta[k].sisi[sisi].nama.includes(nama)) peta[k].sisi[sisi].nama.push(nama);
    }
  }
  const hasil = {};
  for (const [k, v] of Object.entries(peta)) {
    hasil[k] = { terbaca: true, jumlah: v.jumlah, tanpaRegister: [] };
    for (const [sisi, x] of Object.entries(v.sisi)) {
      if (x.terdaftar) continue;
      for (const nama of x.nama) hasil[k].tanpaRegister.push({ pihakKe: Number(sisi), nama });
    }
  }
  return hasil;
}

/** Agenda yang tidak memerlukan panggilan/biaya lagi sesudahnya (hari putus): panjar tidak ditagih. */
const POLA_AGENDA_AKHIR = /putus|musyawarah|ikrar|pembacaan/i;

/**
 * Panjar satu perkara lewat mesin Kasir yang ada: saldo jurnal, "Tambahan Panjar" yang ditawarkan (= saldo kurang untuk
 * biaya yang sudah diusulkan), dan biaya panggilan tertinggi yang pernah dijurnal (patokan "cukup untuk satu panggilan lagi").
 */
async function panjarPerkara(s, perkaraId) {
  const k = await s.kasir(perkaraId);
  if (!k || k.ok === false) return { terbaca: false, alasan: bersih(k && k.alasan).slice(0, 120) || "Kasir tidak terbaca." };
  const JB = s.JB();
  const prodeo = Number(k.pembiayaan || 1) !== 1;
  const tambah = (Array.isArray(k.usulan) ? k.usulan : []).find((u) => Number(u.jenisBiayaId) === s.JB_TAMBAH_PANJAR());
  const panggil = (Array.isArray(k.jurnal) ? k.jurnal : [])
    .filter((b) => [JB.PANGGIL_PENGGUGAT, JB.PANGGIL_PEMOHON, JB.PANGGIL_TERGUGAT, JB.PANGGIL_TERMOHON, JB.PEMBERITAHUAN].includes(Number(b.jenisBiayaId)) && Number(b.jenisTransaksi) < 0)
    .reduce((maks, b) => Math.max(maks, Number(b.jumlah) || 0), 0);
  return {
    terbaca: true,
    prodeo,
    saldo: Number(k.saldo) || 0,
    kurang: tambah ? Number(tambah.jumlah) || 0 : 0,
    panggilTerakhir: panggil,
  };
}

/** Ringkas satu baris jadwal menjadi fakta kelengkapan (hanya ruas yang dipakai aturan portal). */
function ringkasSidang(b) {
  const p = b.panggilan || {};
  const t = p.tenggangTersempit || null;
  return {
    sidangId: bersih(b.sidangId),
    perkaraId: bersih(b.perkaraId),
    nomorPerkara: bersih(b.nomorPerkara),
    jenisPerkara: bersih(b.jenisPerkara),
    alurPerkaraId: Number(b.alurPerkaraId) || null,
    tanggalSidang: tanggalSah(b.tanggalSidang),
    jamSidang: bersih(b.jamSidang).slice(0, 5),
    urutanSidang: Number(b.urutanSidang) || 0,
    agenda: bersih(b.agenda),
    ditunda: b.ditunda === true,
    sudahPutus: b.sudahPutus === true,
    sidangIkrarTalak: b.sidangIkrarTalak === true,
    lewatEcourt: b.lewatEcourt === true,
    majelisNama: bersih(b.majelisNama),
    paniteraNama: bersih(b.paniteraNama),
    jurusitaNama: bersih(b.jurusitaNama),
    saksiPihak1: Number(b.saksiPihak1) || 0,
    saksiPihak2: Number(b.saksiPihak2) || 0,
    adaKuasa: b.adaKuasa === true,
    panggilan: {
      wajibDipanggil: Array.isArray(p.wajibDipanggil) ? p.wajibDipanggil.map(Number) : [],
      belumDipanggil: Number(p.belumDipanggil) || 0,
      sisiBelumDipanggil: Array.isArray(p.sisiBelumDipanggil) ? p.sisiBelumDipanggil.map(Number) : [],
      retur: Number(p.retur) || 0,
      returSebab: Array.isArray(p.returSebab) ? p.returSebab.map((x) => bersih(x).slice(0, 160)).slice(0, 3) : [],
      tenggangMepet: p.tenggangMepet === true,
      tenggangTersempit: t
        ? {
            sisi: Number(t.sisi) || 0,
            dinilai: t.dinilai === true,
            patut: t.patut === true ? true : t.patut === false ? false : null,
            selisih: t.selisih === null || t.selisih === undefined ? null : Number(t.selisih),
            ambang: t.ambang === null || t.ambang === undefined ? null : Number(t.ambang),
            alasan: bersih(t.alasan),
            jalur: bersih(t.jalur),
            // Satuan dan ambang yang SEBENARNYA dipakai penilaian: surat tercatat diterima diukur dengan hari kerja (SEMA 1/2023
            // angka 11), sedangkan ambang kirimnya 6 hari kalender - kalimat portal tidak boleh mencampurnya.
            hariKerja: t.hariKerja === true,
            ambangTerima: t.ambangTerima === null || t.ambangTerima === undefined ? null : Number(t.ambangTerima),
            terimaHariKerja: t.terimaHariKerja === true,
          }
        : null,
      sisaHariKeSidang: p.sisaHariKeSidang === null || p.sisaHariKeSidang === undefined ? null : Number(p.sisaHariKeSidang),
    },
    mediasi: b.mediasi
      ? {
          ditunjuk: tanggalSah(b.mediasi.ditunjuk),
          dimulai: tanggalSah(b.mediasi.dimulai),
          hasil: bersih(b.mediasi.hasil),
          keputusan: tanggalSah(b.mediasi.keputusan),
          laporan: tanggalSah(b.mediasi.laporan),
          mediator: bersih(b.mediasi.mediator).slice(0, 160),
        }
      : null,
    mediasiTerbaca: b.mediasiTerbaca !== false,
  };
}

/**
 * Fakta kelengkapan untuk sidang pada `tanggal` (satu atau dua tanggal), dengan `hariIni` sebagai acuan "sudah lewat".
 * @returns {Promise<{ok:boolean, hariIni:string, tanggal:string[], sidang:object[], gagal:Record<string,string>, ms:Record<string,number>, terpotong:boolean}>}
 */
async function bacaFakta({ hariIni, tanggal } = {}, sumber) {
  const s = sumber || sumberBawaan();
  const hari = tanggalSah(hariIni) || new Date(s.sekarang()).toISOString().slice(0, 10);
  const tgl = [...new Set((Array.isArray(tanggal) ? tanggal : [tanggal]).map(tanggalSah).filter(Boolean))].sort().slice(0, 2);
  const gagal = {};
  const ms = {};
  const ukur = async (nama, kerja, cadangan) => {
    const t0 = s.sekarang();
    try {
      return await kerja();
    } catch (e) {
      gagal[nama] = bersih(e && e.message).slice(0, 160) || "gagal";
      return cadangan;
    } finally {
      ms[nama] = s.sekarang() - t0;
    }
  };
  if (tgl.length === 0) return { ok: false, hariIni: hari, tanggal: [], sidang: [], gagal: { tanggal: "Tanggal sidang tidak sah." }, ms, terpotong: false };

  const jadwal = await ukur("jadwal", () => s.jadwal({ dari: tgl[0], sampai: tgl[tgl.length - 1], cari: "", batas: 400 }), null);
  if (!jadwal) return { ok: false, hariIni: hari, tanggal: tgl, sidang: [], gagal, ms, terpotong: false };

  // Hanya sidang pada tanggal sasaran yang belum diputus (sidang ikrar talak sesudah putus tetap dicek), satu per perkara.
  const lihat = new Set();
  const baris = [];
  for (const b of Array.isArray(jadwal.sidang) ? jadwal.sidang : []) {
    const t = tanggalSah(b.tanggalSidang);
    if (!tgl.includes(t) || !bersih(b.perkaraId)) continue;
    // Putus SEBELUM sidang ini (mis. sidang pemberitahuan) tidak perlu disiapkan; putusan pada/sesudah tanggal sidang ini
    // (pada pembacaan pagi belum ada) tidak mengeluarkannya - itu yang menjaga ukuran atas data lampau tetap bermakna.
    const tglPutus = tanggalSah(b.tanggalPutusan);
    if (b.sudahPutus === true && b.sidangIkrarTalak !== true && (!tglPutus || tglPutus < t)) continue;
    const kunci = `${bersih(b.perkaraId)}|${t}`;
    if (lihat.has(kunci)) continue;
    lihat.add(kunci);
    baris.push(b);
  }
  const terpotong = baris.length > BATAS_PERKARA;
  const dipakai = baris.slice(0, BATAS_PERKARA);
  const ringkas = dipakai.map(ringkasSidang);
  const idPerkara = [...new Set(ringkas.map((r) => r.perkaraId))];

  // BAS sidang sebelumnya: satu kueri per tanggal sasaran.
  const bas = {};
  for (const t of tgl) {
    const idHari = [...new Set(ringkas.filter((r) => r.tanggalSidang === t).map((r) => r.perkaraId))];
    bas[t] = await ukur(`bas-${t}`, () => basSebelumnya(s, idHari, t, hari), null);
  }
  const kuasa = await ukur("kuasa", () => registerKuasa(s, idPerkara), null);

  // Dokumen e-Court: simpanan bot per tanggal, hanya perkara e-Litigasi.
  const ecourt = {};
  for (const t of tgl) {
    if (!ringkas.some((r) => r.tanggalSidang === t && r.lewatEcourt)) continue;
    const h = await ukur(`ecourt-${t}`, () => s.ecourtHari(t), null);
    if (h && h.ok && h.perkara) {
      ecourt[t] = {};
      for (const e of Object.values(h.perkara)) ecourt[t][bersih(e.perkaraId)] = e;
    }
  }

  // Panjar lewat Kasir: perkara unik non-hari-putus, berurutan, dengan batas waktu total.
  const panjar = {};
  const mulaiPanjar = s.sekarang();
  const calon = [...new Set(ringkas.filter((r) => !POLA_AGENDA_AKHIR.test(r.agenda) && !r.sidangIkrarTalak).map((r) => r.perkaraId))];
  let habisWaktu = false;
  for (const id of calon) {
    if (s.sekarang() - mulaiPanjar > BATAS_MS_PANJAR) {
      habisWaktu = true;
      break;
    }
    panjar[id] = await ukur("panjar", () => panjarPerkara(s, id), { terbaca: false, alasan: "Gagal dibaca." });
  }
  if (habisWaktu) gagal.panjar = "Batas waktu pembacaan panjar terlampaui; sebagian perkara tidak dibaca.";
  ms.panjarTotal = s.sekarang() - mulaiPanjar;

  const sidang = ringkas.map((r) => {
    const e = ecourt[r.tanggalSidang] && ecourt[r.tanggalSidang][r.perkaraId];
    return {
      ...r,
      basLalu: bas[r.tanggalSidang] ? bas[r.tanggalSidang][r.perkaraId] || null : null,
      basTerbaca: Boolean(bas[r.tanggalSidang]),
      kuasa: kuasa ? kuasa[r.perkaraId] || { terbaca: true, jumlah: 0, tanpaRegister: [] } : { terbaca: false, jumlah: 0, tanpaRegister: [] },
      ecourt: e
        ? {
            keadaan: bersih(e.keadaan),
            menunggu: Number(e.menunggu) || 0,
            dokumen: Number(e.dokumen) || 0,
            jenisDituntut: Array.isArray(e.jenisDituntut) ? e.jenisDituntut.map(bersih) : [],
            sidangLalu: bersih(e.sidangLalu),
          }
        : null,
      panjar: panjar[r.perkaraId] || null,
    };
  });
  return { ok: true, hariIni: hari, tanggal: tgl, sidang, gagal, ms, terpotong };
}

module.exports = { bacaFakta, basSebelumnya, registerKuasa, panjarPerkara, ringkasSidang, POLA_AGENDA_AKHIR, BATAS_PERKARA };
