import {extractPack} from "@foundryvtt/foundryvtt-cli";

// Extract a NeDB compendium pack.
await extractPack("packs/db/effects.db", "packs/src/", {nedb: true, documentType: "Item"});
await extractPack("packs/db/macros.db", "packs/src/", {nedb: true, documentType: "Macro"});