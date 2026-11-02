/**
 * ============================================================================
 * UNDUHAN PORTAL LEWAT EKSTENSI ALETA - TIDAK DITAHAN CHROME (2 Nov 2026)
 * ============================================================================
 *
 * Keluhan: Status Perkara 273/Pdt.G/2026/PA.Dgl > "Unduh seluruh berkas" /
 * "Unduh yang dipilih" -> Chrome "Insecure download blocked". Portal disajikan
 * di http://192.168.10.10/aleta (bukan konteks aman), dan unduhan ZIP dibuka
 * di bingkai tersembunyi (unduh-alir.ts) - unduhan yang LAHIR dari halaman
 * http itulah yang ditahan. Ekstensi yang terpasang hanya mencegat klik
 * tautan, bukan navigasi bingkai, dan cadangannya dibatasi 40 MB.
 *
 * Bila ekstensi ALETA ada (aleta.js memasang data-aleta-unduh-aman="1" pada
 * <html>), halaman cukup MEMINTA ekstensi lewat jembatan yang sudah ada:
 *
 *   halaman --postMessage {sumber:"aleta-portal", jenis:"unduh-berkas", idPesan, muatan:{alamat}}--> aleta.js
 *   aleta.js -> unduh-universal.js (unduhAman) -> pekerja latar -> dokumen offscreen ekstensi:
 *              fetch berkredensial, Blob, blob:chrome-extension://..., chrome.downloads
 *   halaman <--{sumber:"aleta-ekstensi", kabar:idPesan, tahap, diterima, ukuran}-- (berkali-kali)
 *   halaman <--{sumber:"aleta-ekstensi", balasan:idPesan, jawaban:{ok, nama, ukuran, sebab, ...}}--
 *
 * Badan berkas tidak pernah lewat halaman maupun pesan - ratusan MB pun aman.
 * Tanpa ekstensi, perilaku lama dipakai persis seperti sebelumnya.
 */

import { mulaiUnduhAlir } from "@/lib/unduh-alir";

export const PETUNJUK_TANPA_EKSTENSI =
  'Bila Chrome menahan unduhan ("Insecure download blocked"), pasang/aktifkan ekstensi ALETA, atau pilih Keep di bilah unduhan Chrome.';

export type KabarUnduhEkstensi = {
  tahap: "diterima" | "mulai" | "kemajuan";
  /** Bita yang sudah diterima ekstensi dari server. */
  diterima: number;
  /** Content-Length bila server menyebutnya; 0 bila tidak (ZIP dialirkan). */
  ukuran: number;
};

export type HasilUnduhEkstensi =
  | { ok: true; nama: string; ukuran: number; berjalan: boolean }
  | {
      ok: false;
      /**
       * ekstensi           - jalurnya sendiri tidak tersedia (tidak menjawab, Chrome lama) -> pakai jalur lama
       * diambil-pengelola  - IDM dkk. mengambil alih penyimpanan blob -> pakai jalur lama (yang ditangani IDM)
       * galat-server       - server menolak/galat; sebabnya disebut
       * terputus           - sambungan putus / Chrome menolak menyimpan
       * tidak-ada-kabar    - ekstensi diam terlalu lama
       */
      sebab: "ekstensi" | "diambil-pengelola" | "galat-server" | "terputus" | "tidak-ada-kabar";
      pesan: string;
      status?: number;
    };

export type OpsiUnduhEkstensi = {
  onKabar?: (k: KabarUnduhEkstensi) => void;
  dokumen?: Document;
  /** Ekstensi harus menjawab "diterima" dalam batas ini; bila tidak, jalur lama dipakai. */
  batasJawabMs?: number;
  /** Sesudah diterima: tanpa kabar apa pun selama ini = tidak-ada-kabar. */
  batasSenyapMs?: number;
};

/** Ekstensi ALETA yang mendukung unduhan aman terpasang di halaman ini? */
export function ekstensiUnduhAmanTersedia(dokumen: Document | undefined = typeof document === "undefined" ? undefined : document) {
  return dokumen?.documentElement?.dataset?.aletaUnduhAman === "1";
}

