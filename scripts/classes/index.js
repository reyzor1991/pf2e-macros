import {inspireHeroics} from "./bard.js";
import {certainStrike, dazingBlow, doubleSlice, knockdown, snaggingStrike, swipe, whirlwindStrike} from "./fighter.js";
import {pairedShots, pistolerosChallenge, swordAndPistol} from "./gunslinger.js";
import {twoElementInfusion} from "./kineticist.js";
import {flurryOfBlows} from "./monk.js";
import {twinFeint} from "./rogue.js";
import {huntedShot, rangerLink, twinTakedown} from "./ranger.js";
import {accidentalShot} from "./sharpshooter.js";
import {rootToLife} from "./thaumaturge.js";
import {
    aid,
    counteract,
    doffPartyArmor, effectConditionInfo,
    explorationActivity, gmCounteract,
    onOffNPCVision, repairParty,
    scareToDeath,
    targetIsOffGuard
} from "./general.js";

export function initMacros() {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "inspireHeroics": inspireHeroics,

        "doubleSlice": doubleSlice,
        "knockdown": knockdown,
        "dazingBlow": dazingBlow,
        "snaggingStrike": snaggingStrike,
        "certainStrike": certainStrike,
        "swipe": swipe,
        "whirlwindStrike": whirlwindStrike,

        "pairedShots": pairedShots,
        "pistolerosChallenge": pistolerosChallenge,
        "swordAndPistol": swordAndPistol,

        "twoElementInfusion": twoElementInfusion,

        "flurryOfBlows": flurryOfBlows,

        "twinFeint": twinFeint,

        "huntedShot": huntedShot,
        "twinTakedown": twinTakedown,
        "rangerLink": rangerLink,

        "accidentalShot": accidentalShot,

        "rootToLife": rootToLife,

        "scareToDeath": scareToDeath,
        "aid": aid,
        "explorationActivity": explorationActivity,
        "doffPartyArmor": doffPartyArmor,
        "targetIsOffGuard": targetIsOffGuard,
        "onOffNPCVision": onOffNPCVision,
        "counteract": counteract,
        "gmCounteract": gmCounteract,
        "effectConditionInfo": effectConditionInfo,
        "repairParty": repairParty,
    })
}