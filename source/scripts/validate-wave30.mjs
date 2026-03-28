import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave30-'));
const dataRootPath = join(sandboxPath, 'data');

const { MediaLibraryModule } = await import(
  '../packages/modules/media-library/dist/modules/media-library/src/public/index.js'
);

try {
  const mediaLibrary = new MediaLibraryModule({
    dataRootPath,
  });
  const fakeVideoBinary = Buffer.from('wave30-video-binary-sample-v1', 'utf8');

  const firstIngest = await mediaLibrary.ingestAsset({
    mediaType: 'video',
    mimeType: 'video/mp4',
    binary: fakeVideoBinary,
    sourceChatJid: '120363400000000999@g.us',
    sourceMessageId: 'wamid.wave30.video.1',
    caption: 'Video de teste para distribuicao futura.',
    storedAt: '2026-03-28T16:45:00.000Z',
  });

  assert.equal(firstIngest.deduplicated, false);
  assert.equal(firstIngest.asset.assetId, firstIngest.asset.sha256);
  assert.equal(firstIngest.asset.mediaType, 'video');
  assert.equal(firstIngest.asset.mimeType, 'video/mp4');
  assert.equal(firstIngest.asset.fileSize, fakeVideoBinary.byteLength);
  assert.equal(firstIngest.asset.binaryPath, join(dataRootPath, 'runtime', 'media', 'assets', firstIngest.asset.assetId, 'binary'));
  assert.equal(firstIngest.asset.metadataPath, join(dataRootPath, 'runtime', 'media', 'assets', firstIngest.asset.assetId, 'metadata.json'));

  const duplicateIngest = await mediaLibrary.ingestAsset({
    mediaType: 'video',
    mimeType: 'video/mp4',
    binary: fakeVideoBinary,
    sourceChatJid: '120363400000001000@g.us',
    sourceMessageId: 'wamid.wave30.video.2',
    caption: 'Mesmo ficheiro, noutra mensagem.',
    storedAt: '2026-03-28T16:46:00.000Z',
  });

  assert.equal(duplicateIngest.deduplicated, true);
  assert.equal(duplicateIngest.asset.assetId, firstIngest.asset.assetId);

  const library = await mediaLibrary.getLibrary();
  assert.equal(library.exists, true);
  assert.equal(library.libraryPath, join(dataRootPath, 'runtime', 'media', 'library.json'));
  assert.equal(library.assetsRootPath, join(dataRootPath, 'runtime', 'media', 'assets'));
  assert.equal(library.retentionPolicy.mode, 'manual');
  assert.equal(library.retentionPolicy.deleteAfterDays, null);
  assert.equal(library.assets.length, 1);
  assert.equal(library.assets[0]?.assetId, firstIngest.asset.assetId);
  assert.equal(library.assets[0]?.sourceMessageId, 'wamid.wave30.video.1');

  const binaryOnDisk = await readFile(firstIngest.asset.binaryPath);
  assert.deepEqual(binaryOnDisk, fakeVideoBinary);

  const reloadedMediaLibrary = new MediaLibraryModule({
    dataRootPath,
  });
  const recoveredAsset = await reloadedMediaLibrary.getAsset(firstIngest.asset.assetId);
  assert.ok(recoveredAsset);
  assert.equal(recoveredAsset.assetId, firstIngest.asset.assetId);
  assert.equal(recoveredAsset.exists, true);
  assert.equal(recoveredAsset.sourceChatJid, '120363400000000999@g.us');

  const recoveredBinary = await reloadedMediaLibrary.readBinary(firstIngest.asset.assetId);
  assert.deepEqual(Buffer.from(recoveredBinary), fakeVideoBinary);

  console.log('validate-wave30: ok');
  console.log(`assetId=${firstIngest.asset.assetId}`);
  console.log(`libraryPath=${library.libraryPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
