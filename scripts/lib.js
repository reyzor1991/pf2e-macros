import {socketlibSocket} from "./hooks/setup.js";
import {dcByLevel, moduleName, TO_AVERAGE_DMG} from "./const.js";
import {ArithmeticExpression, DamageInstance, DamageRoll, InstancePool} from "./hooks/init.js";

export function isV12() {
    return game.release.generation > 11
}

export function eventSkipped(event, isDamage = false) {
    return game.settings.get(moduleName, "skipRollDialogMacro")
        ? new KeyboardEvent('keydown', {'shiftKey': isDamage ? game.user.flags.pf2e.settings.showDamageDialogs : game.user.flags.pf2e.settings.showCheckDialogs})
        : event;
}

export function rollSkipDialog(event) {
    return game.settings.get(moduleName, "skipRollDialogMacro")
        ? true
        : (
            event.shiftKey ? game.user.flags.pf2e.settings.showCheckDialogs : !game.user.flags.pf2e.settings.showCheckDialogs
        );
}

export function xdyAutoRoll(roll) {
    return game.modules.get('xdy-pf2e-workbench')?.active
        && ((
                ["all", "players"].includes(String(game.settings.get('xdy-pf2e-workbench', "autoRollDamageAllow")))
                && roll.roller.id === game.user?.id && !game.user?.isGM
            )
            || (
                ["all", "gm"].includes(String(game.settings.get('xdy-pf2e-workbench', "autoRollDamageAllow")))
                && roll.roller.id === game.user?.id && game.user?.isGM
            ))
        && game.settings.get('xdy-pf2e-workbench', 'autoRollDamageForStrike');
}

export function veryHardDCByLvl(lvl) {
    return (dcByLevel.get(lvl) ?? 50) + 5;
}

export function until(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
}

function hasEffect(actor, eff) {
    return actor?.itemTypes?.effect?.find((c => eff === c.slug))
}

function hasOption(message, opt) {
    return message?.flags?.pf2e?.context?.options?.includes(opt);
}

export function isGM() {
    return game.user === game.users.activeGM;
}

export function hasPermissions(item) {
    return 3 === item?.ownership[game.user.id] || game.user.isGM;
}

export async function setEffectToActorId(actorId, effUuid, level = undefined, optionalData) {
    await setEffectToActor(await fromUuid(actorId), effUuid, level, optionalData);
}

export function hasFeatBySourceId(actor, eff) {
    return actor?.itemTypes?.feat?.find((c) => eff === c.sourceId);
}

export function hasEffectBySourceId(actor, eff) {
    return actor?.itemTypes?.effect?.find((c) => eff === c.sourceId);
}

async function gravityWeapon(message) {
    if (message.actor.rollOptions?.["damage-roll"]?.["gravity-weapon"] && !hasOption(message, "item:category:unarmed")) {
        await message.actor.toggleRollOption("damage-roll", "gravity-weapon")
    }
}

async function fistAttack(message) {
    if (hasEffect(message?.target?.actor, `effect-hunt-prey-${message.actor.id}`) && message.actor.rollOptions?.["all"]?.["first-attack"]) {
        await message.actor.toggleRollOption("all", "first-attack")
    }
}

