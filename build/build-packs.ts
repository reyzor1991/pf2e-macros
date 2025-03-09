import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Compile a LevelDB compendium pack.
await compilePack("packs/macros", "dist/packs/macros");
await compilePack("packs/effects", "dist/packs/effects");
