function doubleSliceWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && h.item?.isMelee && h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1 && !h.item?.system?.traits?.value?.includes("unarmed") );
};

async function doubleSlice(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if ( !actor?.itemTypes?.feat?.find(c => "double-slice" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Double Slice!`);
        return;
    }

    const weapons = doubleSliceWeapons(actor);
    if (weapons.length != 2) {
        ui.notifications.warn(`${actor.name} needs only 2 one-handed melee weapons can be equipped at a time.'`);
        return;
    }
    if (weapons[0].item.system.traits.value.includes("agile")) {
        const element = weapons.splice(0, 1)[0];
        weapons.splice(1, 0, element);
    }

    let weaponOptions = '';
    let weaponOptions2 = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
        weaponOptions2 += `<option value=${w.item.id} ${weapons[1].item.id === w.item.id? 'selected':''}>${w.item.name}</option>`
    }

    const { weapon1, weapon2, map } = await Dialog.wait({
        title:"Double Slice",
        content: `
        <div class="row-flurry"><div class="column-flurry first-flurry"><h3>First Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div><div class="column-flurry second-flurry"><h3>Second Attack</h3>
            <select id="fob2">
                ${weaponOptions2}
            </select></div></div><hr>
            <h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return {
                        map: parseInt(html[0].querySelector("#map").value),
                        weapon1: $(html[0]).find("#fob1").val(),
                        weapon2: $(html[0]).find("#fob2").val(),
                    } }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        render: (html) => {
            html.parent().parent()[0].style.cssText += 'box-shadow: 0 0 30px green;';
        },
        default: "ok"
    });
    if ( weapon1 === undefined || weapon2 === undefined || map === undefined ) { return; }
    if ( weapon1 === weapon2) {
        ui.notifications.info("Need to select different weapons");
        return;
    }

    let primary =  actor.system.actions.find( w => w.item.id === weapon1 );
    let secondary =  actor.system.actions.find( w => w.item.id === weapon2 );

    combinedDamage("Double Slice", primary, secondary, ["double-slice-second"], map, map);
}

function knockdownWeapons(actor) {
    return actor.system.actions.filter( h => h.ready && h.visible && h.item?.isMelee && h.item?.isHeld && !h.item?.system?.traits?.value?.includes("unarmed")  );
};

async function knockdown(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if ( !actor?.itemTypes?.feat?.find(c => "knockdown" === c.slug) && !actor?.itemTypes?.feat?.find(c => "slam-down" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Knockdown/Slam Down!`);
        return;
    }

    const weapons = knockdownWeapons(actor);

    let weaponOptions = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
        title:"Knockdown/Slam Down",
        content: `
            <div class="row-hunted-shot"><div class="column-hunted-shot first-hunted-shot"><h3>First Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div><hr><h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { currentWeapon: [html[0].querySelector("#fob1").value], map: parseInt(html[0].querySelector("#map").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        render: (html) => {
            html.parent().parent()[0].style.cssText += 'box-shadow: 0 0 30px green;';
        },
        default: "ok"
    });

    if ( currentWeapon === undefined || map === undefined ) { return; }
    let primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    const primaryMessage = await primary.variants[map].roll({ event:eventSkipped(event) });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    let pd;
    if (xdyAutoRoll(primaryMessage)) {
        pd = true;
    } else {
        if ( primaryDegreeOfSuccess === 2 ) { pd = await primary.damage({event: eventSkipped(event, true)}); }
        if ( primaryDegreeOfSuccess === 3 ) { pd = await primary.critical({event: eventSkipped(event, true)}); }
    }

    if (pd) {
        if (actor?.itemTypes?.feat?.find(c => "improved-knockdown" === c.slug) || actor?.itemTypes?.feat?.find(c => "crashing-slam" === c.slug) ) {
            await game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "prone");

            let formula = "1d6[bludgeoning]";
            if (primary.item.hands === '2') {
                formula = `${primary.item.system.damage.die}[bludgeoning]`
            }
            await game.actionsupportengine.applyDamage(game.user.targets.first().actor, game.user.targets.first(), formula);
        } else {
            let modifiers = [new game.pf2e.Modifier({ label: "PF2E.MultipleAttackPenalty", modifier: map > 0 ? Math.min(2, map) * -5 : map })]
            game.pf2e.actions.trip({modifiers, event: eventSkipped(event) });
        }
    }
}

async function dazingBlow(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }
    if (!game.user.targets.first().actor.itemTypes.condition.find(a=>a.slug==='grabbed' || a.slug==='restrained')) { ui.notifications.info(`Target is not grabbed`);return; }
    const feat = actor?.itemTypes?.feat?.find(c => "dazing-blow" === c.slug);
    if ( !feat ) {
        ui.notifications.warn(`${actor.name} does not have Dazing Blow!`);
        return;
    }

    const weapons = actor.system.actions.filter( h => h.ready && h.item?.isMelee);

    let weaponOptions = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
        title:"Dazing Blow",
        content: `
            <div><div><h3>Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div><hr><h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { currentWeapon: [html[0].querySelector("#fob1").value], map: parseInt(html[0].querySelector("#map").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        default: "ok"
    });

    if ( currentWeapon === undefined || map === undefined ) { return; }
    let primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    if (!primary.item.actor.rollOptions?.["all"]?.["dazing-blow"]) {
        await primary.item.actor.toggleRollOption("all", "dazing-blow")
    }

    const primaryMessage = await primary.variants[map].roll({ event: eventSkipped(event) });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    if ( primaryDegreeOfSuccess === 1 || primaryDegreeOfSuccess === 0 ) {return}

    if (!xdyAutoRoll(primaryMessage)) {
        if ( primaryDegreeOfSuccess === 2 ) {await primary.damage({event: eventSkipped(event, true)}); }
        if ( primaryDegreeOfSuccess === 3 ) {await primary.critical({event:eventSkipped(event, true)}); }
    }

    if (primary.item.actor.rollOptions?.["all"]?.["dazing-blow"]) {
        await primary.item.actor.toggleRollOption("all", "dazing-blow")
    }

    const cfResult = await game.user.targets.first().actor.saves.fortitude.roll({
        skipDialog: rollSkipDialog(event),
        origin: actor,
        dc: {
            label: "Dazing Blow DC",
            value: actor?.attributes?.classDC?.value ?? 0
        }, traits:['press'], title: "Dazing Blow", item: feat, extraRollOptions: ["action:dazing-blow", "press"]
    });

    if (cfResult.degreeOfSuccess === 3) {
        return
    }

    await game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "stunned", 3 - cfResult.degreeOfSuccess);
}

