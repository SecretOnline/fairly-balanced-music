import { readFile } from "node:fs/promises";

interface ProjectConfig {
  "modrinth-id": string;
}

interface VersionManifest {
  latest: { release: string };
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  version_number: string;
  game_versions: string[];
  version_type: string;
  date_published: string;
}

async function getLatestMinecraftVersion(): Promise<string> {
  const manifestUrl =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
  const manifest = (await fetch(manifestUrl).then((r) =>
    r.json(),
  )) as VersionManifest;
  return manifest.latest.release;
}

async function updateModrinthVersions(
  projectId: string,
  latestMcVersion: string,
  token: string,
): Promise<boolean> {
  console.log(`\nChecking Modrinth project: ${projectId}`);

  const versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
  const versions = (await fetch(versionsUrl).then((r) =>
    r.json(),
  )) as ModrinthVersion[];

  const releaseVersions = versions
    .filter((v) => v.version_type === "release")
    .sort(
      (a, b) =>
        new Date(b.date_published).getTime() -
        new Date(a.date_published).getTime(),
    );

  if (releaseVersions.length === 0) {
    console.log("No release versions found on Modrinth");
    return false;
  }

  const latestVersion = releaseVersions[0];
  console.log(`Latest version: ${latestVersion.version_number}`);
  console.log(`Supported game versions: ${latestVersion.game_versions.join(", ")}`);

  if (latestVersion.game_versions.includes(latestMcVersion)) {
    console.log(`Already supports ${latestMcVersion}`);
    return false;
  }

  console.log(`Adding support for ${latestMcVersion}`);
  const updatedGameVersions = [...latestVersion.game_versions, latestMcVersion];

  const patchUrl = `https://api.modrinth.com/v2/version/${latestVersion.id}`;
  const response = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game_versions: updatedGameVersions,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update Modrinth version: ${response.status} ${await response.text()}`,
    );
  }

  console.log(`Successfully updated Modrinth version`);
  return true;
}

async function updateSupportedVersions() {
  const projectConfig: ProjectConfig = JSON.parse(
    await readFile("project.json", "utf-8"),
  );

  const latestMcVersion = await getLatestMinecraftVersion();
  console.log(`Latest Minecraft version: ${latestMcVersion}`);

  const modrinthToken = process.env.MODRINTH_TOKEN;

  if (!modrinthToken) {
    throw new Error("MODRINTH_TOKEN environment variable not set");
  }

  if (projectConfig["modrinth-id"]) {
    const updated = await updateModrinthVersions(
      projectConfig["modrinth-id"],
      latestMcVersion,
      modrinthToken,
    );

    if (updated) {
      console.log("\n✓ Updated supported versions on Modrinth");
    } else {
      console.log("\n✓ Modrinth already supports the latest version");
    }
  } else {
    console.log("\nSkipping Modrinth (no project ID configured)");
  }
}

updateSupportedVersions().catch((err) => {
  console.error(err);
  process.exit(1);
});
