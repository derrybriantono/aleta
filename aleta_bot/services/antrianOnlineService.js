const externalDbService = require("./externalDbService");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

const DEFAULT_CONNECTION_KEY = "antrian_sidang";
// Kode satker pada nomor perkara (mis. "PA.Dgl" untuk PA Donggala). Wajib diset
// lewat env bila aplikasi dipakai satker lain, jika tidak nomor perkara singkat
// seperti "123.G.2026" akan dinormalkan ke satker yang salah.
const COURT_SUFFIX = String(process.env.ALETA_BOT_COURT_CODE || "PA.Dgl").trim() || "PA.Dgl";

const CASE_TYPE_MAP = {
  GS: "Pdt.G.S",
  B: "Pid.B",
  S: "Pid.S",
  C: "Pid.C",
  Pra: "Pid.Pra",
  "Sus-Anak": "Pid.Sus-Anak",
  JN: "JN",
  PraJN: "JN.Pra",
};

function normalizeCaseType(input = "") {
  const raw = String(input || "").trim();
  const exact = CASE_TYPE_MAP[raw];
  if (exact) return exact;
  const upper = raw.toUpperCase();
  const found = Object.entries(CASE_TYPE_MAP).find(([key]) => key.toUpperCase() === upper);
  if (found) return found[1];
  if (/^PDT\./i.test(raw)) return raw.replace(/^PDT\./i, "Pdt.");
  if (/^PID\./i.test(raw)) return raw.replace(/^PID\./i, "Pid.");
  return `Pdt.${raw || "G"}`;
}

function normalizeNomorPerkara(input = "") {
  const text = String(input || "").trim();
  if (!text) return "";
  const full = text.match(/^(\d{1,5})\s*\/\s*([A-Za-z. -]+)\s*\/\s*(\d{4})\s*\/\s*PA\.?([A-Za-z0-9]+)$/i);
  if (full) {
    return `${full[1]}/${normalizeCaseType(full[2].replace(/^Pdt\./i, ""))}/${full[3]}/PA.${full[4]}`;
  }
  const compact = text.match(/^(\d{1,5})\s*[./-]\s*([A-Za-z][A-Za-z.-]*)\s*[./-]\s*(\d{4})(?:\s*[./-]\s*PA\s*[./-]?\s*[A-Za-z0-9]+)?$/i);
  if (!compact) return "";
  return `${compact[1]}/${normalizeCaseType(compact[2])}/${compact[3]}/${COURT_SUFFIX}`;
}

function resolveQueuePartySlot(message = "", explicitSlot = "") {
  const direct = String(explicitSlot || "").toLowerCase();
  if (["pihak_2", "pihak2", "2", "tergugat", "termohon", "lawan"].includes(direct)) return "pihak_2";
  if (["pihak_1", "pihak1", "1", "penggugat", "pemohon"].includes(direct)) return "pihak_1";

  const normalized = String(message || "").toLowerCase();
  if (normalized.startsWith("antrian online")) return "pihak_2";
  if (normalized.startsWith("daftar antrian")) return "pihak_1";
  if (/\b(tergugat|termohon|pihak\s*2|pihak\s*kedua|lawan)\b/.test(normalized)) return "pihak_2";
  return "pihak_1";
}

function buildPhoneCandidates(input = "") {
  const normalized = normalizeIndonesianPhoneNumber(input);
  if (!normalized) return [];

  const local = normalized.startsWith("62") ? `0${normalized.slice(2)}` : "";
  const withoutCountryCode = normalized.startsWith("62") ? normalized.slice(2) : "";
  return Array.from(new Set([
    normalized,
    local,
    withoutCountryCode,
    `+${normalized}`,
  ].filter(Boolean)));
}

