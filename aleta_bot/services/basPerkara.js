"use strict";

/**
 * ============================================================================
 * BAS PERKARA - KETERANGAN SAKSI & BUKTI YANG SUDAH TERSIMPAN (agen U6, 20 Okt 2026)
 * ============================================================================
 *
 * Membaca (SELECT saja) apa yang sudah dicatat di BAS untuk satu perkara supaya duduk perkara dan pertimbangan putusan memakai
 * keterangan saksi dan alat bukti yang SAMA:
 *   - keterangan saksi  : aps_badilag.abt_keterangan_saksi (pertanyaan/jawaban per sidang per saksi) + identitas saksi di SIPP
 *                         perkara_pihak5 (saksi_id = perkara_pihak5.id; saksi_pihak_ke 1 = pihak Penggugat/Pemohon, 2 = Tergugat/Termohon);
 *   - alat bukti surat  : isian ABT 1214 (bukti Penggugat/Pemohon, tanda P.n), 9911 dan 1262 (bukti Tergugat/Termohon, tanda T.n),
 *                         8131/8132 (bukti permohonan jenis lain) - satu baris per bukti.
 *
 * Keluaran bagian dari faktaPerkara().bas dan dapat dipakai sendiri:
 *
 *     { ada, jumlahSaksi: {P, T}, saksi: [ {id, ke, pihak, urutan, nama, hubungan, sidang:[...], tanyaJawab:[ {no, tanya, jawab, pokok:[...]} ]} ],
 *       pokok: { pernikahan: [ {saksi, pihak, nama, tanya, jawab} ], ... },   // pokok = peta-fakta-variabel.json -> pokokBas
 *       bukti: [ {sisi, tanda, jenis, nomor, tanggal, penerbit, teks} ], jumlahBukti: {P, T}, adaJenisBukti: {aktaNikah:true,...} }
 *
 * Pokok pembuktian dikenali dari pertanyaannya (pola di peta) - satu pertanyaan boleh masuk beberapa pokok. Tidak ada nilai yang
 * dikarang: jawaban saksi dikutip apa adanya.
 */

const { muatPeta } = require("./faktaPerkara");

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};

const KODE_BUKTI = Object.freeze([
  { kode: 1214, sisi: "P" },
  { kode: 9911, sisi: "T" },
  { kode: 1262, sisi: "T" },
  { kode: 8131, sisi: "?" },
  { kode: 8132, sisi: "?" },
]);

const JENIS_BUKTI = [
  ["aktaNikah", /akta\s+nikah|buku\s+nikah|kutipan\s+akta\s+nikah/i, "Kutipan Akta Nikah"],
  ["ktp", /kartu\s+tanda\s+penduduk|ktp/i, "KTP"],
  ["kk", /kartu\s+keluarga|\bkk\b/i, "Kartu Keluarga"],
  ["aktaKelahiran", /akta\s+kelahiran|kutipan\s+akta\s+kelahiran|surat\s+kelahiran/i, "Akta Kelahiran"],
  ["aktaCerai", /akta\s+cerai|putusan\s+(?:pengadilan|cerai)/i, "Akta Cerai / Putusan"],
  ["suratKematian", /akta\s+kematian|surat\s+(?:keterangan\s+)?kematian|surat\s+kematian/i, "Surat Kematian"],
  ["suratKeterangan", /surat\s+keterangan/i, "Surat Keterangan"],
  ["foto", /foto|print\s*out|cetak/i, "Foto / Cetakan"],
];

/** Satu baris bukti ("Fotokopi ... lalu diberi tanda P.1 serta ...;") -> {tanda, jenis, nomor, tanggal, penerbit, teks}. */
function uraiBukti(baris, sisiBawaan) {
  const teks = rapat(baris).replace(/^\d+\s*[.)]\s*/, "");
  if (teks.length < 8) return null;
  const tm = /\b(?:bukti\s+)?\(?\s*([PT])\s*\.?\s*(\d{1,2})\s*\)?/i.exec(teks.replace(/\btanda\s+/i, "tanda "));
  const tanda = tm ? `${tm[1].toUpperCase()}.${tm[2]}` : "";
  const jenisItem = JENIS_BUKTI.find(([, re]) => re.test(teks));
  const nomor = (/\bnomor[:\s]+([A-Za-z0-9./-]+)/i.exec(teks) || /\bNo\.?\s*(\d[A-Za-z0-9./-]*)/.exec(teks) || [])[1] || "";
  const tanggal = (/tanggal\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.exec(teks) || [])[1] || "";
  const penerbit = (/dikeluarkan\s+oleh\s+([^,;]+(?:,\s*[A-Za-z ]+)?)/i.exec(teks) || [])[1] || "";
  return {
    sisi: tanda ? (tanda[0] === "P" ? "P" : "T") : sisiBawaan,
    tanda,
    jenisKode: jenisItem ? jenisItem[0] : "lain",
    jenis: jenisItem ? jenisItem[2] : "Alat bukti surat",
    nomor: rapat(nomor).slice(0, 60),
    tanggal,
    penerbit: rapat(penerbit).slice(0, 120),
    teks: teks.slice(0, 600),
  };
}

