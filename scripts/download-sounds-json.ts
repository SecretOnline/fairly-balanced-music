import { mkdir, writeFile } from 'node:fs/promises';

interface VersionManifest {
  latest: { release: string };
  versions: { id: string; url: string }[];
}

interface VersionData {
  assetIndex: { url: string };
}

interface AssetIndex {
  [key: string]: { hash: string };
}

async function downloadSoundsJson() {
  const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
  const manifest = (await fetch(manifestUrl).then(r => r.json())) as VersionManifest;

  const releaseVersion = manifest.latest.release;
  const versionData = (await fetch(manifest.versions.find(v => v.id === releaseVersion)!.url).then(r => r.json())) as VersionData;

  const assetIndex = (await fetch(versionData.assetIndex.url).then(r => r.json())) as AssetIndex;

  const soundsHash = assetIndex.objects['minecraft/sounds.json'].hash;
  const hashPrefix = soundsHash.slice(0, 2);
  const soundsUrl = `https://resources.download.minecraft.net/${hashPrefix}/${soundsHash}`;
  const soundsJson = await fetch(soundsUrl).then(r => r.text());

  await mkdir('mojang', { recursive: true });
  await writeFile('mojang/sounds.json', soundsJson);

  console.log("Downloaded sounds.json");
}

downloadSoundsJson().catch(console.error);
