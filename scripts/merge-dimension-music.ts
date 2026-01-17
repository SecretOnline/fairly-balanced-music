import { readFile, writeFile } from "node:fs/promises";

interface SoundEntry {
  name: string;
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

async function mergeDimensionMusic() {
  const soundsData = await readFile("mojang/sounds.json", "utf-8");
  const sounds: SoundsJson = JSON.parse(soundsData);

  const musicByDimension = new Map(
    DIMENSION_IDS.map((id) => [`music.${id}.`, new Map<string, SoundEntry>()]),
  );
  const emptyBiomes = new Set<string>();

  for (const [key, definition] of Object.entries(sounds)) {
    const prefix = musicByDimension.keys().find((p) => key.startsWith(p));
    if (!prefix) continue;

    if (definition.sounds.length === 0) {
      emptyBiomes.add(key);
      continue;
    }

    const dimensionMusic = musicByDimension.get(prefix)!;
    for (const sound of definition.sounds) {
      if (!dimensionMusic.has(sound.name)) {
        const entry: SoundEntry = {
          name: sound.name,
          stream: sound.stream,
        };
        if (sound.volume !== undefined) {
          entry.volume = sound.volume;
        }
        dimensionMusic.set(sound.name, entry);
      }
    }
  }

  const updatedSounds: SoundsJson = {};

  for (const [key, definition] of Object.entries(sounds)) {
    const prefix = musicByDimension.keys().find((p) => key.startsWith(p));
    if (!prefix) continue;

    const allMusic = Array.from(musicByDimension.get(prefix)!.values());
    updatedSounds[key] = {
      replace: true,
      sounds: emptyBiomes.has(key) ? [] : allMusic,
    };
  }

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
