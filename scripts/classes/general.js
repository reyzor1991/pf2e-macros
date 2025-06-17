import {defDCMap, moduleName, OFF_GUARD_TARGET_EFF} from "../const.js";
import {
    actorFeat,
    addItemToActor,
    baseMapForm,
    combinedDamage,
    distanceIsCorrect,
    eventSkipped,
    hasFeatBySourceId,
    increaseConditionForActor,
    isGM,
    isV12,
    rollSkipDialog,
    setEffectToActor,
    shareLanguage,
    veryHardDCByLvl
} from "../lib.js";
import {socketlibSocket} from "../hooks/setup.js";
import {RepairForm} from "../forms/repair.js";

async function addImmunity(_token, target) {
    const exampleImmunityEffect = {
        type: 'effect',
        name: `Scare to Death Immunity (${_token.actor.name})`,
        img: `${_token.document.texture.src}`,
        system: {
            tokenIcon: {show: true},
            duration: {value: '1', unit: 'minutes', sustained: false, expiry: 'turn-start'},
            rules: [],
            slug: `scare-to-death-immunity-${_token.actor.id}`
        },
    };
    await addItemToActor(target, exampleImmunityEffect);
}

export async function gmCounteract_step1(actorUuid, isFixed, fixedValue, userId) {
    let actor = await fromUuid(actorUuid)

    let options = isFixed ? '' : actor.itemTypes.spellcastingEntry.map((w, i) => `<option value=${i}>${w.name}</option>`).join('')

    let spellcast = isFixed ? '' : `
        <p class="">
            <strong>Spellcasting</strong>
            <select id="fob1" autofocus>
                ${options}
            </select>
        </p>
    `

    const {dc, cl, tl, idx} = await Dialog.wait({
        title: "Counteract",
        content: `
        <p class="">
            <strong>DC</strong>
            <input class='dc' type="number" value='10' min=0 style="width: 5ch;">
        </p>
        <p class="">
            <strong>Counteraction level</strong>
            <input class='cl' type="number" value=1 min=0 max=10 style="width: 5ch;">
        </p>
        <p class="">
            <strong>Target level</strong>
            <input class='tl' type="number" value=1 min=0 max=10 style="width: 5ch;">
        </p>
        ${spellcast}
    `,
        buttons: {
            ok: {
                label: "Counteract",
                icon: "<i class='fa-solid fa-hand'></i>",
                callback: (html) => {
                    return {
                        dc: Number(html.find('.dc').val()) ?? 0,
                        cl: Number(html.find('.cl').val()) ?? 0,
                        tl: Number(html.find('.tl').val()) ?? 0,
                        idx: Number(html.find("#fob1").val()),
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, {}, {width: 300});

    if (!dc) {
        return
    }

    if (isGM()) {
        await gmCounteract_step2(actorUuid, dc, cl, tl, idx, fixedValue)
    } else {
        socketlibSocket.executeForUsers("gmCounteract_step2", [userId], actorUuid, dc, cl, tl, idx, fixedValue);
    }
}

export async function gmCounteract_step2(actorUuid, dc, cl, tl, idx, fixedValue) {
    let actor = await fromUuid(actorUuid)
    await counteractRoll(actor, dc, cl, tl, idx, fixedValue)
}

async function counteractFailMessage() {
    await ChatMessage.create({
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: `Counteract failed`
    });
}

async function counteractSuccessMessage() {
    await ChatMessage.create({
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: `Counteract succeed`
    });
}

async function counteractRoll(actor, dc, cl, tl, idx, fixedValue = undefined) {
    if (tl - cl >= 4) {
        await counteractFailMessage()
    } else {
        let modifiers = [];
        if (fixedValue) {
            modifiers.push(new game.pf2e.Modifier({
                label: "Fixed value",
                modifier: fixedValue,
                type: "circumstance"
            }))
        } else {
            modifiers = actor.itemTypes.spellcastingEntry[idx].statistic.check.modifiers
        }
        let res = await game.pf2e.Check.roll(
            new game.pf2e.CheckModifier('Counteract Check', {
                modifiers
            }),
            {
                actor,
                type: "counteract-check",
                dc: {value: dc},
                domains: ["all", "counteract"],
                options: new Set([
                    ...actor.getRollOptions(),
                    "counteract"
                ])
            }
        );


        let degreeOfSuccess = res.degreeOfSuccess
        if ((tl - cl) === 3 || (tl - cl) === 2) {
            if (degreeOfSuccess === 3) {
                await counteractSuccessMessage()
            } else {
                await counteractFailMessage()
            }
        } else if ((tl - cl) === 1 || (tl - cl) === 0) {
            if (degreeOfSuccess === 3 || degreeOfSuccess === 2) {
                await counteractSuccessMessage()
            } else {
                await counteractFailMessage()
            }
        } else {
            if (degreeOfSuccess === 0) {
                await counteractFailMessage()
            } else {
                await counteractSuccessMessage()
            }
        }
    }
}

export async function scareToDeath(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    const feat = actorFeat(actor, "scare-to-death");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Scare to Death!`);
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    if (!distanceIsCorrect(_token, game.user.targets.first(), 30)) {
        ui.notifications.info(`Target should be in 30ft radius`);
        return;
    }
    if (game.user.targets.first().actor?.itemTypes?.effect?.find(c => `scare-to-death-immunity-${actor.id}` === c.slug)) {
        ui.notifications.info(`Target has immunity to Scare to Death from ${actor.name}`);
        return
    }

    const extraRollOptions = ["action:scare-to-death", "emotion", "fear", "incapacitation", "general", "skill"];
    const traits = ["emotion", "fear", "incapacitation", "general", "skill"];
    const title = "Scare to Death";
    const targetDC = game.user.targets.first().actor?.getStatistic('will')?.dc;
    const dc = {
        scope: "check",
        statistic: targetDC,
        value: targetDC?.value ?? 0
    };
    const modifiers = []
    if (!shareLanguage(actor, game.user.targets.first().actor)) {
        modifiers.push(new game.pf2e.Modifier({
            label: "PF2E.Actions.Demoralize.Unintelligible",
            modifier: -4,
            type: "circumstance"
        }));
    }

    const result = await actor.skills['intimidation'].roll({
        skipDialog: rollSkipDialog(event),
        modifiers,
        origin: null,
        dc,
        traits,
        title,
        item: feat,
        target: game.user.targets.first().actor,
        extraRollOptions
    });

    await addImmunity(_token, game.user.targets.first().actor);

    if (result.degreeOfSuccess === 1) {
        await increaseConditionForActor(game.user.targets.first().actor, "frightened", 1);
    } else if (result.degreeOfSuccess === 2) {
        await increaseConditionForActor(game.user.targets.first().actor, "frightened", 2);
    } else if (result.degreeOfSuccess === 3) {
        const actorDC = actor?.getStatistic('intimidation')?.dc
        const cfResult = await game.user.targets.first().actor.saves.fortitude.roll({
            skipDialog: rollSkipDialog(event),
            origin: actor,
            dc: {
                label: "Scare to Death DC",
                value: actorDC?.value ?? 0
            }, traits: [...traits, 'death'], title, item: feat, extraRollOptions: [...extraRollOptions, 'death']
        });
        if (cfResult.degreeOfSuccess === 0) {
            ChatMessage.create({
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: `${game.user.targets.first().actor.name} died because of Scare to Death`
            });
        } else {
            await increaseConditionForActor(game.user.targets.first().actor, "frightened", 2);
            await increaseConditionForActor(game.user.targets.first().actor, "fleeing", 1);
        }
    }
}

export async function aid(actor) {
    await aidBase(actor,
        `Compendium.${moduleName}.effects.Item.w9uaEadTRdzQDvvb`,
        `Compendium.${moduleName}.effects.Item.L1hIpxQ7GSKecbg8`,
        `Compendium.${moduleName}.effects.Item.FNg7DnPqAJUHa7M3`,//+2
        `Compendium.${moduleName}.effects.Item.I2ybp2bragN3affJ`,//+3
        `Compendium.${moduleName}.effects.Item.YflHqtJFA40JQULG`,//+4
    )
}

export async function aidBase(actor, criticalFailure, success, criticalSuccess, criticalSuccessMaster, criticalSuccessLegendary) {
    if (game.user.targets.size === 0) {
        ui.notifications.info(`Need to select target to apply Aid effect`);
        return;
    }
    let target = game.user.targets.first().actor;

    let defDC = defDCMap[game.settings.get(moduleName, "defAidDC")];
    let styles = `style="display: flex; align-items: center; justify-content: space-between;"`
    let weapons = actor.system.actions.filter(h => h.ready);

    let skillsHtml = `<option value="perception" data-skill='true'>${game.i18n.localize("PF2E.PerceptionLabel")}</option>` + Object.values(_token.actor.skills).map(s => {
        return `<option value="${s.slug}" data-skill='true'>${s.label}</option>`
    });
    let weaponsHtml = weapons.map(s => {
        return `<option value="${s.slug}" data-skill='false'>${s.label}</option>`
    })

    const {id, isSkill, dc} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Aid"},
        content: `
            <p ${styles}>
                <strong>Skill or Attack</strong>
                <select id="actions">
                    ${game.settings.get(moduleName, "aidWeaponTop") ? weaponsHtml + skillsHtml : skillsHtml + weaponsHtml}
                </select>
            </p>
            <p ${styles}>
                <strong>DC</strong>
                <input class='dc' type="number" value='${defDC}' min="0" style="width: 5ch;">
            </p>
        `,
        buttons: [{
            action: "ok", label: "Use", icon: "<i class='fa-solid fa-hand-fist'></i>",
            callback: (event, button, form) => {
                let el = isV12() ? $(form) : $(form.element);
                return {
                    id: el.find("#actions").val(),
                    isSkill: el.find("#actions").find('option:selected').data('skill'),
                    dc: parseInt(el.find('.dc').val()) ?? defDC
                }

            }
        }, {
            action: "cancel",
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }],
        default: "ok"
    }, {}, {width: 600});

    if (!id) {
        return
    }

    let roll;
    let rank;
    if (isSkill) {
        rank = id === 'perception' ? actor.perception.rank : actor.skills[id].rank;
        roll = await actor.getStatistic(id).roll({
            skipDialog: rollSkipDialog(event),
            dc,
            extraRollOptions: [`action:aid:${id}`, 'action:aid']
        })

        if (
            id === 'diplomacy'
            && hasFeatBySourceId(actor, "Compendium.pf2e.classfeatures.Item.4lGhbEjlEoGP4scl")
            && hasFeatBySourceId(actor, "Compendium.pf2e.feats-srd.Item.bCizH4ByTwbLcYA1")
        ) {//Wit&One For All
            if (roll.total >= veryHardDCByLvl(actor.level)) {
                await setEffectToActor(actor, 'Compendium.pf2e.feat-effects.Item.uBJsxCzNhje8m8jj')//set panache
            }
        }
    } else {
        let weapon = weapons.find(w => w.slug === id)
        roll = await weapon?.roll({event: eventSkipped(event), dc, options: [`action:aid:${id}`, 'action:aid']})
        rank = weapon?.options?.includes("proficiency:trained")
            ? 1
            : weapon?.options?.includes("proficiency:expert") ? 2
                : weapon?.options?.includes("proficiency:master") ? 3
                    : weapon?.options?.includes("proficiency:legendary") ? 4
                        : 0

    }

    let hasHelpFeat = hasFeatBySourceId(actor, 'Compendium.pf2e.feats-srd.Item.gWyCNTWUhxneOBne');//Helpful Halfling
    let effectId = undefined;
    if (roll?.options?.degreeOfSuccess === 0 && !hasHelpFeat) {
        effectId = criticalFailure;
    } else if (roll?.options?.degreeOfSuccess === 2) {
        effectId = success;
    } else if (roll?.options?.degreeOfSuccess === 3) {
        effectId = criticalSuccess//+2
        if (rank === 4 || (rank === 3 && hasHelpFeat)) {
            effectId = criticalSuccessLegendary//+4
        } else if (rank === 3 || (rank === 2 && hasHelpFeat)) {
            effectId = criticalSuccessMaster//+3
        }
    }

    if (effectId) {
        if (actor.items.find(a => a.sourceId === 'Compendium.pf2e.equipment-srd.Item.XyoYrGEAhJ3iCahe')?.isInvested) {//The Publican
            let effObj = (await fromUuid(effectId)).toObject()
            effObj.system.rules[0].value += 1;

            await addItemToActor(target, effObj);
        } else {
            await setEffectToActor(target, effectId);
        }

    }
}

export async function shapeshifting(token) {
    if (!token) {
        ui.notifications.info(`Select your token before using this macro`);
    }

    let {imageLink} = await Dialog.wait({
        title: "Link to image",
        content: `
        <p class="">
            <strong>Image link</strong>
            <input class='dc' type="text">
        </p>
    `,
        buttons: {
            ok: {
                label: "Apply",
                icon: "<i class='fa-solid fa-hand'></i>",
                callback: (html) => {
                    return {
                        imageLink: html.find('.dc').val(),
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, {}, {width: 300});
    if (!imageLink) {
        return;
    }

    const effect = {
        type: 'effect',
        name: `Shapeshifting`,
        img: `icons/svg/circle.svg`,
        system: {
            tokenIcon: {show: true},
            duration: {value: -1, unit: 'unlimited', sustained: false, expiry: null},
            rules: [{
                "key": "TokenImage",
                "value": imageLink
            }],
            slug: `shapeshifting-${_token.actor.id}`
        },
    };
    await addItemToActor(token.actor, effect);
}

export async function explorationActivity(actor) {
    if (!actor) {
        ui.notifications.info(`Select your token before using this macro`);
    }

    const actions = [
        {
            label: 'Avoid Notice',
            img: 'icons/magic/perception/silhouette-stealth-shadow.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.IE2nThCmoyhQA0Jn'
        },
        {
            label: 'Cover Tracks',
            img: 'icons/tools/smithing/horseshoe-steel-blue.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.SB7cMECVtE06kByk'
        },
        {
            label: 'Defend',
            img: 'icons/equipment/shield/heater-steel-boss-red.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.cYtYKa1gDEl7y2N0'
        },
        {
            label: 'Detect Magic',
            img: 'systems/pf2e/icons/spells/detect-magic.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.Yb0C1uLzeHrVLl7a'
        },
        {
            label: 'Follow the Expert',
            img: 'icons/skills/social/diplomacy-unity-alliance.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.tfa4Sh7wcxCEqL29'
        },
        {
            label: 'Hustle',
            img: 'icons/skills/movement/feet-winged-boots-brown.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.JuqmIAnkL9hVGai8'
        },
        {
            label: 'Investigate',
            img: 'icons/tools/scribal/magnifying-glass.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.EwgTZBWsc8qKaViP'
        },
        {
            label: 'Refocus',
            img: 'icons/magic/perception/third-eye-blue-red.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.OSefkMgojBLqmRDh'
        },
        {
            label: 'Repeat a Spell',
            img: 'icons/magic/symbols/circle-ouroboros.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.OQaFzDtVEOMWizJJ'
        },
        {
            label: 'Scout',
            img: 'icons/tools/navigation/map-marked-red.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.kV3XM0YJeS2KCSOb'
        },
        {
            label: 'Search',
            img: 'icons/magic/perception/eye-ringed-green.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.TiNDYUGlMmxzxBYU'
        },
        {
            label: 'Track',
            img: 'icons/creatures/abilities/paw-print-yellow.webp',
            id: 'Compendium.pf2e.actionspf2e.Item.EA5vuSgJfiHH7plD'
        }
    ];

    let activeExplorationActivities = actor.system.exploration.map(a => actor.items.get(a).sourceId)
    let buttons = actions.map((action, idx) => {
        let active = activeExplorationActivities.includes(action.id) ? 'active' : '';
        return `<span class="item ${active}" data-id="${action.id}"><img src="${action.img}" height="24">${action.label}</span>`
    }).join("");

    let content = `<div class="pf2e-exploration-activity-list">${buttons}</div>`
    let d = new foundry.applications.api.DialogV2({
        window: {title: `Exploration Activities (${actor.name})`, resizable: true},
        default: "close",
        content,
        buttons: [
            {
                action: "close",
                label: "Close",
                icon: "<i class='fa-solid fa-times'></i>",
            }
        ],
        position: {
            width: 480
        }
    });
    d.addEventListener('render', (e) => {
        const action = async (event) => {
            let button = $(event.currentTarget);
            let sourceId = button.data().id;
            let exploration = actor.system.exploration ?? [];
            if (!actor.itemTypes.action.find(a => a.sourceId === sourceId)) {//need to add
                await actor.createEmbeddedDocuments("Item", [(await fromUuid(sourceId)).toObject()])
            }
            let curId = actor.itemTypes.action.find(a => a.sourceId === sourceId)?.id;
            if (button.hasClass('active')) {
                exploration = exploration.filter(i => i !== curId);
                button.removeClass('active')
            } else {
                exploration.push(curId)
                button.addClass('active')
            }
            await actor.update({"system.exploration": exploration});
            ui.notifications.info("Exploration activities were changed");
        };

        $(e.target.element).find(".pf2e-exploration-activity-list span").on('click', action)
    });
    d.render(true);
}

export async function doffPartyArmor() {
    await Promise.all(
        game.actors.party.members.map(a => a.itemTypes.armor.find(i => i.isEquipped))
            .filter(b => b)
            .map(async (i) => {
                await i.actor.changeCarryType(i, {carryType: 'worn'});
            })
    );

    ChatMessage.create({content: 'Party Armor was doff'});
}

export async function targetIsOffGuard(actor) {
    if (!actor) {
        ui.notifications.info(`Select your token before using this macro`);
        return;
    }
    if (game.user.targets.size === 0) {
        ui.notifications.info(`Need to select target before using this macro`);
        return;
    }
    let target = game.user.targets.first().actor;

    let o = foundry.utils.deepClone(OFF_GUARD_TARGET_EFF);
    o.name = target.name + o.name
    o.system.rules[0].predicate.push("target:signature:" + target.signature)

    return await actor.createEmbeddedDocuments("Item", [o]);
}

export async function onOffNPCVision() {
    let value = await foundry.applications.api.DialogV2.confirm({
        window: {title: "Scene Vision"},
        content: "Do you want to enabled/disabled?<p>Yes -> Enable vision</p><p>No -> Disable vision</p>",
    });
    if (value === undefined || value === null) {
        return
    }

    game.scenes.viewed.tokens.filter(t => t?.actor?.isOfType('npc')).forEach(t => t.update({'sight.enabled': value}))
}

export async function counteract(actor) {
    if (!actor) {
        ui.notifications.info('Select token before using this macro.');
        return;
    }

    if (!actor.itemTypes.spellcastingEntry.length) {
        ui.notifications.info('Actor not have spellcasting for counteracting.');
        return
    }

    let options = actor.itemTypes.spellcastingEntry.map((w, i) => `<option value=${i}>${w.name}</option>`).join('')

    const {dc, cl, tl, idx} = await Dialog.wait({
        title: "Counteract",
        content: `
            <p class="">
                <strong>DC</strong>
                <input class='dc' type="number" value='10' min=0 style="width: 5ch;">
            </p>
            <p class="">
                <strong>Counteraction level</strong>
                <input class='cl' type="number" value=1 min=0 max=10 style="width: 5ch;">
            </p>
            <p class="">
                <strong>Target level</strong>
                <input class='tl' type="number" value=1 min=0 max=10 style="width: 5ch;">
            </p>
            <p class="">
                <strong>Spellcasting</strong>
                <select id="fob1" autofocus>
                    ${options}
                </select>
            </p>
        `,
        buttons: {
            ok: {
                label: "Counteract",
                icon: "<i class='fa-solid fa-hand'></i>",
                callback: (html) => {
                    return {
                        dc: Number(html.find('.dc').val()) ?? 0,
                        cl: Number(html.find('.cl').val()) ?? 0,
                        tl: Number(html.find('.tl').val()) ?? 0,
                        idx: Number(html.find("#fob1").val()),
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, {}, {width: 300});
    if (!dc || !tl || !cl) {
        return
    }

    await counteractRoll(actor, dc, cl, tl, idx);
}

export async function gmCounteract(actor) {
    if (!actor) {
        ui.notifications.info('Select token before using this macro.');
        return;
    }

    const {isFixed, fixedValue} = await Dialog.wait({
        title: "Counteract ",
        content: `
            <strong>Fixed value for roll (usually for items)</strong>
            <div style="display: flex">
            <p class="">
                <strong>Is value fixed?</strong>
                <input class='isFixed' type="checkbox"">
            </p>
            <p class="">
                <strong>Fixed value</strong>
                <input class='fixedValue' type="number" value='0' min=0 style="width: 5ch;">
            </p></div>
        `,
        buttons: {
            ok: {
                label: "Counteract",
                icon: "<i class='fa-solid fa-hand'></i>",
                callback: (html) => {
                    return {
                        isFixed: html.find('.isFixed').prop("checked"),
                        fixedValue: !html.find('.isFixed').prop("checked") ? undefined : Number(html.find('.fixedValue').val()) ?? 0,
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, {}, {width: 300});
    if (isFixed === undefined) {
        return
    }

    if (!isFixed && !actor.itemTypes.spellcastingEntry.length) {
        ui.notifications.info('Actor not have spellcasting for counteracting.');
        return
    }

    if (isGM()) {
        await gmCounteract_step1(actor.uuid, isFixed, fixedValue, game.user.id)
    } else {
        socketlibSocket._sendRequest("gmCounteract_step1", [actor.uuid, isFixed, fixedValue, game.user.id], 0);
    }
}

export async function effectConditionInfo(_actor) {
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select target to run macro`);
        return;
    }
    let target = game.user.targets.first().actor;

    let content = '';
    let effects = target.itemTypes.effect.filter(a => !a.system.unidentified).map(e => e.name)
    if (effects.length > 0) {
        content += `Target is under effects:<br>${effects.join('<br>')}`
    }
    let conds = game.user.targets.first().actor.itemTypes.condition.filter(a => !a.flags.pf2e?.grantedBy?.id).map(e => e.name)
    if (conds.length > 0) {
        if (content) {
            content += '<br><br>'
        }
        content += `Target is under conditions:<br>${conds.join('<br>')}`
    }
    if (!content) {
        content = 'Target is not under any effect/condition'
    }
    ChatMessage.create({
        content,
        whisper: [game.userId]
    })
}

export async function repairParty(actor) {
    if (!actor) {
        ui.notifications.info(`Select your token before using this macro`);
        return;
    }
    let party = actor.parties.first()
    if (!party) {
        ui.notifications.info(`${actor.name} is not a member of party`);
        return
    }

    let items = party.members
        .map(a => [...a.itemTypes.weapon, ...a.itemTypes.armor, ...a.itemTypes.shield])
        .flat();

    items.push(
        ...party.itemTypes.weapon,
        ...party.itemTypes.armor,
        ...party.itemTypes.shield
    );

    items = items.filter(i => i.system.hp.value !== i.system.hp.max)

    if (items.length === 0) {
        ui.notifications.info(`Party has no items for repair`);
        return
    }

    new RepairForm(actor, items)
        .render(true)
}

export async function showHeroPoints() {
    if (!game.user.isGM) {
        ui.notifications.info(`User is not GM`);
        return
    }

    let actorData = game.actors.party.members
        .filter(c => c?.isOfType('character'))
        .map(c => `${c.name} - ${c.heroPoints.value}`)
        .join('<br/>')

    let content = `Current hero points:<br/>${actorData}`

    let mData = {
        content,
        whisper: [game.userId]
    }

    if (isV12()) {
        mData.style = CONST.CHAT_MESSAGE_STYLES.OOC;
    } else {
        mData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
    }

    ChatMessage.create(mData);
}

export async function flowingSpiritStrike(actor) {
    let feat = actor.itemTypes.feat.find(f => f.sourceId === 'Compendium.pf2e.classfeatures.Item.o8Q7wWx2oKvKMi1s');
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Flowing Spirit Strike feat!`);
        return;
    }
    let ikon = feat.flags.pf2e.rulesSelections.grantedIkon;
    if (!ikon) {
        ui.notifications.warn(`${actor.name} does not selected ikon!`);
        return
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select target to run macro`);
        return;
    }

    let weaponAction = actor.system.actions
        .find(a => a?.item?.sourceId === ikon || a?.item?.uuid === ikon);

    const {map} = await baseMapForm();

    if (map === undefined) {
        return;
    }

    await combinedDamage(
        "Flowing Spirit Strike",
        weaponAction,
        weaponAction,
        [],
        map,
        map);
}

export async function retch(actor) {
    if (!actor) {
        ui.notifications.info(`Select your token before using this macro`);
        return;
    }

    let sick = actor.itemTypes.condition.find(c=>c.slug==='sickened' && c?.flags?.['patreon-v3']?.dc)
    if (!sick) {
        ui.notifications.info(`${actor.name} doesn't have sickened condition with DC value`)
        return
    }
    let dc = sick.flags['patreon-v3'].dc

    let resultRoll = await actor.saves.fortitude.roll({dc: {value: dc, label: 'Retching in an attempt to recover'}})

    if (resultRoll.degreeOfSuccess >= 2) {
        await actor.decreaseCondition('sickened')
    }

    if (resultRoll.degreeOfSuccess === 3) {
        await actor.decreaseCondition('sickened')
    }
}