function phoneCompareExpression(columnName) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, '+', ''), '-', ''), '.', ''), ' ', ''), '(', ''), ')', '')`;
}

function mapPartySlot(pihakKe) {
  const value = Number(pihakKe || 0);
  return value === 1 ? "pihak_1" : "pihak_2";
}

function mapPartyRole(pihakKe, source = "pihak") {
  const value = Number(pihakKe || 0);
  if (source === "kuasa") {
    if (value === 1) return "kuasa penggugat/pemohon";
    if (value === 2) return "kuasa tergugat/termohon";
    if (value === 3) return "kuasa pihak intervensi";
    if (value === 4) return "kuasa turut tergugat";
    return "kuasa pihak terkait";
  }
  if (value === 1) return "penggugat/pemohon";
  if (value === 2) return "tergugat/termohon";
  if (value === 3) return "pihak intervensi";
  if (value === 4) return "turut tergugat";
  return "pihak terkait";
}

function normalizePartyMatch(row = {}, source = "pihak") {
  if (!row) return null;
  const pihakKe = Number(row.pihak_ke || 0);
  if (![1, 2, 3, 4].includes(pihakKe)) return null;
  return {
    nomorPerkara: String(row.nomor_perkara || ""),
    partySlot: mapPartySlot(pihakKe),
    partyRole: mapPartyRole(pihakKe, source),
    matchedName: String(row.nama || ""),
    matchedPhone: String(row.telepon || ""),
    source,
  };
}

async function queryFirstPartyMatch(connectionKey, sql, params) {
  const rows = await externalDbService.query(connectionKey, sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function resolveDirectPartyBySender({
  senderNumber,
  nomorPerkara = "",
  onlyToday = false,
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  const candidates = buildPhoneCandidates(senderNumber);
  if (candidates.length === 0) return null;

  const params = [];
  const filters = [
    `${phoneCompareExpression("ph.telepon")} IN (?)`,
    "vp.pihak_ke IN (1, 2, 3, 4)",
  ];
  params.push(candidates);

  if (nomorPerkara) {
    filters.push("p.nomor_perkara = ?");
    params.push(nomorPerkara);
  }

  const todayJoin = onlyToday
    ? "JOIN SIPP.perkara_jadwal_sidang js ON js.perkara_id = p.perkara_id AND js.tanggal_sidang = CURDATE()"
    : "";
  const sql = `
    SELECT
      p.nomor_perkara,
      vp.pihak_ke,
      vp.nama,
      ph.telepon
    FROM SIPP.v_pihak_perkara vp
    JOIN SIPP.pihak ph ON ph.id = vp.pihak_id
    JOIN SIPP.perkara p ON p.perkara_id = vp.perkara_id
    ${todayJoin}
    WHERE ${filters.join(" AND ")}
    ORDER BY
      CASE WHEN vp.pihak_ke = 1 THEN 1 WHEN vp.pihak_ke = 2 THEN 2 ELSE 3 END,
      p.perkara_id DESC
    LIMIT 1`;

  const row = await queryFirstPartyMatch(connectionKey, sql, params);
  return normalizePartyMatch(row, "pihak");
}

async function resolveCounselBySender({
  senderNumber,
  nomorPerkara = "",
  onlyToday = false,
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  const candidates = buildPhoneCandidates(senderNumber);
  if (candidates.length === 0) return null;

  const params = [];
  const filters = [
    `${phoneCompareExpression("ph.telepon")} IN (?)`,
    "pp.pihak_ke IN (1, 2, 3, 4)",
  ];
  params.push(candidates);

  if (nomorPerkara) {
    filters.push("p.nomor_perkara = ?");
    params.push(nomorPerkara);
  }

  const todayJoin = onlyToday
    ? "JOIN SIPP.perkara_jadwal_sidang js ON js.perkara_id = p.perkara_id AND js.tanggal_sidang = CURDATE()"
    : "";
  const sql = `
    SELECT
      p.nomor_perkara,
      pp.pihak_ke,
      pp.nama,
      ph.telepon
    FROM SIPP.perkara_pengacara pp
    JOIN SIPP.pihak ph ON ph.id = pp.pengacara_id
    JOIN SIPP.perkara p ON p.perkara_id = pp.perkara_id
    ${todayJoin}
    WHERE ${filters.join(" AND ")}
    ORDER BY pp.pihak_ke, p.perkara_id DESC
    LIMIT 1`;

  const row = await queryFirstPartyMatch(connectionKey, sql, params);
  return normalizePartyMatch(row, "kuasa");
}

async function resolvePartySlotBySender({
  senderNumber,
  nomorPerkara,
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  const nomorPerkaraFormatted = normalizeNomorPerkara(nomorPerkara);
  if (!senderNumber || !nomorPerkaraFormatted) return null;

  const direct = await resolveDirectPartyBySender({
    senderNumber,
    nomorPerkara: nomorPerkaraFormatted,
    connectionKey,
  });
  if (direct) return direct;

  return resolveCounselBySender({
    senderNumber,
    nomorPerkara: nomorPerkaraFormatted,
    connectionKey,
  });
}

async function findTodayQueueCaseBySender({
  senderNumber,
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  if (!senderNumber) return null;

  const direct = await resolveDirectPartyBySender({
    senderNumber,
    onlyToday: true,
    connectionKey,
  });
  if (direct) return direct;

  return resolveCounselBySender({
    senderNumber,
    onlyToday: true,
    connectionKey,
  });
}

async function resolveEffectiveQueueParty({
  senderNumber,
  nomorPerkara,
  message = "",
  partySlot = "",
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  const nomorPerkaraFormatted = normalizeNomorPerkara(nomorPerkara);
  let senderMatch = null;

  if (senderNumber && nomorPerkaraFormatted) {
    senderMatch = await resolvePartySlotBySender({
      senderNumber,
      nomorPerkara: nomorPerkaraFormatted,
      connectionKey,
    });
  } else if (senderNumber && !nomorPerkaraFormatted) {
    senderMatch = await findTodayQueueCaseBySender({
      senderNumber,
      connectionKey,
    });
  }

  if (senderMatch) {
    return {
      nomorPerkara: senderMatch.nomorPerkara || nomorPerkaraFormatted,
      partySlot: senderMatch.partySlot,
      resolvedBy: "sender_phone",
      partyRole: senderMatch.partyRole,
      matchedName: senderMatch.matchedName,
      matchedPhone: senderMatch.matchedPhone,
    };
  }

  return {
    nomorPerkara: nomorPerkaraFormatted,
    partySlot: resolveQueuePartySlot(message, partySlot),
    resolvedBy: "message_fallback",
    partyRole: "",
    matchedName: "",
    matchedPhone: "",
  };
}

function buildMissingCaseMessage(command = "daftar antrian") {
  return `Silakan kirim nomor perkara untuk daftar antrian online.\nContoh: ${command}#123.G.2026\n\nJika nomor WhatsApp Bapak/Ibu sudah tersimpan di data perkara hari ini, cukup ketik: ambil antrian.`;
}

