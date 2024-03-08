const moduleName = "pf2e-action-support-engine-macros";

let DamageRoll = undefined;
let DamageInstance = undefined;
let ArithmeticExpression = undefined;
let InstancePool = undefined;

function eventSkipped(event, isDamage=false) {
    return game.settings.get(moduleName, "skipRollDialogMacro")
        ? new KeyboardEvent('keydown', {'shiftKey': isDamage ? game.user.flags.pf2e.settings.showDamageDialogs:game.user.flags.pf2e.settings.showCheckDialogs})
        : event;
}

function rollSkipDialog(event) {
    return game.settings.get(moduleName, "skipRollDialogMacro")
        ? true
        : (
            event.shiftKey ? game.user.flags.pf2e.settings.showCheckDialogs : !game.user.flags.pf2e.settings.showCheckDialogs
        );
}

function xdyAutoRoll(roll) {
    return game.modules.get('xdy-pf2e-workbench')?.active
    && (
        ["all", "players"].includes(String(game.settings.get('xdy-pf2e-workbench', "autoRollDamageAllow")))
        && roll.roller.id === game.user?.id && !game.user?.isGM
    )
    && (
        ["all", "gm"].includes(String(game.settings.get('xdy-pf2e-workbench', "autoRollDamageAllow")))
        && roll.roller.id === game.user?.id && game.user?.isGM
    )
    && game.settings.get('xdy-pf2e-workbench', 'autoRollDamageForStrike');
}

