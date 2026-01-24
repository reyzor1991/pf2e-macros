import {inspireHeroics} from "./bard.js";
import {
    certainStrike,
    dazingBlow,
    doubleSlice,
    knockdown,
    overwhelmingCombination,
    snaggingStrike,
    swipe,
    whirlwindStrike
} from "./fighter.js";
import {pairedShots, pistolerosChallenge, stabAndBlast, swordAndPistol, triggerbrandSalvo} from "./gunslinger.js";
import {twoElementInfusion} from "./kineticist.js";
import {flurryOfBlows} from "./monk.js";
import {twinFeint} from "./rogue.js";
import {huntedShot, rangerLink, twinTakedown} from "./ranger.js";
import {accidentalShot} from "./sharpshooter.js";
import {rootToLife} from "./thaumaturge.js";
import {
    aid, aidBase,
    counteract,
    doffPartyArmor,
    effectConditionInfo,
    explorationActivity,
    shapeshifting,
    gmCounteract,
    onOffNPCVision,
    showHeroPoints,
    repairParty,
    scareToDeath,
    targetIsOffGuard,
    flowingSpiritStrike, retch, distractingPerformance, crescentSpray, twinFlowingSpiritStrike, setNumbersToTokens
} from "./general.js";

export function initMacros() {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "inspireHeroics": inspireHeroics,

        "overwhelmingCombination": overwhelmingCombination,
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
        "stabAndBlast": stabAndBlast,
        "triggerbrandSalvo": triggerbrandSalvo,

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
        "aidBase": aidBase,
        "explorationActivity": explorationActivity,
        "shapeshifting": shapeshifting,
        "doffPartyArmor": doffPartyArmor,
        "targetIsOffGuard": targetIsOffGuard,
        "onOffNPCVision": onOffNPCVision,
        "counteract": counteract,
        "gmCounteract": gmCounteract,
        "effectConditionInfo": effectConditionInfo,
        "repairParty": repairParty,
        "showHeroPoints": showHeroPoints,
        "flowingSpiritStrike": flowingSpiritStrike,
        "twinFlowingSpiritStrike": twinFlowingSpiritStrike,
        "retch": retch,
        "distractingPerformance": distractingPerformance,
        "crescentSpray": crescentSpray,
        "setNumbersToTokens": setNumbersToTokens,
    })
}