#!/usr/bin/env node
// =============================================================================
// Diagnosis dokumen gugatan SIPP (kolom pihak/perkara: petitum_dok).
//
// Menjawab satu pertanyaan: kalau ALETA Bot mau melampirkan dokumen ini ke
// WhatsApp pihak (penggugat/tergugat), apakah file-nya benar-benar terbaca?
// Skrip ini TIDAK mengirim pesan apa pun dan hanya MEMBACA data SIPP.
//
// Pemakaian di dalam container bot:
//   docker compose exec aleta_bot node scripts/check-sipp-document.js
//     -> ambil 10 perkara terdaftar hari ini dari SIPP, cek tiap petitum_dok
//
//   docker compose exec aleta_bot node scripts/check-sipp-document.js "upload/perkara/gugatan.pdf"
//     -> cek satu path saja (tanpa menyentuh database)
// =============================================================================
const sippDocumentService = require("../services/sippDocumentService");

const LIMIT = 10;

function label(result) {
  if (!result.ok) return "GAGAL ";
  if (result.stage === "lokal") return "OK/lok";
  return "OK/url";
}

async function reportPath(documentPath, context = "") {
  const result = await sippDocumentService.describeSippDocument(documentPath);
  const suffix = context ? `  [${context}]` : "";
  console.log(`  ${label(result)}  ${String(documentPath || "(kosong)").slice(0, 90)}${suffix}`);
  if (result.ok) {
    console.log(`          sumber : ${result.resolvedFrom}${result.size ? ` (${result.size} byte)` : ""}`);
  } else {
    console.log(`          sebab  : ${result.reason}`);
  }
  return result.ok;
}

async function main() {
  const explicitPath = process.argv[2];

  console.log("Diagnosis dokumen SIPP untuk lampiran WhatsApp");
  console.log(`  root lokal : ${sippDocumentService.SIPP_DOCUMENT_ROOTS.join(", ")}`);
  console.log(`  base URL   : ${sippDocumentService.SIPP_DOCUMENT_BASE_URL || "(tidak diset)"}`);
  console.log("");

  if (explicitPath) {
    const ok = await reportPath(explicitPath);
    process.exit(ok ? 0 : 1);
  }

  // Tanpa argumen: ambil contoh nyata dari SIPP (read-only).
  const notifikasi = require("../notifikasi.js");
  if (typeof notifikasi.getDataPihakBaru !== "function") {
    console.error("Fungsi getDataPihakBaru tidak tersedia di notifikasi.js.");
    process.exit(2);
  }

  const data = await notifikasi.getDataPihakBaru();
  const groups = ["pihakP", "pihakT", "kuasaP", "kuasaT", "turutT", "intervensi"];
  const rows = [];
  for (const group of groups) {
    for (const row of data?.[group] ?? []) {
      rows.push({ group, row });
    }
  }

  if (rows.length === 0) {
    console.log("Tidak ada pihak baru terdaftar hari ini, jadi tidak ada petitum_dok untuk diuji.");
    console.log("Jalankan ulang dengan path dokumen sebagai argumen untuk menguji path tertentu.");
    process.exit(0);
  }

  console.log(`Menguji ${Math.min(rows.length, LIMIT)} dari ${rows.length} pihak baru hari ini:\n`);
  let okCount = 0;
  for (const { group, row } of rows.slice(0, LIMIT)) {
    const ok = await reportPath(row.petitum_dok, `${group} / ${row.nomor_perkara || "-"}`);
    if (ok) okCount += 1;
  }

  const tested = Math.min(rows.length, LIMIT);
  console.log(`\nRingkasan: ${okCount}/${tested} dokumen dapat dilampirkan.`);
  if (okCount < tested) {
    console.log("Dokumen yang gagal akan tetap dikirim sebagai pesan TEKS tanpa lampiran,");
    console.log("dan dicatat di log sistem sebagai 'queue_attachment_unavailable'.");
    console.log("Perbaiki dengan me-mount folder SIPP ke container (lihat docker-compose.yml)");
    console.log("atau set ALETA_BOT_SIPP_DOCUMENT_ROOTS / ALETA_BOT_SIPP_DOCUMENT_BASE_URL.");
  }
  process.exit(okCount === tested ? 0 : 1);
}

main().catch((error) => {
  console.error("Diagnosis gagal:", error.message);
  process.exit(2);
});