function pecahBukti(teks) {
  return String(teks || "")
    .split(/\r?\n|;\s*(?=(?:\d+[.)]\s*)?(?:Fotokopi|Foto|Print|Asli|Surat|Kutipan|Kartu|Akta|Buku))/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 8);
}

/**
 * @param {number} perkaraId
 * @param {Function|null} runAbt    pembaca ABT baca-saja (abt_keterangan_saksi, abt_data_teks)
 * @param {Function} runQuery       pembaca SIPP baca-saja (perkara_pihak5)
 * @param {{peta?: object}} [opsi]
 */
async function bacaBas(perkaraId, runAbt, runQuery, opsi) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const peta = muatPeta((opsi && opsi.peta) || undefined);
  const pokokDef = (peta.pokokBas || []).map((p) => ({ ...p, re: new RegExp(p.pola, "i") }));

  const [jawaban, saksiSipp, buktiMentah] = await Promise.all([
    typeof runAbt === "function"
      ? diam(() =>
          runAbt(
            "SELECT sidang_id, saksi_id, urutan_pertanyaan, pertanyaan, jawaban FROM abt_keterangan_saksi WHERE perkara_id = ? ORDER BY sidang_id, saksi_id, urutan_pertanyaan",
            [id]
          )
        )
      : null,
    typeof runQuery === "function"
      ? diam(() => runQuery("SELECT id, saksi_pihak_ke AS ke, urutan, nama, keterangan AS hubungan FROM perkara_pihak5 WHERE perkara_id = ? ORDER BY saksi_pihak_ke, urutan, id", [id]))
      : null,
    typeof runAbt === "function"
      ? diam(() => runAbt(`SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND no_var IN (${KODE_BUKTI.map((b) => b.kode).join(",")})`, [id]))
      : null,
  ]);

  const peranSaksi = new Map();
  for (const s of Array.isArray(saksiSipp) ? saksiSipp : []) peranSaksi.set(Number(s.id), s);

  const perSaksi = new Map();
  for (const j of Array.isArray(jawaban) ? jawaban : []) {
    if (!rapat(j.jawaban)) continue;
    const sid = Number(j.saksi_id);
    const meta = peranSaksi.get(sid) || {};
    const s =
      perSaksi.get(sid) ||
      {
        id: sid,
        ke: Number(meta.ke) || 0,
        pihak: Number(meta.ke) === 1 ? "P" : Number(meta.ke) === 2 ? "T" : "",
        urutan: Number(meta.urutan) || 0,
        nama: rapat(meta.nama),
        hubungan: rapat(meta.hubungan),
        sidang: [],
        tanyaJawab: [],
      };
    if (!s.sidang.includes(Number(j.sidang_id))) s.sidang.push(Number(j.sidang_id));
    const tanya = rapat(j.pertanyaan);
    s.tanyaJawab.push({ no: Number(j.urutan_pertanyaan) || s.tanyaJawab.length + 1, tanya, jawab: rapat(j.jawaban).replace(/;\s*$/, ""), pokok: pokokDef.filter((p) => p.re.test(tanya)).map((p) => p.id) });
    perSaksi.set(sid, s);
  }
  const saksi = [...perSaksi.values()].sort((a, b) => a.ke - b.ke || a.urutan - b.urutan || a.id - b.id);

  const pokok = {};
  for (const s of saksi) {
    for (const t of s.tanyaJawab) {
      for (const p of t.pokok) (pokok[p] = pokok[p] || []).push({ saksi: s.urutan || 0, pihak: s.pihak, nama: s.nama, tanya: t.tanya, jawab: t.jawab });
    }
  }

  const bukti = [];
  for (const b of Array.isArray(buktiMentah) ? buktiMentah : []) {
    const def = KODE_BUKTI.find((x) => x.kode === Number(b.no_var));
    for (const baris of pecahBukti(b.data)) {
      const u = uraiBukti(baris, def ? def.sisi : "?");
      if (u) bukti.push({ ...u, kodeVariabel: String(b.no_var).padStart(4, "0") });
    }
  }
  const jumlahBukti = { P: bukti.filter((b) => b.sisi === "P").length, T: bukti.filter((b) => b.sisi === "T").length };
  const adaJenisBukti = {};
  for (const b of bukti) adaJenisBukti[b.jenisKode] = true;

  const jumlahSaksi = { P: saksi.filter((s) => s.pihak === "P").length, T: saksi.filter((s) => s.pihak === "T").length };
  return { ada: saksi.length > 0 || bukti.length > 0, jumlahSaksi, saksi, pokok, bukti, jumlahBukti, adaJenisBukti };
}

module.exports = { bacaBas, uraiBukti, pecahBukti, KODE_BUKTI, JENIS_BUKTI };
