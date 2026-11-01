# rtf_ke_pdf.ps1 <folder rtf> <folder pdf> <awalan berkas ...> : ekspor halaman 1-2 tiap RTF ke PDF lewat Word (satu proses Word, ditutup di akhir)
param([string]$Dir, [string]$Out, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Nama)
New-Item -ItemType Directory -Force $Out | Out-Null
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($n in $Nama) {
    $p = (Resolve-Path (Join-Path $Dir ($n + '.rtf'))).Path
    $d = $w.Documents.Open($p, $false, $true)
    $pdf = Join-Path (Resolve-Path $Out).Path ($n + '.pdf')
    # wdExportFormatPDF=17, OpenAfterExport=false, OptimizeFor=0, Range=3 (from-to), From=1, To=2
    $d.ExportAsFixedFormat($pdf, 17, $false, 0, 3, 1, 2)
    Write-Output ("{0}: halaman {1}" -f $n, $d.ComputeStatistics(2))
    $d.Close([ref]0)
  }
} finally {
  $w.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
