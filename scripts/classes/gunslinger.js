import {actorFeat, baseMapForm, combinedDamage, eventSkipped, getMap, hasEffectBySourceId} from "../lib.js";
import {targetIsOffGuard} from "./general.js";

function pairedShotsWeapons(actor) {
    return actor.system.actions
        .filter(h => h.ready && h.item?.isRanged && h.item?.ammo)
        .filter(h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
        .filter(h => ["firearm", "crossbow"].includes(h.item?.group) || h.item?.otherTags?.has("crossbow"));
}

function swordAndPistolWeapons(actor) {
    return [
        ...actor.system.actions
            .filter(h => h.ready && h.item?.isRanged && h.item?.ammo)
            .filter(h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
            .filter(h => ["firearm", "crossbow"].includes(h.item?.group) || h.item?.otherTags?.has("crossbow")),
        ...actor.system.actions
            .filter(h => h.ready && h.item?.isMelee)
            .filter(h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
    ];
}

export async function pairedShots(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorFeat(actor, "paired-shots")) {
        ui.notifications.warn(`${actor.name} does not have Paired Shots!`);
        return;
    }

    const weapons = pairedShotsWeapons(actor);
    if (weapons.length !== 2) {
        ui.notifications.warn(`${actor.name} needs two weapons, each of which can be either a loaded one-handed firearm or loaded one‑handed crossbow.'`);
        return;
    }

    const {map} = await baseMapForm();

    if (map === undefined) {
        return;
    }

    let primary = weapons[0];
    let secondary = weapons[1];
    if (primary.item.system.traits.value.includes("agile")) {
        primary = weapons[1];
        secondary = weapons[0];
    }

    await combinedDamage("Paired Shots", primary, secondary, ["paired-shots"], map, map);
}

export async function pistolerosChallenge(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    if (!actorFeat(actor, "pistoleros-challenge")) {
        ui.notifications.warn(`${actor.name} does not have Pistolero's Challenge!`);
        return;
    }
    let target = game.user.targets.first().actor;


    let itemSource = foundry.utils.deepClone((await fromUuid('Compendium.pf2e.feat-effects.Item.0kO3M46aK64a8ru8'))?.toObject());
    let rule = itemSource.system.rules[1];

    const effect = new CONFIG.Item.documentClass(itemSource, {parent: target});

    const ele = new game.pf2e.RuleElements.builtin.ChoiceSet(foundry.utils.deepClone(rule), {parent: effect});
    await ele.preCreate({itemSource, ruleSource: rule, tempItems: []});

    if (!rule.selection) {
        return
    }
    let label = rule.choices.find(c => c.value === rule.selection)?.label;
    if (!label) {
        return
    }

    let curEff = hasEffectBySourceId(actor, "Compendium.pf2e.feat-effects.Item.0kO3M46aK64a8ru8");
    if (curEff) {
        await curEff.delete()
    }

    let shortSkill = Object.entries(CONFIG.PF2E.skills).find(a => a[1].label === label)[0]
    const skill = actor.skills[actor.system.skills[shortSkill].slug]

    let result = await skill.roll({
        extraRollOptions: ["pistoleros-challenge"],
        dc: {value: target.saves.will.dc.value}
    })

    if (result.options.degreeOfSuccess === 2 || result.options.degreeOfSuccess === 3) {
        await CONFIG.Item.documentClass.createDocuments([itemSource], {parent: actor})
    } else if (result.options.degreeOfSuccess === 0 && !actor.hasCondition('frightened')) {
        await actor.increaseCondition('frightened')
    }
}

export async function swordAndPistol(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    if (!actorFeat(actor, "sword-and-pistol")) {
        ui.notifications.warn(`${actor.name} does not have Sword and Pistol!`);
        return;
    }

    const weapons = swordAndPistolWeapons(actor);
    if (weapons.length < 2) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapons'`);
        return;
    }

    let weaponOptions = weapons.map((w, i) => `<option value=${i}>${w.item.name}</option>`).join('')

    const {first, second, map} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Sword and Pistol"},
        width: 550,
        content: `
            <div class="v2-row">
                <label>First Attack</label>
                <select id="fob1" autofocus>
                    ${weaponOptions}
                </select>
    
                <label>Second Attack</label>
                <select id="fob2">
                    ${weaponOptions}
                </select>
            </div>
            
            ${getMap()}
        `,
        buttons: [{
            action: "ok", label: "Attack", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                return {
                    map: parseInt($(form).find("#map").val()),
                    first: parseInt($(form).find("#fob1").val()),
                    second: parseInt($(form).find("#fob2").val()),
                }
            }

        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    });

    if (first === null || first === undefined || second === null || second === undefined || map === null || map === undefined) {
        return
    }
    const map2 = map === 2 ? map : map + 1;

    let firstRoll = await weapons[first].variants[map].roll({event: eventSkipped(event)});
    let options = []
    if (firstRoll.degreeOfSuccess === 2 || firstRoll.degreeOfSuccess === 3) {
        if (!weapons[first].item.isMelee) {
            let effect = (await targetIsOffGuard(actor))[0];

            setTimeout(async () => {
                await swordAndPistolWeapons(actor)[second].variants[map2].roll({event: eventSkipped(event)});
                await effect.delete()
            }, 300)
            return
        } else {
            options.push('ignore-reaction')
        }
    }

    await swordAndPistolWeapons(actor)[second].variants[map2].roll({event: eventSkipped(event), options});
}