const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
(async () => {
  const [mode, out] = process.argv.slice(2);
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
  if (mode === 'network') {
    const server = http.createServer((_, res) => res.end('fictional-probe'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const local = await fetch(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await local.text(), 'fictional-probe');
    let external = false;
    try { const r = await fetch('https://nodejs.org/', {signal: AbortSignal.timeout(10000)}); external = r.ok; } catch {}
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(out, JSON.stringify({platform:process.platform,arch:process.arch,loopback:true,external}));
  } else if (mode === 'native') {
    const bcrypt = require(path.join(__dirname, 'deps/node_modules/bcrypt'));
    const sample = 'fictional native compatibility sample';
    assert.equal(await bcrypt.compare(sample, await bcrypt.hash(sample, 4)), true);
    const engine = require(path.join(__dirname, 'query_engine.dll.node'));
    assert.equal(typeof engine.QueryEngine, 'function');
    const {PrismaClient} = require(path.join(__dirname,'deps/node_modules/@prisma/client'));
    assert.equal(typeof PrismaClient, 'function');
    fs.writeFileSync(out,JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,bcrypt:true,queryEngineLoaded:true,generatedClientLoaded:true,engineSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'query_engine.dll.node'))).digest('hex')}));
  } else throw Error('Unknown bounded probe mode');
})().catch(() => { console.error('Bounded native probe failed; no credentials logged'); process.exitCode=1; });
