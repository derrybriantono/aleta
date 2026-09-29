// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TAUTAN HALAMAN PERKARA SIPP - PENYANDI, KUNCI, DAN RUTE BOT
 * ============================================================================
 *
 * <enc> pada perkara_detil_agama/<enc> harus dapat dibuka SIPP. Kekeliruan
 * sekecil apa pun - pergeseran baris AES alih-alih Rijndael-256, md5 mentah
 * alih-alih md5 heksa, derau yang dikurangi alih-alih ditambah, base64 kedua
 * yang terlupa - TIDAK berbunyi di mana pun: SIPP mendekodenya menjadi sampah
 * dan petugas melihat halaman perkara kosong.
 *
 * Karena itu yang dijaga di sini bukan "hasilnya tampak base64", melainkan
 * kesamaan PERSIS dengan PHP 5.6 + mcrypt + Encrypt.php SIPP sendiri. Vektor di
 * bawah dibangkitkan skrip PHP (vektor-uji.php di D:/aleta-dev/kerja/
 * tautan-sipp) dengan KUNCI UJI - kunci SIPP tidak pernah boleh masuk
 * repositori, dan tidak dipakai di berkas ini.
 *
 * Layanan dijalankan sungguhan lewat createRequire; db_config ditiru dan
 * mencatat tiap kueri. Tidak ada MySQL yang disentuh.
 */

const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));
// Uji mutan menjalankan berkas ini atas SALINAN layanannya (bersebelahan,
// supaya require relatifnya tetap benar) lewat SIPP_TAUTAN_BERKAS.
const BERKAS_LAYANAN = process.env.SIPP_TAUTAN_BERKAS || "./services/sippTautanService.js";

const KUNCI_UJI_1 = "ujia1eta2026x";
const KUNCI_UJI_2 = "Kunci Uji ALETA - bukan kunci SIPP!";
const KUNCI_UJI_3 = "kutip ' dan \\ garis miring";

// ============================================================================
// VEKTOR PHP 5.6 + mcrypt + Encrypt.php SIPP (KUNCI UJI)
// ============================================================================

/** mcrypt_encrypt(MCRYPT_RIJNDAEL_256, kunci, blok, MCRYPT_MODE_ECB) - kunci biner acak. */
const VEKTOR_ECB = [
  { kunciHex: "7cea3ad4d03cb1b5a3900a0f1caf2b67e1e27fc71df1ebb67524d93e144232e4", blokHex: "b82379d5c177841c098f3098b43366d46eaa8dd95dbd8e2d2ab3d0d7fb553d62", sandiHex: "86895062568732b6843cf6a610cece85b488186177653883a5e837a9a5b3e5e6" },
  { kunciHex: "553a18b71393b661cd6fb603ad9701235b52fccafd6991823f2428514549a7bf", blokHex: "52321779c38e4987f12f9d4c06dafb51a7daca9cfef4f3b8b373deabed1d72fd", sandiHex: "7d18c94635ef2e231d980ba7fc947233ec4e29a97c13a0691743163e3cbb9a39" },
  { kunciHex: "ae0a751bd36a3c8c76cee476befe565e5442f94e5f61b6cd88a3f4e4f6d09d1c", blokHex: "6bc1349d45268e725b4f8b7fd703114c618988df20acd9c3bcb26cfe5f642819", sandiHex: "901256083fe9628e045ef245d6c631ac3a826245a484b3527e994144769d0ee6" },
];

/**
 * base64_encode($this->encrypt->encode($teks)) SIPP. IV-nya dikeluarkan dari
 * hasil itu sendiri lewat _remove_cipher_noise() milik SIPP, jadi JS yang diberi
 * IV yang sama wajib menghasilkan string yang sama persis. Panjang 31/32/33 dan
 * 64/65 menguji batas blok dan CBC berantai.
 */