function buildNotFoundMessage(nomorPerkaraFormatted) {
  return `Nomor Perkara ${nomorPerkaraFormatted} belum bersidang pada hari ini.\nSilakan ketik jadwal#nomor perkara\ncontoh: jadwal#123.G.2026\n(untuk perkara gugatan: G dan permohonan: P).`;
}

function buildSuccessMessage(nomorPerkaraFormatted, nomorAntrian, meta = {}) {
  const roleInfo = meta.partyRole ? `\nTerdeteksi sebagai: ${meta.partyRole}.` : "";
  return `Anda terdaftar dalam antrian online dengan nomor perkara ${nomorPerkaraFormatted} dan menempati antrian nomor ${nomorAntrian}.${roleInfo}\n\nSilakan hadir pada persidangan untuk mengonfirmasi kehadiran Anda kepada petugas kami. Jika nomor perkara Anda sudah dipanggil tiga kali dan tidak hadir, perkara Anda akan ditunda.\n\nUntuk informasi lebih lanjut, hubungi petugas kami di 0822-7111-5021. Kami siap membantu!`;
}

async function registerOnlineQueue({
  nomorPerkara,
  message = "",
  partySlot = "",
  senderNumber = "",
  connectionKey = DEFAULT_CONNECTION_KEY,
} = {}) {
  const queueTarget = await resolveEffectiveQueueParty({
    senderNumber,
    nomorPerkara,
    message,
    partySlot,
    connectionKey,
  });
  const nomorPerkaraFormatted = normalizeNomorPerkara(queueTarget.nomorPerkara);
  const slot = queueTarget.partySlot;
  const command = slot === "pihak_2" ? "antrian online" : "daftar antrian";
  if (!nomorPerkaraFormatted) {
    return {
      status: "needs_more_info",
      nomorPerkara: "",
      partySlot: slot,
      nomorAntrian: null,
      resolvedBy: queueTarget.resolvedBy,
      partyRole: queueTarget.partyRole,
      matchedName: queueTarget.matchedName,
      answer: buildMissingCaseMessage(command),
    };
  }

  const column = slot === "pihak_2" ? "pihak_2" : "pihak_1";
  const updateSql = `
    UPDATE sipp_turunan_antrian.antrian_sidang AS a
    JOIN SIPP.perkara AS p ON a.perkara_id = p.perkara_id
    SET a.online = 1,
        a.${column} = NOW()
    WHERE p.nomor_perkara = ?`;

  const updateResult = await externalDbService.query(connectionKey, updateSql, [nomorPerkaraFormatted]);

  const orderSql = `
    SELECT p.nomor_perkara
    FROM (
      SELECT
        a.perkara_id,
        a.majelis_hakim_kode,
        a.pihak_1,
        a.pihak_2,
        CASE
          WHEN a.pihak_1 IS NOT NULL AND a.pihak_2 IS NOT NULL THEN LEAST(a.pihak_1, a.pihak_2)
          WHEN a.pihak_1 IS NOT NULL THEN a.pihak_1
          ELSE a.pihak_2
        END AS sort_col1,
        a.perkara_id AS sort_col2,
        a.majelis_hakim_kode AS sort_col3
      FROM sipp_turunan_antrian.antrian_sidang a
      WHERE a.pihak_1 IS NOT NULL OR a.pihak_2 IS NOT NULL
      ORDER BY sort_col1, sort_col2, sort_col3
    ) AS sub
    JOIN SIPP.perkara AS p ON sub.perkara_id = p.perkara_id`;

  const rows = await externalDbService.query(connectionKey, orderSql, []);
  const targetIndex = Array.isArray(rows)
    ? rows.findIndex((row) =>
        String(row.nomor_perkara || "").replace(/\s+/g, "").toLowerCase() ===
        nomorPerkaraFormatted.replace(/\s+/g, "").toLowerCase()
      )
    : -1;
  const affectedRows = Number(updateResult?.affectedRows || 0);
  const nomorAntrian = targetIndex >= 0 ? targetIndex + 1 : null;

  if (affectedRows > 0 && nomorAntrian) {
    return {
      status: "registered",
      nomorPerkara: nomorPerkaraFormatted,
      partySlot: slot,
      nomorAntrian,
      resolvedBy: queueTarget.resolvedBy,
      partyRole: queueTarget.partyRole,
      matchedName: queueTarget.matchedName,
      answer: buildSuccessMessage(nomorPerkaraFormatted, nomorAntrian, queueTarget),
    };
  }

  return {
    status: "not_found",
    nomorPerkara: nomorPerkaraFormatted,
    partySlot: slot,
    nomorAntrian: null,
    resolvedBy: queueTarget.resolvedBy,
    partyRole: queueTarget.partyRole,
    matchedName: queueTarget.matchedName,
    answer: buildNotFoundMessage(nomorPerkaraFormatted),
  };
}


