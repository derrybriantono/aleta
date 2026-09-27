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

import { GayaCetakStatusPerkara, useCetakStatusPerkara } from "@/components/portal/cetak-status-perkara";
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
  type PerkaraSingkat,
} from "@/lib/riwayat-perkara";
import type { Ringkasan } from "@/lib/ringkas-status";
import {
  hariIniPeramban,
  susunRingkasanSalin,
  type BahanRingkasanSalin,
} from "@/lib/ringkasan-salin";
import { salinTeks } from "@/lib/salin-teks";
import { useTautanSipp } from "@/lib/tautan-sipp";

/**
 * ============================================================================
 * BILAH ALAT STATUS PERKARA
 * ============================================================================
 *
 * Sepuluh pekerjaan kecil yang selama ini dikerjakan tangan, dan masing-masing
 * hanya memakan beberapa detik - yang membuatnya berarti adalah berapa kali
 * sehari ia terjadi:
 *
 *   - menyalin ringkasan LENGKAP perkara ke pesan WhatsApp atau surel
 *   - menyalin tautan halaman perkara di SIPP untuk dikirim ke rekan
 *   - mencetak lembar yang terbaca di kertas, dari tema apa pun
 *   - membuka atau menutup seluruh bagian sekaligus
 *   - mencari satu bagian di antara dua puluh tujuh
 *   - melompat ke bagian itu
 *   - kembali ke perkara yang tadi dibuka
 *   - menyematkan perkara yang sedang dikerjakan
 *   - membuka halaman perkara yang sama di SIPP
 *
 * ============================================================================
 * RIWAYAT DAN SEMATAN TIDAK PERNAH MENINGGALKAN PERAMBAN
 * ============================================================================
 *
 * Riwayat dan sematan menyebutkan perkara mana yang dibuka SESEORANG -
 * disimpan di peladen, ia menjadi catatan siapa memeriksa perkara siapa,
 * keterangan yang tidak diminta siapa pun.
 *
 * Satu-satunya yang ditanyakan ke peladen adalah ALAMAT halaman perkara di
 * SIPP (lib/tautan-sipp.ts) - hanya dibaca, tidak menyimpan apa pun, dan
 * untuk perkara yang statusnya baru saja disajikan peladen yang sama. Tidak
 * ada keterangan baru yang berpindah tangan.
 */

/**
 * Pintu masuk SIPP milik portal - yang sama dengan ubin SIPP di beranda
 * ALETA. Dipakai bila halaman PERKARANYA tidak dapat disusun: petugas tetap
 * sampai di SIPP, dan kalimat di bawah tombol menyebut mengapa bukan halaman
 * perkaranya.
 */
const PINTU_SIPP = "/api/external-apps/sipp/launch";

type TandaSalin = "" | "ringkas" | "tautan" | "tautan-aleta";