export async function combinedDamage(name, primary, secondary, options, map, map2) {
    let onlyOnePrecision = false;
    const damages = [];
    const attacks = [];

    function PD(cm) {
        if ((cm.author.id || cm.user.id) === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }

    function PRoll(cm) {
        if ((cm.author.id || cm.user.id) === game.userId && !cm.isDamageRoll && cm.isRoll && cm.flags?.pf2e?.origin && cm.flags?.pf2e?.context) {
            attacks.push(cm);
        }
    }

    let hookId = Hooks.on('preCreateChatMessage', PD);
    let hookIdRoll = Hooks.on('preCreateChatMessage', PRoll);

    try {
        if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }
        const primaryMessage = await primary.variants[map].roll({'event': eventSkipped(event)});
        const primaryDegreeOfSuccess =
            attacks[0]?.flags?.pf2e?.flatCheck?.result === 'fail'
                ? 0
                : (primaryMessage?.options?.degreeOfSuccess || 0);

        if (options.includes("double-slice-second") && !primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }

        if (primaryMessage && primaryMessage?.flags?.pf2e?.modifiers?.find(a => a.slug === "aid" && a.enabled)) {
            const eff = hasEffectBySourceId(primary.item.actor, "Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX")
            if (eff) {
                await deleteItem(eff)
            }
        }
        let secondOpts = [];
        if (primary.item.id === secondary.item.id && secondary.item.system.traits.value.includes("backswing") && (primaryDegreeOfSuccess === 0 || primaryDegreeOfSuccess === 1)) {
            secondOpts.push("backswing-bonus")
        }
        if (options.includes("twin-feint")) {
            await setEffectToActor(secondary.item.actor, `Compendium.${moduleName}.effects.Item.HnErWUKHpIpE7eqO`)
            secondOpts.push("twin-feint-second-attack")
        }

        const secondaryMessage = await secondary.variants[map2].roll({
            'event': eventSkipped(event),
            options: secondOpts
        });
        const secondaryDegreeOfSuccess =
            attacks[1]?.flags?.pf2e?.flatCheck?.result === 'fail'
                ? 0
                : (secondaryMessage?.options?.degreeOfSuccess || 0);

        if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }
        let sSize = 1;

        const fOpt = [...options, "skip-handling-message"];
        const sOpt = [...options, "skip-handling-message"];

        if (!xdyAutoRoll(primaryMessage)) {
            if (primaryDegreeOfSuccess === 2) {
                await primary.damage({event: eventSkipped(event, true), options: fOpt});
            }
            if (primaryDegreeOfSuccess === 3) {
                await primary.critical({event: eventSkipped(event, true), options: fOpt});
            }
        }

        if (primaryDegreeOfSuccess === 2 || primaryDegreeOfSuccess === 3) {
            await until(() => damages.length >= 1);
            sSize += 1;
        }

        if (options.includes("twin-feint")) {
            sOpt.push("twin-feint-second-attack")
        }

        if (options.includes("need-twin-2nd-attack")) {
            sOpt.push("twin-2nd-attack")
        }

        if (damages.length > 0) {
            if (hasPrecisionDamage(damages[0].rolls[0])
                && (
                    options.includes("double-slice-second")
                    || options.includes("paired-shots")
                )
            ) {
                onlyOnePrecision = true;
            }
            await gravityWeapon(damages[0])
            await fistAttack(damages[0])
        }

        if (!xdyAutoRoll(secondaryMessage)) {
            if (secondaryDegreeOfSuccess === 2) {
                await secondary.damage({event: eventSkipped(event, true), options: sOpt});
            }
            if (secondaryDegreeOfSuccess === 3) {
                await secondary.critical({event: eventSkipped(event, true), options: sOpt});
            }
        }

        if (secondaryDegreeOfSuccess === 2 || secondaryDegreeOfSuccess === 3) {
            await until(() => damages.length === sSize);
        }

        if (options.includes("twin-feint")) {
            await removeEffectFromActor(secondary.item.actor, `Compendium.${moduleName}.effects.Item.HnErWUKHpIpE7eqO`);
        }

        if (damages.length === 0) {
            let mData = {
                content: "Both attacks missed"
            };
            if (isV12()) {
                mData.style = CONST.CHAT_MESSAGE_STYLES.OOC;
            } else {
                mData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
            }
            ChatMessage.create(mData);
            Hooks.off('preCreateChatMessage', hookId);
            Hooks.off('preCreateChatMessage', hookIdRoll);
            console.log('primaryDegreeOfSuccess')
            console.log(primaryDegreeOfSuccess)
            console.log('secondaryDegreeOfSuccess')
            console.log(secondaryDegreeOfSuccess)
            return;
        }

        if ((primaryDegreeOfSuccess <= 1 && secondaryDegreeOfSuccess >= 2) || (secondaryDegreeOfSuccess <= 1 && primaryDegreeOfSuccess >= 2)) {
            let m = damages[0].toObject();
            m.flags.pf2e.context.options = m.flags.pf2e.context.options.filter(e => e !== "skip-handling-message");
            ChatMessage.createDocuments([m]);
            return;
        }

        const rolls = createNewDamageRolls(onlyOnePrecision, damages.map(a => a.rolls[0]), damages[0].target);
        const opts = damages[0].flags.pf2e.context.options.concat(damages[1].flags.pf2e.context.options).filter(e => e !== 'skip-handling-message');
        const doms = damages[0].flags.pf2e.context.domains.concat(damages[1].flags.pf2e.context.domains);
        const mods = damages[0].flags.pf2e.modifiers.concat(damages[1].flags.pf2e.modifiers);
        const flavor = `<strong>${name} Total Damage</strong>`
            + (damages[0].flavor === damages[1].flavor
                ? `<p>Both Attack<hr>${damages[0].flavor}</p><hr>`
                : `<hr>${damages[0].flavor}<hr>${damages[1].flavor}`)

        const target = damages[0].target;
        const originF = damages[0]?.flags?.pf2e?.origin;
        const originS = damages[1]?.flags?.pf2e?.origin;

        let criticalItems = [];
        if (primaryDegreeOfSuccess === 3) {
            criticalItems.push({
                actor: primary.item.actor.uuid,
                uuid: primary.item.uuid,
            })
        }
        if (secondaryDegreeOfSuccess === 3) {
            criticalItems.push({
                actor: secondary.item.actor.uuid,
                uuid: secondary.item.uuid,
            })
        }

        let messageData = {
            flags: {
                pf2e: {
                    target: {
                        actor: target?.actor?.uuid,
                        token: target?.token?.uuid
                    },
                    context: {
                        options: [...new Set(opts)],
                        domains: [...new Set(doms)],
                        type: "damage-roll",
                        target: {
                            actor: target?.actor?.uuid,
                            token: target?.token?.uuid
                        },
                    },
                    modifiers: [...new Set(mods)],
                    criticalItems,
                }
            },
            rolls,
            flavor,
            speaker: ChatMessage.getSpeaker(),
        };

        if (!isV12()) {
            messageData.type = CONST.CHAT_MESSAGE_TYPES.ROLL;
        }

        if (originF && originS && originF === originS) {
            messageData.flags.pf2e.origin = originF;
        }

        Hooks.off('preCreateChatMessage', hookId);
        Hooks.off('preCreateChatMessage', hookIdRoll);
        await ChatMessage.create(messageData);
    } catch (error) {
        console.log(error)
    } finally {
        Hooks.off('preCreateChatMessage', hookId);
        Hooks.off('preCreateChatMessage', hookIdRoll);
    }
}

