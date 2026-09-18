"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Pin,
  Printer,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import {
  bacaDaftarBagian,
  langgananDaftar,
  siarkanAba,
  type BagianTerdaftar,
} from "@/lib/alat-bagian";
import {
  bacaRiwayat,
  bacaSemat,
  balikSemat,
  catatRiwayat,
  tersemat,
  type PerkaraSingkat,
} from "@/lib/riwayat-perkara";
import type { Ringkasan } from "@/lib/ringkas-status";

/**
 * ============================================================================
 * BILAH ALAT STATUS PERKARA
 * ============================================================================
 *
 * Sepuluh pekerjaan kecil yang selama ini dikerjakan tangan, dan masing-masing
 * hanya memakan beberapa detik - yang membuatnya berarti adalah berapa kali
 * sehari ia terjadi:
 *
 *   - menyalin ringkasan perkara ke pesan WhatsApp atau surel
 *   - menyalin tautan perkara untuk dikirim ke rekan
 *   - mencetak satu lembar untuk berkas
 *   - membuka atau menutup seluruh bagian sekaligus
 *   - mencari satu bagian di antara dua puluh tujuh
 *   - melompat ke bagian itu
 *   - kembali ke perkara yang tadi dibuka
 *   - menyematkan perkara yang sedang dikerjakan
 *   - membuka perkara yang sama di SIPP
 *
 * ============================================================================
 * SELURUHNYA DI PERAMBAN
 * ============================================================================
 *
 * Tidak satu pun menyentuh peladen. Riwayat dan sematan menyebutkan perkara
 * mana yang dibuka SESEORANG - disimpan di peladen, ia menjadi catatan siapa
 * memeriksa perkara siapa, keterangan yang tidak diminta siapa pun.
 */