export function formatMb(bita: number) {
  return `${(Math.max(0, bita) / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Tulisan tombol selama ekstensi bekerja. */
export function teksKemajuanUnduh(k: KabarUnduhEkstensi): string {
  if (k.tahap === "diterima") return "Server menyusun berkas…";
  if (!k.diterima) return "Mulai mengunduh…";
  if (k.ukuran > 0) return `Mengunduh ${formatMb(k.diterima)} dari ${formatMb(k.ukuran)}…`;
  return `Mengunduh ${formatMb(k.diterima)}…`;
}

function idPesanBaru() {
  const huruf = "abcdefghijklmnopqrstuvwxyz0123456789";
  let hasil = "unduh-";
  for (let i = 0; i < 16; i += 1) hasil += huruf[Math.floor(Math.random() * huruf.length)];
  return hasil;
}

type JawabanEkstensi = {
  ok?: boolean;
  nama?: string;
  ukuran?: number;
  berjalan?: boolean;
  sebab?: string;
  galatServer?: boolean;
  status?: number;
  ditolakEkstensi?: boolean;
  diambilPengelola?: boolean;
};

function petakanJawaban(j: JawabanEkstensi | null | undefined): HasilUnduhEkstensi {
  if (j && j.ok === true) {
    return { ok: true, nama: String(j.nama || ""), ukuran: Number(j.ukuran) || 0, berjalan: j.berjalan === true };
  }
  const pesan = String(j?.sebab || "Ekstensi ALETA gagal mengunduh berkas.");
  if (j?.galatServer) return { ok: false, sebab: "galat-server", pesan, status: Number(j.status) || undefined };
  if (j?.diambilPengelola) return { ok: false, sebab: "diambil-pengelola", pesan };
  if (j?.ditolakEkstensi) return { ok: false, sebab: "ekstensi", pesan };
  return { ok: false, sebab: "terputus", pesan };
}

/**
 * Meminta ekstensi mengambil dan menyimpan `alamat` (rute portal seasal).
 * Selesai sesudah berkas TERSIMPAN (atau gagal) - bukan sekadar mulai.
 */
export function unduhLewatEkstensi(alamat: string, opsi: OpsiUnduhEkstensi = {}): Promise<HasilUnduhEkstensi> {
  const dokumen = opsi.dokumen ?? document;
  const jendela = dokumen.defaultView ?? window;
  const batasJawabMs = opsi.batasJawabMs ?? 10_000;
  const batasSenyapMs = opsi.batasSenyapMs ?? 6 * 60_000;
  const idPesan = idPesanBaru();
  const mutlak = new URL(alamat, jendela.location.href).href;

  return new Promise<HasilUnduhEkstensi>((selesai) => {
    let usai = false;
    let henti = 0;
    const akhiri = (h: HasilUnduhEkstensi) => {
      if (usai) return;
      usai = true;
      jendela.clearTimeout(henti);
      jendela.removeEventListener("message", dengar);
      selesai(h);
    };
    const jaga = (ms: number, h: HasilUnduhEkstensi) => {
      jendela.clearTimeout(henti);
      henti = jendela.setTimeout(() => akhiri(h), ms);
    };
    function dengar(e: MessageEvent) {
      if (e.source !== jendela || e.origin !== jendela.location.origin) return;
      const d = e.data as { sumber?: string; kabar?: string; balasan?: string; jawaban?: JawabanEkstensi } & Partial<KabarUnduhEkstensi>;
      if (!d || typeof d !== "object" || d.sumber !== "aleta-ekstensi") return;
      if (d.balasan === idPesan) {
        akhiri(petakanJawaban(d.jawaban));
        return;
      }
      if (d.kabar !== idPesan) return;
      jaga(batasSenyapMs, {
        ok: false,
        sebab: "tidak-ada-kabar",
        pesan: `Ekstensi ALETA tidak mengabarkan unduhan selama ${Math.round(batasSenyapMs / 60_000)} menit. Periksa bilah unduhan Chrome; bila berkasnya belum ada, tekan tombolnya sekali lagi.`,
      });
      const tahap = d.tahap === "diterima" || d.tahap === "mulai" ? d.tahap : "kemajuan";
      opsi.onKabar?.({ tahap, diterima: Number(d.diterima) || 0, ukuran: Number(d.ukuran) || 0 });
    }
    jendela.addEventListener("message", dengar);
    jaga(batasJawabMs, { ok: false, sebab: "ekstensi", pesan: "Ekstensi ALETA tidak menjawab permintaan unduhan." });
    jendela.postMessage({ sumber: "aleta-portal", jenis: "unduh-berkas", idPesan, muatan: { alamat: mutlak } }, jendela.location.origin);
  });
}

/**
 * Pengganti `window.open(rute unduhan)` / `location.href = rute unduhan` untuk
 * tombol ekspor portal. Tanpa ekstensi: caraLama dijalankan SEKETIKA (masih di
 * dalam klik petugas, jadi tidak ditahan penghalang pop-up) - persis perilaku
 * lama. Dengan ekstensi: ekstensi yang menyimpan; galat server disebut lewat
 * onGalat; ekstensi yang tidak bekerja -> bingkai tersembunyi (unduhan biasa).
 */
export function unduhBerkasPortal(
  alamat: string,
  opsi: {
    caraLama?: "tab-baru" | "halaman-ini";
    onGalat?: (pesan: string) => void;
    onKabar?: (k: KabarUnduhEkstensi) => void;
    dokumen?: Document;
  } = {}
): Promise<HasilUnduhEkstensi | null> {
  const dokumen = opsi.dokumen ?? document;
  const jendela = dokumen.defaultView ?? window;
  if (!ekstensiUnduhAmanTersedia(dokumen)) {
    if (opsi.caraLama === "halaman-ini") jendela.location.href = alamat;
    else jendela.open(alamat, "_blank", "noopener,noreferrer");
    return Promise.resolve(null);
  }
  return unduhLewatEkstensi(alamat, { dokumen, onKabar: opsi.onKabar }).then(async (h) => {
    if (h.ok) return h;
    if (h.sebab === "ekstensi" || h.sebab === "diambil-pengelola") {
      const lama = await mulaiUnduhAlir(alamat, { dokumen, batasMs: 30_000 });
      // Rute ekspor tidak memasang cookie kabar: "tidak-ada-kabar" di sini bukan galat.
      if (!lama.ok && lama.sebab === "galat-server") opsi.onGalat?.(lama.pesan);
      return h;
    }
    opsi.onGalat?.(h.pesan);
    return h;
  });
}
