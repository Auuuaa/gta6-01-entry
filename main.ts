// Neon Harbor — hand-in program for the gta6-01 bounty.
//
// This file does one small job: it stages the finished game for grading.
// It copies the playable game (game/) and its screenshots (screenshots/)
// out of this repository into the output directory, then asks the kit
// library to write a dossier.json describing everything that was staged.
// It contains no game logic of its own; the game lives under game/.
//
// Run it as:  MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
// With no variable set it writes to /output, which is where the grader
// looks. It needs nothing but the Node standard library.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDossier } from "./vendor/makefun-game.ts";

// Limits the dossier builder is given, matching the bounty gate: the
// dossier text is capped, at most four screenshots of at most 256 KiB
// each, and the game tree is capped at 993 entries / 48 MiB with paths
// no longer than 1,000 bytes.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const FALLBACK_OUTPUT = "/output";

// Where this file lives on disk, so the game and screenshots are found
// relative to the repository no matter where the command is run from.
function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

// The directory to stage into: the environment's choice, or /output.
function pickOutputDir(): string {
  const wanted = process.env.MAKEFUN_OUTPUT_DIR;
  return wanted !== undefined && wanted !== "" ? wanted : FALLBACK_OUTPUT;
}

// Complain loudly when a folder we need is not there, instead of
// staging a half-empty entry and only finding out at grading time.
function insistOnFolder(path: string, label: string): void {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`missing ${label}: expected a directory at ${path}`);
  }
}

// Copy a whole folder tree, files and subfolders alike, creating the
// destination as we go. Symlinks and friends are not expected in the
// entry, so anything that is neither a file nor a directory is refused
// rather than silently skipped.
function mirrorFolder(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) {
      mirrorFolder(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    } else {
      throw new Error(`unsupported entry while copying ${source}: ${entry.name}`);
    }
  }
}

// Screenshots are staged when the folder exists. A missing folder is
// reported instead of crashing the copy loop, but the dossier builder
// itself will still refuse an entry with no screenshots at all, which
// is the right outcome for a real submission.
function stageScreenshots(root: string, out: string): void {
  const shots = join(root, "screenshots");
  if (!existsSync(shots)) {
    console.warn("warning: no screenshots/ folder beside main.ts; continuing without it");
    return;
  }
  insistOnFolder(shots, "screenshots folder");
  mirrorFolder(shots, join(out, "screenshots"));
}

// The whole hand-in, in order: prepare the destination, stage the game,
// stage the screenshots, then write the dossier from what was staged.
function handIn(): void {
  const root = repoRoot();
  const out = resolve(pickOutputDir());

  const gameDir = join(root, "game");
  insistOnFolder(gameDir, "game folder");

  mkdirSync(out, { recursive: true });
  // Clear anything a previous run staged, so files deleted from the
  // repository since then cannot linger and make this run's output
  // differ from the repo's current state.
  for (const stale of ["game", "screenshots", "dossier.json"]) {
    rmSync(join(out, stale), { recursive: true, force: true });
  }
  mirrorFolder(gameDir, join(out, "game"));
  stageScreenshots(root, out);

  const dossier = buildDossier(out, DOSSIER_LIMITS);
  writeFileSync(join(out, "dossier.json"), dossier);
}

try {
  handIn();
  console.log("BUILD_OK");
} catch (problem) {
  const detail = problem instanceof Error ? problem.message : String(problem);
  console.error(`BUILD_FAILED: ${detail}`);
  process.exitCode = 1;
}
