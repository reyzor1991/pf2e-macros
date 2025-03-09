import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Compile a LevelDB compendium pack.
await compilePack("packs/src/macros", "pf2e-macros/packs/macros");
await compilePack("packs/src/effects", "pf2e-macros/packs/effects");
