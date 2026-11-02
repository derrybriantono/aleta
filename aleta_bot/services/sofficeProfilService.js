"use strict";

/**
 * ============================================================================
 * PROFIL SOFFICE YANG SUDAH HANGAT, DIPAKAI ULANG PER SLOT (2 Nov 2026)
 * ============================================================================
 *
 * Keluhan "cetak terlalu lambat". Tiap konversi RTF -> PDF dahulu memberi
 * soffice profil BARU (-env:UserInstallation di folder sekali pakai), sehingga
 * tiap cetak membayar pembuatan profil dari nol. Cetak BAS dengan Z cross
 * otomatis = paling sedikit DUA konversi (ukur letak, lalu PDF akhir), sampai
 * lima bila kalimat jangkar perlu dirapatkan.
 *
 * Diukur di lingkungan uji (LibreOffice 24.2, 4 inti): konversi RTF kecil
 * dengan profil baru ±1.280 ms, dengan profil yang dipakai ulang ±1.050 ms;
 * blangko BAS Derry ±1.380 vs ±1.190 ms. Di server (disk container, mesin
 * lebih lambat) selisihnya perlu diukur sendiri.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 *   1. SATU PROFIL = SATU KONVERSI PADA SATU SAAT. Dua soffice atas profil
 *      yang sama bertengkar (yang kedua menyerahkan pekerjaannya ke yang
 *      pertama atau gagal tanpa keterangan) - alasan profil tersendiri sejak
 *      awal. Slot dipinjam secara eksklusif; bila semua slot sedang dipakai,
 *      konversi itu memakai profil sekali pakai di foldernya sendiri, PERSIS
 *      seperti sebelumnya. Tidak ada yang menunggu antrean: konversi serentak
 *      tetap serentak.
 *   2. PROFIL YANG MUNGKIN RUSAK TIDAK DIPAKAI LAGI. Konversi yang gagal
 *      (galat, habis waktu, hasil bukan PDF) membuang profil slot itu dan
 *      slotnya berganti folder (generasi baru): soffice yang mungkin masih
 *      menggantung atas profil lama tidak pernah disapa konversi berikutnya.
 *   3. TIDAK ADA ISI PERKARA DI PROFIL. Diperiksa: sesudah konversi, profil
 *      tidak memuat judul, penulis, isi, maupun nama/jalur berkas naskah
 *      (uji cetak-cepat-2nov). Naskah dan PDF tetap ditulis di folder sekali
 *      pakai milik pemanggil dan dibuang di sana.
 *   4. MATI = PERILAKU LAMA. ALETA_SOFFICE_PROFIL_HANGAT=0 mematikannya;
 *      bawaan 2 slot (unggah putusan mengubah dua RTF bersamaan).
 *
 * Profil berada di folder sementara proses ini (os.tmpdir()) dan dibuang saat
 * proses berakhir; container yang dinyalakan ulang mulai dari profil baru.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BATAS_SLOT = 8;

function jumlahSlot() {
  const mentah = String(process.env.ALETA_SOFFICE_PROFIL_HANGAT ?? "").trim();
  if (mentah === "") return 2;
  const n = Number(mentah);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(BATAS_SLOT, Math.floor(n));
}

let akar = null;
const slot = [];

function folderAkar() {
  if (!akar) {
    akar = path.join(os.tmpdir(), `aleta-soffice-profil-${process.pid}`);
    process.once("exit", () => {
      try {
        fs.rmSync(akar, { recursive: true, force: true });
      } catch {
        /* proses berakhir; folder sementara */
      }
    });
  }
  return akar;
}

function keUrl(folder) {
  return `file://${String(folder).replace(/\\/g, "/")}`;
}

/**
 * Meminjam profil untuk SATU konversi.
 *
 * @param {string} cadangan folder profil sekali pakai (di dalam folder kerja pemanggil) bila tidak ada slot bebas / fitur mati
 * @returns {{url: string, hangat: boolean, folder: string, kembalikan: (sehat: boolean) => void}}
 *   kembalikan(true) sesudah konversi berhasil dan hasilnya sah; kembalikan(false) membuang profil slot itu.
 */
function pinjam(cadangan) {
  const n = jumlahSlot();
  for (let i = 0; i < n; i += 1) {
    if (!slot[i]) slot[i] = { sibuk: false, generasi: 0 };
    const s = slot[i];
    if (s.sibuk) continue;
    s.sibuk = true;
    const folder = path.join(folderAkar(), `slot-${i}-${s.generasi}`);
    let selesai = false;
    return {
      url: keUrl(folder),
      hangat: true,
      folder,
      kembalikan(sehat) {
        if (selesai) return;
        selesai = true;
        if (!sehat) {
          s.generasi += 1;
          fs.promises.rm(folder, { recursive: true, force: true }).catch(() => {});
        }
        s.sibuk = false;
      },
    };
  }
  return { url: keUrl(cadangan), hangat: false, folder: cadangan, kembalikan() {} };
}

/** Keadaan slot (untuk uji dan pemeriksaan). */
function keadaan() {
  return { jumlah: jumlahSlot(), akar, slot: slot.map((s, i) => ({ slot: i, sibuk: s.sibuk, generasi: s.generasi })) };
}

module.exports = { pinjam, keadaan, jumlahSlot };
