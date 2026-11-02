"use strict";

/**
 * ============================================================================
 * JALUR UNDUHAN AMAN UNTUK BERKAS BESAR - SISI PEKERJA LATAR (2 Nov 2026)
 * ============================================================================
 *
 * Keluhan: "Unduh seluruh berkas" / "Unduh yang dipilih" di Status Perkara
 * (ZIP perkara, 2-28 MB per arsip pindaian, bisa ratusan MB) dijawab Chrome
 * "Insecure download blocked". Sebab yang terbukti dari kode:
 *   1. Portal (src/lib/unduh-alir.ts) membuka rute ZIP di BINGKAI TERSEMBUNYI.
 *      Unduhan itu lahir dari halaman http - unduh-universal.js hanya mencegat
 *      klik tautan/a.click() di bingkai utama, bukan navigasi <iframe>.
 *   2. Cadangan "unduh-ulang" (latar.js) mengulangnya dengan fetch + blob di
 *      TAB, lalu data: lewat pesan - dibatasi 40 MB, dan fetch+blob ZIP di tab
 *      itulah yang dulu dipotong IDM (butir 25, 6 Okt 2026).
 *   3. Unduhan http langsung dari ekstensi pun dapat ditahan (lihat
 *      unduhPaketTerbaru di latar.js).
 *
 * Jalur baru, tanpa blob raksasa lewat pesan:
 *
 *   halaman/skrip konten --"unduh-aman-mulai" {alamat}--> pekerja latar (berkas ini)
 *   pekerja latar        --buat dokumen offscreen (unduh-aman.html, alasan BLOBS)
 *   pekerja latar        --"unduh-aman-ambil" {alamat, tugas}--> dokumen offscreen
 *   dokumen offscreen    fetch berkredensial (izin host manifest) -> Blob -> blob:chrome-extension://...
 *   dokumen offscreen    --"unduh-aman-kabar"/"-siap"/"-gagal" {tugas}--> pekerja latar
 *   pekerja latar        terbitkanUnduhan(blob:chrome-extension://..., nama) = chrome.downloads
 *   pekerja latar        --chrome.tabs.sendMessage "unduh-aman-kabar" {idTugas, tahap}--> tab asal
 *
 * Asal unduhannya chrome-extension:// (konteks aman), bukan http - sama
 * alasannya dengan data: yang sudah lolos selama ini, tetapi tanpa batas
 * 40 MB: badan berkas tidak pernah melewati pesan, hanya alamat blob-nya.
 *
 * Seluruh keadaan tugas DIBAWA di pesan (tab, bingkai, idTugas) - pekerja latar
 * MV3 yang dimatikan Chrome di tengah unduhan panjang dibangunkan lagi oleh
 * pesan "siap" dari dokumen offscreen dan tetap tahu ke tab mana kabarnya.
 *
 * Yang diterima hanya: GET, asal SAMA dengan bingkai pengirim, dan asal itu
 * satker (192.168.10.10 / 127.0.0.1, port bebas) - persis cakupan skrip
 * konten. Tidak ada yang ditulis ke DOM halaman dari sini.
 */
