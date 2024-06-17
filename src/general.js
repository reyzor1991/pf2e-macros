async function scareToDeath(actor) {
    if (!actor) { ui.notifications.info("Please select 1 token"); return; }
    const feat = actorFeat(actor, "scare-to-death");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Scare to Death!`);
        return;
    }
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`); return; }
    if (!distanceIsCorrect(_token, game.user.targets.first(), 30)) { ui.notifications.info(`Target should be in 30ft radius`); return; }
    if (game.user.targets.first().actor?.itemTypes?.effect?.find(c => `scare-to-death-immunity-${actor.id}` === c.slug)) { ui.notifications.info(`Target has immunity to Scare to Death from ${actor.name}`); return }

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

    const result = await actor.skills['intimidation'].roll({ skipDialog: rollSkipDialog(event), modifiers, origin: null, dc, traits, title, item: feat, target: game.user.targets.first().actor, extraRollOptions });

    await addImmunity(_token, game.user.targets.first().actor);

    if (result.degreeOfSuccess === 1) {
        increaseConditionForActor(game.user.targets.first().actor, "frightened", 1);
    } else if (result.degreeOfSuccess === 2) {
        increaseConditionForActor(game.user.targets.first().actor, "frightened", 2);
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

function shareLanguage(actor, target) {
    if (target?.itemTypes?.condition?.find(c => "deafened" === c.slug)) { return false }

    return (target.system.traits.languages.value ?? []).some(item => actor?.system.traits.languages.value.includes(item))
}

async function addImmunity(_token, target) {
    const exampleImmunityEffect = {
        type: 'effect',
        name: `Scare to Death Immunity (${_token.actor.name})`,
        img: `${_token.document.texture.src}`,
        system: {
            tokenIcon: { show: true },
            duration: { value: '1', unit: 'minutes', sustained: false, expiry: 'turn-start' },
            rules: [],
            slug: `scare-to-death-immunity-${_token.actor.id}`
        },
    };
    await addItemToActor(target, exampleImmunityEffect);
};

const defDCMap = {
    'remaster': 15,
    'old': 20,
    'homebrew10': 10,
    'homebrew13': 13,
}

async function aid(actor) {
    if (game.user.targets.size === 0) { ui.notifications.info(`Need to select target to apply Aid effect`);return; }
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

    const { id, isSkill, dc } = await Dialog.wait({
        title: "Aid",
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
        buttons: {
            ok: {
                label: "Aid",
                icon: "<i class='fa-solid fa-hand'></i>",
                callback: (html) => {
                    return {
                        id: html.find("#actions").val(),
                        isSkill: html.find("#actions").find('option:selected').data('skill'),
                        dc: parseInt(html.find('.dc').val()) ?? defDC
                    }
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, {}, { width: 600 });

    if (!id) { return }

    let roll;
    let rank = 0;
    if (isSkill) {
        rank = id === 'perception' ? actor.perception.rank : actor.skills[id].rank;
        roll = await actor.getStatistic(id).roll({ skipDialog: rollSkipDialog(event), dc, extraRollOptions: [`action:aid:${id}`, 'action:aid'] })

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
        roll = await weapon?.roll({ event: eventSkipped(event), dc, options: [`action:aid:${id}`, 'action:aid'] })
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
        effectId = `Compendium.${moduleName}.effects.Item.w9uaEadTRdzQDvvb`;
    } else if (roll?.options?.degreeOfSuccess === 2) {
        effectId = `Compendium.${moduleName}.effects.Item.L1hIpxQ7GSKecbg8`;
    } else if (roll?.options?.degreeOfSuccess === 3) {
        effectId = `Compendium.${moduleName}.effects.Item.FNg7DnPqAJUHa7M3`//+2
         if (rank === 4 || (rank === 3 && hasHelpFeat)) {
            effectId = `Compendium.${moduleName}.effects.Item.YflHqtJFA40JQULG`//+4
        } else if (rank === 3 || (rank === 2 && hasHelpFeat)) {
            effectId = `Compendium.${moduleName}.effects.Item.I2ybp2bragN3affJ`//+3
        }
    }

    if (effectId) {
        if (actor.items.find(a=>a.sourceId === 'Compendium.pf2e.equipment-srd.Item.XyoYrGEAhJ3iCahe')?.isInvested) {//The Publican
            let effObj = (await fromUuid(effectId)).toObject()
            effObj.system.rules[0].value += 1;

            await addItemToActor(target, effObj);
        } else {
            await setEffectToActor(target, effectId);
        }

    }
}

async function explorationActivity(actor) {
    if (!actor) { ui.notifications.info(`Select your token before using this macro`); }

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
    new Dialog({
        title: `Exploration Activities (${actor.name})`,
        default: "close",
        render: (html) => {
            const action = async (event) => {
                let button = $(event.currentTarget);
                let sourceId = button.data().id;
                let exploration = actor.system.exploration ?? [];
                if (!actor.itemTypes.action.find(a => a.sourceId === sourceId)) {//need to add
                    await actor.createEmbeddedDocuments("Item", [(await fromUuid(sourceId)).toObject()])
                }
                let curId =  actor.itemTypes.action.find(a => a.sourceId === sourceId)?.id;
                if (button.hasClass('active')) {
                    exploration = exploration.filter(i => i !== curId);
                    button.removeClass('active')
                } else {
                    exploration.push(curId)
                    button.addClass('active')
                }
                await actor.update({ "system.exploration": exploration });
                ui.notifications.info("Exploration activities were changed");
            };

            html.find(".pf2e-exploration-activity-list span").on('click', action)
        },
        content,
        buttons: {
            close: {
                icon: `<i class="fas fa-times"></i>`,
                label: 'Close',
            },
        }
        ,
    }, { popOut: true, resizable: true, width: 450 }).render(true);
}

async function doffPartyArmor() {
    await Promise.all(
        game.actors.party.members.map(a=>a.itemTypes.armor.find(i=>i.isEquipped))
            .filter(b=>b)
            .map(async (i) => {
                await i.actor.changeCarryType(i, {carryType: 'worn'});
            })
    );

    ChatMessage.create({ content: 'Party Armor was doff' });
}

const OFF_GUARD_TARGET_EFF = {
  "name": " is Off-guard",
  "type": "effect",
  "effects": [],
  "system": {
    "description": {
      "gm": "",
      "value": ""
    },
    "rules": [
      {
        "key": "EphemeralEffect",
        "selectors": [
          "attack-roll",
          "damage"
        ],
        "predicate": [],
        "uuid": "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg"
      }
    ],
    "slug": "target-is-off-guard",
    "traits": {
      "otherTags": [],
      "value": []
    },
    "level": { "value": 1 },
    "duration": {
      "value": -1,
      "unit": "unlimited",
      "expiry": null,
      "sustained": false
    },
    "tokenIcon": { "show": true },
  },
  "img": "icons/skills/melee/strike-blade-scimitar-gray-red.webp"
}

async function targetIsOffGuard(token) {
    if (!token) {
        ui.notifications.info(`Select your token before using this macro`);
        return;
    }
    if (game.user.targets.size === 0) {
        ui.notifications.info(`Need to select target before using this macro`);
        return;
    }
    let target = game.user.targets.first().actor;

    let o = deepClone(OFF_GUARD_TARGET_EFF);
    o.name = target.name + o.name
    o.system.rules[0].predicate.push("target:signature:"+target.signature)

    await token.actor.createEmbeddedDocuments("Item", [o]);
}

Hooks.once("init", () => {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "scareToDeath": scareToDeath,
        "aid": aid,
        "explorationActivity": explorationActivity,
        "doffPartyArmor": doffPartyArmor,
        "targetIsOffGuard": targetIsOffGuard,
    })
});