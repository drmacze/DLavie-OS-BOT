/**
 * DLavie OS — Object Storage (Replit App Storage)
 * Wrapper untuk @google-cloud/storage dengan Replit sidecar auth
 */

'use strict';

const { randomUUID } = require('crypto');

const SIDECAR = 'http://127.0.0.1:1106';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '';

let _storage = null;

function getStorageClient() {
  if (_storage) return _storage;
  try {
    const { Storage } = require('@google-cloud/storage');
    _storage = new Storage({
      credentials: {
        audience: 'replit',
        subject_token_type: 'access_token',
        token_url: `${SIDECAR}/token`,
        type: 'external_account',
        credential_source: {
          url: `${SIDECAR}/credential`,
          format: { type: 'json', subject_token_field_name: 'access_token' },
        },
        universe_domain: 'googleapis.com',
      },
      projectId: '',
    });
    return _storage;
  } catch (err) {
    console.warn('[ObjStorage] @google-cloud/storage not available:', err.message);
    return null;
  }
}

function isAvailable() {
  return !!(BUCKET_ID && PRIVATE_DIR);
}

function parsePath(fullPath) {
  if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
  const parts = fullPath.split('/');
  return { bucketName: parts[1], objectName: parts.slice(2).join('/') };
}

async function getSignedUploadUrl({ name, contentType, userId }) {
  const objectId = randomUUID();
  const privateBase = PRIVATE_DIR.replace(/\/$/, '');
  const objectPath = `${privateBase}/uploads/${userId || 'anon'}/${objectId}`;
  const { bucketName, objectName } = parsePath(objectPath);

  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: 'PUT',
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Sidecar error: ${res.status}`);
  const { signed_url } = await res.json();
  return {
    uploadUrl: signed_url,
    objectPath: `/objects/${userId || 'anon'}/${objectId}`,
    metadata: { name, contentType, objectId, userId },
  };
}

async function fileExists(objectPath) {
  try {
    const client = getStorageClient();
    if (!client) return false;
    const privateBase = PRIVATE_DIR.replace(/\/$/, '');
    const entityId = objectPath.replace(/^\/objects\//, '');
    const fullPath = `${privateBase}/uploads/${entityId}`;
    const { bucketName, objectName } = parsePath(fullPath);
    const [exists] = await client.bucket(bucketName).file(objectName).exists();
    return exists;
  } catch (_) { return false; }
}

async function streamObject(objectPath, res) {
  const client = getStorageClient();
  if (!client) { res.status(503).json({ error: 'Storage tidak tersedia' }); return; }
  const privateBase = PRIVATE_DIR.replace(/\/$/, '');
  const entityId = objectPath.replace(/^\/objects\//, '');
  const fullPath = `${privateBase}/uploads/${entityId}`;
  const { bucketName, objectName } = parsePath(fullPath);
  const file = client.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) { res.status(404).json({ error: 'File tidak ditemukan' }); return; }
  const [meta] = await file.getMetadata();
  res.set({
    'Content-Type': meta.contentType || 'application/octet-stream',
    'Cache-Control': 'private, max-age=3600',
  });
  file.createReadStream().pipe(res);
}

async function listUserObjects(userId) {
  try {
    const client = getStorageClient();
    if (!client) return [];
    const privateBase = PRIVATE_DIR.replace(/\/$/, '');
    const prefix = `${privateBase.split('/').slice(2).join('/')}/uploads/${userId}/`;
    const { bucketName } = parsePath(`${privateBase}/x`);
    const [files] = await client.bucket(bucketName).getFiles({ prefix, maxResults: 100 });
    return files.map(f => ({
      name: f.name.split('/').pop(),
      path: `/objects/${userId}/${f.name.split('/').pop()}`,
      size: parseInt(f.metadata.size || 0),
      contentType: f.metadata.contentType || 'application/octet-stream',
      createdAt: f.metadata.timeCreated,
    }));
  } catch (err) {
    console.warn('[ObjStorage] listUserObjects error:', err.message);
    return [];
  }
}

async function deleteObject(objectPath) {
  const client = getStorageClient();
  if (!client) throw new Error('Storage tidak tersedia');
  const privateBase = PRIVATE_DIR.replace(/\/$/, '');
  const entityId = objectPath.replace(/^\/objects\//, '');
  const fullPath = `${privateBase}/uploads/${entityId}`;
  const { bucketName, objectName } = parsePath(fullPath);
  await client.bucket(bucketName).file(objectName).delete();
}

module.exports = { isAvailable, getSignedUploadUrl, streamObject, listUserObjects, deleteObject, fileExists };
