const moduleName = "pf2e-action-support-engine-macros";

let DamageRoll = undefined;

function eventSkipped(event, isDamage=false) {
    return game.settings.get(moduleName, "skipRollDialogMacro")
        ? new KeyboardEvent('keydown', {'shiftKey': isDamage?game.user.flags.pf2e.settings.showDamageDialogs:game.user.flags.pf2e.settings.showCheckDialogs})
        : event;
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

    if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
        await primary.item.actor.toggleRollOption("all", "double-slice-second")
    }
    const primaryMessage = await primary.variants[map].roll({ 'event': eventSkipped(event) });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

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
    const secondaryDegreeOfSuccess = secondaryMessage.degreeOfSuccess;

    if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
        await primary.item.actor.toggleRollOption("all", "double-slice-second")
    }

    const fOpt = [...options];
    const sOpt = [...options];

    if (!xdyAutoRoll(primaryMessage)) {
        if ( primaryDegreeOfSuccess === 2 ) { await primary.damage({event: eventSkipped(event, true), options: fOpt}); }
        if ( primaryDegreeOfSuccess === 3 ) { await primary.critical({event: eventSkipped(event, true), options: fOpt}); }
    }

    if (options.includes("twin-feint")) {
        sOpt.push("twin-feint-second-attack")
    }

    if (damages.length > 0) {
        if (damages[0].flags.pf2e.modifiers.find(a=>["precision"].includes(a.slug) && a.enabled) || options.includes("double-slice-second")) {
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
        ChatMessage.createDocuments(damages);
        return;
    }

    const data = !onlyOnePrecision
        ? createDataDamage(damages.map(a=>a.rolls).flat().map(a=>a.terms).flat().map(a=>a.rolls).flat())
        : createDataDamageOnlyOnePrecision(damages);

    const formulas = [];
    Object.keys(data).forEach(k=>{
         formulas.push(`(${data[k].join('+')})[${k}]`);
    });

    const rolls = [await new DamageRoll(formulas.join(',')).evaluate( {async: true} )];
    const opts = damages[0].flags.pf2e.context.options.concat(damages[1].flags.pf2e.context.options);
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
};

function createDataDamageOnlyOnePrecision(damages) {
    if (damages[0].rolls[0]._formula.includes('precision') && damages[1].rolls[0]._formula.includes('precision')) {
        let fDamages = damages[0].rolls.flat().map(a=>a.terms).flat().map(a=>a.rolls).flat();
        let sDamages = damages[1].rolls.flat().map(a=>a.terms).flat().map(a=>a.rolls).flat();

        const fR = damages[0].rolls[0]._formula.match(/\+ (([0-9]{1,})d(4|6|8|10|12)|(\(([0-9]{1,})d(4|6|8|10|12)(\[doubled\])?( \+ ([0-9]{1,}))?\)))\[precision\]/);
        const fRMod = damages[0].rolls[0].options.degreeOfSuccess === 3 ? 2 : 1;
        const sR = damages[1].rolls[0]._formula.match(/\+ (([0-9]{1,})d(4|6|8|10|12)|(\(([0-9]{1,})d(4|6|8|10|12)(\[doubled\])?( \+ ([0-9]{1,}))?\)))\[precision\]/);
        const sRMod = damages[1].rolls[0].options.degreeOfSuccess === 3 ? 2 : 1;

        if (getSumDamage(fR, fRMod) > getSumDamage(sR, sRMod)) {
            //delete from 2
            sDamages = sDamages.map(obj => {
                return {
                    "head": {
                        "formula": obj.head.formula.replace(sR[0], "")
                    },
                    "options": {
                        "flavor": obj.options.flavor
                    }
                };
            })
        } else {
            fDamages = fDamages.map(obj => {
                return {
                    "head": {
                        "formula": obj.head.formula.replace(fR[0], "")
                    },
                    "options": {
                        "flavor": obj.options.flavor
                    }
                };
            })
        }
        return createDataDamage(fDamages.concat(sDamages));
    }
    return createDataDamage(damages.map(a=>a.rolls).flat().map(a=>a.terms).flat().map(a=>a.rolls).flat());
}

function getSumDamage(damage, mod) {
    if (damage[2]&&damage[3]) {
        return damage[2] * damage[3] * mod;
    } else if (damage[5] && damage[6]) {
        return ((damage[5] * damage[6]) + (damage[8] ?? 0)) * mod;
    }
}

function createDataDamage(arr) {
    const data = {}
    for (const dr of arr) {
        if (dr.options.flavor in data) {
            data[dr.options.flavor].push(dr.head.formula);
        } else {
            data[dr.options.flavor] = [dr.head.formula]
        }
    }
    return data;
}

function hasEffect(actor, eff) {
    return actor?.itemTypes?.effect?.find((c => eff === c.slug))
}

function hasOption(message, opt) {
    return message?.flags?.pf2e?.context?.options?.includes(opt);
}