const VEKTOR_TETAP = [
  { kunci: KUNCI_UJI_1, teks: "7", ivHex: "54d53f1b227e6d94ebaafd06dc22d7f59a2d636e4d9488f59d9eae94b314bed2", enc: "dGpoeVRWYmdvUFpQNGw0NEZGbzVXTkpteUthejk3OWFBdFVReU9oTUlRSm03UkprTHpOUkVCT0dOVFR0U1U1ZFhxc25naUlFNFZxU1c1T1gvOVd0bmc9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "99", ivHex: "d04dbd5c52f9803a90e965ceb5e553a36635b2bfcda06bab926ee56edc680990", enc: "TXJEd2pvWmJzNXowSWNZQTdSMjFCcDV1Ri9jekE2SVE5NlZIb2hHZ2JNQnRpcXkzQTJvUjZOeXhlVHlSZW44QkUrSWpRSFMrZmlXYlZnOFplbFdtMnc9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "5143", ivHex: "eadcda80d391c526fa0a5203860e689f20e46f03ef5750b69cad73c14eafbeac", enc: "VEQ4TnNnZnorSWhlUXJNMXZrYktBbGdkMUR0VnVvY2JBZVRWOVlQbklkeS9WRXJzQkFOZ2JFNW5IOGFINGJCRGIweEZyblRIbVVZZUhseXJ2NEVUbnc9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "372959773", ivHex: "ba13b4a828db83429228b4d322c02ee380eb597cd2721e23c39ce4e27a329441", enc: "SEhibjJsdzl0cVQyWUJVRld2aVFScmdrdnJRNDFWV0lLTk5HRnE5cTkzR3lCb3JmRW9IWGJHbzBqblJTTUwzNkJocUVNN1RDOGFhMDREZ1hhUFk3cnc9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "5337791710", ivHex: "378b33ea585896e737681b9dfa84a8914df2a8cd547e01d9b86c1bbca286dffe", enc: "bWU1bUhJeTZ5VW1ib0h6UE1yd0s5SVVyRFFXNjRUZytIYU45OE5lK1FpNnc4K2VKeWszS09XRTEvUkRmb08ySUlkQUl3dE42OWd3aDhBM3I4RlpMR1E9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "491589969481", ivHex: "14e2120ce8b3096e3c88e1473428831f79da5700356a446f0d1cb2762bb98a9c", enc: "ZGtWRlBod1ZQTkNnd0VKNWJHRGxnckVUdkRpYnpYdlVjbE1VcW1EeDdjd3JDNmcwZnluLzAzZXNDK2VKanNyVXRGMHFrbUtTc1dHN0VudFpUNFZhRkE9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "7153283962670860990023418822246", ivHex: "501b510ed9efdbd3a08708d0ccabbe8d06a265117535e6e4c1aba81014cd941a", enc: "c242RVFBMVJEalVFdjJrQ0JPTWc4RDdieWtuYm1CMUpKdUlLUkVrRjkwcjlUcTNPdUcrUURiU0NLY3lBbWdSMmhCem43L2pCaVcwRTBGT1V6R2RMQlE9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "61477261628918494940784639419626", ivHex: "ed32efef2a0b0f1965678f3ac50f59daf24ad40316e1e93ad61c00895dc10078", enc: "VDVVaUlWNXRRbnZKbi9Ccy9VZTdQU3FET1R0OFJDQ2ZPMU5pdlpMNVk2Z3BiL20veFVlV2ZBbFU4b0dJL2NqWWRLY0VzcVZ4b3JsZ0EvQm9yRWFGTkE9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "754854441617320609700710123230468", ivHex: "e92aeeb1db07a13f8a2775841e53540940d2a3d4176d4c704b6bb6e30695cab5", enc: "UzQwaDR3OXAxS0h1WDlhMlZvdTJiSGdMQ0F4OTBJUFZzS0lZRnp2TkxlVWhEcWJTTEVTQjNBMy92d1YrQkZJVGh0elhEaG9QMkhkaWNERlNNbUpwdmZJbUhQN1VyRnVvTXR3Tmx1bVIvWlRpWUpZRTkxT3RzK1JLL29nMVg0MEk=" },
  { kunci: KUNCI_UJI_1, teks: "3689997209049724794595050165602251501759366633526044371314599770", ivHex: "04b90cd45d9ee62bf34763b7ef7a6904f88160183825317b55aa443777dc7fd1", enc: "Wmh3L0JwRUFHWTFYZjhUcEo3TExaekM2eFZDZWlHamd1dUdtYTZ3VTRnSFpoNnM2dURuRzVNQTVVaFRRd2svQUNGNVEybUYzeEFXTXBJRjc2VUpyNDNGdmJoMm4wTDJOeXluU2paT0Uwbm03c0xLYjIrbEFST2FmdVIya3ZZNGc=" },
  { kunci: KUNCI_UJI_1, teks: "64400174257918522042168345218152742919245030032759980623000526299", ivHex: "20512b372d3a99f038a66aa1685e84d166a94f8a5950b451e99a1b3040506aaf", enc: "Z3JSZWFXR2N6RktjM3N2VG9KYm1OSjdpdE1LL3MrdTJUdEY5WkhXSXpkODd3dUhGU2JUc0ErQnlzSURrMjZmaU9PUXI2RWdydmQrRGhTMDNYODdEY1QvYjNwRzRheE5MendEcWsrclVEWVNBV3FWWi95RzBlS3E5YzZKYzlmcGJQekZLYng4OVZiajFzTGdOd1YvRTFiNDkzdDhKUjQzYkRsaVp4cldWeDg4PQ==" },
  { kunci: KUNCI_UJI_2, teks: "29268", ivHex: "5068643fe165b7ec30a52c5264f0a9f6269099e29c4be19e7169ec31cbb3a024", enc: "aUtESnBCZkhHRkNSMVdTSWxDZmRLbGZFL0J2OWhCSUQwNkpOWnl6ckJWaHlGbkY2UmltK1JkVW1jNnhUY2dLSE9oNEx2RGZ1Z3A3MHZzVGJkYmNjT1E9PQ==" },
  { kunci: KUNCI_UJI_2, teks: "372222272512720361072424105277335", ivHex: "137e396ff79ec0a05ac2294a63b25af2b8b5bda283943be16c9739b89a84a1af", enc: "UzdhZTFDMEFJUVM3OG1HQWsrbU9KdW5wSU52a3pXeEd6dENhN3Z1OEJ1TkZKSjNWQzRNV0xLZ1lHUXFWUStRNVNZdG02K1ZpVjg5Tzgwd21hdGhzcWlXQ1hYWTBCOHVuSU1hWC82b3Uza0Nndmp4ZzhTbmZvTmkxMjlBZHV6Z1M=" },
  { kunci: KUNCI_UJI_3, teks: "2115131", ivHex: "520b8ce03f54dbfa2a208c0b3a38869b18e331b3eaea76db5c94bc1b92aaecf8", enc: "dUcvRlJxT0hEeXFRZ3J4Q25KeTUwbEFaYVJVZlVOa01rZmtkVGNzT1VsdWZnMThaZSthWUw0RUNmdlpXTFhUWk5TcG9BMDcvaHkwYi9CamVVRWk2L0E9PQ==" },
  { kunci: KUNCI_UJI_3, teks: "7600441552954368104718699182692943375359138462132264457562279461", ivHex: "35c181b0762e054e75dda8a3599a5738caa97614f1d3eebf76622942801c0d25", enc: "bXlXNkZ0cGhPWDdiUDlqYXUvNktid0xmcm5ZbU9WSHdxOGVLZExtQWM0Z3dZNmtVd0hOS0pjZURuWUorT1p1Y3o3REl0cGxoaWhueDJIZ3lZMWt6TUFPb1ZRTjhZTEtFUWZlcmV1ZjBPMUl1QXVlNVZaeHFyZVdHZEdHb0tQZVg=" },
];