Hooks.once("init", () => {
    DamageRoll = CONFIG.Dice.rolls.find( r => r.name === "DamageRoll" );

    DamageInstance = CONFIG.Dice.rolls.find((r) => r.name === "DamageInstance");
    ArithmeticExpression = CONFIG.Dice.termTypes.ArithmeticExpression;
    InstancePool = CONFIG.Dice.termTypes.InstancePool;

    game.settings.register(moduleName, "skipRollDialogMacro", {
        name: "Skip RollDialog for macros",
        hint: "Skipping RollDialog for macros which used for combined damage",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register(moduleName, "defAidDC", {
        name: "Default Aid DC (macro)",
        scope: "world",
        config: true,
        default: 'remaster',
        choices: {
            'remaster': 'DC is 15',
            'old': 'DC is 20',
            'homebrew10': 'DC is 10',
            'homebrew13': 'DC is 13',
        },
        type: String,
    });

    game.settings.register(moduleName, "aidWeaponTop", {
        name: "Show weapon above skills",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
});


const dcByLevel = new Map([
    [-1, 13],
    [0, 14],
    [1, 15],
    [2, 16],
    [3, 18],
    [4, 19],
    [5, 20],
    [6, 22],
    [7, 23],
    [8, 24],
    [9, 26],
    [10, 27],
    [11, 28],
    [12, 30],
    [13, 31],
    [14, 32],
    [15, 34],
    [16, 35],
    [17, 36],
    [18, 38],
    [19, 39],
    [20, 40],
    [21, 42],
    [22, 44],
    [23, 46],
    [24, 48],
    [25, 50],
]);

function veryHardDCByLvl(lvl) {
    return (dcByLevel.get(lvl) ?? 50) + 5;
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

async function combinedDamage(name, primary, secondary, options, map, map2) {
    let onlyOnePrecision = false;
    const damages = [];
    function PD(cm) {
        if ( cm.user.id === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }

    Hooks.on('preCreateChatMessage', PD);

    try {
        if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }
        const primaryMessage = await primary.variants[map].roll({ 'event': eventSkipped(event) });
        const primaryDegreeOfSuccess = primaryMessage.options.degreeOfSuccess;

        if (options.includes("double-slice-second") && !primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }

        if (primaryMessage && primaryMessage?.flags?.pf2e?.modifiers?.find(a=>a.slug === "aid" && a.enabled)) {
            const eff = game.actionsupportengine.hasEffectBySourceId(primary.item.actor, "Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX")
            if (eff) {
                await game.actionsupportengine.deleteItem(eff)
            }
        }
        let secondOpts = [];
        if (primary.item.id === secondary.item.id && secondary.item.system.traits.value.includes("backswing") && (primaryDegreeOfSuccess === 0 || primaryDegreeOfSuccess === 1)) {
            secondOpts.push("backswing-bonus")
        }
        if (options.includes("twin-feint")) {
            await game.actionsupportengine.setEffectToActor(secondary.item.actor, 'Compendium.pf2e-action-support-engine.effects.Item.HnErWUKHpIpE7eqO')
            secondOpts.push("twin-feint-second-attack")
        }

        const secondaryMessage = await secondary.variants[map2].roll({ 'event': eventSkipped(event), options: secondOpts});
        const secondaryDegreeOfSuccess = secondaryMessage.options.degreeOfSuccess;

        if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
            await primary.item.actor.toggleRollOption("all", "double-slice-second")
        }

        const fOpt = [...options, "skip-handling-message"];
        const sOpt = [...options, "skip-handling-message"];

        if (!xdyAutoRoll(primaryMessage)) {
            if ( primaryDegreeOfSuccess === 2 ) { await primary.damage({event: eventSkipped(event, true), options: fOpt}); }
            if ( primaryDegreeOfSuccess === 3 ) { await primary.critical({event: eventSkipped(event, true), options: fOpt}); }
        }

        if (options.includes("twin-feint")) {
            sOpt.push("twin-feint-second-attack")
        }

        if (damages.length > 0) {
            if (hasPrecisionDamage(damages[0].rolls[0]) && options.includes("double-slice-second")) {
                onlyOnePrecision = true;
            }
            await gravityWeapon(damages[0])
            await fistAttack(damages[0])
        }

        if (!xdyAutoRoll(secondaryMessage)) {
            if ( secondaryDegreeOfSuccess === 2 ) { await secondary.damage({event: eventSkipped(event, true), options: sOpt}); }
            if ( secondaryDegreeOfSuccess === 3 ) { await secondary.critical({event: eventSkipped(event, true), options: sOpt}); }
        }

        Hooks.off('preCreateChatMessage', PD);

        if (options.includes("twin-feint")) {
            await game.actionsupportengine.removeEffectFromActor(secondary.item.actor, "Compendium.pf2e-action-support-engine.effects.Item.HnErWUKHpIpE7eqO");
        }

        if (damages.length === 0) {
            ChatMessage.create({
                type: CONST.CHAT_MESSAGE_TYPES.OOC,
                content: "Both attacks missed"
            });
            return;
        }

        if ( (primaryDegreeOfSuccess <= 1 && secondaryDegreeOfSuccess >= 2) || (secondaryDegreeOfSuccess <= 1 && primaryDegreeOfSuccess >= 2)) {
            let m = damages[0].toObject();
            m.flags.pf2e.context.options=m.flags.pf2e.context.options.filter(e=>e!="skip-handling-message");
            ChatMessage.createDocuments([m]);
            return;
        }

        const rolls = createNewDamageRolls(onlyOnePrecision, damages.map(a=>a.rolls[0]));
        const opts = damages[0].flags.pf2e.context.options.concat(damages[1].flags.pf2e.context.options).filter(e=>e != 'skip-handling-message');
        const doms = damages[0].flags.pf2e.context.domains.concat(damages[1].flags.pf2e.context.domains);
        const mods = damages[0].flags.pf2e.modifiers.concat(damages[1].flags.pf2e.modifiers);
        const flavor = `<strong>${name} Total Damage</strong>`
            + (damages[0].flavor === damages[1].flavor
                ? `<p>Both Attack<hr>${damages[0].flavor}</p><hr>`
                : `<hr>${damages[0].flavor}<hr>${damages[1].flavor}`)

        const target = damages[0].target;
        const originF = damages[0]?.flags?.pf2e?.origin;
        const originS = damages[0]?.flags?.pf2e?.origin;

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
                    modifiers: [...new Set(mods)]
                }
            },
            rolls,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            flavor,
            speaker: ChatMessage.getSpeaker(),
        };

        if (originF && originS && originF === originS) {
            messageData.flags.pf2e.origin = originF;
        }

        await ChatMessage.create(messageData);
    } catch (error) {
        Hooks.off('preCreateChatMessage', PD);
        console.log(error)
    } finally {
        Hooks.off('preCreateChatMessage', PD);
    }
};

const TO_AVERAGE_DMG = {
    'd4': 3,
    'd6': 4,
    'd8': 5,
    'd10': 6,
    'd12': 7,
}

function extractNotes(rollNotes, selectors) {
    return selectors.flatMap((s) => (rollNotes[s] ?? []).map((n) => n.clone()));
}

function hasPrecisionDamage(damage) {
    return damage._formula.includes('precision')
}

function createNewDamageRolls(onlyOnePrecision, damages) {
    if (onlyOnePrecision && hasPrecisionDamage(damages[0]) && hasPrecisionDamage(damages[1])) {
        return createDataDamageOnlyOnePrecision(damages)
    }
    return combineDamages(damages);
}

function combineDamages(damages) {
    let groups = Object.values(Object.groupBy(damages.map(a=>a.instances).flat(), ({ options }) => options.flavor))

    let newInstances = groups.map(g=> {
        if (g.length === 1) {
            return DamageInstance.fromData(g[0].toJSON())
        } else {
            return DamageInstance.fromTerms([ArithmeticExpression.fromData({
                operator: '+',
                operands: g.map(a=>a.toJSON().terms[0]),
                 evaluated: true
             })], foundry.utils.deepClone(g[0].head.toJSON().options));
        }
    })

    return [DamageRoll.fromTerms([InstancePool.fromRolls(newInstances)])]
}

function createDataDamageOnlyOnePrecision(damages) {
    let f = damages[0].options?.damage?.damage?.modifiers?.filter(a=>a.damageCategory==="precision" && a.enabled)?.map(a=>a.modifier)?.reduce((a, b) => a + b, 0) ?? 0;
    const fR = damages[0].options?.damage?.damage?.dice?.filter(a=>a.category==="precision" && a.enabled).map(a=>a.diceNumber*TO_AVERAGE_DMG[a.dieSize])?.reduce((a, b) => a + b, 0) ?? 0;
    const fRMod = damages[0].options.degreeOfSuccess === 3 ? 2 : 1;

    let s = damages[1].options?.damage?.damage?.modifiers?.filter(a=>a.damageCategory==="precision" && a.enabled)?.map(a=>a.modifier)?.reduce((a, b) => a + b, 0) ?? 0;
    const sR = damages[1].options?.damage?.damage?.dice?.filter(a=>a.category==="precision" && a.enabled).map(a=>a.diceNumber*TO_AVERAGE_DMG[a.dieSize])?.reduce((a, b) => a + b, 0) ?? 0;
    const sRMod = damages[1].options.degreeOfSuccess === 3 ? 2 : 1;

    let damageIdx = 0;
    if (((f+fR) * fRMod) > ((s+sR) * sRMod)) {
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
                        }
                    }
                }
            }
        } else {
            if (json.term.operands[0].class === 'ArithmeticExpression') {
                if (json.term.operands[1].options.flavor === 'precision') {
                    json.term = json.term.operands[0];
                }
            }
        }
    }
    return json
}

function hasEffect(actor, eff) {
    return actor?.itemTypes?.effect?.find((c => eff === c.slug))
}

function hasOption(message, opt) {
    return message?.flags?.pf2e?.context?.options?.includes(opt);
}