function hasPrecisionDamage(damage) {
    return damage._formula.includes('precision')
}

function createNewDamageRolls(onlyOnePrecision, damages, target) {
    if (onlyOnePrecision && hasPrecisionDamage(damages[0]) && hasPrecisionDamage(damages[1])) {
        return createDataDamageOnlyOnePrecision(damages)
    }
    return combineDamages(damages, target);
}

function combineDamages(damages, target) {
    let materials = damages.map(a => a.instances.map(a => [...a.materials]).flat()).flat()

    let handleMaterial = true;

    if (materials.length && target?.actor) {
        handleMaterial = materials.some(m => {
            return target.actor.attributes.immunities.find(a => a.type === m)
                || target.actor.attributes.resistances.find(a => a.type === m)
                || target.actor.attributes.weaknesses.find(a => a.type === m)
        })
    }

    let groups = handleMaterial
        ? Object.values(Object.groupBy(damages.map(a => a.instances).flat(), ({options}) => options.flavor))
        : Object.values(Object.groupBy(damages.map(a => a.instances).flat(), (e) => e.type));

    let newInstances = groups.map(g => {
        if (g[0]?.options?.flavor?.includes('persistent')) {
            return g
        } else if (g.length === 1) {
            return DamageInstance.fromData(g[0].toJSON())
        } else {
            let mainOptions = foundry.utils.deepClone(g[0].head.toJSON().options)
            let subOptions = foundry.utils.deepClone(g[1].head.toJSON().options)
            if (subOptions.crit && !mainOptions.crit) {
                mainOptions.crit = subOptions.crit;
            }
            mainOptions.flavor = [...new Set(`${mainOptions.flavor},${subOptions.flavor}`.split(','))].join(',')

            return DamageInstance.fromTerms([ArithmeticExpression.fromData({
                operator: '+',
                operands: g.map(a => a.toJSON().terms[0]),
                evaluated: true
            })], foundry.utils.deepClone(mainOptions));
        }
    }).flat()

    return [DamageRoll.fromTerms([InstancePool.fromRolls(newInstances)])]
}

