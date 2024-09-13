import {
    actorAction,
    actorFeat,
    baseAttackWeaponForm,
    combinedDamage,
    favoriteWeapon,
    getMap,
    selectIf
} from "../lib.js";

function huntedShotWeapons(actor) {
    return actor.system.actions
        .filter(
            h => h.ready && h.item?.isRanged && (
                (h.visible && "0" === h?.item?.reload && (h.item?.ammo || h.item?.isThrowable)) || actor.isOfType('npc')
            )
        );
}

function twinTakedownWeapons(actor) {
    return actor.system.actions
        .filter(h => h.ready && (h.item?.isMelee || (h?.item?.isRanged && h.altUsages[0]?.options?.includes('melee'))) && !h.item?.system?.traits?.value?.includes("unarmed")
            && (
                (h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
                || actor.isOfType('npc')
            )
        );
}

export async function huntedShot(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorAction(actor, "hunted-shot") && !actorFeat(actor, "hunted-shot")) {
        ui.notifications.warn(`${actor.name} does not have Hunted Shot!`);
        return;
    }

    const weapons = huntedShotWeapons(actor)
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon'`);
        return;
    }
    let f1 = favoriteWeapon("hunted-shot")
    let weaponOptions = weapons.map(w => `<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const {currentWeapon, map} = await baseAttackWeaponForm("Hunted Shot", weaponOptions);

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    const map2 = map === 2 ? map : map + 1;

    let primary = weapons.find(w => w.item.id === currentWeapon);
    let secondary = weapons.find(w => w.item.id === currentWeapon);

    await combinedDamage("Hunted Shot", primary, secondary, [], map, map2);
}

export async function twinTakedown(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorFeat(actor, "twin-takedown") && !actorAction(actor, "twin-takedown")) {
        ui.notifications.warn(`${actor.name} does not have Twin Takedown!`);
        return;
    }

    const weapons = twinTakedownWeapons(actor);
    if (weapons.length < 2) {
        ui.notifications.warn(`${actor.name} needs only 2 one-handed melee weapons can be equipped at a time.'`);
        return;
    }

    let f1 = favoriteWeapon("twin-takedown-1")
    let f2 = favoriteWeapon("twin-takedown-2")

    let weaponOptions = '';
    let weaponOptions2 = '';
    for (const [i, value] of weapons.entries()) {
        weaponOptions += `<option value=${i} ${selectIf(f1, value.item)}>${value.item.name}</option>`
        weaponOptions2 += `<option value=${i} ${selectIf(f2, value.item, () => {
            return i === 1 || value.item?.traits.has('agile') ? 'selected' : ''
        })}>${value.item.name}</option>`
    }

    const {weapon1, weapon2, map} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Twin Takedown"},
        content: `
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <h3>First Attack</h3>
                    <select id="fob1" autofocus>
                        ${weaponOptions}
                    </select>
                </div>
                <div>
                    <h3>Second Attack</h3>
                    <select id="fob2">
                        ${weaponOptions2}
                    </select>
                </div>
            </div>
            ${getMap()}
        `,
        buttons: [{
            action: "ok", label: "Attack", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                return {
                    weapon1: $(form).find("#fob1").val(),
                    weapon2: $(form).find("#fob2").val(),
                    map: parseInt($(form).find("#map").val()),
                }
            }
        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    });

    if (map === undefined) {
        return;
    }
    const map2 = map === 2 ? map : map + 1;

    let options = weapons[weapon1] === weapons[weapon2]
        ? []
        : weapons[weapon1].item.system.traits.value.some((t) => t === "twin") && weapons[weapon2].item.system.traits.value.some((t) => t === "twin")
            ? ['need-twin-2nd-attack']
            : []

    await combinedDamage("Twin Takedown", weapons[weapon1], weapons[weapon2], options, map, map2);
}

export async function rangerLink(actor) {
    if (!game.user.isGM) {
        ui.notifications.info(`Only GM can run script`);
        return
    }
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if ("ranger" !== actor?.class?.slug) {
        ui.notifications.info(`Actor should be Ranger`);
        return
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token of animal companion as target`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("animal-companion" !== target?.class?.slug) {
        ui.notifications.info(`Need to select 1 token of animal companion as target`);
        return
    }

    await target.setFlag("pf2e", "master", actor.id);
    await actor.setFlag("pf2e", "animalCompanion", target.uuid);

    ui.notifications.info(`Ranger and Animal Companion were linked`);
}