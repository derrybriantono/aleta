"use strict";

/**
 * Pengaman batas waktu untuk setiap query ke database perkara.
 *
 * Sebelum ini yang ada hanya batas waktu KONEKSI (5 detik). Begitu koneksi
 * berhasil, query yang berjalan lambat digantung sampai selesai, berapa pun
 * lamanya. Kolam koneksi mysql berisi sepuluh sambungan; sepuluh query lambat
 * yang menumpuk membuat bot berhenti menjawab siapa pun — termasuk notifikasi
 * terjadwal — tanpa satu pun pesan kesalahan yang jelas.
 *
 * Dua lapis dipasang, dan keduanya memang diperlukan:
 *
 *   1. BATAS DI SISI SERVER (MAX_EXECUTION_TIME). Ini yang benar-benar
 *      MENGHENTIKAN query di dalam MySQL. Melindungi SIPP itu sendiri, bukan
 *      hanya bot. Hanya berlaku untuk SELECT.
 *
 *   2. BATAS DI SISI KLIEN (opsi timeout milik driver). Ini melepaskan bot dari
 *      penantian bila server tidak menghormati lapis pertama — misalnya versi
 *      MySQL lama atau MariaDB, yang mengabaikan petunjuk itu sebagai komentar
 *      biasa. Sengaja diberi kelonggaran di atas batas server supaya lapis
 *      pertama yang lebih rapi selalu mendapat kesempatan lebih dulu.
 *
 * Petunjuk MAX_EXECUTION_TIME aman dipasang pada server yang tidak
 * mengenalinya: MySQL memperlakukan petunjuk tak dikenal sebagai peringatan,
 * bukan galat, dan MariaDB membacanya sekadar komentar. Jadi pemasangannya
 * tidak pernah merusak query yang sudah berjalan.
 */

const { readRuntimeConfig } = require("../config/runtime-config");

const DEFAULT_QUERY_TIMEOUT_MS = Number(process.env.ALETA_BOT_QUERY_TIMEOUT_MS || 15000);
const DEFAULT_CONNECTION_LIMIT = Number(process.env.ALETA_BOT_DB_CONNECTION_LIMIT || 10);
/** Kelonggaran batas klien di atas batas server. */
const CLIENT_GRACE_MS = 2000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;

function clampTimeout(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

/** Pengaturan batas waktu, dapat diatur dari portal lewat runtime config. */
function getGuardConfig(runtimeConfig = readRuntimeConfig()) {
  const guard = (runtimeConfig && runtimeConfig.queryGuard) || {};
  const timeoutMs = clampTimeout(guard.timeoutMs, DEFAULT_QUERY_TIMEOUT_MS);
  return {
    enabled: guard.enabled !== false,
    timeoutMs,
    // Batas klien selalu sedikit lebih longgar daripada batas server.
    clientTimeoutMs: Math.min(MAX_TIMEOUT_MS, timeoutMs + CLIENT_GRACE_MS),
    serverEnforced: guard.serverEnforced !== false,
    connectionLimit: Math.max(1, Math.min(50, Number(guard.connectionLimit || DEFAULT_CONNECTION_LIMIT) || DEFAULT_CONNECTION_LIMIT)),
  };
}

/**
 * Apakah pernyataan ini SELECT tunggal?
 *
 * Petunjuk MAX_EXECUTION_TIME hanya sah pada SELECT. Pernyataan majemuk
 * dilewati karena penyisipan di depan hanya akan mengenai pernyataan pertama
 * dan menyesatkan.
 */
function isSingleSelect(sql) {
  const text = String(sql || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
  if (!/^select\s/i.test(text)) return false;
  // Titik koma di tengah menandakan lebih dari satu pernyataan.
  const withoutTrailing = text.replace(/;\s*$/, "");
  return !withoutTrailing.includes(";");
}

/**
 * Menyisipkan batas waktu sisi server tepat setelah kata SELECT.
 * Query yang sudah memuat batasnya sendiri tidak diganggu.
 */
function withServerTimeout(sql, timeoutMs) {
  const text = String(sql || "");
  if (!isSingleSelect(text)) return text;
  if (/MAX_EXECUTION_TIME\s*\(/i.test(text)) return text;
  return text.replace(/^(\s*)select(\s)/i, `$1SELECT /*+ MAX_EXECUTION_TIME(${Math.round(timeoutMs)}) */$2`);
}

/**
 * Membungkus argumen query driver mysql agar membawa batas waktu.
 *
 * Driver menerima string SQL maupun objek pilihan; keduanya ditangani, dan
 * pilihan yang sudah ditetapkan pemanggil tidak ditimpa.
 *
 * @returns {{options: (string|object), sql: string, applied: boolean}}
 */
function applyQueryGuard(sqlOrOptions, guardConfig = getGuardConfig()) {
  const isOptions = sqlOrOptions && typeof sqlOrOptions === "object";
  const originalSql = isOptions ? String(sqlOrOptions.sql || "") : String(sqlOrOptions || "");

  if (!guardConfig.enabled || !originalSql.trim()) {
    return { options: sqlOrOptions, sql: originalSql, applied: false };
  }

  const guardedSql = guardConfig.serverEnforced
    ? withServerTimeout(originalSql, guardConfig.timeoutMs)
    : originalSql;

  if (isOptions) {
    return {
      options: {
        ...sqlOrOptions,
        sql: guardedSql,
        timeout: sqlOrOptions.timeout || guardConfig.clientTimeoutMs,
      },
      sql: guardedSql,
      applied: true,
    };
  }

  return {
    options: { sql: guardedSql, timeout: guardConfig.clientTimeoutMs },
    sql: guardedSql,
    applied: true,
  };
}

/**
 * Pesan yang layak dibaca manusia saat query melewati batas waktu.
 * Dipakai agar kegagalan tidak muncul sebagai kode driver yang membingungkan.
 */
function describeTimeoutError(error, guardConfig = getGuardConfig()) {
  const detik = Math.round(guardConfig.timeoutMs / 1000);
  return (
    `Data dari SIPP tidak selesai diambil dalam ${detik} detik dan dihentikan agar tidak membebani sistem. ` +
    "Silakan coba lagi beberapa saat lagi." +
    (error && error.code ? ` (${error.code})` : "")
  );
}

module.exports = {
  CLIENT_GRACE_MS,
  DEFAULT_CONNECTION_LIMIT,
  DEFAULT_QUERY_TIMEOUT_MS,
  applyQueryGuard,
  describeTimeoutError,
  getGuardConfig,
  isSingleSelect,
  withServerTimeout,
};
