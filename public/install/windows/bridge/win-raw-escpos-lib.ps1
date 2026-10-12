# Bir kez yüklenir — ham ESC/POS (winspool RAW)
if (-not ('LimaRawPrinter' -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class LimaRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOW pDocInfo);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.ComponentModel.Win32Exception();
    }
    try {
      var di = new DOCINFOW { pDocName = "LimaReceipt", pDataType = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, ref di)) throw new System.ComponentModel.Win32Exception();
      try {
        if (!StartPagePrinter(hPrinter)) throw new System.ComponentModel.Win32Exception();
        int written;
        if (!WritePrinter(hPrinter, bytes, bytes.Length, out written)) throw new System.ComponentModel.Win32Exception();
        EndPagePrinter(hPrinter);
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@
}

function Resolve-LimaPrinterName([string]$PrinterName) {
  if (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue) {
    return $PrinterName
  }
  $alt = Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match 'Ekolojik POS-80|POS-80|Zywell'
  } | Select-Object -First 1
  if ($alt) { return $alt.Name }
  return $PrinterName
}

function Send-LimaRawEscPosFile([string]$PrinterName, [string]$FilePath) {
  if (-not (Test-Path -LiteralPath $FilePath)) {
    throw "Dosya bulunamadi: $FilePath"
  }
  $resolved = Resolve-LimaPrinterName $PrinterName
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  [LimaRawPrinter]::Send($resolved, $bytes)
}
