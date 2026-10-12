/**
 * ============================================================================
 * NAMA MEDIATOR DI JADWAL SIDANG (12 Okt 2026, butir 6)
 * ============================================================================
 *
 * Diminta pengguna: "beri nama mediator di bawah nama JS (di atas ruangan)
 * pada jadwal sidang di Majelis & Petugas, terus tambah juga di rincian."
 *
 * Sumbernya SUDAH sampai ke baris: bot membaca perkara_mediasi.mediator_text
 * (mediasi TERAKHIR perkara itu, lihat mediasiBanyakPerkara) dan
 * penanda-mediasi memakainya untuk lencana "Mediasi". Berkas ini hanya
 * memutuskan KAPAN namanya patut tampil pada satu baris.
 *
 * Diukur di sipp (PA Bungku) 12 Okt 2026: 575 dari 576 baris perkara_mediasi
 * punya mediator_text, isinya satu nama berikut gelar ("Massadi, S.Ag., M.H.",
 * "Jafar M. Naser, SHI") - tanda koma di dalamnya BUKAN pemisah dua orang,
 * jadi namanya tidak dipecah.
 *
 * ATURAN TAMPIL: mediator hanya disebut pada sidang yang jatuh pada atau
 * SESUDAH hari mediator itu ditunjuk (penetapan_penunjukan_mediator atau
 * dimulai_mediasi, yang lebih awal) - aturan yang sama dengan lencana
 * "Mediasi" di kolom Agenda. Sidang pertama, sebelum mediator ditunjuk,
 * tidak boleh berbunyi seakan mediatornya sudah ada: itu menuduh majelis
 * telah mengirim para pihak bermediasi sebelum ditetapkan.
 */

export type BarisMediator = {
  tanggalSidang?: string | null;
  mediasi?: {
    ditunjuk?: string | null;
    dimulai?: string | null;
    mediator?: string | null;
  } | null;
  /** false = kuerinya gagal; "tidak tahu" bukan "tidak ada", maka tidak disebut apa pun. */
  mediasiTerbaca?: boolean;
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim();
}

/** "2026-10-12T16:00:00.000Z" / "2026-10-12" -> "2026-10-12"; selain itu "". */
function tanggalIso(nilai: unknown): string {
  const cocok = /^(\d{4}-\d{2}-\d{2})/.exec(bersih(nilai));
  return cocok ? cocok[1] : "";
}

/**
 * Nama mediator yang patut tampil pada baris sidang ini, "" bila tidak ada.
 *
 * Tanpa tanggal penunjukan sama sekali (kolom kosong) namanya tetap tampil:
 * tanggal yang tidak terbaca tidak boleh menyembunyikan fakta yang terbaca.
 */
export function mediatorBaris(baris: BarisMediator): string {
  if (baris.mediasiTerbaca === false) return "";
  const m = baris.mediasi;
  if (!m) return "";
  const nama = bersih(m.mediator);
  if (!nama) return "";
  const awal = [tanggalIso(m.ditunjuk), tanggalIso(m.dimulai)].filter(Boolean).sort()[0] ?? "";
  const sidang = tanggalIso(baris.tanggalSidang);
  if (awal && sidang && awal > sidang) return "";
  return nama;
}
