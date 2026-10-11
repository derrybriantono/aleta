"use client";

import { useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";
import type { KontakParaPihak, KontakParaPihakBaris } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/* === STATUS-ZIP 12 Okt === */

/**
 * ============================================================================
 * EMAIL, NOMOR WHATSAPP, DAN KESEDIAAN SIDANG ELEKTRONIK PADA "PARA PIHAK"
 * (butir 12, 12 Oktober 2026)
 * ============================================================================
 *
 * Di bawah nama tiap pihak dan kuasa: email, nomor WhatsApp/HP, dan "Bersedia
 * sidang elektronik (e-Litigasi)" - ya / tidak / belum menjawab / tidak
 * diketahui. Email dan nomor datang dari SIPP dulu, lalu e-Court, SELALU dengan
 * tanda sumber; bila SIPP dan e-Court berbeda, nilai e-Court ikut disebut.
 * Kesediaan sidang elektronik dari persetujuan saluran elektronik e-Court -
 * yang tidak terbaca disebut "tidak diketahui" beserta sebabnya, tidak ditebak.
 *
 * Dibaca SEKALI per perkara dan disimpan - sepuluh nama tidak berarti sepuluh
 * pembacaan. Hak lihatnya dijaga rute (403 = bagian ini tidak digambar, bukan
 * pesan galat: yang tidak berhak tidak perlu tahu ada yang disembunyikan).
 */

type Keadaan =
  | { tahap: "memuat" }
  | { tahap: "ditolak" }
  | { tahap: "galat"; pesan: string }
  | { tahap: "siap"; data: KontakParaPihak };

const simpanan = new Map<string, Keadaan>();
const sedangJalan = new Map<string, Promise<void>>();
const pendengar = new Set<() => void>();

function beritahu() {
  for (const p of pendengar) p();
}

async function muat(nomorPerkara: string) {
  if (simpanan.has(nomorPerkara) && simpanan.get(nomorPerkara)!.tahap !== "memuat") return;
  const lama = sedangJalan.get(nomorPerkara);
  if (lama) return lama;
  simpanan.set(nomorPerkara, { tahap: "memuat" });
  const kerja = (async () => {
    try {
      const balasan = await fetch(
        apiPath(`/api/aleta-ecourt/kontak-para-pihak?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );
      if (balasan.status === 403) {
        simpanan.set(nomorPerkara, { tahap: "ditolak" });
        return;
      }
      const isi = ((await balasan.json()) as { data?: KontakParaPihak & { alasan?: string; available?: boolean } })?.data;
      if (!balasan.ok || !isi) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: "Kontak para pihak tidak dapat dibaca." });
      } else if (isi.ok === false) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: isi.alasan || "Kontak para pihak tidak dapat dibaca." });
      } else {
        simpanan.set(nomorPerkara, { tahap: "siap", data: isi });
      }
    } catch (e) {
      simpanan.set(nomorPerkara, {
        tahap: "galat",
        pesan: e instanceof Error ? e.message : "Kontak para pihak tidak dapat dibaca.",
      });
    } finally {
      sedangJalan.delete(nomorPerkara);
      beritahu();
    }
  })();
  sedangJalan.set(nomorPerkara, kerja);
  beritahu();
  return kerja;
}

/** Kosongkan simpanan - dipakai uji, dan bila petugas meminta baca ulang. */
export function bersihkanKontakParaPihak(nomorPerkara?: string) {
  if (nomorPerkara) simpanan.delete(nomorPerkara);
  else simpanan.clear();
  beritahu();
}

export function useKontakParaPihak(nomorPerkara: string): Keadaan {
  const [, paksa] = useState(0);
  // HAK-PERAN 12 Okt: kontak pribadi pihak = status.data-pihak; rute juga 403.
  const boleh = bolehAksiLayar(usePenggunaAktifOpsional(), "status.data-pihak");
  useEffect(() => {
    const dengar = () => paksa((x) => x + 1);
    pendengar.add(dengar);
    if (nomorPerkara && boleh) void muat(nomorPerkara);
    return () => {
      pendengar.delete(dengar);
    };
  }, [nomorPerkara, boleh]);
  if (!boleh) return { tahap: "ditolak" };
  return simpanan.get(nomorPerkara) ?? { tahap: "memuat" };
}

/** Mencari baris kontak untuk satu orang pada daftar pihak Status Perkara. */
export function cariKontakPihak(
  data: KontakParaPihak,
  orang: { nama: string; jenis: string; pihakKe: number | null }
): KontakParaPihakBaris | null {
  const baku = orang.nama.trim().toLowerCase().replace(/\s+/g, " ");
  const jenis = orang.jenis === "kuasa" ? "kuasa" : "pihak";
  const semua = data.orang.filter(
    (x) => x.nama.trim().toLowerCase().replace(/\s+/g, " ") === baku && x.jenis === jenis
  );
  return semua.find((x) => x.pihakKe === orang.pihakKe) ?? semua[0] ?? null;
}

const LABEL_ELITIGASI: Record<KontakParaPihakBaris["elitigasi"]["status"], { teks: string; kelas: string }> = {
  ya: { teks: "Ya", kelas: "text-emerald-700 dark:text-emerald-300" },
  tidak: { teks: "Tidak", kelas: "text-rose-700 dark:text-rose-300" },
  belum: { teks: "Belum menjawab", kelas: "text-amber-700 dark:text-amber-300" },
  "tidak-diketahui": { teks: "Tidak diketahui", kelas: "text-muted-foreground" },
  "tidak-berlaku": { teks: "-", kelas: "text-muted-foreground" },
};

function TandaSumber({ sumber }: { sumber: string }) {
  if (!sumber) return null;
  return (
    <span className="ml-1 rounded border border-border px-1 text-[0.65rem] uppercase text-muted-foreground">
      {sumber === "sipp" ? "SIPP" : "e-Court"}
    </span>
  );
}

function RuasKontak({
  label,
  nilai,
  tambahan,
  kosong,
}: {
  label: string;
  nilai: KontakParaPihakBaris["email"];
  tambahan?: string;
  kosong: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5" data-ruas-kontak={label}>
      <span className="w-[8.5rem] shrink-0 text-muted-foreground">{label}</span>
      {nilai.nilai ? (
        <>
          <span className="break-all font-medium">{nilai.nilai}</span>
          <TandaSumber sumber={nilai.sumber} />
          {nilai.lazim === false ? <span className="text-amber-700 dark:text-amber-300">(bentuknya tidak lazim)</span> : null}
          {tambahan ? <span className="text-muted-foreground">{tambahan}</span> : null}
          {nilai.lain.map((l) => (
            <span key={`${l.sumber}-${l.nilai}`} className="text-muted-foreground">
              · {l.sumber === "ecourt" ? "e-Court" : "SIPP"}: <span className="break-all">{l.nilai}</span>
            </span>
          ))}
        </>
      ) : (
        <span className="text-muted-foreground">{kosong}</span>
      )}
    </div>
  );
}

/**
 * Baris kontak di bawah satu nama pada "Para pihak".
 *
 * `orang` dari daftar pihak Status Perkara. Pihak yang tidak terdaftar pada
 * jawaban bot (turut tergugat, saksi) tidak digambari apa-apa - bagian ini
 * hanya berbicara tentang pihak dan kuasa yang kontaknya memang dibaca.
 */
export function KontakPihak({
  nomorPerkara,
  orang,
}: {
  nomorPerkara: string;
  orang: { nama: string; jenis: string; pihakKe: number | null };
}) {
  const keadaan = useKontakParaPihak(nomorPerkara);
  if (keadaan.tahap === "ditolak") return null;
  if (keadaan.tahap === "memuat") {
    return <p className="pl-0.5 text-xs text-muted-foreground">Membaca kontak…</p>;
  }
  if (keadaan.tahap === "galat") {
    return <p className="pl-0.5 text-xs text-muted-foreground">{keadaan.pesan}</p>;
  }
  const baris = cariKontakPihak(keadaan.data, orang);
  if (!baris) return null;
  const kuasa = baris.jenis === "kuasa";
  const e = LABEL_ELITIGASI[baris.elitigasi.status];

  return (
    <div
      className="mt-0.5 space-y-0.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs"
      data-bagian="kontak-pihak"
    >
      <RuasKontak label="Email" nilai={baris.email} kosong="belum ada di SIPP maupun e-Court" />
      <RuasKontak
        label={baris.hp.bisaWhatsApp || !baris.hp.nilai ? "WhatsApp / HP" : "Telepon (bukan HP)"}
        nilai={baris.hp}
        kosong="belum ada di SIPP maupun e-Court"
      />
      {kuasa ? null : (
        <div className="flex flex-wrap items-baseline gap-x-1.5" data-ruas-kontak="elitigasi">
          <span className="w-[8.5rem] shrink-0 text-muted-foreground">Sidang elektronik</span>
          <span className={`font-medium ${e.kelas}`} data-elitigasi={baris.elitigasi.status}>
            {e.teks}
          </span>
          <span className="text-muted-foreground">
            {baris.elitigasi.status === "ya" || baris.elitigasi.status === "tidak" || baris.elitigasi.status === "belum"
              ? "(bersedia bersidang secara e-Litigasi - dari e-Court)"
              : `(${baris.elitigasi.label})`}
          </span>
        </div>
      )}
    </div>
  );
}
/* === AKHIR STATUS-ZIP === */
