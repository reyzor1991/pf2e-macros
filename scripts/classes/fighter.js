import {moduleName} from "../const.js";
import {
    actorAction,
    actorFeat,
    applyDamage,
    baseAttackWeaponForm,
    combinedDamage, distanceIsCorrect,
    eventSkipped,
    favoriteWeapon,
    getMap,
    hasFeatBySourceId,
    increaseConditionForActor,
    rollSkipDialog,
    selectIf,
    setEffectToActor,
    xdyAutoRoll
} from "../lib.js";
import {DamageRoll} from "../hooks/init.js";

function doubleSliceWeapons(actor) {
    let weapons = actor.system.actions
        .filter(h => h.ready && h.item?.isMelee && !h.item?.system?.traits?.value?.includes("unarmed")
            && (
                (h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1) || actor.isOfType('npc')
            )
        )
        .map(a => [a, a.item.name]);

    //Dual Thrower
    if (hasFeatBySourceId(actor, 'Compendium.pf2e.feats-srd.Item.zfTmb78yGZzNpgU3')) {
        let comboThrows = actor.system.actions.filter(h => h.ready && h.altUsages?.[0]?.item.isThrown)
            .map(a => [a.altUsages?.[0], `${a.altUsages?.[0].item.name} Throw`])

        let throws = actor.system.actions.filter(h => h.ready && (h.item.isThrown || (h.item?.isRanged && h.item?.handsHeld === 1 && h.item?.ammo)))
            .map(a => [a, `${a.item.name} Throw`])

        weapons = weapons.concat(comboThrows).concat(throws);
    }


    return weapons
}

function knockdownWeapons(actor) {
    return actor.system.actions.filter(h => h.ready && h.item?.isMelee && !h.item?.system?.traits?.value?.includes("unarmed")
        && (
            (h.item?.isHeld && h.visible) || actor.isOfType('npc')
        )
    );
}