export function AlatStatusPerkara({
  nomorPerkara,
  jenisPerkara,
  ringkas,
  onBuka,
}: {
  nomorPerkara: string;
  jenisPerkara: string;
  ringkas: Ringkasan;
  /** Membuka perkara lain - dipakai riwayat dan sematan. */
  onBuka: (nomorPerkara: string) => void;
}) {
  const [bagian, setBagian] = useState<BagianTerdaftar[]>([]);
  const [cari, setCari] = useState("");
  const [riwayat, setRiwayat] = useState<PerkaraSingkat[]>([]);
  const [semat, setSemat] = useState<PerkaraSingkat[]>([]);
  const [disalin, setDisalin] = useState("");

  const singkat = useMemo<PerkaraSingkat>(
    () => ({ nomorPerkara, jenisPerkara, dibuka: new Date().toISOString().slice(0, 10) }),
    [nomorPerkara, jenisPerkara]
  );

  // Daftar bagian hidup - bagian mendaftarkan dirinya saat lahir.
  useEffect(() => {
    const perbarui = () => setBagian(bacaDaftarBagian());
    perbarui();
    return langgananDaftar(perbarui);
  }, []);

  // Riwayat dicatat SESUDAH perkaranya sungguh terbuka, bukan saat dicari:
  // pencarian yang tidak menemukan apa pun tidak boleh meninggalkan jejak.
  useEffect(() => {
    if (!nomorPerkara) return;
    catatRiwayat(singkat);
    setRiwayat(bacaRiwayat());
    setSemat(bacaSemat());
  }, [nomorPerkara, singkat]);

  const salin = useCallback(async (teks: string, tanda: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      setDisalin(tanda);
      window.setTimeout(() => setDisalin(""), 1600);
    } catch {
      // Peramban yang menolak papan klip - lazim di luar HTTPS - tidak boleh
      // membuat tombolnya diam. Teksnya dipilihkan supaya dapat disalin tangan.
      setDisalin("gagal");
      window.setTimeout(() => setDisalin(""), 2400);
    }
  }, []);

  /**
   * Ringkasan yang disalin - kalimat, bukan tabel.
   *
   * Yang menyalin ini menempelkannya ke WhatsApp atau surel, dan tabel yang
   * ditempel ke sana kehilangan seluruh kolomnya. Yang selamat hanya baris
   * yang berdiri sendiri.
   */
  const teksRingkas = useMemo(() => {
    const baris = [
      nomorPerkara,
      jenisPerkara,
      `Keadaan: ${ringkas.keadaan}`,
      ringkas.umurKalimat,
      `Sidang berikutnya: ${ringkas.berikutnya}`,
      `Majelis: ${ringkas.majelisKalimat}`,
    ];
    if (ringkas.peringatan.length > 0) {
      baris.push(`Perlu tindakan (${ringkas.peringatan.length}):`);
      for (const p of ringkas.peringatan) baris.push(`- ${p.pesan}`);
    }
    return baris.filter(Boolean).join("\n");
  }, [nomorPerkara, jenisPerkara, ringkas]);

  const tautan = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${withBasePath(
      `/aleta-ecourt?perkara=${encodeURIComponent(nomorPerkara)}`
    )}`;
  }, [nomorPerkara]);

  const bagianTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return [];
    return bagian.filter((b) => b.judul.toLowerCase().includes(kata)).slice(0, 8);
  }, [bagian, cari]);

  const sudahSemat = semat.some((x) => x.nomorPerkara === nomorPerkara);

  const loncat = useCallback((kunci: string) => {
    siarkanAba({ jenis: "buka", kunci });
    // Digulung SESUDAH bagiannya terbuka. Menggulung lebih dahulu membawa
    // pembacanya ke tempat bagian itu berada SELAGI masih terciut, dan begitu
    // ia terbuka isinya mendorong halaman - pembacanya mendarat di tempat lain.
    window.setTimeout(() => {
      document.getElementById(`bagian-${kunci}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    setCari("");
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 print:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => void salin(teksRingkas, "ringkas")}>
          {disalin === "ringkas" ? (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {disalin === "ringkas" ? "Tersalin" : "Salin ringkasan"}
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={() => void salin(tautan, "tautan")}>
          {disalin === "tautan" ? (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {disalin === "tautan" ? "Tersalin" : "Salin tautan"}
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Cetak
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => siarkanAba({ jenis: "buka-semua" })}
        >
          <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Buka semua
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => siarkanAba({ jenis: "tutup-semua" })}
        >
          <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Tutup semua
        </Button>

        <Button
          type="button"
          size="sm"
          variant={sudahSemat ? "default" : "outline"}
          onClick={() => setSemat(balikSemat(singkat))}
          title={sudahSemat ? "Lepas sematan" : "Sematkan perkara ini"}
        >
          <Pin className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {sudahSemat ? "Tersemat" : "Sematkan"}
        </Button>

        {disalin === "gagal" ? (
          <span className="text-xs text-muted-foreground">
            Peramban menolak papan klip — salin tangan dari layar.
          </span>
        ) : null}
      </div>

      {/* ================================================================
          CARI BAGIAN, LALU LONCAT
          ================================================================

          Dua puluh tujuh bagian. Yang mencari "relaas" sekarang menggulung
          melewati dua belas bagian lain untuk menemukannya. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari bagian — relaas, biaya, putusan…"
            className="h-8 pl-7 text-sm"
          />
        </div>

        <a
          href={withBasePath("/aleta-sipp")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted/50"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Buka SIPP
        </a>
      </div>

      {bagianTersaring.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {bagianTersaring.map((b) => (
            <button
              key={b.kunci}
              type="button"
              onClick={() => loncat(b.kunci)}
              className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted/50"
            >
              {b.judul}
            </button>
          ))}
        </div>
      ) : null}

      {/* ================================================================
          SEMATAN DAN RIWAYAT
          ================================================================

          Sematan lebih dahulu: ia dipilih sendiri oleh pemiliknya, sedangkan
          riwayat hanya akibat dari apa yang kebetulan ia buka. */}
      {semat.length > 0 || riwayat.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
          {semat.map((x) => (
            <button
              key={`semat-${x.nomorPerkara}`}
              type="button"
              onClick={() => onBuka(x.nomorPerkara)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition hover:bg-muted/50",
                x.nomorPerkara === nomorPerkara
                  ? "border-primary/60 text-primary"
                  : "border-border text-foreground"
              )}
            >
              <Pin className="h-3 w-3" aria-hidden />
              {x.nomorPerkara}
            </button>
          ))}
          {riwayat
            .filter((x) => x.nomorPerkara !== nomorPerkara)
            .filter((x) => !semat.some((y) => y.nomorPerkara === x.nomorPerkara))
            .map((x) => (
              <button
                key={`riwayat-${x.nomorPerkara}`}
                type="button"
                onClick={() => onBuka(x.nomorPerkara)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <Clock className="h-3 w-3" aria-hidden />
                {x.nomorPerkara}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
