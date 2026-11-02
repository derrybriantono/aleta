"use strict";

/**
 * ============================================================================
 * DOKUMEN OFFSCREEN "UNDUHAN AMAN" (2 Nov 2026)
 * ============================================================================
 *
 * Dibuat pekerja latar (unduh-aman-latar.js) dengan alasan BLOBS. Di sinilah
 * berkas portal (ZIP perkara, ekspor) DIAMBIL - fetch berkredensial dari asal
 * chrome-extension:// dengan izin host manifest - lalu dijadikan Blob dan
 * diberi alamat blob:chrome-extension://... yang diterbitkan pekerja latar
 * lewat chrome.downloads. Chrome tidak menahan unduhan beralamat ekstensi
 * sebagai "Insecure download blocked"; badan berkasnya tidak pernah lewat
 * pesan, jadi ratusan MB pun tidak menyentuh batas 40 MB jalur data:.
 *
 * Berkas besar tidak ditampung sebagai satu larik raksasa: potongan aliran
 * dikumpulkan per 8 MB menjadi Blob (yang disimpan Chrome di luar tumpukan JS,
 * ke cakram bila perlu), lalu Blob-Blob itu disatukan tanpa disalin ulang.
 *
 * Kabar ke pekerja latar: "mulai" (kepala jawaban diterima), "kemajuan"
 * (paling sering sedetik sekali - sekaligus menjaga pekerja latar tetap
 * hidup), lalu tepat satu dari "siap" atau "gagal". Galat server (4xx/5xx,
 * JSON galat portal, halaman web/masuk) disebut sebabnya, bukan "Failed to fetch".
 */
