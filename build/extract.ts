import {extractPack} from "@foundryvtt/foundryvtt-cli";

// Extract a NeDB compendium pack.
await extractPack("packs/db/effects.db", "packs/src/effects", {nedb: true, documentType: "Item"});
await extractPack("packs/db/macros.db", "packs/src/macros", {nedb: true, documentType: "Macro"});