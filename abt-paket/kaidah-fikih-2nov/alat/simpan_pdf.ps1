# Simpan RTF utuh ke PDF lewat Word SaveAs2 (cadangan bila ExportAsFixedFormat per halaman gagal), lalu semua halaman ke PNG.
# pakai: simpan_pdf.ps1 <rtf> <awalan png>. Word milik sendiri ditutup di akhir; Word proses lain tidak disentuh.
param([string]$Rtf, [string]$Awalan)
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open((Resolve-Path $Rtf).Path, $false, $true)
  $pdf = "$Awalan.pdf"
  $d.SaveAs2([ref]$pdf, [ref]17)
  Write-Output ("halaman {0} -> {1}" -f $d.ComputeStatistics(2), $pdf)
  $d.Close([ref]0)
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
& "$PSScriptRoot\..\..\tanya-jawab-format-1nov\alat\pdf_semua_png.ps1" -Pdf $pdf -Awalan $Awalan -Lebar 1000
