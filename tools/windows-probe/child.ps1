param([Parameter(Mandatory=$true)][string]$Mode,[Parameter(Mandatory=$true)][string]$probeHome)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
try {
$root = Split-Path $PSScriptRoot -Parent
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Nonadministrator required' }
$node = Join-Path $PSScriptRoot 'node.exe'
$out = Join-Path $probeHome ($Mode + '.json')
if ($Mode -eq 'identity') {
  # Child creates the directory and therefore owns it, no ownership transfer.
  if (Test-Path $probeHome) { throw 'Fresh private target required' }
  New-Item $probeHome -ItemType Directory | Out-Null
  & icacls.exe $probeHome /inheritance:d | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Access-only privacy update failed' }
  $actual=Get-Acl -LiteralPath $probeHome
  $owner=$actual.GetOwner([Security.Principal.SecurityIdentifier]).Value
  if ($owner -ne $identity.User.Value -or -not $actual.AreAccessRulesProtected) { throw 'Created owner or privacy mismatch' }
  $allowed=@($identity.User.Value,'S-1-5-18','S-1-5-32-544')
  $rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 3 -or @($rules | Where-Object {$_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow'}).Count) { throw 'Private allowed SID set mismatch' }
  [IO.File]::WriteAllText((Join-Path $probeHome 'sentinel.txt'),'fictional nonsecret ACL sentinel')
  $fileAcl=Get-Acl -LiteralPath (Join-Path $probeHome 'sentinel.txt')
  if (@($fileAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow'}).Count) { throw 'Child file has unexpected ACL' }
  if ([IO.File]::ReadAllText((Join-Path $probeHome 'sentinel.txt')) -ne 'fictional nonsecret ACL sentinel') { throw 'Positive sentinel read failed' }
  @{sid=$identity.User.Value;admin=$false;sentinelRead=$true;owner=$owner;os=[Environment]::OSVersion.VersionString} | ConvertTo-Json | Set-Content $out -Encoding UTF8
} elseif ($Mode -eq 'negative') {
  $denied = $false
  try { [IO.File]::ReadAllText((Join-Path $probeHome 'sentinel.txt')) | Out-Null }
  catch [UnauthorizedAccessException] { $denied = $true }
  if (-not $denied) { exit 12 }
  exit 0
} elseif ($Mode -eq 'network-before' -or $Mode -eq 'network-after') {
  & $node (Join-Path $PSScriptRoot 'native.cjs') network $out
  if ($LASTEXITCODE -ne 0) { throw 'Network child failed' }
} elseif ($Mode -eq 'native') {
  $env:PRISMA_QUERY_ENGINE_LIBRARY = Join-Path $PSScriptRoot 'query_engine.dll.node'
  $env:PRISMA_SCHEMA_ENGINE_BINARY = Join-Path $PSScriptRoot 'schema-engine.exe'
  & $node (Join-Path $PSScriptRoot 'native.cjs') native $out
  if ($LASTEXITCODE -ne 0) { throw 'Native loading failed' }
  $v = & (Join-Path $PSScriptRoot 'schema-engine.exe') --version
  if ($LASTEXITCODE -ne 0 -or $v -notmatch '605197351a3c8bdd595af2d2a9bc3025bca48ea2') { throw 'Schema engine version mismatch' }
} elseif ($Mode -eq 'postgres') {
  $pg = Join-Path $PSScriptRoot 'pg/bin'
  $data = Join-Path $probeHome 'pgdata'
  $passfile = Join-Path $probeHome 'pg-password.txt'
  $started = $false
  function Stage($value) {
    # Fixed enum only. No arguments, paths, identities, native output or secrets.
    [IO.File]::AppendAllText((Join-Path $probeHome 'postgres-stages.txt'),($value+"`n"))
  }
  Stage 'entered'
  function Run-Pg($name,$arguments,$stageName) {
    Stage ($stageName+'-before')
    $savedPreference=$ErrorActionPreference
    try {
      $ErrorActionPreference='Continue'
      & (Join-Path $pg ($name + '.exe')) @arguments 2>&1 | Out-Null
      $nativeExit=$LASTEXITCODE
    } finally { $ErrorActionPreference=$savedPreference }
    if ($nativeExit -ne 0) { Stage ($stageName+'-failed'); throw ('PostgreSQL probe command failed: ' + $name) }
    Stage ($stageName+'-after')
  }
  try {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $rng.Dispose()
    $password = [Convert]::ToBase64String($bytes)
    # Ephemeral CI-only database secret, never emitted or included in artifacts.
    [IO.File]::WriteAllText($passfile,$password)
    $passwordAcl=Get-Acl -LiteralPath $passfile
    $passwordRules=@($passwordAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if ($passwordRules.Count -ne 3 -or @($passwordRules | Where-Object {$_.IdentityReference.Value -notin @($identity.User.Value,'S-1-5-18','S-1-5-32-544') -or $_.AccessControlType -ne 'Allow'}).Count) { throw 'Password file SID allowlist mismatch' }
    Run-Pg 'initdb' @('-D',$data,'--username=hms_probe','--auth-host=scram-sha-256',('--pwfile=' + $passfile),'--encoding=UTF8','--locale=C') 'initdb'
    Remove-Item $passfile
    Stage 'hba-before'
    $hba=[IO.File]::ReadAllLines((Join-Path $data 'pg_hba.conf'))
    if (-not @($hba | Where-Object {$_ -match '^host\s+all\s+all\s+127\.0\.0\.1/32\s+scram-sha-256\s*$'}).Count) { throw 'Loopback SCRAM HBA missing' }
    Stage 'hba-after'
    $port = 55773
    Stage 'config-before'
    [IO.File]::AppendAllText((Join-Path $data 'postgresql.auto.conf'),("`nlisten_addresses = '127.0.0.1'`nport = $port`n"))
    Stage 'config-after'
    Run-Pg 'pg_ctl' @('-D',$data,'-l',(Join-Path $probeHome 'postgres-private.log'),'-w','start') 'start'
    $started = $true
    $env:PGPASSWORD = $password; $env:PGHOST='127.0.0.1'; $env:PGPORT=[string]$port; $env:PGUSER='hms_probe'; $env:PGDATABASE='postgres'
    Stage 'query-before'
    $value = & (Join-Path $pg 'psql.exe') -X -t -A -v ON_ERROR_STOP=1 -c 'SELECT current_user'
    if ($LASTEXITCODE -ne 0 -or $value.Trim() -ne 'hms_probe') { throw 'Actual PostgreSQL query failed' }
    Stage 'query-after'
    $pidValue = [int]([IO.File]::ReadAllLines((Join-Path $data 'postmaster.pid'))[0])
    $process = Get-Process -Id $pidValue
    if ($process.Path -ne (Join-Path $pg 'postgres.exe')) { throw 'Postmaster identity mismatch' }
    Stage 'modules-before'
    $modules = @($process.Modules | ForEach-Object { @{name=$_.ModuleName;path=$_.FileName;version=$_.FileVersionInfo.FileVersion} })
    Stage 'modules-after'
    Stage 'listener-before'
    $listeners = @(Get-NetTCPConnection -OwningProcess $pidValue -State Listen)
    if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].LocalPort -ne $port) { throw 'Loopback listener mismatch' }
    Stage 'listener-after'
    Run-Pg 'pg_dump' @('--version') 'dump'; Run-Pg 'pg_restore' @('--version') 'restore'
    @{query=$true;loopback=$true;port=$port;modules=$modules;pid=$pidValue;data=$data} | ConvertTo-Json -Depth 5 | Set-Content $out -Encoding UTF8
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $password=$null
    if (Test-Path $passfile) { Remove-Item $passfile }
    if ($started -or (Test-Path (Join-Path $data 'postmaster.pid'))) { Run-Pg 'pg_ctl' @('-D',$data,'-w','-m','fast','stop') 'stop' }
  }
  Stage 'stop-after'
  if (Test-Path (Join-Path $data 'postmaster.pid')) { throw 'Postmaster remained after stop' }
} else { throw 'Unknown child mode' }

} catch {
  $diagnostic=@{exceptionType=$_.Exception.GetType().FullName;line=[int]$_.InvocationInfo.ScriptLineNumber;hresult=[int]$_.Exception.HResult}
  try {
    $failureBase=if (Test-Path $ProbeHome) {$ProbeHome} else {Split-Path $ProbeHome -Parent}
    $diagnostic | ConvertTo-Json | Set-Content (Join-Path $failureBase ($Mode+'.failure.json')) -Encoding UTF8
  } catch {}
  exit 20
}
