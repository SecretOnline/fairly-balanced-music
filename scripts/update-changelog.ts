import { readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface SoundEntry {
  name: string;
  type?: string;
  stream?: boolean;
  volume?: number;
  weight?: number;
}

interface SoundDefinition {
  replace?: boolean;
  sounds: SoundEntry[];
}

interface SoundsJson {
  [key: string]: SoundDefinition;
}

interface LangJson {
  [key: string]: string;
}

function soundPathToLangKey(soundPath: string): string {
  // Convert "music/game/nether/ballad_of_the_cats" to "music.game.nether.ballad_of_the_cats"
  return soundPath.replace(/\//g, ".");
}

function getSoundName(soundPath: string, langData: LangJson): string {
  const langKey = soundPathToLangKey(soundPath);
  return langData[langKey] || soundPath;
}

function extractTracks(sounds: SoundsJson, prefix: string): Set<string> {
  const tracks = new Set<string>();

  for (const [key, definition] of Object.entries(sounds)) {
    if (key.startsWith(prefix)) {
      for (const sound of definition.sounds) {
        if (sound.name && !sound.type) {
          tracks.add(sound.name);
        }
      }
    }
  }

  return tracks;
}

function extractOverworldTracks(sounds: SoundsJson): Set<string> {
  const tracks = new Set<string>();

  for (const [key, definition] of Object.entries(sounds)) {
    if (key.startsWith("music.overworld.") || key === "music.game") {
      for (const sound of definition.sounds) {
        if (sound.name && !sound.type) {
          tracks.add(sound.name);
        }
      }
    }
  }

  return tracks;
}

async function updateChangelog() {
  // Get the old version from git
  let oldSounds: SoundsJson = {};
  try {
    const { stdout } = await execAsync(
      "git show HEAD:pack/assets/minecraft/sounds.json",
    );
    oldSounds = JSON.parse(stdout);
  } catch (err) {
    console.log("No previous sounds.json found in git, treating as empty");
  }

  const newSoundsData = await readFile(
    "pack/assets/minecraft/sounds.json",
    "utf-8",
  );
  const newSounds: SoundsJson = JSON.parse(newSoundsData);

  const langData: LangJson = JSON.parse(
    await readFile("mojang/en_us.json", "utf-8"),
  );

  // Extract tracks from old and new sounds for overworld and nether
  const oldOverworldTracks = extractOverworldTracks(oldSounds);
  const newOverworldTracks = extractOverworldTracks(newSounds);
  const addedOverworldTracks = [...newOverworldTracks].filter(
    (track) => !oldOverworldTracks.has(track),
  );

  const oldNetherTracks = extractTracks(oldSounds, "music.nether.");
  const newNetherTracks = extractTracks(newSounds, "music.nether.");
  const addedNetherTracks = [...newNetherTracks].filter(
    (track) => !oldNetherTracks.has(track),
  );

  // Check if there are any changes
  if (addedOverworldTracks.length === 0 && addedNetherTracks.length === 0) {
    console.log("No new tracks added to changelog");
    return;
  }

  // Read current changelog
  let changelog = await readFile("CHANGELOG.md", "utf-8");

  // Find the latest version to increment
  const versionRegex = /## v(\d+)\.(\d+)\.(\d+) - /;
  const versionMatch = changelog.match(versionRegex);

  if (!versionMatch) {
    throw new Error("Could not find version in CHANGELOG.md");
  }

  const major = parseInt(versionMatch[1]);
  const minor = parseInt(versionMatch[2]);
  const newVersion = `v${major}.${minor + 1}.0`;
  const today = new Date().toISOString().split("T")[0];

  let changelogSection = `## ${newVersion} - ${today}\n\n### Added\n\n`;

  if (addedOverworldTracks.length > 0) {
    changelogSection += "- Overworld\n";
    for (const track of addedOverworldTracks.sort()) {
      const trackName = getSoundName(track, langData);
      changelogSection += `  - ${trackName}\n`;
    }
  }

  if (addedNetherTracks.length > 0) {
    changelogSection += "- Nether\n";
    for (const track of addedNetherTracks.sort()) {
      const trackName = getSoundName(track, langData);
      changelogSection += `  - ${trackName}\n`;
    }
  }

  changelogSection += "\n";

  // Find the Unreleased section and insert after it
  const unreleasedRegex = /## Unreleased - DATE\n+/;
  const unreleasedMatch = changelog.match(unreleasedRegex);

  if (!unreleasedMatch) {
    throw new Error("Could not find Unreleased section in CHANGELOG.md");
  }

  // Insert the changes after the Unreleased header
  const insertIndex = unreleasedMatch.index! + unreleasedMatch[0].length;
  changelog =
    changelog.slice(0, insertIndex) +
    changelogSection +
    changelog.slice(insertIndex);

  await writeFile("CHANGELOG.md", changelog);

  console.log("Updated CHANGELOG.md:");
  console.log(`- Added ${addedOverworldTracks.length} overworld tracks`);
  console.log(`- Added ${addedNetherTracks.length} nether tracks`);
}

updateChangelog().catch((err) => {
  console.error(err);
  process.exit(1);
});