/** encode() SIPP dengan IV acak (mcrypt_create_iv) - hanya dapat diperiksa lewat dekode. */
const VEKTOR_ACAK = [
  { kunci: KUNCI_UJI_1, teks: "685366", enc: "c0xQU0JTc25mWnhDTmZjSVkvbk9scnlTbVk5NTdnc3Y1ZGdZeVNhYkpYRGhXaVpQbWI4OG5rWlBHSER4enpmYWNCR1UrcEdsTWR0cllPVUt1WjZqSEE9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "762328", enc: "VGN0eDUzeENyK0VIRlg1eVcxMXA1S2s2QjRFYW1nNkcrVWx3UkhDUGtjN0lTRmNlQlRmWGRmSjlEZzJPektaVzJDaDA1M3ZXMVZ4Yi90NzBWUTVFUnc9PQ==" },
  { kunci: KUNCI_UJI_1, teks: "16199", enc: "U2NOdnFTdytRZ2NyMVdXOHRLRmtFZlhCMWxNYUpYRzdiNWdtblJoald3c1NsNEJxZ3hNSkpVS2h4ZEZDQlp4Qm1jT3BRQUo2bWZZMGUxNWFqcGpzZFE9PQ==" },
  { kunci: KUNCI_UJI_2, teks: "2874908047", enc: "L3BPb254NktCNXduYUdNaXU0dnNGUTMzRzFkRWgwS09xbldNUXBTT1ZJTk5sV0VjM2RxRHFGKy9NWGRjcGxocG8wL0NFNEFsYXlLRDNzajVEVDM2Rnc9PQ==" },
  { kunci: KUNCI_UJI_2, teks: "73259303", enc: "MitxSHdhL2xlaUVzaUNuTTh5N0hvenZleW9nbGM0VWoveVFqK3h6Qi95Q2NRaWZVSGQ3cWN4d1BmdFJZcHBPRXpnc3FoODJiblRVNDZGL0JsKzRvRGc9PQ==" },
  { kunci: KUNCI_UJI_2, teks: "7737797", enc: "R0NMR3c1OGhUSWlSaDFCWGpMSUNFTWVtMkpwblB5ZWF0TFFabGdYVkNaNDZZN2xtZHV3TWJaWjgza2w3MWxrMVBvNXlaS1hPU1VGMlZIK1dvWW5GNUE9PQ==" },
  { kunci: KUNCI_UJI_3, teks: "9391569", enc: "SlVtaGg3MCt0K2FWVkcrNnpjcTRSKzNqOU1acDlqQTV4cnlCTlNzc0FVQ1ZJTFp5elB1N21UaU5FOEh0SVdVdURsUUhTaHYzSGFnTVN6ckh4WTkxRVE9PQ==" },
  { kunci: KUNCI_UJI_3, teks: "41120", enc: "UXVHLzZJM1phcXphdEhha1JxN1NGRm9MNHplS0lyTU9XNnRYTHZTZzdCMEpNd1JhQyt0amora2g2U3RjdGNGZS9DcjljZGRNR1J3SnFyanVGT1hhTWc9PQ==" },
  { kunci: KUNCI_UJI_3, teks: "56368", enc: "djFnL0tyNVZmRkovOU54dUhuSk93aVlUTVlvS0xaYkVVSHVPQ0IzME45dDRHMTlUOTJNK2NNUUoxV0NlWGptVGNrYUYwbk9KUkh1ZVRVZDByTUhuVXc9PQ==" },
];

/**
 * $config['permitted_uri_chars'] SIPP ('+=\a-z 0-9~%.:_-') sebagaimana dirakit
 * _filter_uri() CodeIgniter: preg_quote, "\-" dikembalikan menjadi "-", /i.
 */
const POLA_PERMITTED_URI_SIPP = /^[+=\\a-z 0-9~%.:_-]+$/i;

/**
 * Rincian peladen yang tidak boleh sampai ke layar petugas: jalur berkas
 * (Windows maupun Linux), config.php, dan nama pengaturan env. Pesan gagal bot
 * diteruskan portal apa adanya ke SETIAP pengguna berkemampuan panel.
 */
const POLA_RINCIAN_PELADEN =
  /[A-Za-z]:[\\/]|(?:^|[\s"'(,])\/(?:usr|var|home|etc|opt|srv|tmp|root)\b|application[\\/]config|config\.php|\.php\b|ALETA_[A-Z_]+/;

/** console.warn ditampung - rincian untuk pengelola memang dikirim ke sana. */
function tampungLog() {
  const baris: string[] = [];
  const asli = console.warn;
  console.warn = (...x: unknown[]) => {
    baris.push(x.map(String).join(" "));
  };
  return { baris, pulihkan: () => (console.warn = asli) };
}

// ============================================================================
// TIRUAN db_config DAN PEMUAT LAYANAN
// ============================================================================

type Bahan = { rk: Uint8Array; derau: Buffer };
type Hasil = {
  ok: boolean;
  jalur?: string;
  pintu?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  alasan?: string;
  message?: string;
};
type Layanan = {
  tautanPerkara: (m: { perkaraId?: unknown; nomor?: unknown }) => Promise<Hasil>;
  POLA_SEGMEN_AMAN: RegExp;
  PINTU_MENURUT_JENIS: Record<number, string>;
  _uji: {
    SBOX: Uint8Array;
    jadwalKunci: (k: Buffer) => Uint8Array;
    sandiBlok: (rk: Uint8Array, b: Uint8Array) => Uint8Array;
    bukaBlok: (rk: Uint8Array, b: Uint8Array) => Uint8Array;
    bahanDariKunci: (k: Buffer) => Bahan;
    encodeCi: (teks: string, bahan: Bahan, iv?: Buffer) => string;
    decodeCi: (teks: string, bahan: Bahan) => string | null;
    segmenUntuk: (teks: string, bahan: Bahan, iv?: Buffer) => string;
    uraiKunciConfig: (isi: string) => { ok: boolean; kunci?: string; sebab?: string };
    jalurConfigCalon: () => string[];
    ujiDiri: () => boolean;
    VEKTOR_UJI_DIRI: { ci: { enc: string } };
    lupakan: () => void;
  };
};

type Kueri = { sql: string; nilai: unknown[] };
let catatan: Kueri[] = [];
let jawab: (sql: string, nilai: unknown[]) => unknown[] = () => [];

function bersihkanCache() {
  for (const kunci of Object.keys(muat.cache)) {
    if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
  }
}

function pasangTiruan() {
  const dbPalsu = {
    query(sql: string, nilai: unknown[] | ((e: unknown, r: unknown) => void), cb?: (e: unknown, r: unknown) => void) {
      const selesai = typeof nilai === "function" ? nilai : cb;
      const daftar = Array.isArray(nilai) ? nilai : [];
      catatan.push({ sql: String(sql), nilai: daftar });
      let hasil: unknown[];
      try {
        hasil = jawab(String(sql), daftar);
      } catch (galat) {
        selesai?.(galat, null);
        return;
      }
      selesai?.(null, hasil);
    },
  };
  const berkas = muat.resolve("./db_config");
  muat.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: dbPalsu } as unknown as NodeJS.Module;
}

/** Layanan segar - singgahan kunci, pintu, dan uji diri ikut kosong. */
function layanan(): Layanan {
  bersihkanCache();
  pasangTiruan();
  return muat(BERKAS_LAYANAN) as Layanan;
}

const bahanUji = (L: Layanan, kunci: string) => L._uji.bahanDariKunci(Buffer.from(kunci, "latin1"));

/** Segmen -> teks, persis langkah manage_perkara::setParams(): decode(base64_decode(segmen)). */
function dekodeSegmen(L: Layanan, segmen: string, kunci: string): string | null {
  return L._uji.decodeCi(Buffer.from(segmen, "base64").toString("latin1"), bahanUji(L, kunci));
}

// SIPP palsu: satu perkara Donggala, jenis pengadilan agama.
const PERKARA = [
  { perkaraId: 888, nomorPerkara: "53/Pdt.G/2019/PA.Dgl" },
  { perkaraId: 10126, nomorPerkara: "574/Pdt.G/2026/PA.Dgl" },
];
let jenisPengadilan: unknown = "4";

function jawabSipp(sql: string, nilai: unknown[]): unknown[] {
  if (/FROM sys_config/i.test(sql)) return jenisPengadilan === undefined ? [] : [{ nilai: jenisPengadilan }];
  if (/WHERE p\.perkara_id = \?/.test(sql)) return PERKARA.filter((p) => p.perkaraId === Number(nilai[0]));
  if (/WHERE p\.nomor_perkara = \?/.test(sql)) return PERKARA.filter((p) => p.nomorPerkara === nilai[0]);
  return [];
}

// ============================================================================
// LINGKUNGAN: config SIPP UJI DI FOLDER SEMENTARA
// ============================================================================

const ENV_DIJAGA = ["ALETA_SIPP_CONFIG_PATH", "ALETA_SIPP_ENCRYPTION_KEY", "ALETA_BOT_SIPP_DOCUMENT_ROOTS"] as const;
const envAwal: Record<string, string | undefined> = {};
for (const nama of ENV_DIJAGA) envAwal[nama] = process.env[nama];

const sementara = mkdtempSync(path.join(os.tmpdir(), "aleta-sipp-tautan-"));
const CONFIG_UJI = path.join(sementara, "config.php");

function tulisConfig(isi: string, berkas = CONFIG_UJI) {
  writeFileSync(berkas, isi, "latin1");
}

/**
 * Potongan config.php SIPP dengan bentuk aslinya: docblock, baris lain, lalu
 * kunci. Dua penetapan yang DIKOMENTARI sengaja diletakkan SESUDAH yang asli:
 * karena yang terakhir berlaku, pengurai yang lupa membuang komentar akan
 * memungut salah satunya dan ketahuan.
 */
function configDenganKunci(literal: string) {
  return [
    "<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');",
    "$config['base_url'] = \"http://\".$_SERVER['HTTP_HOST'].'/';",
    "/*",
    "|--------------------------------------------------------------------------",
    "| Encryption Key",
    "|--------------------------------------------------------------------------",
    "*/",
    `$config['encryption_key'] = ${literal};`,
    "/*",
    "$config['encryption_key'] = 'kunci-lama-dalam-komentar-blok';",
    "*/",
    "// $config['encryption_key'] = 'kunci-lama-dalam-komentar-baris';",
    "$config['sess_encrypt_cookie']	= TRUE;",
    "",
  ].join("\n");
}

beforeEach(() => {
  catatan = [];
  jawab = jawabSipp;
  jenisPengadilan = "4";
  delete process.env.ALETA_SIPP_ENCRYPTION_KEY;
  delete process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS;
  process.env.ALETA_SIPP_CONFIG_PATH = CONFIG_UJI;
  tulisConfig(configDenganKunci(`'${KUNCI_UJI_1}'`));
});

afterEach(() => {
  for (const nama of ENV_DIJAGA) {
    if (envAwal[nama] === undefined) delete process.env[nama];
    else process.env[nama] = envAwal[nama];
  }
});

afterAll(() => {
  bersihkanCache();
  rmSync(sementara, { recursive: true, force: true });
});

// ============================================================================
describe("Rijndael blok 256 bit sama dengan mcrypt", () => {
  it("S-box sama dengan tabel Rijndael", () => {
    const { SBOX } = layanan()._uji;
    expect([SBOX[0x00], SBOX[0x01], SBOX[0x53], SBOX[0xff]]).toEqual([0x63, 0x7c, 0xed, 0x16]);
    expect(new Set(SBOX).size).toBe(256);
  });

  it("blok mentah (ECB) sama persis dengan mcrypt_encrypt MCRYPT_RIJNDAEL_256, dan bukaBlok membaliknya", () => {
    const u = layanan()._uji;
    for (const v of VEKTOR_ECB) {
      const rk = u.jadwalKunci(Buffer.from(v.kunciHex, "hex"));
      expect(Buffer.from(u.sandiBlok(rk, Buffer.from(v.blokHex, "hex"))).toString("hex")).toBe(v.sandiHex);
      expect(Buffer.from(u.bukaBlok(rk, Buffer.from(v.sandiHex, "hex"))).toString("hex")).toBe(v.blokHex);
    }
  });

  it("uji diri bawaan lulus", () => {
    expect(layanan()._uji.ujiDiri()).toBe(true);
  });
});

// ============================================================================
describe("format CI_Encrypt sama persis dengan Encrypt.php SIPP", () => {
  it("IV yang sama menghasilkan segmen yang sama sampai bait terakhir - termasuk batas blok dan CBC berantai", () => {
    const L = layanan();
    for (const v of VEKTOR_TETAP) {
      const segmen = L._uji.segmenUntuk(v.teks, bahanUji(L, v.kunci), Buffer.from(v.ivHex, "hex"));
      expect(segmen, `${v.kunci} / ${v.teks.length} angka`).toBe(v.enc);
    }
  });

  it("segmen buatan PHP (IV acak) didekode menjadi teks yang sama", () => {
    const L = layanan();
    for (const v of [...VEKTOR_TETAP, ...VEKTOR_ACAK]) {
      expect(dekodeSegmen(L, v.enc, v.kunci), `${v.kunci} / ${v.teks}`).toBe(v.teks);
    }
  });

  it("kunci yang keliru tidak pernah mendekode menjadi teks aslinya", () => {
    const L = layanan();
    for (const v of VEKTOR_ACAK) {
      const kunciLain = v.kunci === KUNCI_UJI_1 ? KUNCI_UJI_2 : KUNCI_UJI_1;
      expect(dekodeSegmen(L, v.enc, kunciLain)).not.toBe(v.teks);
    }
  });

  it("decode menolak seperti CI: karakter di luar alfabet base64 menjadi null", () => {
    const L = layanan();
    expect(L._uji.decodeCi("bukan base64!", bahanUji(L, KUNCI_UJI_1))).toBeNull();
    expect(L._uji.decodeCi("QUJD", bahanUji(L, KUNCI_UJI_1))).toBeNull(); // kurang dari satu IV
  });
});

// ============================================================================
describe("segmen aman di jalur URL SIPP", () => {
  it("2.000 segmen acak: tanpa '/' dan '+', lolos permitted_uri_chars, dan kembali ke id-nya", () => {
    const L = layanan();
    const bahan = bahanUji(L, KUNCI_UJI_1);
    for (let i = 0; i < 2000; i += 1) {
      const id = String(1 + Math.floor(Math.random() * 10 ** (1 + (i % 9))));
      const segmen = L._uji.segmenUntuk(id, bahan);
      expect(segmen).toMatch(L.POLA_SEGMEN_AMAN);
      expect(segmen).toMatch(POLA_PERMITTED_URI_SIPP);
      expect(segmen.includes("/") || segmen.includes("+")).toBe(false);
      expect(L._uji.decodeCi(Buffer.from(segmen, "base64").toString("latin1"), bahan)).toBe(id);
    }
  });

  it("penjaganya menggigit: base64 SATU lapis (tanpa base64 kedua) memuat '/' atau '+' dan ditolak pola", () => {
    // Tanpa ini, pola yang terlalu longgar akan lulus diam-diam - dan satu "/"
    // di segmen memecah segment(2) sehingga setParams() menjawab 404.
    const L = layanan();
    const bahan = bahanUji(L, KUNCI_UJI_1);
    const selapis = Array.from({ length: 200 }, () => L._uji.encodeCi("10126", bahan));
    const cacat = selapis.filter((s) => s.includes("/") || s.includes("+"));
    expect(cacat.length).toBeGreaterThan(0);
    for (const s of cacat) expect(s).not.toMatch(L.POLA_SEGMEN_AMAN);
  });
});

// ============================================================================
describe("kunci dari config SIPP", () => {
  it("literal PHP diurai seperti PHP: kutip tunggal/ganda, eskape, komentar dilewati, penetapan terakhir berlaku", () => {
    const { uraiKunciConfig: urai } = layanan()._uji;
    expect(urai(configDenganKunci("'abc123'"))).toEqual({ ok: true, kunci: "abc123" });
    expect(urai(configDenganKunci(String.raw`'a\'b\\c\n'`))).toEqual({ ok: true, kunci: "a'b\\c\\n" });
    expect(urai(configDenganKunci(String.raw`"a\"b\\c\n\x41\101\q"`))).toEqual({ ok: true, kunci: 'a"b\\c\nAA\\q' });
    expect(urai(`<?php\n// $config['encryption_key'] = 'lama';\n# $config['encryption_key'] = 'lama2';\n$config["encryption_key"] = 'baru';\n`)).toEqual({
      ok: true,
      kunci: "baru",
    });
    expect(urai(`<?php\n$config['encryption_key'] = 'pertama';\n$config['encryption_key'] = 'kedua';\n`)).toEqual({
      ok: true,
      kunci: "kedua",
    });
  });

  it("yang tidak dapat dihitung di luar PHP ditolak, bukan ditebak", () => {
    const { uraiKunciConfig: urai } = layanan()._uji;
    expect(urai(configDenganKunci(`"awal$lain"`))).toEqual({ ok: false, sebab: "tidak_dapat_diurai" });
    expect(urai(configDenganKunci(`getenv('KUNCI')`))).toEqual({ ok: false, sebab: "tidak_dapat_diurai" });
    expect(urai(configDenganKunci(`'a' . 'b'`))).toEqual({ ok: false, sebab: "tidak_dapat_diurai" });
    // get_key(): `$key == FALSE` - di PHP "0" == FALSE.
    expect(urai(configDenganKunci(`''`))).toEqual({ ok: false, sebab: "kosong" });
    expect(urai(configDenganKunci(`'0'`))).toEqual({ ok: false, sebab: "kosong" });
    expect(urai(`<?php\n/*\n$config['encryption_key'] = 'hanya-komentar';\n*/\n`)).toEqual({ ok: false, sebab: "tidak_ditemukan" });
  });

  it("tautan memakai kunci dari berkas config, dan kuncinya tidak pernah ada di jawaban", async () => {
    const L = layanan();
    const hasil = await L.tautanPerkara({ perkaraId: "888" });
    expect(hasil.ok).toBe(true);
    expect(hasil.jalur).toMatch(/^perkara_detil_agama\/[A-Za-z0-9]+={0,2}$/);
    expect(dekodeSegmen(L, String(hasil.jalur).split("/")[1], KUNCI_UJI_1)).toBe("888");

    const teks = JSON.stringify(hasil);
    const md5 = createHash("md5").update(KUNCI_UJI_1).digest("hex");
    expect(teks).not.toContain(KUNCI_UJI_1);
    expect(teks).not.toContain(md5);
  });

  it("config diganti dengan kunci baru: tautan berikutnya ikut kunci baru", async () => {
    const L = layanan();
    const lama = await L.tautanPerkara({ perkaraId: "888" });
    expect(dekodeSegmen(L, String(lama.jalur).split("/")[1], KUNCI_UJI_1)).toBe("888");

    tulisConfig(configDenganKunci(`'${KUNCI_UJI_2}'`));
    // Waktu ubah dimajukan tegas - sistem berkas yang kasar resolusinya tidak
    // boleh membuat uji ini lulus karena kebetulan ukuran berkasnya berbeda.
    const nanti = new Date(Date.now() + 5000);
    utimesSync(CONFIG_UJI, nanti, nanti);
    const baru = await L.tautanPerkara({ perkaraId: "888" });
    expect(dekodeSegmen(L, String(baru.jalur).split("/")[1], KUNCI_UJI_2)).toBe("888");
  });

  it("ALETA_SIPP_ENCRYPTION_KEY menimpa berkas config", async () => {
    process.env.ALETA_SIPP_ENCRYPTION_KEY = KUNCI_UJI_3;
    const L = layanan();
    const hasil = await L.tautanPerkara({ perkaraId: "10126" });
    expect(dekodeSegmen(L, String(hasil.jalur).split("/")[1], KUNCI_UJI_3)).toBe("10126");
  });

  it("tanpa jalur tegas: config dicari di <akar SIPP>/application/config/config.php (ALETA_BOT_SIPP_DOCUMENT_ROOTS)", async () => {
    // Inilah jalur peladen: folder SIPP terpasang hanya-baca di /usr/src/app/SIPP.
    const akar = path.join(sementara, "SIPP");
    mkdirSync(path.join(akar, "application", "config"), { recursive: true });
    tulisConfig(configDenganKunci(`'${KUNCI_UJI_2}'`), path.join(akar, "application", "config", "config.php"));
    delete process.env.ALETA_SIPP_CONFIG_PATH;
    process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS = `${path.join(sementara, "tidak-ada")},${akar}`;
    const L = layanan();
    expect(L._uji.jalurConfigCalon()).toEqual([
      path.join(sementara, "tidak-ada", "application", "config", "config.php"),
      path.join(akar, "application", "config", "config.php"),
    ]);
    const hasil = await L.tautanPerkara({ perkaraId: "888" });
    expect(dekodeSegmen(L, String(hasil.jalur).split("/")[1], KUNCI_UJI_2)).toBe("888");
  });

  it("config tidak ada: kunci_tidak_terbaca, jalurnya ke log saja, dan SIPP tidak disentuh", async () => {
    process.env.ALETA_SIPP_CONFIG_PATH = path.join(sementara, "tidak-ada.php");
    const log = tampungLog();
    try {
      const hasil = await layanan().tautanPerkara({ perkaraId: "888" });
      expect(hasil).toMatchObject({ ok: false, alasan: "kunci_tidak_terbaca" });
      expect(hasil.message).not.toContain("tidak-ada.php");
      expect(hasil.jalur).toBeUndefined();
      expect(log.baris.join("\n")).toContain(path.join(sementara, "tidak-ada.php"));
    } finally {
      log.pulihkan();
    }
    expect(catatan).toEqual([]);
  });

  it("pola rincian server sungguh menangkap bentuk pesan lama yang membawa jalur", () => {
    // Penjaga yang tidak dapat gagal bukan penjaga: pesan sebelum perbaikan ini
    // membawa jalur container dan nama pengaturan ke layar.
    for (const lama of [
      "Untuk pengelola: config.php SIPP tidak ditemukan (dicari di /var/www/html/SIPP/application/config/config.php, /usr/src/app/SIPP/application/config/config.php).",
      "Untuk pengelola: berkas D:\\Aplikasi\\SIPP\\application\\config\\config.php ada tetapi tidak dapat dibaca (EACCES).",
      "setel ALETA_SIPP_ENCRYPTION_KEY pada layanan aleta-bot.",
    ]) {
      expect(lama).toMatch(POLA_RINCIAN_PELADEN);
      expect(JSON.stringify({ message: lama })).toMatch(POLA_RINCIAN_PELADEN);
    }
    // Dan tidak menuduh kalimat petugas yang sah: nomor perkara bergaris miring.
    expect("Perkara 53/Pdt.G/2019/PA.Dgl tidak ditemukan di SIPP.").not.toMatch(POLA_RINCIAN_PELADEN);
  });

  it("kunci tidak terbaca APA PUN sebabnya: layar mendapat satu kalimat tanpa jalur, log mendapat rinciannya tanpa kunci", async () => {
    const fsBot = muat("fs") as typeof import("node:fs");
    const bacaAsli = fsBot.readFileSync;
    const log = tampungLog();
    const kasus: Array<{ nama: string; siapkan: () => void; diLog: string }> = [
      {
        nama: "berkas config yang ditegaskan tidak ada",
        siapkan: () => {
          process.env.ALETA_SIPP_CONFIG_PATH = path.join(sementara, "tidak-ada.php");
        },
        diLog: path.join(sementara, "tidak-ada.php"),
      },
      {
        nama: "akar SIPP bawaan tidak memuat config",
        siapkan: () => {
          delete process.env.ALETA_SIPP_CONFIG_PATH;
          process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS = path.join(sementara, "akar-kosong");
        },
        diLog: path.join(sementara, "akar-kosong"),
      },
      {
        nama: "encryption_key tidak ada",
        siapkan: () => tulisConfig("<?php\n$config['base_url'] = '';\n"),
        diLog: CONFIG_UJI,
      },
      {
        // Kuncinya ADA di berkas, di dalam ekspresi: log tetap tidak boleh
        // mengutip isi berkas.
        nama: "encryption_key berupa ekspresi",
        siapkan: () => tulisConfig(configDenganKunci(`'${KUNCI_UJI_1}' . 'x'`)),
        diLog: CONFIG_UJI,
      },
      {
        nama: "encryption_key kosong",
        siapkan: () => tulisConfig(configDenganKunci("''")),
        diLog: CONFIG_UJI,
      },
      {
        nama: "berkas ada tetapi tidak dapat dibaca",
        siapkan: () => {
          fsBot.readFileSync = ((berkas: unknown, ...sisa: unknown[]) => {
            if (String(berkas) === CONFIG_UJI) {
              throw Object.assign(new Error(`EACCES: permission denied, open '${CONFIG_UJI}'`), { code: "EACCES" });
            }
            return (bacaAsli as (...a: unknown[]) => unknown)(berkas, ...sisa);
          }) as typeof fsBot.readFileSync;
        },
        diLog: CONFIG_UJI,
      },
    ];
    const kalimat = new Set<string>();
    try {
      for (const k of kasus) {
        process.env.ALETA_SIPP_CONFIG_PATH = CONFIG_UJI;
        delete process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS;
        tulisConfig(configDenganKunci(`'${KUNCI_UJI_1}'`));
        fsBot.readFileSync = bacaAsli;
        k.siapkan();
        log.baris.length = 0;

        const hasil = await layanan().tautanPerkara({ perkaraId: "888" });
        expect(hasil, k.nama).toMatchObject({ ok: false, alasan: "kunci_tidak_terbaca" });
        expect(JSON.stringify(hasil), k.nama).not.toMatch(POLA_RINCIAN_PELADEN);
        expect(String(hasil.message), k.nama).not.toContain(sementara);
        kalimat.add(String(hasil.message));

        const tercatat = log.baris.join("\n");
        expect(tercatat, k.nama).toContain(k.diLog);
        expect(tercatat, k.nama).not.toContain(KUNCI_UJI_1);
      }
    } finally {
      fsBot.readFileSync = bacaAsli;
      log.pulihkan();
    }
    // Satu kalimat untuk semua sebab: yang membedakan sebab adalah log.
    expect(kalimat.size).toBe(1);
    expect([...kalimat][0]).toContain("admin ALETA");
    expect(catatan).toEqual([]);
  });

  it("log kegagalan kunci tidak berulang untuk sebab yang sama, tetapi sebab baru langsung tercatat", async () => {
    const log = tampungLog();
    const kiniAsli = Date.now;
    try {
      const L = layanan();
      const hitung = (nama: string) => log.baris.filter((b) => b.includes(nama)).length;

      process.env.ALETA_SIPP_CONFIG_PATH = path.join(sementara, "tidak-ada-1.php");
      for (let i = 0; i < 5; i += 1) await L.tautanPerkara({ perkaraId: "888" });
      expect(hitung("tidak-ada-1.php")).toBe(1);

      process.env.ALETA_SIPP_CONFIG_PATH = path.join(sementara, "tidak-ada-2.php");
      await L.tautanPerkara({ perkaraId: "888" });
      await L.tautanPerkara({ perkaraId: "888" });
      expect(hitung("tidak-ada-2.php")).toBe(1);

      // Sebelas menit kemudian sebab yang sama dicatat lagi.
      Date.now = () => kiniAsli() + 11 * 60 * 1000;
      await L.tautanPerkara({ perkaraId: "888" });
      expect(hitung("tidak-ada-2.php")).toBe(2);
    } finally {
      Date.now = kiniAsli;
      log.pulihkan();
    }
  });

  it("uji diri gagal: tidak ada tautan sama sekali, dan SIPP tidak disentuh", async () => {
    const L = layanan();
    const asli = L._uji.VEKTOR_UJI_DIRI.ci.enc;
    L._uji.VEKTOR_UJI_DIRI.ci.enc = `${asli.slice(0, -4)}AAA=`;
    try {
      const hasil = await L.tautanPerkara({ perkaraId: "888" });
      expect(hasil).toMatchObject({ ok: false, alasan: "sandi_tidak_lulus_uji" });
      expect(catatan).toEqual([]);
    } finally {
      L._uji.VEKTOR_UJI_DIRI.ci.enc = asli;
    }
  });
});

// ============================================================================
describe("perkara dan pintu masuknya", () => {
  it("perkaraId: SELECT berparameter; jenis pengadilan 4 -> perkara_detil_agama", async () => {
    const hasil = await layanan().tautanPerkara({ perkaraId: "888" });
    expect(hasil).toMatchObject({ ok: true, pintu: "perkara_detil_agama", perkaraId: "888", nomorPerkara: "53/Pdt.G/2019/PA.Dgl" });
    const cari = catatan.find((k) => /FROM perkara p/.test(k.sql));
    expect(cari?.nilai).toEqual(["888"]);
    expect(cari?.sql).not.toContain("888");
    for (const k of catatan) expect(k.sql.trim()).toMatch(/^SELECT\b/i);
  });

  it("pintu mengikuti cabang perkara_list.php; kosong dibaca 1 seperti login.php", async () => {
    const kasus: Array<[unknown, string]> = [
      ["1", "perkara_detil"],
      ["2", "perkara_detil_mil"],
      ["3", "perkara_detil_tun"],
      ["4", "perkara_detil_agama"],
      ["", "perkara_detil"],
      [null, "perkara_detil"],
      [undefined, "perkara_detil"], // baris sys_config 83 tidak ada
      ["9", "perkara_detil"],
    ];
    for (const [nilai, pintu] of kasus) {
      jenisPengadilan = nilai;
      const hasil = await layanan().tautanPerkara({ perkaraId: "888" });
      expect(hasil.pintu, `sys_config 83 = ${String(nilai)}`).toBe(pintu);
      expect(String(hasil.jalur).startsWith(`${pintu}/`)).toBe(true);
    }
  });

  it("sys_config gagal dibaca: pintu umum perkara_detil, dan kegagalannya tidak disinggahkan", async () => {
    const L = layanan();
    jawab = (sql, nilai) => {
      if (/FROM sys_config/.test(sql)) throw new Error("tabel terkunci (uji)");
      return jawabSipp(sql, nilai);
    };
    const pesan: string[] = [];
    const asliWarn = console.warn;
    console.warn = (...x: unknown[]) => pesan.push(x.join(" "));
    try {
      expect((await L.tautanPerkara({ perkaraId: "888" })).pintu).toBe("perkara_detil");
    } finally {
      console.warn = asliWarn;
    }
    expect(pesan.some((p) => p.includes("tabel terkunci"))).toBe(true);
    jawab = jawabSipp;
    expect((await L.tautanPerkara({ perkaraId: "888" })).pintu).toBe("perkara_detil_agama");
  });

  it("nomor saja: dicari lewat nomor_perkara, perkara_id terbesar bila kembar", async () => {
    const hasil = await layanan().tautanPerkara({ nomor: "  574 / Pdt.G / 2026 / PA.Dgl " });
    expect(hasil).toMatchObject({ ok: true, perkaraId: "10126" });
    const cari = catatan.find((k) => /WHERE p\.nomor_perkara = \?/.test(k.sql));
    expect(cari?.nilai).toEqual(["574/Pdt.G/2026/PA.Dgl"]);
    expect(cari?.sql).toMatch(/ORDER BY p\.perkara_id DESC/);
  });

  it("perkaraId dan nomor yang menunjuk perkara berbeda: DITOLAK, tanpa jalur", async () => {
    const hasil = await layanan().tautanPerkara({ perkaraId: "888", nomor: "574/Pdt.G/2026/PA.Dgl" });
    expect(hasil).toMatchObject({ ok: false, alasan: "nomor_tidak_cocok" });
    expect(hasil.jalur).toBeUndefined();
    expect(hasil.message).toContain("574/Pdt.G/2026/PA.Dgl");
    expect(hasil.message).toContain("53/Pdt.G/2019/PA.Dgl");
  });

  it("perkaraId dan nomor yang sama (beda spasi dan huruf) diterima", async () => {
    const hasil = await layanan().tautanPerkara({ perkaraId: "888", nomor: "53 / pdt.g / 2019 / pa.dgl" });
    expect(hasil).toMatchObject({ ok: true, perkaraId: "888" });
  });

  it("yang disandikan perkara_id dari SIPP, bukan masukannya: '0888' menjadi '888'", async () => {
    const L = layanan();
    const hasil = await L.tautanPerkara({ perkaraId: "0888" });
    expect(hasil.perkaraId).toBe("888");
    expect(dekodeSegmen(L, String(hasil.jalur).split("/")[1], KUNCI_UJI_1)).toBe("888");
  });

  it("perkara tidak ada: perkara_tidak_ditemukan", async () => {
    const L = layanan();
    expect(await L.tautanPerkara({ perkaraId: "5" })).toMatchObject({ ok: false, alasan: "perkara_tidak_ditemukan" });
    expect(await L.tautanPerkara({ nomor: "1/Pdt.G/1999/PA.Dgl" })).toMatchObject({ ok: false, alasan: "perkara_tidak_ditemukan" });
  });

  it("masukan kosong atau pengenal tidak sah ditolak TANPA menyentuh SIPP", async () => {
    const L = layanan();
    expect(await L.tautanPerkara({})).toMatchObject({ ok: false, alasan: "masukan_kosong" });
    expect(await L.tautanPerkara({ perkaraId: " ", nomor: " " })).toMatchObject({ ok: false, alasan: "masukan_kosong" });
    for (const buruk of ["abc", "1 OR 1=1", "-5", "12345678901", ["1", "2"], { a: 1 }]) {
      expect(await L.tautanPerkara({ perkaraId: buruk }), JSON.stringify(buruk)).toMatchObject({
        ok: false,
        alasan: "perkara_id_tidak_sah",
      });
    }
    expect(catatan).toEqual([]);
  });

  it("SIPP melempar: sipp_tidak_terbaca, bukan galat yang lolos", async () => {
    jawab = () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3306");
    };
    const asliWarn = console.warn;
    console.warn = () => undefined;
    try {
      const hasil = await layanan().tautanPerkara({ perkaraId: "888" });
      expect(hasil).toMatchObject({ ok: false, alasan: "sipp_tidak_terbaca" });
      expect(hasil.message).not.toContain("ECONNREFUSED");
    } finally {
      console.warn = asliWarn;
    }
  });
});

// ============================================================================
// RUTE BOT - DIPOTONG DARI internalGatewayRoutes.js, DIJALANKAN SUNGGUHAN
// ============================================================================

// Uji mutan rute memakai SALINAN berkas rute di luar repositori lewat
// SIPP_TAUTAN_RUTE: berkas rute dipakai bersama banyak fitur, dan merusaknya di
// tempat - walau sebentar - dapat menggagalkan pekerjaan lain yang sedang diuji.
const BERKAS_RUTE = process.env.SIPP_TAUTAN_RUTE || path.join(AKAR_BOT, "routes", "internalGatewayRoutes.js");
const PENJAGA_TOKEN = () => undefined;

function muatRute(L: Layanan) {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const awal = isi.indexOf('router.get("/sipp/tautan-perkara"');
  const akhir = isi.indexOf("\n});\n", awal);
  if (!(awal > 0 && akhir > awal)) throw new Error("Rute /sipp/tautan-perkara tidak ditemukan.");
  const rute: Record<string, { penjaga: unknown; penangan: (req: unknown, res: unknown) => Promise<void> }> = {};
  vm.runInContext(
    isi.slice(awal, akhir + 4),
    vm.createContext({
      sippTautanService: L,
      requireInternalToken: PENJAGA_TOKEN,
      router: {
        get: (jalur: string, penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) => {
          rute[jalur] = { penjaga, penangan };
        },
      },
      console,
    }),
    { filename: "internalGatewayRoutes.js#sipp-tautan-perkara" }
  );
  return rute["/sipp/tautan-perkara"];
}

async function panggilRute(L: Layanan, query: Record<string, unknown>) {
  const { penangan } = muatRute(L);
  let status = 200;
  let json: Record<string, unknown> = {};
  const res = {
    status(s: number) {
      status = s;
      return res;
    },
    json(x: unknown) {
      json = JSON.parse(JSON.stringify(x));
      return res;
    },
  };
  await penangan({ query }, res);
  return { status, json };
}

describe("rute bot GET /sipp/tautan-perkara", () => {
  it("terdaftar di balik requireInternalToken, dan layanannya dimuat di kepala berkas", () => {
    expect(muatRute(layanan()).penjaga).toBe(PENJAGA_TOKEN);
    expect(readFileSync(BERKAS_RUTE, "utf8")).toContain('const sippTautanService = require("../services/sippTautanService");');
  });

  it("200 berisi jalur relatif, pintu, dan perkara - tanpa kunci", async () => {
    const L = layanan();
    const r = await panggilRute(L, { perkaraId: "888", nomor: "53/Pdt.G/2019/PA.Dgl" });
    expect(r.status).toBe(200);
    expect(Object.keys(r.json).sort()).toEqual(["jalur", "nomorPerkara", "ok", "perkaraId", "pintu"]);
    expect(r.json.ok).toBe(true);
    expect(dekodeSegmen(L, String(r.json.jalur).split("/")[1], KUNCI_UJI_1)).toBe("888");
    expect(JSON.stringify(r.json)).not.toContain(KUNCI_UJI_1);
  });

  it("kegagalan: kode HTTP menurut alasannya, dengan kalimat untuk petugas di message", async () => {
    const L = layanan();
    const kasus: Array<[Record<string, unknown>, number, string]> = [
      [{}, 400, "masukan_kosong"],
      [{ perkaraId: "x" }, 400, "perkara_id_tidak_sah"],
      [{ perkaraId: ["1", "2"] }, 400, "perkara_id_tidak_sah"],
      [{ perkaraId: "5" }, 404, "perkara_tidak_ditemukan"],
      [{ perkaraId: "888", nomor: "574/Pdt.G/2026/PA.Dgl" }, 409, "nomor_tidak_cocok"],
    ];
    for (const [query, status, alasan] of kasus) {
      const r = await panggilRute(L, query);
      expect(r.status, JSON.stringify(query)).toBe(status);
      expect(r.json).toMatchObject({ ok: false, alasan });
      expect(String(r.json.message).length).toBeGreaterThan(10);
      // gatewayFetch portal membaca error LEBIH DAHULU dari message; error
      // yang ikut terisi akan menenggelamkan kalimat untuk petugas.
      expect(r.json.error).toBeUndefined();
      // Jawaban ini diteruskan portal ke layar petugas apa adanya.
      expect(JSON.stringify(r.json), JSON.stringify(query)).not.toMatch(POLA_RINCIAN_PELADEN);
    }

    process.env.ALETA_SIPP_CONFIG_PATH = path.join(sementara, "tidak-ada.php");
    const log = tampungLog();
    try {
      const tanpaKunci = await panggilRute(layanan(), { perkaraId: "888" });
      expect(tanpaKunci.status).toBe(503);
      expect(tanpaKunci.json.alasan).toBe("kunci_tidak_terbaca");
      expect(JSON.stringify(tanpaKunci.json)).not.toMatch(POLA_RINCIAN_PELADEN);
      expect(log.baris.join("\n")).toContain("tidak-ada.php");
    } finally {
      log.pulihkan();
    }
  });

  it("layanan melempar: 500 { ok:false, error }", async () => {
    const L = layanan();
    const rusak = { ...L, tautanPerkara: async () => Promise.reject(new Error("rusak (uji)")) };
    const r = await panggilRute(rusak as Layanan, { perkaraId: "888" });
    expect(r.status).toBe(500);
    expect(r.json).toEqual({ ok: false, error: "rusak (uji)" });
  });
});
