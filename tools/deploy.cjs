#!/usr/bin/env node
// Deploys Firestore rules, indexes and Hosting through the Firebase REST APIs.
// Works with a plain Firebase Admin SDK service-account key, which `firebase deploy`
// rejects (it also needs Service Usage permissions).
//
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json npm run deploy [-- rules|indexes|hosting]
//
// Never commit the key file.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects.default;
const HOSTING = 'https://firebasehosting.googleapis.com/v1beta1';
const only = process.argv[2];

let client;
async function call(method, url, data, extra = {}) {
  try {
    return (await client.request({ method, url, data, ...extra })).data;
  } catch (e) {
    const err = new Error(`${method} ${url} → ${e.response?.status} ${JSON.stringify(e.response?.data)?.slice(0, 300)}`);
    err.status = e.response?.status;
    throw err;
  }
}

async function deployRules() {
  const content = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const ruleset = await call('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    { source: { files: [{ name: 'firestore.rules', content }] } });
  const name = `projects/${PROJECT}/releases/cloud.firestore`;
  try {
    await call('PATCH', `https://firebaserules.googleapis.com/v1/${name}`, { release: { name, rulesetName: ruleset.name } });
  } catch (e) {
    if (e.status !== 404) throw e;
    await call('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`, { name, rulesetName: ruleset.name });
  }
  console.log('✓ Firestore rules released');
}

async function deployIndexes() {
  const { indexes } = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'));
  for (const ix of indexes) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups/${ix.collectionGroup}/indexes`;
    try {
      await call('POST', url, { queryScope: ix.queryScope, fields: ix.fields });
      console.log(`✓ index requested: ${ix.collectionGroup}`);
    } catch (e) {
      if (e.status === 409) console.log(`✓ index exists: ${ix.collectionGroup}`);
      else if (e.status === 403) console.warn(`! no permission to create index ${ix.collectionGroup} — create it in the console`);
      else throw e;
    }
  }
}

async function deployHosting() {
  const sites = (await call('GET', `${HOSTING}/projects/${PROJECT}/sites`)).sites || [];
  const site = sites.find((s) => s.type === 'DEFAULT_SITE') || sites[0]
    || await call('POST', `${HOSTING}/projects/${PROJECT}/sites?siteId=${PROJECT}`, {});
  const { hosting } = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const headers = (hosting.headers || []).map((h) => ({ glob: h.source, headers: Object.fromEntries(h.headers.map((x) => [x.key, x.value])) }));
  const version = await call('POST', `${HOSTING}/${site.name}/versions`, { config: { headers } });

  const pub = path.join(ROOT, hosting.public);
  const files = {};
  const blobs = {};
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      const gz = zlib.gzipSync(fs.readFileSync(p));
      const hash = crypto.createHash('sha256').update(gz).digest('hex');
      files[`/${path.relative(pub, p).split(path.sep).join('/')}`] = hash;
      blobs[hash] = gz;
    }
  })(pub);

  const { uploadUrl, uploadRequiredHashes = [] } = await call('POST', `${HOSTING}/${version.name}:populateFiles`, { files });
  for (const hash of uploadRequiredHashes) {
    await call('POST', `${uploadUrl}/${hash}`, blobs[hash], { headers: { 'Content-Type': 'application/octet-stream' } });
  }
  await call('PATCH', `${HOSTING}/${version.name}?update_mask=status`, { status: 'FINALIZED' });
  await call('POST', `${HOSTING}/${site.name}/releases?versionName=${version.name}`, {});
  console.log(`✓ Hosting released (${uploadRequiredHashes.length}/${Object.keys(files).length} files uploaded) → ${site.defaultUrl}`);
}

(async () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file.');
  client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  console.log(`Deploying to ${PROJECT}…`);
  if (!only || only === 'rules') await deployRules();
  if (!only || only === 'indexes') await deployIndexes();
  if (!only || only === 'hosting') await deployHosting();
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