function createDataDamageOnlyOnePrecision(damages) {
    let f = damages[0].options?.damage?.damage?.modifiers?.filter(a => a.damageCategory === "precision" && a.enabled)?.map(a => a.modifier)?.reduce((a, b) => a + b, 0) ?? 0;
    const fR = damages[0].options?.damage?.damage?.dice?.filter(a => a.category === "precision" && a.enabled).map(a => a.diceNumber * TO_AVERAGE_DMG[a.dieSize])?.reduce((a, b) => a + b, 0) ?? 0;
    const fRMod = damages[0].options.degreeOfSuccess === 3 ? 2 : 1;

    let s = damages[1].options?.damage?.damage?.modifiers?.filter(a => a.damageCategory === "precision" && a.enabled)?.map(a => a.modifier)?.reduce((a, b) => a + b, 0) ?? 0;
    const sR = damages[1].options?.damage?.damage?.dice?.filter(a => a.category === "precision" && a.enabled).map(a => a.diceNumber * TO_AVERAGE_DMG[a.dieSize])?.reduce((a, b) => a + b, 0) ?? 0;
    const sRMod = damages[1].options.degreeOfSuccess === 3 ? 2 : 1;

    let damageIdx = 0;
    if (((f + fR) * fRMod) > ((s + sR) * sRMod)) {
        //delete from 2
        damageIdx = 1;
    }

    let json = deletePrecisionFrom(damages[damageIdx].instances[0].head.toJSON(), damages[damageIdx]?.options?.degreeOfSuccess === 3)
    let dInstance = DamageInstance.fromTerms([RollTerm.fromData(json)], foundry.utils.deepClone(damages[damageIdx].instances[0].options))
    damages[damageIdx] = DamageRoll.fromTerms([InstancePool.fromRolls([dInstance, ...damages[damageIdx].instances.slice(1)])])

    return combineDamages(damages)
}

function deletePrecisionFrom(json, isCrit) {
    if (json.term.class === "ArithmeticExpression") {
        if (isCrit) {
            if (json.term.operands[1].class === "Grouping") {
                if (json.term.operands[1].term.class === "ArithmeticExpression") {
                    if (json.term.operands[1].term.operands[0].class === 'ArithmeticExpression' && json.term.operands[1].term.operands[1].options.flavor === 'precision') {
                        json.term.operands[1].term = json.term.operands[1].term.operands[0];
                    }
                }
            } else if (json.term.operands[0].class === "ArithmeticExpression") {
                if (json.term.operands[0].operands[1].class === "Grouping") {
                    if (json.term.operands[0].operands[1].term.class === "ArithmeticExpression") {
                        if (json.term.operands[0].operands[1].term.operands[0].class === 'ArithmeticExpression' && json.term.operands[0].operands[1].term.operands[1].options.flavor === 'precision') {
                            json.term.operands[0].operands[1].term = json.term.operands[0].operands[1].term.operands[0];
                        } else if (json.term.operands[0].operands[1].term.operands[0].class === 'Die' && json.term.operands[0].operands[1].term.operands[1].options.flavor === 'precision') {
                            json.term.operands[0].operands[1].term = json.term.operands[0].operands[1].term.operands[0];
                        }
                    }
                }
            }
        } else {
            if (json.term.operands[0].class === 'ArithmeticExpression') {
                if (json.term.operands[1].options.flavor === 'precision') {
                    json.term = json.term.operands[0];
                }
            } else if (json.term.operands[0].class === 'Die') {
                if (json.term.operands[1].options.flavor === 'precision') {
                    json.term = json.term.operands[0];
                }
            }
        }
    }
    return json
}

export async function setEffectToActor(
    actor,
    effUuid,
    level = undefined,
    optionalData = {name: undefined, icon: undefined, origin: undefined, duplication: false}
) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("setEffectToActorId", [actor.uuid, effUuid, level, optionalData], 0);
        return;
    }

    let source = await fromUuid(effUuid);
    let withBa = hasEffectBySourceId(actor, effUuid);
    if (withBa && withBa.system.badge) {
        withBa.update({
            "system.badge.value": (withBa.system.badge.value += 1),
        });
    } else if (!withBa || optionalData?.duplication) {
        source = source.toObject();
        if (optionalData?.name) {
            source.name = optionalData.name;
        }
        if (optionalData?.icon) {
            source.img = optionalData.icon;
        }
        source.flags = foundry.utils.mergeObject(source.flags ?? {}, {core: {sourceId: effUuid}});
        if (level) {
            source.system.level = {value: level};
        }
        if (optionalData?.origin) {
            source.system.context = foundry.utils.mergeObject(source.system.context ?? {}, {
                origin: optionalData?.origin,
            });
        }
        await actor.createEmbeddedDocuments("Item", [source]);
    }
}

export function distanceIsCorrect(firstT, secondT, distance) {
    return (
        (firstT instanceof Token ? firstT : firstT.object).distanceTo(
            secondT instanceof Token ? secondT : secondT.object
        ) <= distance
    );
}

export async function removeConditionFromActorId(actorId, condition, forceRemove = false) {
    await removeConditionFromActor(await fromUuid(actorId), condition, forceRemove);
}

export async function removeConditionFromActor(actor, condition, forceRemove = false) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("removeConditionFromActorId", [actor.uuid, condition, forceRemove], 0);
        return;
    }

    await actor.decreaseCondition(condition, {forceRemove: forceRemove});
}

export async function rollAllRecoveryById(actorUUID) {
    await rollAllRecovery(await fromUuid(actorUUID));
}

