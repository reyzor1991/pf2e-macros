import {actorAction, actorFeat, combinedDamage, favoriteWeapon, getMap, isV12, selectIf} from "../lib.js";

function flurryOfBlowsWeapons(actor) {
    let weapons = actor.system.actions
        .filter(h => h.item?.system?.traits?.value?.includes("unarmed") && (h.visible || actor.isOfType('npc')));

    if (actor.system.actions.some(e => e.visible && e.origin?.type === "effect" && e.origin?.slug.includes("stance"))) {
        weapons = actor.system.actions.filter(e => e.visible && e.origin?.type === "effect" && e.origin?.slug.includes("stance")).concat(actor.system.actions.filter(h => h.visible && h.item?.isMelee && h.item?.system?.traits?.value?.includes("unarmed") && h.origin?.type !== "effect"));
    }

    if (actor.itemTypes.feat.some(s => s.slug === "monastic-weaponry") && actor.system.actions.some(h => h.item?.isHeld && h.item?.system?.traits?.value.includes("monk"))) {
        let baseWeapons = actor.system.actions.filter(h => h.item?.isHeld && h.ready && h.item?.system?.traits?.value.includes("monk"));
        baseWeapons = baseWeapons.filter(a => !a.item.isRanged).concat(baseWeapons.filter(a => a.item.isRanged && a.altUsages.length > 0).map(a => a.altUsages[0]))

        weapons = baseWeapons.concat(weapons)
    }

    if (actor.itemTypes.effect.some(s => s.slug === "stance-monastic-archer-stance") && actor.system.actions.some(h => h.item?.isHeld && h.item?.group === "bow" && h.item?.reload === "0")) {
        weapons.unshift(actor.system.actions.find(h => h.item?.isHeld && h.item?.group === "bow" && h.item?.reload === "0"))
    }

    return weapons;
}

function getWeapon(actor, id, isRanged, slug) {
    const _w = actor.system.actions.filter(w => w.item.id === id);
    if (_w.length === 1) {
        if (isRanged && _w[0].options?.includes("ranged")) {
            return _w[0];
        } else if (!isRanged && !_w[0].options?.includes("ranged")) {
            return _w[0];
        } else if (!isRanged && _w[0].options?.includes("ranged") && _w[0].altUsages.length > 0) {
            return _w[0].altUsages.find(aa => !aa.options?.includes("ranged")) ?? null
        }
        return null;
    } else {
        return _w.find(w => w.item.slug === slug)
    }
}

export async function flurryOfBlows(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorAction(actor, "flurry-of-blows") && !actorFeat(actor, "flurry-of-blows")) {
        ui.notifications.warn(`${actor.name} does not have Flurry of Blows!`);
        return;
    }

    const weapons = flurryOfBlowsWeapons(actor)
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} not have correct weapon`);
        return;
    }

    let weaponOptions = '';
    let weaponOptions2 = '';
    const hasRangedDesc = weapons.some(w => w?.options?.includes("ranged"));

    let f1 = favoriteWeapon("flurry-of-blows-1")
    let f2 = favoriteWeapon("flurry-of-blows-2")

    for (const w of weapons) {
        const isRanged = !hasRangedDesc ? '' : w?.options?.includes("ranged") ? " (Ranged Usage)" : ' (Melee Usage)';
        weaponOptions += `<option value=${w.item.id} ${selectIf(f1, w.item)} data-ranged="${!!w?.options?.includes("ranged")}" data-slug="${w.item.slug}">${w.item.name}${isRanged}</option>`
        weaponOptions2 += `<option value=${w.item.id} ${selectIf(f2, w.item)} data-ranged="${!!w?.options?.includes("ranged")}" data-slug="${w.item.slug}">${w.item.name}${isRanged}</option>`
    }

    const {weapon1, weapon2, map} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Flurry of Blows"},
        content: `
            <div class="row-flurry">
                <div class="column-flurry first-flurry">
                    <h3>First Attack</h3>
                    <select id="fob1" autofocus>
                        ${weaponOptions}
                    </select>
                </div>
                <div class="column-flurry second-flurry">
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
                let el = isV12() ? $(form) : $(form.element);
                return {
                    weapon1: [el.find("#fob1").val(), el.find("#fob1").find(':selected').attr('data-ranged') === 'true', el.find("#fob1").find(':selected').attr('data-slug')],
                    weapon2: [el.find("#fob2").val(), el.find("#fob2").find(':selected').attr('data-ranged') === 'true', el.find("#fob2").find(':selected').attr('data-slug')],
                    map: parseInt(el.find("#map").val()),
                }
            }
        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    }, {}, {width: 500});

    if (weapon1 === undefined || weapon2 === undefined || map === undefined) {
        return;
    }

    const map2 = map === 2 ? map : map + 1;

    let primary = getWeapon(actor, weapon1[0], weapon1[1], weapon1[2]);
    let secondary = getWeapon(actor, weapon2[0], weapon2[1], weapon2[2]);
    if (!primary || !secondary) {
        ui.notifications.error("Can't map to correct weapon");
        return;
    }

    const options = actorFeat(actor, "stunning-fist") ? ["stunning-fist"] : [];
    if (actorFeat(actor, "stunning-blows")) {
        options.push("stunning-blows")
    }
    if (primary === secondary && primary?.item?.traits?.has('forceful')) {
        options.push("forceful-second")
    }

    await combinedDamage("Flurry Of Blows", primary, secondary, options, map, map2);
}
