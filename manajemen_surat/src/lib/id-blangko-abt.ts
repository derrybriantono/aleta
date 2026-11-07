/**
 * Id blangko di pustaka ALETA ABT = jalur relatif berkas di ABT ("1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", sampai 181 huruf),
 * jadi spasi, kurung, dan garis miring sah. Id hanya dipakai sebagai kunci kueri berparameter dan kolom teks; yang ditolak: karakter kendali,
 * garis miring terbalik, dan segmen "..". Satu pola untuk semua rute (cetak, selesai, siap) supaya tidak ada yang menolak id pustaka nyata.
 */
export const POLA_ID_BLANGKO = /^(?!.*(?:^|\/)\.\.(?:\/|$))[^\u0000-\u001f\\]{1,300}$/;

export const idBlangkoSah = (id: unknown): id is string => typeof id === "string" && POLA_ID_BLANGKO.test(id);