export async function doubleSlice(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (!actorFeat(actor, "double-slice") && !actorAction(actor, "double-slice")) {
        ui.notifications.warn(`${actor.name} does not have Double Slice!`);
        return;
    }

    const weapons = doubleSliceWeapons(actor);
    if (new Set(weapons.map(a => a[0].item.uuid)).size < 2) {
        ui.notifications.warn(`${actor.name} needs only 2 one-handed melee weapons can be equipped at a time.'`);
        return;
    }

    let f1 = favoriteWeapon("double-slice-1")
    let f2 = favoriteWeapon("double-slice-2")

    let weaponOptions = '';
    let weaponOptions2 = '';
    for (const [i, value] of weapons.entries()) {
        weaponOptions += `<option value=${i} ${selectIf(f1, value[0].item)}>${value[1]}</option>`
        weaponOptions2 += `<option value=${i} ${selectIf(f2, value[0].item, () => {
            return i === 1 || value[0].item?.traits.has('agile') ? 'selected' : ''
        })}>${value[1]}</option>`
    }

    const {weapon1, weapon2, map} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Double Slice"},
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
                return {
                    map: parseInt($(form).find("#map").val()),
                    weapon1: parseInt($(form).find("#fob1").val()),
                    weapon2: parseInt($(form).find("#fob2").val()),
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

    let primary = weapons[weapon1][0];
    let secondary = weapons[weapon2][0];

    await combinedDamage("Double Slice", primary, secondary, ["double-slice-second"], map, map);
}

export async function knockdown(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    if (
        !actorAction(actor, "knockdown") && !actorAction(actor, "slam-down")
        && !actorFeat(actor, "knockdown") && !actorFeat(actor, "slam-down")
    ) {
        ui.notifications.warn(`${actor.name} does not have Knockdown/Slam Down!`);
        return;
    }

    const weapons = knockdownWeapons(actor);

    let f1 = favoriteWeapon("slam-down")
    let weaponOptions = weapons.map(w => `<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const {currentWeapon, map} = await baseAttackWeaponForm("Slam Down", weaponOptions)

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    let primary = actor.system.actions.find(w => w.item.id === currentWeapon);

    const primaryMessage = await primary.variants[map].roll({event: eventSkipped(event)});
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    let pd;
    if (xdyAutoRoll(primaryMessage)) {
        pd = true;
    } else {
        if (primaryDegreeOfSuccess === 2) {
            pd = await primary.damage({event: eventSkipped(event, true)});
        }
        if (primaryDegreeOfSuccess === 3) {
            pd = await primary.critical({event: eventSkipped(event, true)});
        }
    }

    if (pd) {
        if (actorFeat(actor, "improved-knockdown") || actorFeat(actor, "crashing-slam")) {
            await increaseConditionForActor(game.user.targets.first().actor, "prone");

            let formula = "1d6[bludgeoning]";
            if (primary.item.hands === '2') {
                formula = `${primary.item.system.damage.die}[bludgeoning]`
            }
            await applyDamage(game.user.targets.first().actor, game.user.targets.first(), formula);
        } else {
            let modifiers = [new game.pf2e.Modifier({
                label: "PF2E.MultipleAttackPenalty",
                modifier: map > 0 ? Math.min(2, map) * -5 : map
            })]
            game.pf2e.actions.trip({modifiers, event: eventSkipped(event)});
        }
    }
}

export async function dazingBlow(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    if (!game.user.targets.first().actor.itemTypes.condition.find(a => a.slug === 'grabbed' || a.slug === 'restrained')) {
        ui.notifications.info(`Target is not grabbed`);
        return;
    }
    const feat = actorFeat(actor, "dazing-blow");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Dazing Blow!`);
        return;
    }

    const weapons = actor.system.actions.filter(h => h.ready && h.item?.isMelee);

    let f1 = favoriteWeapon("dazing-blow")
    let weaponOptions = weapons.map(w => `<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const {currentWeapon, map} = await baseAttackWeaponForm("Dazing Blow", weaponOptions)

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    let primary = actor.system.actions.find(w => w.item.id === currentWeapon);

    if (!primary.item.actor.rollOptions?.["all"]?.["dazing-blow"]) {
        await primary.item.actor.toggleRollOption("all", "dazing-blow")
    }

    const primaryMessage = await primary.variants[map].roll({event: eventSkipped(event)});
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    if (primaryDegreeOfSuccess === 1 || primaryDegreeOfSuccess === 0) {
        return
    }

    if (!xdyAutoRoll(primaryMessage)) {
        if (primaryDegreeOfSuccess === 2) {
            await primary.damage({event: eventSkipped(event, true)});
        }
        if (primaryDegreeOfSuccess === 3) {
            await primary.critical({event: eventSkipped(event, true)});
        }
    }

    if (actor.rollOptions?.["all"]?.["dazing-blow"]) {
        await actor.toggleRollOption("all", "dazing-blow")
    }

    const cfResult = await game.user.targets.first().actor.saves.fortitude.roll({
        skipDialog: rollSkipDialog(event),
        origin: actor,
        dc: {
            label: "Dazing Blow DC",
            value: actor?.attributes?.classDC?.value ?? 0
        }, traits: ['press'], title: "Dazing Blow", item: feat, extraRollOptions: ["action:dazing-blow", "press"]
    });

    if (cfResult.degreeOfSuccess === 3) {
        return
    }

    await increaseConditionForActor(game.user.targets.first().actor, "stunned", 3 - cfResult.degreeOfSuccess);
}

export async function snaggingStrike(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    let feat = actorFeat(actor, "snagging-strike");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Snagging Strike!`);
        return;
    }

    if (actor.items.contents.filter(a => a.handsHeld > 0).filter(a => !(a.slug === 'buckler' && a.handsHeld === 1)).map(a => a.handsHeld).reduce((a, b) => a + b, 0) >= 2) {
        ui.notifications.warn(`${actor.name} does not have free hand!`);
        return
    }

    const weapons = actor.system.actions.filter(h => h.ready && h.item?.isMelee);

    let f1 = favoriteWeapon("snagging-strike")
    let weaponOptions = weapons.map(w => `<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const {currentWeapon, map} = await baseAttackWeaponForm("Snagging Strike", weaponOptions)

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    let primary = actor.system.actions.find(w => w.item.id === currentWeapon);

    const primaryMessage = await primary.variants[map].roll({event: eventSkipped(event)});
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    if (primaryDegreeOfSuccess === 1 || primaryDegreeOfSuccess === 0) {
        return
    }

    if (!xdyAutoRoll(primaryMessage)) {
        if (primaryDegreeOfSuccess === 2) {
            await primary.damage({event: eventSkipped(event, true)});
        }
        if (primaryDegreeOfSuccess === 3) {
            await primary.critical({event: eventSkipped(event, true)});
        }
    }

    await setEffectToActor(
        game.user.targets.first().actor,
        `Compendium.${moduleName}.effects.Item.YsNqG4OocHoErbc9`,
        feat.level,
        {
            origin: {
                actor: actor?.uuid,
                item: feat.uuid
            }
        }
    )
}

export async function certainStrike(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }

    let feat = actorFeat(actor, "certain-strike");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Certain Strike!`);
        return;
    }

    const weapons = actor.system.actions.filter(h => h.ready && h.item?.isMelee);
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon`);
        return;
    }

    let f1 = favoriteWeapon("certain-strike")
    let weaponOptions = weapons.map(w => `<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const {currentWeapon, map} = await baseAttackWeaponForm("Certain Strike", weaponOptions)

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    let primary = actor.system.actions.find(w => w.item.id === currentWeapon);

    const primaryMessage = await primary.variants[map].roll({
        event: eventSkipped(event),
        options: ["press", "item:trait:press"]
    });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;
    if (primaryDegreeOfSuccess !== 1) {
        return
    }

    const damages = [];

    function PD(cm) {
        if (cm.user.id === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }

    let hookId = Hooks.on('preCreateChatMessage', PD);
    await primary.damage({event: eventSkipped(event, true)});
    Hooks.off('preCreateChatMessage', hookId);

    if (damages.length === 0) {
        console.log(`Damage Message is missing`)
        return;
    }

    let damageRoll = damages[0].rolls[0];
    let damageMods = new game.pf2e.StatisticModifier("", damageRoll?.options?.damage?.damage?.modifiers ?? []).modifiers

    let damageAll = [...damageRoll.formula.matchAll(/\+ ([0-9]{1,})\)? ([a-z]{1,})/g)]
    let damage = damageAll.map(a => `${a[1]}[${a[2]}]`).join(",")
    if (damage) {
        let options = [`map:increases:${map}`]

        let target = game.user.targets.first()
        const targetFlag = target ? {actor: target.actor.uuid, token: target.document.uuid} : null;

        let roll = new DamageRoll(damage, {}, {
            rollerId: game.userId,
            damage: {
                damage: {
                    modifiers: damageMods,
                    breakdown: {
                        failure: damageMods.filter((m) => m.enabled).map((m) => `${m.label} ${m.modifier < 0 ? "" : "+"}${m.modifier}`)
                    }
                },
                modifiers: damageMods,
                name: damages[0].item.name
            },
            degreeOfSuccess: 1,
            critRule: null,
            showBreakdown: true,
            ignoredResistances: []
        });

        let flavor = '';
        let breakdownTags = roll.options.damage.damage.breakdown.failure.map(b =>
            `<span class="tag tag_transparent" data-visibility="">${b}</span>`
        );
        flavor += `<h4 class="action"><strong>Damage Roll: Certain Strike</strong><span class="subtitle">(Miss)</span></h4>`
        flavor += `<div class="tags" data-tooltip-class="pf2e"><span class="tag" data-trait="press" data-tooltip="PF2E.TraitDescriptionPress" aria-describedby="tooltip">${game.i18n.localize("PF2E.TraitPress")}</span></div>`
        flavor += `<hr>`
        flavor += breakdownTags.length > 0 ? `<div class="tags modifiers">${breakdownTags.join("")}</div>` : ""

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({
                actor,
            }),
            flavor,
            flags: {
                pf2e: {
                    context: {
                        type: 'damage-roll',
                        actor: actor.id,
                        target: targetFlag,
                        sourceType: "attack",
                        outcome: "failure",
                        traits: ['attack'],
                        options,
                        mapIncreases: map
                    },
                    origin: primary.item.getOriginData(),
                    strike: {
                        actor: actor.uuid,
                        index: actor.system.actions.indexOf(primary),
                        damaging: true,
                        name: primary.item.name,
                        altUsage: primary.item.altUsageType,
                    },
                    modifiers: damageMods,
                    target: targetFlag
                },
            },
        })
    }
}

