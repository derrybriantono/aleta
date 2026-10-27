"use strict";

/**
 * ============================================================================
 * PENAMPIL PDF SALINAN (14 Okt 2026)
 * ============================================================================
 *
 * Dibuka pekerja latar (pesan "tampilkan-pdf") sesudah PDF SALINAN disusun:
 * "SALINAN" kanan atas, "ttd" di tempat tanda tangan pejabat, dan tanda
 * tangan Panitera di blok Untuk Salinan. Halaman ini berasal dari
 * chrome-extension:// - PDF-nya tampil dan diunduh dari asal tepercaya, jadi
 * Chrome tidak menahannya seperti unduhan dari halaman http SIPP/ABT.
 *
 * Isinya dititipkan di chrome.storage.session (kunci "aletaPdf:<id>", id di
 * hash alamat) dan dihapus begitu terbaca - PDF putusan tidak tinggal di
 * penyimpanan peramban lebih lama dari perlunya.
 */

const KUNCI_AWALAN = "aletaPdf:";

function bitaDariData(alamat) {
  const koma = String(alamat || "").indexOf(",");
  const biner = atob(String(alamat).slice(koma + 1));
  const bita = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i += 1) bita[i] = biner.charCodeAt(i);
  return bita;
}

async function muat() {
  const judul = document.getElementById("judul");
  const pesan = document.getElementById("pesan");
  const unduh = document.getElementById("unduh");
  const penampil = document.getElementById("penampil");
  const id = decodeURIComponent(String(location.hash || "").replace(/^#/, ""));
  const kunci = `${KUNCI_AWALAN}${id}`;
  let titipan = null;
  try {
    const isi = await chrome.storage.session.get(kunci);
    titipan = isi && isi[kunci];
  } catch {
    titipan = null;
  }
  if (!titipan || !String(titipan.alamat || "").startsWith("data:application/pdf")) {
    pesan.textContent = "PDF salinan sudah tidak tersedia (tab ini dimuat ulang atau peramban dibuka ulang). Buat ulang dari panel ALETA.";
    pesan.className = "awas";
    penampil.remove();
    return;
  }
  try {
    await chrome.storage.session.remove(kunci);
  } catch {
    /* dibersihkan pekerja latar menurut umurnya */
  }
  const nama = String(titipan.nama || "SALINAN.pdf");
  document.title = nama;
  judul.textContent = nama;
  pesan.textContent = String(titipan.pesan || "");
  if (titipan.awas) pesan.className = "awas";
  const blob = new Blob([bitaDariData(titipan.alamat)], { type: "application/pdf" });
  const alamat = URL.createObjectURL(blob);
  penampil.src = alamat;
  unduh.disabled = false;
  // Unduhan diterbitkan pekerja latar lewat chrome.downloads (data: URL), SAMA dengan RTF - bukan <a download> blob dari halaman ini,
  // yang dapat ditahan Chrome sebagai "Insecure download blocked". Nama berkas tidak berubah.
  const alamatData = String(titipan.alamat);
  unduh.addEventListener("click", () => {
    unduh.disabled = true;
    let selesai = false;
    const akhir = (h) => {
      if (selesai) return;
      selesai = true;
      unduh.disabled = false;
      pesan.textContent = h && h.ok ? `Tersimpan: ${nama}` : `Unduhan gagal: ${(h && h.pesan) || "pekerja latar tidak menjawab"}. Coba tekan Unduh lagi.`;
      pesan.className = h && h.ok ? "" : "awas";
    };
    try {
      chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis: "unduh", nama, alamat: alamatData }, (h) => {
        void chrome.runtime.lastError;
        akhir(h);
      });
    } catch {
      akhir(null);
    }
    setTimeout(() => akhir(null), 30000);
  });
}

void muat();