const QUEUE_COMMANDS = ["daftar antrian", "antrian online", "ambil antrian"];

/**
 * Memantau antrian sidang online dari portal.
 *
 * Antrian dicatat di tabel `sipp_turunan_antrian.antrian_sidang` yang berada di
 * luar ALETA, jadi satu-satunya cara mengetahui fiturnya jalan atau tidak
 * adalah membacanya langsung. Fungsi ini TIDAK mengubah apa pun - hanya SELECT.
 *
 * Kalau koneksi ke basis data antrian putus, itu justru informasi terpenting
 * bagi petugas: perintah "daftar antrian" dari pihak akan gagal diam-diam.
 */
async function getQueueMonitor({ connectionKey = DEFAULT_CONNECTION_KEY, limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const hasil = {
    connectionKey,
    commands: QUEUE_COMMANDS,
    reachable: false,
    error: "",
    checkedAt: new Date().toISOString(),
    totals: { sidangHariIni: 0, sudahAmbilAntrian: 0, pihak1: 0, pihak2: 0 },
    items: [],
  };

  const sql = `
    SELECT
      p.nomor_perkara,
      a.majelis_hakim_kode,
      a.online,
      -- Jam pendaftaran diformat langsung oleh MySQL menjadi teks jam dinding.
      -- Kolom ini adalah waktu lokal WITA tanpa zona; bila dibiarkan sebagai
      -- DATETIME lalu ditafsirkan driver/Node/browser, jamnya bergeser +8.
      -- Memformat di SQL memastikan yang tampil = jam yang benar-benar tercatat.
      DATE_FORMAT(a.pihak_1, '%d/%m/%Y %H:%i') AS pihak_1,
      DATE_FORMAT(a.pihak_2, '%d/%m/%Y %H:%i') AS pihak_2
    FROM sipp_turunan_antrian.antrian_sidang a
    JOIN SIPP.perkara p ON p.perkara_id = a.perkara_id
    -- HANYA SIDANG HARI INI, mengikuti tanggal server database.
    --
    -- Tabel antrian_sidang tidak dibersihkan saat berganti hari, sehingga
    -- baris hari sebelumnya masih tersimpan di sana. Tanpa penyaringan ini,
    -- panel menampilkan sisa antrian kemarin pada hari yang tidak ada
    -- sidangnya sama sekali - dan petugas membacanya sebagai "hari ini ada
    -- 36 sidang", karena memang begitu bunyi judulnya.
    --
    -- EXISTS dipakai, bukan JOIN, supaya perkara yang punya lebih dari satu
    -- jadwal tidak terhitung berkali-kali.
    --
    -- CURDATE() dinilai oleh server MySQL, jam yang sama dengan yang dipakai
    -- aplikasi antrian SIPP, sehingga keduanya selalu berganti hari bersamaan.
    WHERE EXISTS (
      SELECT 1
      FROM SIPP.perkara_jadwal_sidang js
      WHERE js.perkara_id = a.perkara_id
        AND js.tanggal_sidang = CURDATE()
    )
    ORDER BY
      CASE
        WHEN a.pihak_1 IS NOT NULL AND a.pihak_2 IS NOT NULL THEN LEAST(a.pihak_1, a.pihak_2)
        WHEN a.pihak_1 IS NOT NULL THEN a.pihak_1
        ELSE a.pihak_2
      END IS NULL,
      CASE
        WHEN a.pihak_1 IS NOT NULL AND a.pihak_2 IS NOT NULL THEN LEAST(a.pihak_1, a.pihak_2)
        WHEN a.pihak_1 IS NOT NULL THEN a.pihak_1
        ELSE a.pihak_2
      END,
      a.perkara_id,
      a.majelis_hakim_kode
    LIMIT ?`;

  let rows = [];
  try {
    rows = await externalDbService.query(connectionKey, sql, [safeLimit]);
    hasil.reachable = true;
  } catch (error) {
    hasil.error = error && error.message ? error.message : String(error);
    return hasil;
  }

  const daftar = Array.isArray(rows) ? rows : [];
  let urutan = 0;
  hasil.items = daftar.map((row) => {
    const pihak1 = row.pihak_1 || null;
    const pihak2 = row.pihak_2 || null;
    const sudahAmbil = Boolean(pihak1 || pihak2);
    if (sudahAmbil) urutan += 1;
    return {
      nomorPerkara: String(row.nomor_perkara || ""),
      majelisHakimKode: String(row.majelis_hakim_kode || ""),
      online: Number(row.online || 0) === 1,
      // Sudah berupa teks jam dinding "dd/mm/YYYY HH:mm" dari SQL — dipakai apa
      // adanya, TIDAK dilewatkan new Date() agar tidak bergeser zona lagi.
      pihak1DaftarPada: pihak1 ? String(pihak1) : null,
      pihak2DaftarPada: pihak2 ? String(pihak2) : null,
      // Nomor antrian hanya berlaku bagi yang sudah mendaftar, sesuai urutan
      // yang dipakai registerOnlineQueue saat menjawab pihak.
      nomorAntrian: sudahAmbil ? urutan : null,
    };
  });

  hasil.totals.sidangHariIni = hasil.items.length;
  hasil.totals.sudahAmbilAntrian = hasil.items.filter((item) => item.nomorAntrian !== null).length;
  hasil.totals.pihak1 = hasil.items.filter((item) => item.pihak1DaftarPada).length;
  hasil.totals.pihak2 = hasil.items.filter((item) => item.pihak2DaftarPada).length;

  return hasil;
}

module.exports = {
  DEFAULT_CONNECTION_KEY,
  QUEUE_COMMANDS,
  buildPhoneCandidates,
  normalizeNomorPerkara,
  resolveQueuePartySlot,
  resolvePartySlotBySender,
  findTodayQueueCaseBySender,
  registerOnlineQueue,
  getQueueMonitor,
};