export async function swipe(token) {
    ui.notifications.info("Not ready yet");
    return;

    if (!token) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    let actor = token.actor;
    if (!hasFeatBySourceId(actor, "Compendium.pf2e.feats-srd.Item.JbrVcOf82oFXk3mY")) {//swipe
        ui.notifications.warn(`${actor.name} does not have Swipe!`);
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    let target = game.user.targets.first().document;

    const weapons = actor.system.actions
        .filter(h => h.ready && h.item?.isMelee && !h.item?.system?.traits?.value?.includes("unarmed") && h.item.group !== "shield");
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon`);
        return;
    }

    let weaponOptions = '';
    for (const w of weapons) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const {currentWeapon, map} = await Dialog.wait({
        title: "sweep",
        content: `
            <div><div><h3>Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div>${getMap()}
        `,
        buttons: {
            ok: {
                label: "Attack",
                icon: "<i class='fa-solid fa-hand-fist'></i>",
                callback: (html) => {
                    return {
                        currentWeapon: html[0].querySelector("#fob1").value,
                        map: parseInt(html[0].querySelector("#map").value)
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    });

    if (currentWeapon === undefined || map === undefined) {
        return;
    }
    let weapon = actor.system.actions.find(w => w.item.id === currentWeapon);
    let hasSweep = weapon?.item?.traits?.has('sweep')

    let reach = actor.getReach({action: "attack", weapon: weapon.item})
    let additionalTargets = token.scene.tokens.filter(t => t.actor !== actor)
        .filter(t => t !== target)
        .filter(t => actor.isEnemyOf(t.actor))
        .filter(t => t._object.distanceTo(token) <= reach)
        .filter(t => t._object.distanceTo(target._object) <= 5);

    let additionalTarget = undefined;
    if (additionalTargets.length > 1) {
        let tokenOptions = '';
        for (const t of additionalTargets) {
            tokenOptions += `<option value=${t.id}>${t.name}</option>`
        }

        const {currentToken} = await Dialog.wait({
            title: "Choose additional target",
            content: `
                <div><div><h3>Target</h3><select id="fob1" autofocus>
                    ${tokenOptions}
                </select></div></div<hr>
            `,
            buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => {
                        return {currentToken: html[0].querySelector("#fob1").value}
                    }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
            },
            default: "ok"
        });

        if (!currentToken) {
            return;
        }
        additionalTarget = additionalTargets.find(t => t.id === currentToken)
    } else if (additionalTargets.length === 1) {
        additionalTarget = additionalTargets[0]
    }

    let targetMessage = undefined;
    let statisticModifier = weapon.variants[map]
    const rollVsTarget = await statisticModifier.roll({
        event: eventSkipped(event),
        target: target._object,
        options: ['sweep-bonus'],
        createMessage: true,
        callback: (roll, outcome, message, _event) => {
            targetMessage = message.toJSON();
        }
    });

    if (additionalTarget) {
        let context = await actor.getCheckContext({
            item: weapon.item,
            domains: rollVsTarget.options.domains,
            statistic: statisticModifier,
            target: {
                token: additionalTarget._object
            },
            defense: "armor",
            options: new Set(targetMessage.flags.pf2e.context.options),
            viewOnly: undefined,
            traits: ["attack"]
        });

        let checkContext = {
            type: "attack-roll",
            identifier: `${weapon.item.id}.${weapon.item.slug}.melee`,
            action: "strike",
            title: targetMessage?.flags?.pf2e?.context?.title,
            actor: context.self.actor,
            token: context.self.token,
            target: context.target,
            item: context.self.item,
            altUsage: targetMessage?.flags?.pf2e?.context?.altUsage,
            damaging: targetMessage?.flags?.pf2e?.context?.damaging,
            domains: context.domains,
            options: context.options,
            notes: targetMessage?.flags?.pf2e?.context?.notes,
            dc: context.dc,
            traits: context.traits,
            rollTwice: targetMessage?.flags?.pf2e?.context?.rollTwice,
            substitutions: targetMessage?.flags?.pf2e?.context?.substitutions,
            dosAdjustments: targetMessage?.flags?.pf2e?.context?.dosAdjustments,
            mapIncreases: targetMessage?.flags?.pf2e?.context?.mapIncreases,
            createMessage: true,
            rollMode: targetMessage?.flags?.pf2e?.context?.rollMode,
        };
    }
}

export async function whirlwindStrike(token) {
    let actor = token?.actor;
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (!hasFeatBySourceId(actor, "Compendium.pf2e.feats-srd.Item.AGydz5DKJ2KHSO4S")) {//swipe
        ui.notifications.warn(`${actor.name} does not have Whirlwind Strike!`);
        return;
    }

    const weapons = actor.system.actions
        .filter(h => h.ready && h.item?.isMelee);

    let weaponOptions = weapons.map((w, i) => `<option value=${i}>${w.item.name}</option>`).join('')

    const {currentWeapon, map} = await baseAttackWeaponForm("Whirlwind Strike", weaponOptions)

    if (currentWeapon === undefined || map === undefined) {
        return;
    }

    let weapon = weapons[currentWeapon].item;
    let action = "attack";
    let reach = actor.getReach({action, weapon})

    let enemies = token.scene.tokens.map(t => t.object)
        .filter(t => t !== token && t.actor)
        .filter(t => !actor.isAllyOf(t.actor))
        .filter(t => distanceIsCorrect(t, token, reach))

    if (weapons.length === 0) {
        ui.notifications.warn(`No available enemies`);
        return;
    }
    for (const enemy of enemies) {
        enemy.setTarget();
        await weapons[currentWeapon].variants[map].roll({event: eventSkipped(event)});
        enemy.setTarget(false);
    }
}
