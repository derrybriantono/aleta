"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { type KosakataTambahan } from "@/lib/aleta-bot-message-linter";
import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * KOSAKATA PEMERIKSA PESAN - DITAMBAH DARI LAYAR, BUKAN DARI VERSI BARU
 * ============================================================================
 *
 * Tercatat sejak 1.15.0: daftar kosakata belum dapat disunting dari portal,
 * sehingga penambahan satu kata masih lewat pembaruan aplikasi. Untuk satu
 * baris teks: paket dibangun, diunggah, dipasang, container dibangun ulang.
 *
 * Ongkos sebesar itu untuk perubahan sekecil itu berarti kosakatanya jarang
 * bertambah - dan yang paling dirugikan justru kosakata penipuan, yang di
 * dunia nyata berubah tiap beberapa minggu.
 */

const JENIS = [
  {
    kunci: "phishing" as const,
    label: "Kosakata penipuan",
    keterangan:
      "Frasa yang membuat pesan resmi terbaca seperti penipuan. Pembayaran perkara diurus di bank atau PTSP, tidak lewat pesan.",
  },
  {
    kunci: "promosi" as const,
    label: "Kosakata iklan",
    keterangan:
      "Kata khas pesan iklan massal. Penyaring WhatsApp mengenalinya, dan pesan pengadilan tidak membutuhkannya.",
  },
  {
    kunci: "pemendek" as const,
    label: "Alamat pemendek",
    keterangan:
      "Nama host pemendek tautan, satu per baris - misalnya contoh.link. Alamat yang disembunyikan tidak dapat diperiksa penerimanya sebelum ditekan.",
  },
];

type Jawaban = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  tambahan?: KosakataTambahan;
};

const KOSONG: Required<KosakataTambahan> = { promosi: [], phishing: [], pemendek: [] };

async function ambil(alamat: string, opsi?: RequestInit): Promise<Jawaban> {
  const respons = await fetch(apiPath(alamat), { cache: "no-store", ...opsi });
  const luar = (await respons.json()) as { data?: unknown } | null;
  return ((luar && typeof luar === "object" && "data" in luar ? luar.data : luar) ?? {}) as Jawaban;
}

/**
 * Kosakata tambahan yang berlaku, dibaca sekali untuk seluruh layar.
 *
 * Janjinya disimpan di lingkup modul, bukan di dalam komponen: pemeriksa
 * kalimat dipasang pada TIAP kartu isi pesan, dan pembacaan per kartu berarti
 * puluhan permintaan untuk satu daftar yang sama.
 *
 * Kegagalan membacanya TIDAK menghentikan pemeriksanya. Yang hilang hanya
 * kata-kata tambahan; daftar bawaan tetap berlaku, sebab ia ada di dalam kode
 * portal dan tidak pernah menyeberang ke mana pun.
 */
let janjiKosakata: Promise<Required<KosakataTambahan>> | null = null;

function bacaKosakata(): Promise<Required<KosakataTambahan>> {
  if (!janjiKosakata) {
    janjiKosakata = ambil("/api/aleta-bot/kosakata")
      .then((isi) => ({ ...KOSONG, ...(isi.tambahan || {}) }))
      .catch(() => KOSONG);
  }
  return janjiKosakata;
}

/** Membuang simpanan supaya pembacaan berikutnya mengambil yang baru. */
function lupakanKosakata() {
  janjiKosakata = null;
}

/** Kosakata tambahan untuk pemeriksa kalimat. Kosong sampai pembacaannya tiba. */
export function useKosakataTambahan(): KosakataTambahan {
  const [tambahan, setTambahan] = useState<KosakataTambahan>(KOSONG);

  useEffect(() => {
    let hidup = true;
    void bacaKosakata().then((isi) => {
      if (hidup) setTambahan(isi);
    });
    return () => {
      hidup = false;
    };
  }, []);

  return tambahan;
}

/** Satu daftar menjadi teks berbaris, dan sebaliknya. */
const keTeks = (daftar?: string[]) => (daftar || []).join("\n");
const keDaftar = (teks: string) =>
  teks
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

