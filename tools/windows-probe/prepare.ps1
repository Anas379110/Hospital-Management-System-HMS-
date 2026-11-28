$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or $env:GITHUB_EVENT_NAME -ne 'pull_request') { throw 'Disposable Windows pull-request runner required' }
$event = Get-Content $env:GITHUB_EVENT_PATH -Raw | ConvertFrom-Json
if ($event.pull_request.head.repo.full_name -ne $env:GITHUB_REPOSITORY) { throw 'Same repository only' }
$root = Join-Path $env:RUNNER_TEMP ('hms-native-' + $env:GITHUB_RUN_ID + '-' + $env:GITHUB_RUN_ATTEMPT)
if (Test-Path $root) { throw 'Fresh staging path required' }
New-Item $root -ItemType Directory | Out-Null
function Get-Pinned($url, $hash, $path) {
  Invoke-WebRequest $url -UseBasicParsing -OutFile $path
  if ((Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw 'Pinned download mismatch' }
}
Get-Pinned 'https://nodejs.org/dist/v22.23.5/node-v22.23.5-win-x64.zip' '4a191082e9706866830379d577d2cc8a50c776fcd9436a8d061b063ed0d9a0e3' (Join-Path $root 'node.zip')
Get-Pinned 'https://get.enterprisedb.com/postgresql/postgresql-17.12-2-windows-x64-binaries.zip' '520c8c6f19abb3b31fa83ec5e486e2f769eedd7593d94e60a7cda8a5bfb4df91' (Join-Path $root 'pg.zip')
Expand-Archive (Join-Path $root 'node.zip') (Join-Path $root 'node-archive')
Expand-Archive (Join-Path $root 'pg.zip') (Join-Path $root 'pg-archive')
$bin = Join-Path $root 'runtime'
New-Item $bin -ItemType Directory | Out-Null
Copy-Item (Join-Path $root 'node-archive/node-v22.23.5-win-x64/node.exe') $bin
Copy-Item (Join-Path $root 'node-archive/node-v22.23.5-win-x64/LICENSE') (Join-Path $bin 'NODE-LICENSE')
# Keep PG bin/lib/share intact in this disposable probe, never publish these archives.
New-Item (Join-Path $bin 'pg') -ItemType Directory | Out-Null
foreach ($n in @('bin','lib','share')) { Copy-Item (Join-Path $root ('pg-archive/pgsql/' + $n)) (Join-Path $bin ('pg/' + $n)) -Recurse }
$engineCommit = '605197351a3c8bdd595af2d2a9bc3025bca48ea2'
$engines = @(
  @{ Name='schema-engine.exe'; Gz='cfdcce35f151ea8e57772f07fd909b6118389119b76e51ab1105ef86f955048b'; Raw='a7d949e16cc5937aa77d67888c8993118ef16c764e536e9ed7c17cfe61bb65ad' },
  @{ Name='query_engine.dll.node'; Gz='b72732897f7fb1d24ea9d26cb254b78b10d4257eaeb27f04d9fb82d20addc5d5'; Raw='7d58cada77c5833e57d2ab4ad61ea2948247b2caa8575066b2fe3bc7e4ea4e5a' }
)
foreach ($e in $engines) {
  $gz = Join-Path $root ($e.Name + '.gz')
  Get-Pinned ("https://binaries.prisma.sh/all_commits/$engineCommit/windows/" + $e.Name + '.gz') $e.Gz $gz
  $inputStream = [IO.File]::OpenRead($gz)
  $decompress = New-Object IO.Compression.GzipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
  $outputStream = [IO.File]::Create((Join-Path $bin $e.Name))
  try { $decompress.CopyTo($outputStream) } finally { $outputStream.Dispose(); $decompress.Dispose(); $inputStream.Dispose() }
  if ((Get-FileHash (Join-Path $bin $e.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $e.Raw) { throw 'Raw engine mismatch' }
}
$app = Join-Path $bin 'deps'
New-Item $app -ItemType Directory | Out-Null
Copy-Item backend/package.json,backend/package-lock.json $app
New-Item (Join-Path $app 'prisma') -ItemType Directory | Out-Null
Copy-Item backend/prisma/schema.prisma (Join-Path $app 'prisma/schema.prisma')
Copy-Item backend/prisma/migrations (Join-Path $app 'prisma/migrations') -Recurse
Copy-Item backend/prisma/demo (Join-Path $app 'prisma/demo') -Recurse
Copy-Item backend/src,backend/tsconfig.json,backend/nest-cli.json $app -Recurse
$env:PATH = (Join-Path $root 'node-archive/node-v22.23.5-win-x64') + ';' + $env:PATH
$env:PRISMA_SCHEMA_ENGINE_BINARY = Join-Path $bin 'schema-engine.exe'
$env:PRISMA_QUERY_ENGINE_LIBRARY = Join-Path $bin 'query_engine.dll.node'
Push-Location $app
try {
  & npm.cmd ci --ignore-scripts --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Locked install failed' }
  & (Join-Path $bin 'node.exe') node_modules/prisma/build/index.js generate
  if ($LASTEXITCODE -ne 0) { throw 'Native generation failed' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Locked backend build failed' }
} finally { Pop-Location }
Copy-Item tools/windows-probe/child.ps1,tools/windows-probe/native.cjs,tools/windows-probe/roundtrip.cjs,tools/windows-probe/app-child.cjs,tools/windows-probe/roundtrip-seed.sql $bin
Write-Output 'Pinned native probe preparation complete. No package or application launch claimed.'