(function unduhAmanDokumenModul(akar) {
  const SUMBER = "aleta-unduh-aman";
  const BATAS_KEPALA_MS = 180000; // di atas timeout=120 Apache, sama dengan unduh-alir.ts portal
  const BATAS_SENYAP_MS = 120000; // aliran yang berhenti mengirim selama ini dianggap terputus
  const UMUR_BLOB_MS = 30 * 60 * 1000;
  const POTONGAN_BLOB = 8 * 1024 * 1024;
  const SELANG_KABAR_MS = 1000;

  function mb(n) {
    return `${(Number(n) / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  /** Nama dari Content-Disposition (filename* RFC 5987 dahulu). */
  function namaDariDisposisi(nilai) {
    const s = String(nilai || "");
    const bintang = s.match(/filename\*\s*=\s*(?:[A-Za-z0-9_-]+)'[^']*'([^;]+)/i);
    if (bintang) {
      try {
        return decodeURIComponent(bintang[1].trim().replace(/^"|"$/g, ""));
      } catch {
        return bintang[1].trim();
      }
    }
    const biasa = s.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i);
    if (!biasa) return "";
    const mentah = String(biasa[1] !== undefined ? biasa[1] : biasa[2]).trim();
    try {
      return decodeURIComponent(mentah);
    } catch {
      return mentah;
    }
  }

  function namaDariAlamat(alamat) {
    try {
      const potong = new URL(alamat).pathname.split("/").filter(Boolean).pop() || "";
      const n = decodeURIComponent(potong);
      return /\.[A-Za-z0-9]{2,5}$/.test(n) ? n : "";
    } catch {
      return "";
    }
  }

  /** Kalimat galat dari badan jawaban server (JSON portal, halaman web, atau teks). */
  function pesanGalatServer(teks, status, tipe) {
    const bersih = String(teks || "").trim();
    if (bersih.startsWith("{")) {
      try {
        const isi = JSON.parse(bersih);
        const e = isi && isi.error;
        const kandidat = [e && typeof e === "object" ? e.message : null, e, isi && isi.message, isi && isi.alasan, isi && isi.pesan];
        for (const k of kandidat) {
          if (typeof k === "string" && k.trim()) return `Server menolak (${status}): ${k.trim().replace(/_/g, " ").slice(0, 300)}`;
        }
      } catch {
        /* bukan JSON utuh */
      }
    }
    if (/html/i.test(String(tipe || "")) || /^<!doctype|^<html/i.test(bersih)) {
      const judul = (bersih.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
      const ringkas = (judul || bersih.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160);
      const masuk = /login|masuk|sign ?in/i.test(ringkas);
      if (masuk) return "Sesi ALETA berakhir - server menjawab halaman masuk. Muat ulang halaman, masuk kembali, lalu ulangi unduhan.";
      return `Server menjawab halaman web, bukan berkas (${status})${ringkas ? `: ${ringkas}` : ""}.`;
    }
    const ringkas = bersih.replace(/\s+/g, " ").slice(0, 160);
    return ringkas ? `Server menjawab ${status}: ${ringkas}` : `Server menjawab ${status} tanpa isi.`;
  }

  /**
   * @param {object} alat { fetch, kirim(pesan), buatUrl(blob), lepasUrl(url), Blob, AbortController,
   *                       setTimeout, clearTimeout, sekarang() }
   */
  function buatPengambil(alat) {
    const blobAktif = new Map();
    let sedangAmbil = 0;

    function sisa() {
      return blobAktif.size + sedangAmbil;
    }

    function lepas(url) {
      const butir = blobAktif.get(url);
      if (butir) {
        alat.clearTimeout(butir.henti);
        blobAktif.delete(url);
        try {
          alat.lepasUrl(url);
        } catch {
          /* sudah dilepas */
        }
      }
      return { ok: true, sisa: sisa() };
    }

    async function ambil(p) {
      const tugas = p && p.tugas;
      const alamat = String((p && p.alamat) || "");
      const kirim = (jenis, isi) => alat.kirim({ sumber: SUMBER, jenis, tugas, ...isi });
      const gagal = (pesan, tambahan) => kirim("unduh-aman-gagal", { pesan, ...(tambahan || {}) });
      sedangAmbil += 1;
      const pembatal = alat.AbortController ? new alat.AbortController() : null;
      let sebabHenti = "";
      let henti = 0;
      const pasangHenti = (ms, sebab) => {
        alat.clearTimeout(henti);
        henti = alat.setTimeout(() => {
          sebabHenti = sebab;
          if (pembatal) pembatal.abort();
        }, ms);
      };
      let diterima = 0;
      try {
        pasangHenti(BATAS_KEPALA_MS, `Server belum mulai mengirim setelah ${Math.round(BATAS_KEPALA_MS / 1000)} detik.`);
        let r;
        try {
          r = await alat.fetch(alamat, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            ...(pembatal ? { signal: pembatal.signal } : {}),
          });
        } catch (g) {
          gagal(sebabHenti || `Server ALETA tidak terjangkau dari ekstensi: ${String((g && g.message) || g).slice(0, 160)}`);
          return;
        }
        const kepala = (k) => String((r.headers && r.headers.get(k)) || "");
        const tipe = kepala("content-type");
        const disposisi = kepala("content-disposition");
        const lampiran = /attachment|filename/i.test(disposisi);
        if (!r.ok || (!lampiran && /text\/html|application\/json/i.test(tipe))) {
          let teks = "";
          try {
            teks = await r.text();
          } catch {
            teks = "";
          }
          gagal(pesanGalatServer(teks.slice(0, 4000), r.status, tipe), { galatServer: true, status: r.status });
          return;
        }
        const panjang = Number(kepala("content-length")) || 0;
        kirim("unduh-aman-kabar", { tahap: "mulai", diterima: 0, ukuran: panjang });

        const tipeBersih = tipe.split(";")[0].trim();
        const bagian = [];
        let tampung = [];
        let tampungBita = 0;
        let kabarTerakhir = alat.sekarang();
        if (r.body && typeof r.body.getReader === "function") {
          const pembaca = r.body.getReader();
          for (;;) {
            pasangHenti(BATAS_SENYAP_MS, `Server berhenti mengirim selama ${Math.round(BATAS_SENYAP_MS / 1000)} detik.`);
            const { done, value } = await pembaca.read();
            if (done) break;
            if (!value || !value.byteLength) continue;
            tampung.push(value);
            tampungBita += value.byteLength;
            diterima += value.byteLength;
            if (tampungBita >= POTONGAN_BLOB) {
              bagian.push(new alat.Blob(tampung));
              tampung = [];
              tampungBita = 0;
            }
            if (alat.sekarang() - kabarTerakhir >= SELANG_KABAR_MS) {
              kabarTerakhir = alat.sekarang();
              kirim("unduh-aman-kabar", { tahap: "kemajuan", diterima, ukuran: panjang });
            }
          }
        } else {
          const b = await r.blob();
          bagian.push(b);
          diterima = b.size;
        }
        alat.clearTimeout(henti);
        const blob = new alat.Blob([...bagian, ...tampung], tipeBersih ? { type: tipeBersih } : {});
        if (!blob.size) {
          gagal("Server mengirim berkas kosong.", { galatServer: true, status: r.status });
          return;
        }
        if (panjang > 0 && blob.size !== panjang) {
          gagal(`Sambungan terputus: baru ${mb(blob.size)} dari ${mb(panjang)} yang diterima.`);
          return;
        }
        const url = alat.buatUrl(blob);
        // Dilepas pekerja latar sesudah Chrome selesai menyimpan; ini hanya jaring pengaman.
        blobAktif.set(url, { henti: alat.setTimeout(() => lepas(url), UMUR_BLOB_MS) });
        const nama = namaDariDisposisi(disposisi) || String((p && p.nama) || "") || namaDariAlamat(alamat);
        kirim("unduh-aman-siap", { blobUrl: url, nama, ukuran: blob.size, tipe: tipeBersih });
      } catch (g) {
        gagal(
          sebabHenti ||
            `Sambungan ke server terputus${diterima ? ` sesudah ${mb(diterima)}` : ""}: ${String((g && g.message) || g).slice(0, 160)}`
        );
      } finally {
        alat.clearTimeout(henti);
        sedangAmbil -= 1;
      }
    }

    return { ambil, lepas, sisa };
  }

  function pasangDiDokumen(chrome) {
    const pengambil = buatPengambil({
      fetch: (a, o) => fetch(a, o),
      kirim: (pesan) => {
        try {
          chrome.runtime.sendMessage(pesan, () => void chrome.runtime.lastError);
        } catch {
          /* pekerja latar tidak terjangkau: tidak ada yang bisa dikabari */
        }
      },
      buatUrl: (b) => URL.createObjectURL(b),
      lepasUrl: (u) => URL.revokeObjectURL(u),
      Blob,
      AbortController: typeof AbortController === "function" ? AbortController : null,
      setTimeout: (f, ms) => setTimeout(f, ms),
      clearTimeout: (h) => clearTimeout(h),
      sekarang: () => Date.now(),
    });
    chrome.runtime.onMessage.addListener((p, pengirim, jawab) => {
      if (!p || p.sumber !== "aleta-latar" || p.sasaran !== "unduh-aman") return undefined;
      if (pengirim && pengirim.id !== undefined && pengirim.id !== chrome.runtime.id) return undefined;
      if (p.jenis === "unduh-aman-ambil") {
        void pengambil.ambil(p);
        jawab({ ok: true, dok: "unduh-aman" });
        return false;
      }
      if (p.jenis === "unduh-aman-lepas") {
        jawab(pengambil.lepas(String(p.blobUrl || "")));
        return false;
      }
      return undefined;
    });
    return pengambil;
  }

  akar.AletaUnduhAmanDok = { buatPengambil, pasangDiDokumen, namaDariDisposisi, pesanGalatServer };
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && typeof document !== "undefined") {
      pasangDiDokumen(chrome);
    }
  } catch {
    /* di luar konteks ekstensi (uji) */
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
