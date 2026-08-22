import {actorAction, actorFeat, combinedDamage, favoriteWeapon, getDialogElement, readDialogValue, getMap, selectIf} from "../lib.js";

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
        weapons.unshift(...actor.system.actions.filter(h => h.item?.isHeld && h.item?.group === "bow" && h.item?.reload === "0"))
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
                const dialog = getDialogElement(form);
                const first = dialog?.querySelector("#fob1");
                const second = dialog?.querySelector("#fob2");
                return {
                    weapon1: [first?.value, first?.selectedOptions?.[0]?.dataset?.ranged === "true", first?.selectedOptions?.[0]?.dataset?.slug],
                    weapon2: [second?.value, second?.selectedOptions?.[0]?.dataset?.ranged === "true", second?.selectedOptions?.[0]?.dataset?.slug],
                    map: parseInt(readDialogValue(form, "#map")),
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

    // Stunning Fist / Stunning Blows put their reminder Note behind a toggleable RollOption on
    // the "damage" domain. Passing the option into the damage roll's context is not enough: the
    // Note's predicate is tested against the actor's own roll options, so the toggle has to be
    // set. It must also be set BEFORE the strikes are resolved below, because toggling updates
    // the item, which re-prepares the actor and rebuilds `actor.system.actions` - strikes
    // captured beforehand are stale and roll without the option.
    const noteToggles = ["stunning-fist", "stunning-blows"]
        .filter(slug => actorFeat(actor, slug))
        .map(slug => actor.itemTypes.feat.find(f => f.slug === slug))
        .filter(item => !!item && !actor.rollOptions?.damage?.[item.slug]);

    try {
        for (const item of noteToggles) {
            await actor.toggleRollOption("damage", item.slug, item.id, true);
        }

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
    } finally {
        for (const item of noteToggles) {
            await actor.toggleRollOption("damage", item.slug, item.id, false);
        }
    }
}
