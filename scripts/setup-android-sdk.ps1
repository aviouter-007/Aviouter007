# Writes android/local.properties from ANDROID_HOME or default SDK path
$sdk = $env:ANDROID_HOME
if (-not $sdk) {
  $sdk = "$env:LOCALAPPDATA\Android\Sdk"
}
if (-not (Test-Path $sdk)) {
  Write-Host "Android SDK not found. Install Android Studio first."
  Write-Host "https://developer.android.com/studio"
  exit 1
}
$escaped = $sdk -replace '\\', '\\'
$props = "sdk.dir=$escaped"
$out = Join-Path $PSScriptRoot "..\client\android\local.properties"
Set-Content -Path $out -Value $props -Encoding ASCII
$jbr = "C:\Program Files\Android\Android Studio\jbr"
$gradleProps = Join-Path $PSScriptRoot "..\client\android\gradle.properties"
if (Test-Path $jbr) {
  $jbrEsc = $jbr -replace '\\', '\\'
  $extra = "org.gradle.java.home=$jbrEsc"
  if (Test-Path $gradleProps) {
    $content = Get-Content $gradleProps -Raw
    if ($content -notmatch 'org.gradle.java.home') {
      Add-Content $gradleProps "`n$extra"
    }
  }
  Write-Host "Using JDK 21 from Android Studio JBR"
}

Write-Host "Wrote $out"
Write-Host "sdk.dir=$sdk"
