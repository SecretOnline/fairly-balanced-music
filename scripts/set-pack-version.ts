import { readFile, writeFile } from "node:fs/promises";

interface VersionJson {
  pack_version: {
    resource_major: number;
    resource_minor: number;
  };
}

interface PackMcmeta {
  pack: {
    description: string;
    min_format: number | [number, number];
    max_format: number;
  };
}

async function updatePackVersion() {
  const versionData = await readFile("mojang/version.json", "utf-8");
  const version: VersionJson = JSON.parse(versionData);

  const mcmetaData = await readFile("pack/pack.mcmeta", "utf-8");
  const mcmeta: PackMcmeta = JSON.parse(mcmetaData);

  const { resource_major, resource_minor } = version.pack_version;
  mcmeta.pack.min_format =
    resource_minor > 0 ? [resource_major, resource_minor] : resource_major;

  await writeFile(
    "pack/pack.mcmeta",
    JSON.stringify(mcmeta, null, 2) + "\n",
  );

  console.log(
    `Updated pack.mcmeta min_format to ${JSON.stringify(mcmeta.pack.min_format)}`,
  );
}

updatePackVersion().catch((err) => {
  console.error(err);
  process.exit(1);
});
