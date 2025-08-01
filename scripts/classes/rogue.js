import {
    actorAction,
    actorFeat,
    eventSkipped,
    favoriteWeapon,
    getMap,
    isV12,
    removeEffectFromActor,
    selectIf,
    setEffectToActor
} from "../lib.js";
import {moduleName} from "../const.js";

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
    if (weapons.length < 2) {
        ui.notifications.warn(`${actor.name} needs only 2 melee weapons can be equipped at a time.'`);
        return;
    }

    let f1 = favoriteWeapon("twin-feint-1")
    let f2 = favoriteWeapon("twin-feint-2")

    let weaponOptions = '';
    let weaponOptions2 = '';
    for (const [i, value] of weapons.entries()) {
        weaponOptions += `<option value=${i} ${selectIf(f1, value.item)}>${value.label}</option>`
        weaponOptions2 += `<option value=${i} ${selectIf(f2, value.item)}>${value.label}</option>`
    }

    const {weapon1, weapon2, map} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Twin Feint"},
        width: 550,
        content: `
            <div class="v2-row">
                <label>First Attack</label>
                <select id="fob1" autofocus>
                    ${weaponOptions}
                </select>
    
                <label>Second Attack</label>
                <select id="fob2">
                    ${weaponOptions2}
                </select>
            </div>
            
            ${getMap()}
        `,
        buttons: [{
            action: "ok", label: "Attack", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                let el = isV12() ? $(form) : $(form.element);
                return {
                    map: parseInt(el.find("#map").val()),
                    weapon1: parseInt(el.find("#fob1").val()),
                    weapon2: parseInt(el.find("#fob2").val()),
                }
            }
        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    });
    if (weapon1 === undefined || weapon2 === undefined || map === undefined) {
        return;
    }
    if (weapon1 === weapon2) {
        ui.notifications.info("Need to select different weapons");
        return;
    }

    let primary = weapons[weapon1];
    let secondary = weapons[weapon2];

    const map2 = map === 2 ? map : map + 1;

    await primary.variants[map].roll({'event': eventSkipped(event)});
    await setEffectToActor(secondary.item.actor, `Compendium.${moduleName}.effects.Item.HnErWUKHpIpE7eqO`)
    let roll = await secondary.variants[map2].roll({
        'event': eventSkipped(event),
        options: ["twin-feint-second-attack"]
    });
    if (roll.options?.degreeOfSuccess < 2) {
        await removeEffectFromActor(secondary.item.actor, `Compendium.${moduleName}.effects.Item.HnErWUKHpIpE7eqO`);
    }
}
