# Deploy VFXT Firebase rules + indexes + functions using the Admin SDK JSON.
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-firebase.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Cred = Join-Path $Root "vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json"
if (-not (Test-Path $Cred)) {
  throw "Missing Admin SDK JSON at $Cred"
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $Cred
$env:GCLOUD_PROJECT = "vfxt-a60d6"

Write-Host "Building Cloud Functions..."
Push-Location (Join-Path $Root "functions")
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "functions build failed" }
Pop-Location

Write-Host "Deploying firestore rules, indexes, storage rules, and functions to vfxt-a60d6..."
npx --yes firebase-tools@14 deploy `
  --project vfxt-a60d6 `
  --only "firestore:rules,firestore:indexes,storage,functions" `
  --non-interactive

if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed" }
Write-Host "Deploy complete."
