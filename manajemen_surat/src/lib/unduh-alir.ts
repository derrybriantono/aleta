import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * ============================================================================
 * UNDUHAN BESAR LEWAT JALUR UNDUH PERAMBAN, BUKAN fetch + blob
 * (6 Oktober 2026, butir 25)
 * ============================================================================
 *
 * "Unduh seluruh perkara" 445/Pdt.G/2026/PA.Dgl menjawab "Failed to fetch".
 * Terukur di peladen (hanya baca): ZIP-nya tersusun dalam satu detik (jejak
 * audit: 51 berkas, 25.818.199 byte), Apache mencatat status 200, tetapi yang
 * terkirim selalu terputus di 11,5-12,9 MB - enam kali, di titik berbeda -
 * tanpa satu galat pun di error_log Apache maupun log container. Berkas statis
 * 32 MB lewat Apache yang sama ke komputer yang sama turun utuh. Yang memutus
 * adalah sisi peramban: tombol lama memanggil fetch() lalu menunggu SELURUH
 * badan jawaban sebagai blob, dan permintaan fetch ber-Content-Disposition
 * attachment sebesar itu dipotong di tengah - komputer itu menjalankan IDM
 * dengan ZIP di daftar tangkapannya.
 *
 * Jalan yang dipakai sekarang adalah jalan yang memang dikenali peramban DAN
 * pengelola unduhan: alamatnya dibuka sebagai unduhan biasa di bingkai
 * tersembunyi. Badan ZIP tidak pernah melewati JavaScript halaman, jadi
 * tidak ada blob raksasa di memori tab.
 *
 * Yang hilang dari unduhan biasa adalah kabarnya - peramban tidak memberi tahu
 * halaman kapan unduhan mulai atau gagal. Dua isyarat menggantikannya:
 *
 *   - BERHASIL MULAI: rute memasang cookie `aleta_unduh_<token>` pada kepala
 *     jawaban yang berhasil; halaman memeriksanya berkala.
 *   - GAGAL: jawaban galat (JSON 4xx/5xx, halaman galat proksi) tidak diunduh
 *     peramban melainkan DIMUAT di bingkai itu - halaman membacanya (asal yang
 *     sama) dan menyebutkan sebabnya, bukan "Failed to fetch".
 *   - Tidak ada kabar sama sekali sampai batas waktu: disebutkan juga, beserta
 *     kemungkinan bahwa pengelola unduhan sudah mengambil alih.
 */

export type HasilUnduhAlir =
  | { ok: true }
  | { ok: false; sebab: "galat-server" | "tidak-ada-kabar"; pesan: string };

export type OpsiUnduhAlir = {
  /** Batas menunggu kabar (cookie atau halaman galat). Bawaan 180 detik - di atas timeout=120 Apache. */
  batasMs?: number;
  /** Selang pemeriksaan cookie. */
  jedaMs?: number;
  dokumen?: Document;
};

export const BATAS_KABAR_UNDUH_MS = 180_000;

/** Token acak huruf-angka - cocok dengan pola yang diterima rute. */
export function buatTokenUnduh(): string {
  const huruf = "abcdefghijklmnopqrstuvwxyz0123456789";
  let hasil = "";
  for (let i = 0; i < 16; i += 1) hasil += huruf[Math.floor(Math.random() * huruf.length)];
  return hasil;
}

export function namaCookieUnduh(token: string) {
  return `aleta_unduh_${token}`;
}

export function alamatDenganToken(alamat: string, token: string) {
  return `${alamat}${alamat.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

/** Kalimat galat dari isi halaman yang dimuat bingkai (JSON portal atau halaman galat proksi). */
export function pesanDariHalamanGalat(teks: string, judul = ""): string {
  const bersih = String(teks || "").trim();
  if (bersih.startsWith("{")) {
    try {
      const isi = JSON.parse(bersih);
      return pesanGalatPortal(isi, "Server menolak permintaan unduhan.").replace(/_/g, " ");
    } catch {
      // bukan JSON utuh - jatuh ke teks biasa di bawah
    }
  }
  const ringkas = (judul || bersih).replace(/\s+/g, " ").slice(0, 160);
  return ringkas ? `Server menjawab: ${ringkas}` : "Server menjawab tanpa isi.";
}

/**
 * Memulai unduhan `alamat` sebagai unduhan biasa peramban dan menunggu
 * kabarnya. Tidak pernah membaca badan ZIP.
 */
export function mulaiUnduhAlir(alamat: string, opsi: OpsiUnduhAlir = {}): Promise<HasilUnduhAlir> {
  const dokumen = opsi.dokumen ?? document;
  const jendela = dokumen.defaultView ?? window;
  const batasMs = opsi.batasMs ?? BATAS_KABAR_UNDUH_MS;
  const jedaMs = opsi.jedaMs ?? 400;
  const token = buatTokenUnduh();
  const cookie = namaCookieUnduh(token);

  const bingkai = dokumen.createElement("iframe");
  bingkai.style.display = "none";
  bingkai.setAttribute("aria-hidden", "true");
  bingkai.dataset.aletaUnduh = token;

  return new Promise<HasilUnduhAlir>((selesai) => {
    let usai = false;
    const akhiri = (hasil: HasilUnduhAlir, tundaHapusMs: number) => {
      if (usai) return;
      usai = true;
      jendela.clearInterval(periksa);
      jendela.clearTimeout(batas);
      // Cookie penanda dibuang - ia hanya isyarat sekali pakai.
      dokumen.cookie = `${cookie}=; Max-Age=0; Path=/`;
      // Bingkai TIDAK dibuang seketika sesudah unduhan mulai: unduhan yang
      // sudah diserahkan ke peramban tidak bergantung padanya lagi, tetapi
      // memberi jeda tidak merugikan apa pun.
      jendela.setTimeout(() => bingkai.remove(), tundaHapusMs);
      selesai(hasil);
    };

    const periksa = jendela.setInterval(() => {
      if (dokumen.cookie.split(/;\s*/).some((x) => x.startsWith(`${cookie}=`))) {
        akhiri({ ok: true }, 60_000);
      }
    }, jedaMs);

    const batas = jendela.setTimeout(() => {
      akhiri(
        {
          ok: false,
          sebab: "tidak-ada-kabar",
          pesan: `Server belum mulai mengirim setelah ${Math.round(batasMs / 1000)} detik. Bila unduhannya ternyata sudah berjalan di bilah unduhan peramban atau di pengelola unduhan (mis. IDM), abaikan pesan ini; bila tidak, tekan tombolnya sekali lagi.`,
        },
        0
      );
    }, batasMs);

    bingkai.addEventListener("load", () => {
      // Unduhan yang berhasil tidak memuat apa pun di bingkai; yang dimuat
      // adalah jawaban galat. Bingkai kosong (about:blank awal) tidak berisi
      // teks dan karena itu diabaikan di bawah.
      let teks = "";
      let judul = "";
      try {
        const isi = bingkai.contentDocument;
        if (!isi) return;
        teks = isi.body?.innerText || isi.body?.textContent || "";
        judul = isi.title || "";
      } catch {
        teks = "";
      }
      if (!teks.trim() && !judul.trim()) return;
      akhiri({ ok: false, sebab: "galat-server", pesan: pesanDariHalamanGalat(teks, judul) }, 0);
    });

    bingkai.src = alamatDenganToken(alamat, token);
    dokumen.body.appendChild(bingkai);
  });
}
