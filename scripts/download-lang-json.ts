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

async function downloadLangJson() {
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

  console.log(`Extracting en_us.json...`);
  const jarBuffer = Buffer.from(clientJar);
  const zip = await JSZip.loadAsync(jarBuffer);
  const langJsonFile = zip.file("assets/minecraft/lang/en_us.json");
  const langJson = langJsonFile
    ? await langJsonFile.async("nodebuffer")
    : null;

  if (!langJson) {
    throw new Error("assets/minecraft/lang/en_us.json not found in client .jar");
  }

  await mkdir("mojang", { recursive: true });
  await writeFile("mojang/en_us.json", langJson.toString("utf8"));

  console.log("Downloaded and extracted en_us.json");
}

downloadLangJson().catch((err) => {
  console.error(err);
  process.exit(1);
});
