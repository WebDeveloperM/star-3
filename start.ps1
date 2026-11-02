# Sahifa oynada ochiladi. Gerb bosilganda script.js oyna sarlavhasini $signal ga almashtiradi va
# Chrome kiosk rejimida qayta ochiladi: brauzer faqat shu rejimda "press Esc" yozuvini chiqarmaydi.
$signal = 'Start kiosk'
$windowProfile = 'proyekt-window'
$kioskProfile = 'proyekt-start'

$page = ([Uri](Join-Path $PSScriptRoot 'index.html')).AbsoluteUri
$flags = @('--no-first-run', '--no-default-browser-check', '--disable-pinch', '--overscroll-history-navigation=0', '--hide-crash-restore-bubble') + $args

function Stop-ChromeProfile($name) {
  Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$name*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Start-Chrome($name, $options) {
  Start-Process $env:CHROME -PassThru -ArgumentList (@("--user-data-dir=`"$env:TEMP\$name`"") + $flags + $options)
}

# Oldingi ishga tushirishdan qolgan oyna bo'lsa, Chrome yangi oynani unga qo'shib yuboradi
Stop-ChromeProfile $windowProfile
Stop-ChromeProfile $kioskProfile

$window = Start-Chrome $windowProfile @('--start-maximized', "--app=$page#launcher")

while (-not $window.HasExited) {
  $window.Refresh()
  if ($window.MainWindowTitle -like "$signal*") {
    $kiosk = Start-Chrome $kioskProfile @('--kiosk', $page)
    # Eski oyna kiosk oynasi chizilguncha turadi, orada ish stoli ko'rinmaydi
    $deadline = (Get-Date).AddSeconds(10)
    do {
      Start-Sleep -Milliseconds 100
      $kiosk.Refresh()
    } until ($kiosk.MainWindowHandle -ne 0 -or (Get-Date) -gt $deadline)
    Start-Sleep -Milliseconds 800
    $window.CloseMainWindow() | Out-Null
    break
  }
  Start-Sleep -Milliseconds 150
}
