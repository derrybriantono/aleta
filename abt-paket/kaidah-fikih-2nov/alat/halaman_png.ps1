# Cetak SATU halaman (tempat kata ditemukan) dari RTF lewat Word -> PDF -> PNG (Windows.Data.Pdf).
# pakai: halaman_png.ps1 <rtf> <kata> <awalan png> [kemunculan ke-n (1)] [lebar (1000)]
# keluaran: <awalan>-h<halaman>.png ; tertulis juga nomor halaman. Word hanya dipakai sebentar, ditutup di akhir.
param([string]$Rtf, [string]$Kata, [string]$Awalan, [int]$Ke = 1, [int]$Lebar = 1000)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $p = (Resolve-Path $Rtf).Path
  $d = $w.Documents.Open($p, $false, $true)
  $r = $d.Content
  $r.Find.ClearFormatting()
  $ketemu = $r.Find.Execute($Kata)
  $n = 1
  while ($ketemu -and $n -lt $Ke) { $r.Collapse(0); $ketemu = $r.Find.Execute($Kata); $n++ }
  if (-not $ketemu) { Write-Output "TIDAK KETEMU: $Kata"; $d.Close([ref]0); return }
  $hal = [int]$r.Information(3)
  $pdf = "$Awalan-h$hal.pdf"
  # 17 = wdExportFormatPDF ; 3 = wdExportFromTo
  $d.ExportAsFixedFormat($pdf, 17, $false, 0, 3, $hal, $hal)
  $d.Close([ref]0)
  Write-Output "halaman $hal -> $pdf"
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
$png = & "$PSScriptRoot\..\..\tanya-jawab-format-1nov\alat\pdf_semua_png.ps1" -Pdf $pdf -Awalan ($pdf -replace '\.pdf$', '') -Lebar $Lebar
Write-Output $png