(function unduhAmanLatarModul(akar) {
  const DOK = "unduh-aman.html";
  const SUMBER_DOK = "aleta-unduh-aman";
  const POLA_ASAL = /^https?:\/\/(?:192\.168\.10\.10|127\.0\.0\.1)(?::\d+)?$/i;
  /** Menunggu Chrome selesai MENYALIN blob ke cakram (bukan mengambil dari server). */
  const BATAS_TUNTAS_MS = 10 * 60 * 1000;
  const PESAN_PENGELOLA =
    "Berkas sudah diambil dari server, tetapi penyimpanannya diambil alih program pengunduh (mis. Internet Download Manager) dan hasilnya kosong. Unduhan dicoba lewat jalur peramban biasa; bila tetap gagal, tambahkan 192.168.10.10 ke pengecualian situs program pengunduh itu.";

  const AKHIRAN_TIPE = {
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/json": "json",
    "application/rtf": "rtf",
    "text/rtf": "rtf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };

  function stempel() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  }

  /** Nama berkas yang aman bagi chrome.downloads: tanpa jalur, berakhiran, <= 180 aksara. */
  function rapikanNama(nama, tipe) {
    let n = String(nama || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
      .replace(/^[\s.]+|[\s.]+$/g, "")
      .trim();
    const akhiran = AKHIRAN_TIPE[String(tipe || "").split(";")[0].trim().toLowerCase()] || "";
    if (!n || /^download(?:\s*\(\d+\))?(?:\.[A-Za-z0-9]+)?$/i.test(n)) n = `Unduhan ${stempel()}${akhiran ? `.${akhiran}` : ""}`;
    else if (!/\.[A-Za-z0-9]{2,5}$/.test(n) && akhiran) n = `${n}.${akhiran}`;
    if (n.length > 180) {
      const titik = n.lastIndexOf(".");
      const ekor = titik > 0 && n.length - titik <= 6 ? n.slice(titik) : "";
      n = n.slice(0, 180 - ekor.length).trim() + ekor;
    }
    return n;
  }

  function teksGalat(g) {
    return String((g && g.message) || g || "galat tidak dikenal").slice(0, 200);
  }

  /**
   * @param {any} chrome
   * @param {{ terbitkan: (alamat: string, nama: string, tuntasMs: number) => Promise<any> }} alat
   *   terbitkan = terbitkanUnduhan latar.js (SATU-satunya chrome.downloads.download).
   */
  function pasang(chrome, alat) {
    let sedangMembuat = null;

    function asalEkstensi() {
      try {
        // Bukan new URL(...).origin: skema chrome-extension: tidak "istimewa" menurut WHATWG URL di luar Chrome.
        return String(chrome.runtime.getURL("")).replace(/\/+$/, "");
      } catch {
        return "";
      }
    }

    function blobMilikSendiri(alamat) {
      const asal = asalEkstensi();
      return !!asal && String(alamat || "").startsWith(`blob:${asal}/`);
    }

    function dariDokumen(pengirim) {
      try {
        return (
          !!pengirim &&
          !pengirim.tab &&
          (pengirim.id === undefined || pengirim.id === chrome.runtime.id) &&
          String(pengirim.url || "").startsWith(chrome.runtime.getURL(DOK))
        );
      } catch {
        return false;
      }
    }

    async function adaDokumen() {
      try {
        if (typeof chrome.runtime.getContexts === "function") {
          const k = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [chrome.runtime.getURL(DOK)] });
          return Array.isArray(k) && k.length > 0;
        }
        if (typeof chrome.offscreen.hasDocument === "function") return !!(await chrome.offscreen.hasDocument());
      } catch {
        /* dianggap belum ada - createDocument yang menolak dobel ditangkap di bawah */
      }
      return false;
    }

    async function pastikanDokumen() {
      if (await adaDokumen()) return;
      if (!sedangMembuat) {
        sedangMembuat = Promise.resolve(
          chrome.offscreen.createDocument({
            url: DOK,
            reasons: ["BLOBS"],
            justification: "Mengambil berkas portal ALETA dan menyimpannya lewat chrome.downloads dari asal ekstensi (bukan unduhan http yang ditahan Chrome).",
          })
        )
          .catch((g) => {
            // Dua unduhan serentak: yang kedua mendapati dokumennya sudah ada.
            if (!/single offscreen|only a single|already/i.test(teksGalat(g))) throw g;
          })
          .finally(() => {
            sedangMembuat = null;
          });
      }
      await sedangMembuat;
    }

    function kirimKeDokumen(pesan) {
      return new Promise((selesai) => {
        try {
          chrome.runtime.sendMessage({ sumber: "aleta-latar", sasaran: "unduh-aman", ...pesan }, (j) => {
            let galat = null;
            try {
              galat = chrome.runtime.lastError || null;
            } catch (e) {
              galat = e;
            }
            selesai(galat ? { ok: false, pesan: teksGalat(galat) } : j || { ok: false, pesan: "dokumen unduhan tidak menjawab" });
          });
        } catch (g) {
          selesai({ ok: false, pesan: teksGalat(g) });
        }
      });
    }

    function kabarKeTab(tugas, isi) {
      if (!tugas || !Number.isInteger(tugas.tab)) return;
      const pesan = { sumber: "aleta-latar", jenis: "unduh-aman-kabar", idTugas: String(tugas.id || ""), ...isi };
      try {
        const balik = () => {
          try {
            void chrome.runtime.lastError;
          } catch {
            /* tab sudah ditutup */
          }
        };
        const janji = chrome.tabs.sendMessage(tugas.tab, pesan, { frameId: Number(tugas.bingkai) || 0 }, balik);
        if (janji && typeof janji.catch === "function") janji.catch(() => {});
      } catch {
        /* tab sudah ditutup: unduhannya tetap tersimpan, kabarnya saja yang hilang */
      }
    }

    /** Pulang { alamat, tugas } atau { pesan } bila ditolak. */
    function periksaMulai(pesan, pengirim) {
      const tab = pengirim && pengirim.tab;
      if (!tab || !Number.isInteger(tab.id)) return { pesan: "permintaan bukan dari tab" };
      let u;
      let asal;
      try {
        u = new URL(String(pesan.alamat || ""));
        asal = new URL(String(pengirim.url || tab.url || "")).origin;
      } catch {
        return { pesan: "alamat unduhan tidak sah" };
      }
      if (u.protocol !== "http:" && u.protocol !== "https:") return { pesan: "alamat unduhan bukan http" };
      if (u.origin !== asal) return { pesan: "alamat unduhan bukan milik halaman ini" };
      if (!POLA_ASAL.test(u.origin)) return { pesan: "alamat unduhan di luar server satker" };
      const id = String(pesan.idTugas || "").slice(0, 64);
      if (!id) return { pesan: "idTugas kosong" };
      return {
        alamat: u.href,
        tugas: { id, tab: tab.id, bingkai: Number.isInteger(pengirim.frameId) ? pengirim.frameId : 0 },
      };
    }

    async function mulai(pesan, pengirim) {
      const cek = periksaMulai(pesan, pengirim);
      if (!cek.alamat) return { ok: false, ditolakEkstensi: true, pesan: cek.pesan };
      if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
        return { ok: false, ditolakEkstensi: true, pesan: "Chrome ini belum mendukung jalur unduhan aman ekstensi (perbarui Chrome)." };
      }
      try {
        await pastikanDokumen();
      } catch (g) {
        return { ok: false, ditolakEkstensi: true, pesan: `dokumen unduhan ekstensi gagal dibuat: ${teksGalat(g)}` };
      }
      const perintah = { jenis: "unduh-aman-ambil", alamat: cek.alamat, nama: String(pesan.nama || "").slice(0, 200), tugas: cek.tugas };
      let j = await kirimKeDokumen(perintah);
      if (!j || j.ok !== true) {
        // Dokumen yang baru lahir kadang belum memasang pendengarnya.
        await new Promise((r) => setTimeout(r, 300));
        j = await kirimKeDokumen(perintah);
      }
      if (!j || j.ok !== true) return { ok: false, ditolakEkstensi: true, pesan: `dokumen unduhan ekstensi tidak menjawab: ${(j && j.pesan) || "-"}` };
      return { ok: true, diterima: true, idTugas: cek.tugas.id };
    }

    async function lepasBlob(blobUrl) {
      const j = await kirimKeDokumen({ jenis: "unduh-aman-lepas", blobUrl });
      if (j && j.ok && Number(j.sisa) === 0 && typeof chrome.offscreen.closeDocument === "function") {
        try {
          await chrome.offscreen.closeDocument();
        } catch {
          /* sudah tertutup */
        }
      }
    }

    /** Dokumen offscreen selesai mengambil: terbitkan dari blob milik ekstensi. */
    async function terbitkanSiap(p) {
      const tugas = p.tugas || {};
      const blobUrl = String(p.blobUrl || "");
      if (!blobMilikSendiri(blobUrl)) {
        kabarKeTab(tugas, { tahap: "gagal", ok: false, pesan: "alamat blob bukan milik ekstensi - ditolak" });
        return;
      }
      const ukuran = Number(p.ukuran) || 0;
      const nama = rapikanNama(p.nama, p.tipe);
      let h;
      try {
        h = await alat.terbitkan(blobUrl, nama, BATAS_TUNTAS_MS);
      } catch (g) {
        h = { ok: false, pesan: teksGalat(g) };
      }
      h = h || { ok: false, pesan: "chrome.downloads tidak menjawab" };
      let hasil;
      const ukuranCakram = Number(h.fileSize);
      const ukuranCocok = !(ukuran > 0 && Number.isFinite(ukuranCakram) && ukuranCakram >= 0 && ukuranCakram !== ukuran);
      if (h.ok && h.ada !== false && ukuranCocok) {
        hasil = { tahap: "selesai", ok: true, nama, ukuran };
      } else if (h.state === "waktu") {
        // Chrome masih menyalin: tidak dilaporkan gagal, blob TIDAK dilepas.
        hasil = { tahap: "selesai", ok: true, nama, ukuran, berjalan: true };
      } else if (h.ok || h.galat === "USER_CANCELED" || h.state === "hilang") {
        hasil = { tahap: "gagal", ok: false, diambilPengelola: true, pesan: PESAN_PENGELOLA };
      } else {
        hasil = {
          tahap: "gagal",
          ok: false,
          pesan: h.galat ? `Chrome menghentikan penyimpanan berkas (${h.galat}).` : `Chrome menolak menyimpan berkas: ${h.pesan || "sebab tidak diketahui"}.`,
        };
      }
      if (h.state !== "waktu") void lepasBlob(blobUrl);
      kabarKeTab(tugas, hasil);
    }

    chrome.runtime.onMessage.addListener((pesan, pengirim, jawab) => {
      if (!pesan || typeof pesan !== "object") return undefined;
      if (pesan.sumber === "aleta-panel" && pesan.jenis === "unduh-aman-mulai") {
        mulai(pesan, pengirim).then(jawab, (g) => jawab({ ok: false, ditolakEkstensi: true, pesan: teksGalat(g) }));
        return true; // jawaban menyusul
      }
      if (pesan.sumber !== SUMBER_DOK || !dariDokumen(pengirim)) return undefined;
      if (pesan.jenis === "unduh-aman-kabar") {
        kabarKeTab(pesan.tugas, { tahap: pesan.tahap === "mulai" ? "mulai" : "kemajuan", diterima: Number(pesan.diterima) || 0, ukuran: Number(pesan.ukuran) || 0 });
      } else if (pesan.jenis === "unduh-aman-gagal") {
        kabarKeTab(pesan.tugas, {
          tahap: "gagal",
          ok: false,
          pesan: String(pesan.pesan || "unduhan gagal").slice(0, 400),
          galatServer: pesan.galatServer === true,
          status: Number(pesan.status) || 0,
        });
      } else if (pesan.jenis === "unduh-aman-siap") {
        void terbitkanSiap(pesan);
      } else {
        return undefined;
      }
      jawab({ ok: true });
      return false;
    });

    return { mulai, terbitkanSiap, rapikanNama, blobMilikSendiri };
  }

  akar.AletaUnduhAman = { pasang, rapikanNama, DOK };
})(typeof globalThis !== "undefined" ? globalThis : self);
