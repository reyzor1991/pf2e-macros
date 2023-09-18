const moduleName = "pf2e-action-support-engine-macros";

let DamageRoll = undefined;

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
    const attack = [];
    function PD(cm) {
        if ( cm.user.id === game.userId && cm.isDamageRoll) {
            if (hasOption(cm, "macro:damage")) {
                damages.push(cm);
            }
            return false;
        } else if ( cm.user.id === game.userId && cm.isCheckRoll) {
            attack.push(cm);
        }
    }

    Hooks.on('preCreateChatMessage', PD);

    const ev = game.settings.get(moduleName, "skipRollDialogMacro")
        ? new KeyboardEvent('keydown', {'shiftKey': game.user.flags.pf2e.settings.showRollDialogs})
        : event;

    if (options.includes("double-slice-second") && primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
        await primary.item.actor.toggleRollOption("all", "double-slice-second")
    }
    const primaryMessage = await primary.variants[map].roll({ event:ev });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    if (options.includes("double-slice-second") && !primary.item.actor.rollOptions?.["all"]?.["double-slice-second"]) {
        await primary.item.actor.toggleRollOption("all", "double-slice-second")
    }

    if (attack[0] && attack[0]?.flags?.pf2e?.modifiers?.find(a=>a.slug === "aid" && a.enabled)) {
        const eff = game.actionsupportengine.hasEffectBySourceId(primary.item.actor, "Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX")
        if (eff) {
            await game.actionsupportengine.deleteItem(eff)
        }
    }

    const secondaryMessage = await secondary.variants[map2].roll({ event:ev });
    const secondaryDegreeOfSuccess = secondaryMessage.degreeOfSuccess;

    const fOpt = [...options, "macro:damage"];
    const sOpt = [...options, "macro:damage"];
    if (game.settings.settings.has('xdy-pf2e-workbench.autoRollDamageForStrike') && game.settings.get('xdy-pf2e-workbench', 'autoRollDamageForStrike')) {
        fOpt.push("skip-handling-message");
        sOpt.push("skip-handling-message");
    }

    let pd,sd;
    if ( primaryDegreeOfSuccess === 2 ) { pd = await primary.damage({event, options: fOpt}); }
    if ( primaryDegreeOfSuccess === 3 ) { pd = await primary.critical({event, options: fOpt}); }

    if (damages.length > 0) {
//        if (damages[0].flags.pf2e.modifiers.find(a=>["precision"].includes(a.slug) && a.enabled)) {
//            onlyOnePrecision = true;
//        }
        await gravityWeapon(damages[0])
        await fistAttack(damages[0])
    }

    if ( secondaryDegreeOfSuccess === 2 ) { sd = await secondary.damage({event, options: sOpt}); }
    if ( secondaryDegreeOfSuccess === 3 ) { sd = await secondary.critical({event, options: sOpt}); }

    Hooks.off('preCreateChatMessage', PD);

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
    await ChatMessage.create({
        flags: {
            pf2e: {
                target: damages[0].target,
                context: {
                    options: [...new Set(opts)],
                    domains: [...new Set(doms)],
                    type: "damage-roll",
                    target: damages[0].target,
                },
                modifiers: [...new Set(mods)]
            }
        },
        target: damages[0].target,
        rolls,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        flavor,
        speaker: ChatMessage.getSpeaker(),
    });
};

function createDataDamageOnlyOnePrecision(damages) {
    if (damages[0].rolls[0]._formula.includes('precision') && damages[1].rolls[0]._formula.includes('precision')) {
        let fDamages = damages[0].rolls.flat().map(a=>a.terms).flat().map(a=>a.rolls).flat();
        let sDamages = damages[1].rolls.flat().map(a=>a.terms).flat().map(a=>a.rolls).flat();

        const fR = damages[0].rolls[0]._formula.match(/\+ ([0-9]{1,})d(4|6|8|10|12)\[precision\]/);
        const fRMod = damages[0].rolls[0].options.degreeOfSuccess === 3 ? 2 : 1;
        const sR = damages[1].rolls[0]._formula.match(/\+ ([0-9]{1,})d(4|6|8|10|12)\[precision\]/);
        const sRMod = damages[1].rolls[0].options.degreeOfSuccess === 3 ? 2 : 1;

        if (fR[1]*fR[2]*fRMod > sR[1]*sR[2]*sRMod) {
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
                        "formula": obj.head.formula.replace(sR[0], "")
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
