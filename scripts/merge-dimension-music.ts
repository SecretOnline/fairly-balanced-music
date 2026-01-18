import { readFile, writeFile } from "node:fs/promises";

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

const DIMENSION_IDS = ["overworld", "nether"];
const EXCLUDED_SOUND_EVENTS = ["music.overworld.deep_dark"];
const ADDITIONAL_OVERWORLD_EVENTS = ["music.creative"];

function expandSoundEntry(
  entry: SoundEntry,
  sounds: SoundsJson,
  visited = new Set<string>(),
): SoundEntry[] {
  if (entry.type === "event") {
    if (visited.has(entry.name)) {
      console.warn(`Circular reference detected for event: ${entry.name}`);
      return [];
    }
    visited.add(entry.name);

    const eventDefinition = sounds[entry.name];
    if (!eventDefinition) {
      console.warn(`Event reference not found: ${entry.name}`);
      return [];
    }

    return eventDefinition.sounds.flatMap((sound) =>
      expandSoundEntry(sound, sounds, visited),
    );
  }

  return [entry];
}

async function mergeDimensionMusic() {
  const soundsData = await readFile("mojang/sounds.json", "utf-8");
  const sounds: SoundsJson = JSON.parse(soundsData);

  const musicByDimension = new Map(
    DIMENSION_IDS.map((id) => [`music.${id}.`, new Map<string, SoundEntry>()]),
  );
  const emptyBiomes = new Set<string>();

  for (const [key, definition] of Object.entries(sounds)) {
    const prefix = musicByDimension.keys().find((p) => key.startsWith(p));
    if (!prefix || EXCLUDED_SOUND_EVENTS.includes(key)) continue;

    if (definition.sounds.length === 0) {
      emptyBiomes.add(key);
      continue;
    }

    const dimensionMusic = musicByDimension.get(prefix)!;
    for (const sound of definition.sounds) {
      const expandedSounds = expandSoundEntry(sound, sounds);
      for (const expandedSound of expandedSounds) {
        if (!dimensionMusic.has(expandedSound.name)) {
          const entry: SoundEntry = {
            name: expandedSound.name,
            stream: expandedSound.stream,
          };
          if (expandedSound.volume !== undefined) {
            entry.volume = expandedSound.volume;
          }
          dimensionMusic.set(expandedSound.name, entry);
        }
      }
    }
  }

  const overworldMusic = musicByDimension.get("music.overworld.")!;
  const musicGameDefinition = sounds["music.game"];
  if (musicGameDefinition) {
    for (const sound of musicGameDefinition.sounds) {
      const expandedSounds = expandSoundEntry(sound, sounds);
      for (const expandedSound of expandedSounds) {
        if (!overworldMusic.has(expandedSound.name)) {
          const entry: SoundEntry = {
            name: expandedSound.name,
            stream: expandedSound.stream,
          };
          if (expandedSound.volume !== undefined) {
            entry.volume = expandedSound.volume;
          }
          overworldMusic.set(expandedSound.name, entry);
        }
      }
    }
  }

  for (const eventKey of ADDITIONAL_OVERWORLD_EVENTS) {
    const eventDefinition = sounds[eventKey];
    if (eventDefinition) {
      for (const sound of eventDefinition.sounds) {
        const expandedSounds = expandSoundEntry(sound, sounds);
        for (const expandedSound of expandedSounds) {
          if (!overworldMusic.has(expandedSound.name)) {
            const entry: SoundEntry = {
              name: expandedSound.name,
              stream: expandedSound.stream,
            };
            if (expandedSound.volume !== undefined) {
              entry.volume = expandedSound.volume;
            }
            overworldMusic.set(expandedSound.name, entry);
          }
        }
      }
    }
  }

  const updatedSounds: SoundsJson = {};

  for (const [key, definition] of Object.entries(sounds)) {
    const prefix = musicByDimension.keys().find((p) => key.startsWith(p));
    if (!prefix || EXCLUDED_SOUND_EVENTS.includes(key)) continue;

    const allMusic = Array.from(musicByDimension.get(prefix)!.values());
    updatedSounds[key] = {
      replace: true,
      sounds: emptyBiomes.has(key) ? [] : allMusic,
    };
  }

  const overworldMusicList = Array.from(overworldMusic.values());
  updatedSounds["music.game"] = {
    replace: true,
    sounds: overworldMusicList,
  };

  await writeFile(
    "pack/assets/minecraft/sounds.json",
    JSON.stringify(updatedSounds, null, 2),
  );

  console.log("Merged music definitions:");
  for (const [prefix, soundEntries] of musicByDimension.entries()) {
    const musicCount = soundEntries.size;
    const biomeCount = Object.keys(updatedSounds).filter((k) =>
      k.startsWith(prefix),
    ).length;
    console.log(`- ${prefix} - ${musicCount} tracks for ${biomeCount} biomes`);
  }
  console.log(`- ${emptyBiomes.size} biomes with no music`);
}

mergeDimensionMusic().catch((err) => {
  console.error(err);
  process.exit(1);
});
