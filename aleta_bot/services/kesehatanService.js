"use strict";

/**
 * Bacaan kesehatan untuk Pusat kesehatan portal (E2, 25 Okt 2026).
 *
 * HANYA MEMBACA. Dua hal yang tidak diketahui portal:
 *   - keadaan pemutus arus SIPP (sippCircuitBreakerService) - terbuka berarti
 *     SIPP sedang tertekan dan bot sengaja berhenti menanyainya;
 *   - apakah SIPP, ABT, dan antrian sidang menjawab "SELECT 1" (hanya bila
 *     diminta `ping`, supaya bacaan biasa tidak menyentuh basis data mana pun).
 *
 * Tidak ada nama basis data, alamat, akun, atau sandi dalam jawaban.
 */

const SAMBUNGAN = Object.freeze([
  { kunci: "sipp_primary", nama: "SIPP" },
  { kunci: "aps_badilag", nama: "ABT" },
  { kunci: "antrian_sidang", nama: "Antrian sidang" },
]);

const BATAS_PING_MS = 4000;

function dengarBatas(janji, ms) {
  let pewaktu;
  const batas = new Promise((_, tolak) => {
    pewaktu = setTimeout(() => tolak(new Error("habis_waktu")), ms);
  });
  return Promise.race([janji, batas]).finally(() => clearTimeout(pewaktu));
}

function ringkasCircuit(circuit) {
  if (!circuit) return null;
  return {
    keadaan: String(circuit.state || ""),
    gagalBerturut: Number(circuit.consecutiveFailures || 0),
    dibukaPada: circuit.openedAt || null,
    gagalTerakhir: circuit.lastFailureAt || null,
    berhasilTerakhir: circuit.lastSuccessAt || null,
    pesanTerakhir: String(circuit.lastErrorMessage || "").slice(0, 160),
    totalDibuka: Number(circuit.totalOpened || 0),
    totalDitolak: Number(circuit.totalRejected || 0),
  };
}

async function pingSatu(externalDbService, kunci) {
  const mulai = Date.now();
  try {
    const hasil = await dengarBatas(externalDbService.testConnection(kunci), BATAS_PING_MS);
    return {
      status: hasil && hasil.status === "success" ? "berhasil" : "gagal",
      durasiMs: Number((hasil && hasil.durationMs) || Date.now() - mulai),
      galat: hasil && hasil.status === "success" ? "" : String((hasil && hasil.error) || "").slice(0, 160),
    };
  } catch (galat) {
    return {
      status: "gagal",
      durasiMs: Date.now() - mulai,
      galat: String((galat && galat.message) || galat).slice(0, 160),
    };
  }
}

/**
 * @param {{ ping?: boolean, deps?: { externalDbService?: object, sippCircuitBreaker?: object, sekarang?: () => Date, proses?: object } }} opsi
 */
async function susunKesehatan(opsi = {}) {
  const deps = opsi.deps || {};
  const externalDbService = deps.externalDbService || require("./externalDbService");
  const breaker = deps.sippCircuitBreaker || require("./sippCircuitBreakerService");
  const sekarang = (deps.sekarang || (() => new Date()))();
  const proses = deps.proses || process;

  let circuits = [];
  try {
    circuits = (breaker.getStatus().circuits || []).map((c) => c);
  } catch {
    circuits = [];
  }

  const sambungan = [];
  for (const s of SAMBUNGAN) {
    const circuit = circuits.find((c) => c.key === s.kunci);
    sambungan.push({
      kunci: s.kunci,
      nama: s.nama,
      circuit: ringkasCircuit(circuit),
      ping: opsi.ping ? await pingSatu(externalDbService, s.kunci) : { status: "dilewati", durasiMs: 0, galat: "" },
    });
  }

  const memori = typeof proses.memoryUsage === "function" ? proses.memoryUsage() : { rss: 0 };
  return {
    ok: true,
    diukurPada: sekarang.toISOString(),
    bot: {
      uptimeDetik: Math.round(typeof proses.uptime === "function" ? proses.uptime() : 0),
      memoriMB: Math.round((Number(memori.rss) || 0) / 1048576),
      versiNode: String(proses.version || ""),
    },
    sambungan,
  };
}

module.exports = { SAMBUNGAN, susunKesehatan };