export async function rollAllRecovery(actor) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("rollAllRecoveryById", [actor.uuid], 0);
        return;
    }
    const list = actor.itemTypes.condition.filter((a) => a.slug === "persistent-damage");
    for (const element of list) {
        element.rollRecovery();
    }
}

export async function deleteItemById(itemUuid) {
    await deleteItem(await fromUuid(itemUuid));
}

export async function deleteItem(item) {
    if (!hasPermissions(item)) {
        socketlibSocket._sendRequest("deleteItemById", [item.uuid], 0);
    } else {
        await item.delete();
    }
}

export async function increaseConditionForActorId(actorId, condition, value = undefined) {
    await increaseConditionForActor(await fromUuid(actorId), condition, value);
}

export async function increaseConditionForActor(actor, condition, value = undefined) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("increaseConditionForActorId", [actor.uuid, condition, value], 0);
        return;
    }

    let activeCondition = undefined;
    const valueObj = {};
    if (value) {
        activeCondition = hasCondition(actor, condition);
        if (activeCondition && activeCondition?.value >= value) {
            return;
        } else if (activeCondition) {
            valueObj["value"] = value - activeCondition.value;
        } else {
            valueObj["value"] = value;
        }
    }

    await actor.increaseCondition(condition, valueObj);
}

function hasCondition(actor, con) {
    return actor?.itemTypes?.condition?.find((c) => con === c.slug);
}

export async function addItemToActorId(actorUuid, item) {
    await addItemToActor(await fromUuid(actorUuid), item);
}

export async function addItemToActor(actor, item) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("addItemToActorId", [actor.uuid, item], 0);
        return;
    }
    await actor.createEmbeddedDocuments("Item", [item]);
}

export async function removeEffectFromActorId(actor, effect) {
    await removeEffectFromActor(await fromUuid(actorId), effect);
}

async function removeEffectFromActor(actor, effect) {
    if (!actor) {
        return
    }
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("removeEffectFromActorId", [actor.uuid, effect], 0);
        return;
    }

    let eff = actor.itemTypes.effect.find((a) => a.flags?.core?.sourceId === effect);
    if (eff) {
        await eff.delete();
    }
}

export async function applyDamageById(actorUUID, tokenUUID, formula) {
    await applyDamage(await fromUuid(actorUUID), await fromUuid(tokenUUID), formula);
}

export async function applyDamage(actor, token, formula) {
    if (!hasPermissions(actor)) {
        socketlibSocket._sendRequest("applyDamageById", [actor.uuid, token.uuid, formula], 0);
        return;
    }

    const roll = new DamageRoll(parseFormula(actor, formula));
    await roll.evaluate({async: true});
    actor.applyDamage({damage: roll, token});
    roll.toMessage({speaker: {alias: actor.name}});
}

export function actorFeat(actor, feat) {
    return actor?.itemTypes?.feat?.find((c => feat === c.slug))
}

export function actorAction(actor, action) {
    return actor?.itemTypes?.action?.find((c => action === c.slug))
}

export function getMap() {
    return `<label>Multiple Attack Penalty</label>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><br/>`
}

export async function baseAttackWeaponForm(title, weaponOptions) {
    return await foundry.applications.api.DialogV2.wait({
        window: {title},
        content: `
            <labelr>Weapon</labelr>
            <select id="fob1" autofocus>
                ${weaponOptions}
            </select>
            ${getMap()}
        `,
        buttons: [{
            action: "ok", label: "Attack", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                return {
                    map: parseInt($(form).find("#map").val()),
                    currentWeapon: $(form).find("#fob1").val(),
                }
            }
        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    });
}

export async function baseMapForm(title) {
    return await foundry.applications.api.DialogV2.wait({
        window: {title},
        content: `
            ${getMap()}
        `,
        buttons: [{
            action: "ok", label: "Attack", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                return {
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
}

export function favoriteWeapon(macro) {
    return game.settings.get(moduleName, "favoriteWeapons").find(c => c.id === macro)?.value;
}

export function selectIf(favorite, item, fn = undefined) {
    if (!game.settings.get(moduleName, "useFavoriteWeapons")) {
        return
    }
    if (!item || !favorite) {
        return fn ? fn() : ''
    }
    return favorite === item.name || favorite === item.id || favorite === item.slug ? 'selected' : ""
}

export function shareLanguage(actor, target) {
    if (target?.itemTypes?.condition?.find(c => "deafened" === c.slug)) {
        return false
    }

    return (target.system.details.languages.value ?? []).some(item => actor?.system.details.languages.value.includes(item))
}