export function KosakataPemeriksaPesan() {
  const [draf, setDraf] = useState<Required<KosakataTambahan> | null>(null);
  const [jawaban, setJawaban] = useState<Jawaban | null>(null);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  /** Membaca kosakata. TIDAK menyentuh keadaan layar. */
  const baca = useCallback(async (): Promise<{ isi: Jawaban | null; sebab: string }> => {
    try {
      return { isi: await ambil("/api/aleta-bot/kosakata"), sebab: "" };
    } catch (kesalahan) {
      return {
        isi: null,
        sebab: kesalahan instanceof Error ? kesalahan.message : String(kesalahan),
      };
    }
  }, []);

  const terapkan = useCallback((isi: Jawaban | null, sebab: string) => {
    setGalat(sebab);
    if (!isi) return;
    setJawaban(isi);
    setDraf({ ...KOSONG, ...(isi.tambahan || {}) });
  }, []);

  /** Penyegaran atas permintaan - sesudah menyimpan. */
  const muat = useCallback(async () => {
    const { isi, sebab } = await baca();
    terapkan(isi, sebab);
  }, [baca, terapkan]);

  // Penanda hidup: jawaban yang terlambat tidak ditulis ke layar yang sudah
  // dilepas. Pola yang sama dengan papan antrian - lihat layar-antrian-jaga-hidup.
  useEffect(() => {
    let hidup = true;
    void (async () => {
      const { isi, sebab } = await baca();
      if (!hidup) return;
      terapkan(isi, sebab);
    })();
    return () => {
      hidup = false;
    };
  }, [baca, terapkan]);

  const simpan = async () => {
    if (!draf) return;
    setSedangSimpan(true);
    setPesan("");
    setGalat("");
    try {
      const isi = await ambil("/api/aleta-bot/kosakata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tambahan: draf }),
      });

      if (isi.available === false || isi.ok === false) {
        setGalat(isi.alasan || "Tidak tersimpan.");
        return;
      }

      // Simpanan sekawan dibuang supaya pemeriksa kalimat di kartu-kartu isi
      // pesan memakai kata yang baru tanpa menunggu halaman dimuat ulang.
      lupakanKosakata();
      setPesan("Kosakata tersimpan. Pemeriksa isi pesan memakainya mulai sekarang.");
      await muat();
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : String(kesalahan));
    } finally {
      setSedangSimpan(false);
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Kosakata pemeriksa isi pesan</CardTitle>
        <CardDescription>
          Kata dan frasa yang ditambahkan pengadilan ini, satu per baris. Daftar bawaan aplikasi
          tetap berlaku dan tidak dapat dihapus dari sini - yang di bawah hanya TAMBAHAN.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
            {galat}
          </div>
        ) : null}

        {jawaban?.available === false ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            {jawaban.alasan || "ALETA Bot belum dapat dihubungi."}
          </div>
        ) : null}

        {pesan ? (
          <div className="rounded-md border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {pesan}
          </div>
        ) : null}

        {/* ==================================================================
            KENAPA HANYA DAPAT DITAMBAH
            ==================================================================

            Ditulis di layar, bukan hanya di dalam kode - yang membuka layar
            ini pantas tahu kenapa ia tidak menemukan tombol hapus, alih-alih
            menyangka fiturnya belum jadi. */}
        <p className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          Daftar bawaan memuat frasa seperti &quot;kode otp&quot; dan &quot;segera transfer&quot;.
          Menghapusnya berarti membuka jalan bagi pesan yang paling berbahaya - pesan yang
          mengatasnamakan pengadilan dan meminta uang. Peringatannya sendiri tidak pernah menahan
          pengiriman; ia hanya memberi tahu. Karena itu di sini hanya dapat ditambah.
        </p>

        {draf
          ? JENIS.map((jenis) => (
              <label key={jenis.kunci} className="block space-y-1 text-sm">
                <span className="font-medium">{jenis.label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {jenis.keterangan}
                </span>
                <Textarea
                  rows={4}
                  value={keTeks(draf[jenis.kunci])}
                  onChange={(e) =>
                    setDraf((lama) =>
                      lama ? { ...lama, [jenis.kunci]: keDaftar(e.target.value) } : lama
                    )
                  }
                  placeholder="Satu kata atau frasa per baris"
                />
                <span className="block text-xs text-muted-foreground">
                  {draf[jenis.kunci].length} tambahan
                </span>
              </label>
            ))
          : null}

        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void simpan()} disabled={sedangSimpan || !draf}>
            {sedangSimpan ? "Menyimpan…" : "Simpan kosakata"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Tersimpan atas nama Anda, dan tercatat sebagai kejadian keamanan.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