async function snaggingStrike(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`); return; }

    let feat = actor?.itemTypes?.feat?.find(c => "snagging-strike" === c.slug);
    if ( !feat ) {
        ui.notifications.warn(`${actor.name} does not have Snagging Strike!`);
        return;
    }

    if (actor.items.contents.filter(a=>a.handsHeld > 0).filter(a=> !(a.slug === 'buckler' && a.handsHeld === 1) ).map(a=>a.handsHeld).reduce((a, b) => a + b, 0) >= 2) {
        ui.notifications.warn(`${actor.name} does not have free hand!`);
        return
    }

    const weapons = actor.system.actions.filter( h => h.ready && h.item?.isMelee);

    let weaponOptions = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
        title:"Dazing Blow",
        content: `
            <div><div><h3>Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div><hr><h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { currentWeapon: [html[0].querySelector("#fob1").value], map: parseInt(html[0].querySelector("#map").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        default: "ok"
    });

    if ( currentWeapon === undefined || map === undefined ) { return; }
    let primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    const primaryMessage = await primary.variants[map].roll({ event: eventSkipped(event) });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;

    if ( primaryDegreeOfSuccess === 1 || primaryDegreeOfSuccess === 0 ) {return}

    if (!xdyAutoRoll(primaryMessage)) {
        if ( primaryDegreeOfSuccess === 2 ) {await primary.damage({event: eventSkipped(event, true)}); }
        if ( primaryDegreeOfSuccess === 3 ) {await primary.critical({event: eventSkipped(event, true)}); }
    }

    await game.actionsupportengine.setEffectToActor(game.user.targets.first().actor, "Compendium.pf2e-action-support-engine.effects.Item.YsNqG4OocHoErbc9", feat.level, {origin: {actor:actor?.uuid, item: feat.uuid}} )
};

async function certainStrike(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`); return; }

    let feat = actor?.itemTypes?.feat?.find(c => "certain-strike" === c.slug);
    if ( !feat ) {
        ui.notifications.warn(`${actor.name} does not have Certain Strike!`);
        return;
    }

    const weapons = actor.system.actions.filter( h => h.ready && h.item?.isMelee);
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon'`);
        return;
    }

    let weaponOptions = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
        title:"Certain Strike",
        content: `
            <div><div><h3>Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div><hr><h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { currentWeapon: [html[0].querySelector("#fob1").value], map: parseInt(html[0].querySelector("#map").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        default: "ok"
    });

    if ( currentWeapon === undefined || map === undefined ) { return; }
    let primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    const primaryMessage = await primary.variants[map].roll({ event: eventSkipped(event), options: ["press","item:trait:press"] });
    const primaryDegreeOfSuccess = primaryMessage.degreeOfSuccess;
    if ( primaryDegreeOfSuccess != 1 ) { return }


    const damages = [];
    function PD(cm) {
        if ( cm.user.id === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }
    Hooks.on('preCreateChatMessage', PD);
    await primary.damage({event: eventSkipped(event, true)});
    Hooks.off('preCreateChatMessage', PD);

    if (damages.length === 0) {
        console.log(`Damage Message is missing`)
        return;
    }

    let damageRoll = damages[0].rolls[0];
    let damageMods = new game.pf2e.StatisticModifier("", damageRoll?.options?.damage?.damage?.modifiers ?? []).modifiers

    let damageAll = [...damageRoll.formula.matchAll(/\+ ([0-9]{1,})\)? ([a-z]{1,})/g)]
    let damage = damageAll.map(a=>`${a[1]}[${a[2]}]`).join(",")
    if (damage) {
        let options = [`map:increases:${map}`]

        let target = game.user.targets.first()
        const targetFlag = target ? { actor: target.actor.uuid, token: target.document.uuid } : null;

        let roll = new DamageRoll(damage, {}, {
            rollerId: game.userId,
            damage: {
                damage: {
                    modifiers: damageMods,
                    breakdown: {
                        failure: damageMods.filter((m) => m.enabled).map((m) => `${m.label} ${m.modifier < 0 ? "" : "+"}${m.modifier}`)
                    }
                },
                name: damages[0].item.name
            },
            degreeOfSuccess: 1,
            critRule: null,
            showBreakdown: true,
            ignoredResistances: []
        });

        let flavor = '';
        let breakdownTags = roll.options.damage.damage.breakdown.failure.map(b=>
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
                    modifiers: [],
                    target: targetFlag
                },
            },
        })
    }
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "doubleSlice": doubleSlice,
        "knockdown": knockdown,
        "dazingBlow": dazingBlow,
        "snaggingStrike": snaggingStrike,
        "certainStrike": certainStrike,
    })
});