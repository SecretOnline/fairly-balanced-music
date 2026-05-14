import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; url: string }[];
}

interface VersionData {
  downloads: {
    client: {
      url: string;
      sha1: string;
    };
  };
}

async function downloadVersionJson() {
  const manifestUrl =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
  const manifest = (await fetch(manifestUrl).then((r) =>
    r.json(),
  )) as VersionManifest;

  const versionType = (process.env.VERSION_TYPE ?? "release") as "release" | "snapshot";
  const releaseVersion = manifest.latest[versionType];

  const versionData = (await fetch(
    manifest.versions.find((v) => v.id === releaseVersion)!.url,
  ).then((r) => r.json())) as VersionData;

  const clientUrl = versionData.downloads.client.url;
  console.log(`Downloading client .jar...`);

  const clientJar = await fetch(clientUrl).then((r) => r.arrayBuffer());

  console.log(`Extracting version.json...`);
  const jarBuffer = Buffer.from(clientJar);
  const zip = await JSZip.loadAsync(jarBuffer);
  const versionJsonFile = zip.file("version.json");
  const versionJson = versionJsonFile
    ? await versionJsonFile.async("nodebuffer")
    : null;

  if (!versionJson) {
    throw new Error("version.json not found in client .jar");
  }

  await mkdir("mojang", { recursive: true });
  await writeFile("mojang/version.json", versionJson.toString("utf8"));

  console.log("Downloaded and extracted version.json");
}

downloadVersionJson().catch((err) => {
  console.error(err);
  process.exit(1);
});
