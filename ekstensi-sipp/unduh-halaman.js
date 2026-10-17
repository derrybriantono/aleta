"use strict";

/**
 * ============================================================================
 * UNDUHAN UNIVERSAL - SISI DUNIA HALAMAN (17 Okt 2026)
 * ============================================================================
 *
 * Skrip konten biasa (dunia terasing) melihat KLIK pada tautan, tetapi tidak
 * melihat a.click() yang dipanggil skrip halaman pada tautan yang belum
 * terpasang di DOM (pola umum "buat <a download>, click(), buang": portal,
 * dan sebagian halaman SIPP). Peristiwa click demikian tidak pernah naik ke
 * document.
 *
 * Berkas ini berjalan di dunia HALAMAN dan hanya melakukan SATU hal: sebelum
 * HTMLAnchorElement.prototype.click berjalan pada tautan ber-atribut download,
 * ia mengabarkan alamat + namanya lewat peristiwa dokumen yang dapat
 * dibatalkan. Bila unduh-universal.js (dunia terasing) mengambilnya
 * (preventDefault), click asli TIDAK dijalankan - unduhannya diterbitkan
 * ekstensi. Bila tidak ada yang mengambil (wilayah ABT non-Derry, alamat
 * lintas asal, ekstensi belum siap), click berjalan SEPERTI BIASA.
 *
 * Pembungkus kedua: HTMLFormElement.prototype.submit. form.submit() tidak
 * melahirkan peristiwa submit, jadi kiriman POST-nya dikabarkan (tidak
 * dibatalkan) supaya unduhan terblokir dari borang itu dikenali sebagai POST
 * dan tidak ditebak sebagai GET.
 *
 * Tidak membaca, mengubah, atau menulis apa pun di halaman selain itu. Detail
 * peristiwa berupa teks JSON: obyek tidak diteruskan lintas dunia oleh Chrome.
 */
(function unduhHalamanModul() {
  try {
    if (typeof HTMLAnchorElement === "undefined" || window.__unduhTautanDipasang) return;
    window.__unduhTautanDipasang = true;
    const NAMA = "unduh-tautan-ekstensi";
    const asli = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      try {
        if (this.hasAttribute("download") && this.getAttribute("href")) {
          const kabar = new CustomEvent(NAMA, {
            cancelable: true,
            detail: JSON.stringify({ href: this.href, nama: this.getAttribute("download") || "" }),
          });
          // false = ada yang mengambil alih (preventDefault).
          if (!document.dispatchEvent(kabar)) return undefined;
        }
      } catch {
        /* gagal mengabarkan: lanjut ke click asli */
      }
      return asli.apply(this, arguments);
    };
    // form.submit() tidak melahirkan peristiwa submit. Kiriman POST-nya
    // dikabarkan (tanpa dibatalkan) supaya unduhan yang terblokir dari borang
    // itu dikenali sebagai POST dan TIDAK ditebak sebagai GET lalu diulang.
    if (typeof HTMLFormElement !== "undefined") {
      const submitAsli = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function submit() {
        try {
          if (String(this.method || "get").toUpperCase() === "POST") {
            const data = new FormData(this);
            const entri = [];
            let berkas = false;
            for (const [k, v] of data.entries()) {
              if (typeof v === "string") entri.push([k, v]);
              else berkas = true;
            }
            document.dispatchEvent(
              new CustomEvent("kirim-borang-ekstensi", {
                detail: JSON.stringify({ aksi: this.action || location.href, metode: "POST", berkas, entri }),
              })
            );
          }
        } catch {
          /* kabar gagal: kirim tetap berjalan */
        }
        return submitAsli.apply(this, arguments);
      };
    }
  } catch {
    /* tanpa pembungkus, hanya klik nyata dan cadangan yang bekerja */
  }
})();
