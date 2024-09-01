import {actorAction, actorFeat, baseMapForm, combinedDamage, getMap} from "../lib.js";

function twinFeintWeapons(actor) {
    return actor.system.actions
        .filter(h => h.ready && h.item?.isMelee && !h.item?.system?.traits?.value?.includes("unarmed")
            && (
                (h.item?.isHeld && (h.item?.hands === "1" || h.item?.hands === "1+") && h.item?.handsHeld === 1) || actor.isOfType('npc')
            )
        );
}

export async function twinFeint(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorAction(actor, "twin-feint") && !actorFeat(actor, "twin-feint")) {
        ui.notifications.warn(`${actor.name} does not have Twin Feint!`);
        return;
    }

    const weapons = twinFeintWeapons(actor);
    if (weapons.length !== 2) {
        ui.notifications.warn(`${actor.name} needs only 2 melee weapons can be equipped at a time.'`);
        return;
    }

    const {map} = await baseMapForm("Twin Feint");

    if (map === undefined) {
        return;
    }
    const map2 = map === 2 ? map : map + 1;

    let primary = weapons[0];
    let secondary = weapons[1];
    if (primary.item.system.traits.value.includes("agile")) {
        primary = weapons[1];
        secondary = weapons[0];
    }

    await combinedDamage("Twin Feint", primary, secondary, ["twin-feint"], map, map2);
}