export function AlatStatusPerkara({
  nomorPerkara,
  jenisPerkara,
  perkaraId = "",
  bahan,
  ringkas,
  onBuka,
}: {
  nomorPerkara: string;
  jenisPerkara: string;
  /** perkara_id SIPP - untuk menyusun alamat halaman perkaranya di SIPP. */
  perkaraId?: string;
  /**
   * Muatan Status Perkara yang sedang tampil - bahan ringkasan lengkap.
   * Boleh tidak ada; ringkasannya lalu hanya memuat yang diketahui bilah ini.
   */
  bahan?: BahanRingkasanSalin;
  ringkas: Ringkasan;
  /** Membuka perkara lain - dipakai riwayat dan sematan. */
  onBuka: (nomorPerkara: string) => void;
}) {
  const [bagian, setBagian] = useState<BagianTerdaftar[]>([]);
  const [cari, setCari] = useState("");
  const [riwayat, setRiwayat] = useState<PerkaraSingkat[]>([]);
  const [semat, setSemat] = useState<PerkaraSingkat[]>([]);
  const [disalin, setDisalin] = useState<TandaSalin>("");
  /**
   * Teks yang gagal disalin otomatis, disodorkan untuk disalin tangan.
   *
   * Dulu kegagalan hanya berbunyi "salin tangan dari layar" - padahal
   * ringkasannya tidak pernah tampil di layar, jadi tidak ada yang dapat
   * disalin tangan.
   */
  const [salinTangan, setSalinTangan] = useState<{ apa: string; teks: string } | null>(null);

  const { tautan, ulangi: ulangiTautan } = useTautanSipp(perkaraId, nomorPerkara);

  // Lembar cetak: tema terang dan palet kertas selama mencetak - lihat
  // cetak-status-perkara.tsx.
  useCetakStatusPerkara();

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

  /**
   * Menyalin, dengan jalan cadangan untuk peladen satker yang bukan HTTPS.
   *
   * Teksnya disusun SEBELUM fungsi ini dipanggil, di dalam klik yang sama -
   * lihat lib/salin-teks.ts: jalan cadangan hanya dihormati peramban selama
   * masih di dalam tindakan pengguna.
   */
  const salin = useCallback(async (teks: string, tanda: Exclude<TandaSalin, "">, apa: string) => {
    const hasil = await salinTeks(teks);
    if (hasil === "gagal") {
      setDisalin("");
      setSalinTangan({ apa, teks });
      return;
    }
    setSalinTangan(null);
    setDisalin(tanda);
    window.setTimeout(() => setDisalin(""), 1800);
  }, []);

  /**
   * Ringkasan yang disalin - baris yang berdiri sendiri, bukan tabel.
   *
   * Yang menyalin ini menempelkannya ke WhatsApp atau surel, dan tabel yang
   * ditempel ke sana kehilangan seluruh kolomnya. Susunannya di
   * lib/ringkasan-salin.ts, diuji tersendiri.
   *
   * Disusun saat tombol DITEKAN, bukan tiap kali layar digambar: "hari ini"
   * yang dipakainya harus hari ketika ia disalin, dan layar yang terbuka sejak
   * kemarin tidak boleh menyalin keadaan kemarin.
   */
  const susunRingkasan = useCallback(
    () =>
      susunRingkasanSalin(bahan ?? { identitas: { nomorPerkara, jenisPerkara } }, ringkas, {
        hariIni: hariIniPeramban(),
        alamatSipp: tautan.keadaan === "ada" ? tautan.alamat : "",
      }),
    [bahan, nomorPerkara, jenisPerkara, ringkas, tautan]
  );

  /** Tautan layar ini di ALETA - cadangan bila alamat SIPP tidak tersedia. */
  const tautanAleta = useCallback(
    () =>
      `${window.location.origin}${withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent(nomorPerkara)}`)}`,
    [nomorPerkara]
  );

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

  const sippAda = tautan.keadaan === "ada";
  const sippTidakTersedia = tautan.keadaan === "tidak-ada" || tautan.keadaan === "gagal";

  const kelasTautan =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted/50";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 print:hidden">
      {/* Aturan cetak hidup selama layar ini terbuka - di dalam bilah yang
          sendiri tidak tercetak; lembar gaya tetap berlaku di mana pun ia
          berada. */}
      <GayaCetakStatusPerkara />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          title="Salin ringkasan lengkap perkara ini - pihak, majelis, sidang, putusan, biaya - untuk WhatsApp atau surel"
          onClick={() => void salin(susunRingkasan(), "ringkas", "ringkasan perkara")}
        >
          {disalin === "ringkas" ? (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {disalin === "ringkas" ? "Tersalin" : "Salin ringkasan"}
        </Button>

        {/* Salin tautan: alamat halaman perkara di SIPP. Bila alamat itu
            tidak tersedia, yang disalin tautan ALETA - dan labelnya
            mengatakannya SEBELUM ditekan, bukan sesudah ditempel orang lain. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={tautan.keadaan === "memuat"}
          title={
            sippAda
              ? "Salin alamat halaman perkara ini di SIPP"
              : tautan.keadaan === "memuat"
                ? "Menyiapkan alamat halaman perkara di SIPP…"
                : "Alamat SIPP tidak tersedia - yang disalin tautan ALETA ke perkara ini"
          }
          onClick={() =>
            sippAda
              ? void salin(tautan.alamat, "tautan", "alamat SIPP")
              : void salin(tautanAleta(), "tautan-aleta", "tautan ALETA")
          }
        >
          {disalin === "tautan" || disalin === "tautan-aleta" ? (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {disalin === "tautan"
            ? "Tautan SIPP tersalin"
            : disalin === "tautan-aleta"
              ? "Tautan ALETA tersalin"
              : sippTidakTersedia
                ? "Salin tautan ALETA"
                : "Salin tautan"}
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
      </div>

      {/* ================================================================
          SALIN TANGAN - BILA PERAMBAN MENOLAK KEDUA JALAN
          ================================================================

          Teksnya ditaruh di kotak yang sudah terpilih seluruhnya, sehingga
          yang tersisa hanya Ctrl+C. Mengatakan "salin sendiri" tanpa
          menyodorkan teksnya adalah menyuruh orang menyalin sesuatu yang
          tidak dapat ia lihat. */}
      {salinTangan ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100"
        >
          <p className="mb-1.5">
            Peramban menolak menyalin otomatis. Isi {salinTangan.apa} sudah terpilih di kotak ini —
            tekan Ctrl+C untuk menyalinnya.
          </p>
          <textarea
            readOnly
            autoFocus
            aria-label={`Isi ${salinTangan.apa} untuk disalin tangan`}
            value={salinTangan.teks}
            rows={Math.min(12, Math.max(2, salinTangan.teks.split("\n").length))}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-y rounded border border-border bg-background p-1.5 font-mono text-xs text-foreground"
          />
          <div className="mt-1 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setSalinTangan(null)}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}

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

        {/* ==============================================================
            BUKA SIPP - HALAMAN PERKARANYA, DI TAB BARU
            ==============================================================

            Tautan <a target="_blank"> sungguhan, dengan alamat yang SUDAH
            diminta saat perkara terbuka - lihat lib/tautan-sipp.ts mengapa
            bukan window.open sesudah menunggu peladen (pemblokir popup).

            Selagi alamatnya disiapkan, tombolnya tampak tetapi belum dapat
            ditekan. Bila alamatnya tidak ada, ia menjadi pintu SIPP biasa
            dan labelnya berkata begitu - bukan tombol yang diam. */}
        {sippAda ? (
          <a
            href={tautan.alamat}
            target="_blank"
            rel="noopener noreferrer"
            title={`Buka halaman perkara ${nomorPerkara} di SIPP (tab baru)`}
            className={kelasTautan}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Buka SIPP
          </a>
        ) : tautan.keadaan === "memuat" ? (
          <span
            aria-disabled="true"
            title="Menyiapkan alamat halaman perkara di SIPP…"
            className={cn(kelasTautan, "cursor-wait opacity-60 hover:bg-transparent")}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Buka SIPP
          </span>
        ) : (
          <a
            href={withBasePath(PINTU_SIPP)}
            target="_blank"
            rel="noopener noreferrer"
            title="Halaman perkaranya tidak tersedia - membuka SIPP dari berandanya (tab baru)"
            className={kelasTautan}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Buka SIPP (beranda)
          </a>
        )}
      </div>

      {/* Alasannya dari peladen, apa adanya - rute sipp-tautan sudah
          menulisnya sebagai kalimat utuh untuk petugas. Yang ditambahkan di
          sini hanya apa yang TETAP dapat dikerjakan. */}
      {sippTidakTersedia ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {tautan.alasan} Buka SIPP (beranda) tetap membuka SIPP, dan Salin tautan ALETA menyalin
          tautan layar ini.
          {tautan.keadaan === "gagal" ? (
            <>
              {" "}
              <button
                type="button"
                onClick={ulangiTautan}
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Coba lagi
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {bagianTersaring.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {bagianTersaring.map((b) => (
            <button
              type="button"
              key={b.kunci}
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
              type="button"
              key={`semat-${x.nomorPerkara}`}
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
                type="button"
                key={`riwayat-${x.nomorPerkara}`}
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
