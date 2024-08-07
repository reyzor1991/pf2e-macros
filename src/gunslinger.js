function pairedShotsWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && h.item?.isRanged && h.item?.ammo)
        .filter( h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
        .filter( h =>  ["firearm", "crossbow"].includes(h.item?.group) || h.item?.otherTags?.has("crossbow"));
};

function swordAndPistolWeapons(actor) {
    return [
        ...actor.system.actions
            .filter( h => h.ready && h.item?.isRanged && h.item?.ammo)
            .filter( h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
            .filter( h =>  ["firearm", "crossbow"].includes(h.item?.group) || h.item?.otherTags?.has("crossbow")),
       ...actor.system.actions
            .filter( h => h.ready && h.item?.isMelee)
            .filter( h => h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1)
    ];
};

async function pairedShots(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size !== 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if ( !actorFeat(actor, "paired-shots") ) {
        ui.notifications.warn(`${actor.name} does not have Paired Shots!`);
        return;
    }

    const weapons = pairedShotsWeapons(actor);
    if (weapons.length !== 2) {
        ui.notifications.warn(`${actor.name} needs two weapons, each of which can be either a loaded one-handed firearm or loaded one‑handed crossbow.'`);
        return;
    }

    const { map } = await Dialog.wait({
        title:"Paired Shots",
        content: `
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
                    callback: (html) => { return { map: parseInt(html[0].querySelector("#map").value)} }
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

    if ( map === undefined ) { return; }

    let primary =  actor.system.actions.find( w => w.item.id === weapons[0].item.id );
    let secondary =  actor.system.actions.find( w => w.item.id === weapons[1].item.id );
    if (primary.item.system.traits.value.includes("agile")) {
        primary =  actor.system.actions.find( w => w.item.id === weapons[1].item.id );
        secondary =  actor.system.actions.find( w => w.item.id === weapons[0].item.id );
    }

    combinedDamage("Paired Shots", primary, secondary, ["paired-shots"], map, map);
}

async function pistolerosChallenge(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size !== 1) { ui.notifications.info(`Need to select 1 token as target`);return; }
    if ( !actorFeat(actor, "pistoleros-challenge") ) {
        ui.notifications.warn(`${actor.name} does not have Pistolero's Challenge!`);
        return;
    }
    let target = game.user.targets.first().actor;


    let itemSource = foundry.utils.deepClone((await fromUuid('Compendium.pf2e.feat-effects.Item.0kO3M46aK64a8ru8'))?.toObject());
    let rule = itemSource.system.rules[1];

    const effect = new CONFIG.Item.documentClass(itemSource, { parent: target });

    const ele = new game.pf2e.RuleElements.builtin.ChoiceSet(foundry.utils.deepClone(rule), {parent: effect});
    await ele.preCreate({itemSource, ruleSource: rule, tempItems: []});

    if (!rule.selection) {return}
    let label = rule.choices.find(c=>c.value === rule.selection)?.label;
    if (!label) {return}

    let curEff = hasEffectBySourceId(actor, "Compendium.pf2e.feat-effects.Item.0kO3M46aK64a8ru8");
    if (curEff) {
        await curEff.delete()
    }

    let shortSkill = Object.entries(CONFIG.PF2E.skills).find(a=>a[1]===label)[0]
    const skill = actor.skills[actor.system.skills[shortSkill].slug]

    let result = await skill.roll({
        extraRollOptions: ["pistoleros-challenge"],
        dc: { value: target.saves.will.dc.value }
    })

    if (result.options.degreeOfSuccess === 2 || result.options.degreeOfSuccess === 3) {
        await CONFIG.Item.documentClass.createDocuments([itemSource], {parent: actor})
    } else if (result.options.degreeOfSuccess === 0 && !actor.hasCondition('frightened')) {
        await actor.increaseCondition('frightened')
    }
}

async function swordAndPistol(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size !== 1) { ui.notifications.info(`Need to select 1 token as target`);return; }
    if ( !actorFeat(actor, "sword-and-pistol") ) {
        ui.notifications.warn(`${actor.name} does not have Sword and Pistol!`);
        return;
    }
    let target = game.user.targets.first().actor;

    const weapons = swordAndPistolWeapons(actor);
    if (weapons.length < 2) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapons'`);
        return;
    }

    let weaponOptions = weapons.map((w,i)=>`<option value=${i}>${w.item.name}</option>`).join('')

    const { first, second, map } = await Dialog.wait({
        title:"Sword and Pistol",
        content: `
            <div>
                <div>
                    <h3>First Attack</h3>
                    <select id="fob1" autofocus>
                        ${weaponOptions}
                    </select>
                </div>
                <div>
                <h3>Second Attack</h3>
                <select id="fob2">
                    ${weaponOptions}
                </select>
                </div>
            </div>
            <hr>
            <h3>Multiple Attack Penalty</h3>
                <select id="map">
                <option value=0>No MAP</option>
                <option value=1>MAP -5(-4 for agile)</option>
                <option value=2>MAP -10(-8 for agile)</option>
            </select>
            <hr>
        `,
        buttons: {
                ok: {
                    label: "Attack",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { first: [html[0].querySelector("#fob1").value], second: [html[0].querySelector("#fob2").value], map: parseInt(html[0].querySelector("#map").value)} }
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

    if (first === null || first === undefined || second === null || second === undefined || map === null || map === undefined) {return}
    const map2 = map === 2 ? map : map + 1;

    let firstRoll = await weapons[first].variants[map].roll({ event: eventSkipped(event) });
    let options = []
    if (firstRoll.degreeOfSuccess === 2 || firstRoll.degreeOfSuccess === 3) {
        if (!weapons[first].item.isMelee) {
            let effect = (await targetIsOffGuard(actor))[0];

            setTimeout(async () => {
                await swordAndPistolWeapons(actor)[second].variants[map2].roll({ event: eventSkipped(event) });
                await effect.delete()
            }, 300)
            return
        } else {
            options.push('ignore-reaction')
        }
    }

    await swordAndPistolWeapons(actor)[second].variants[map2].roll({ event: eventSkipped(event), options });
};

Hooks.once("init", () => {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "pairedShots": pairedShots,
        "pistolerosChallenge": pistolerosChallenge,
        "swordAndPistol": swordAndPistol,
    })
});