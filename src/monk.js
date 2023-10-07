const meleeImg = `<img class="alt-usage-icon" src="systems/pf2e/icons/mdi/sword.svg" data-tooltip="Melee Usage">`

function flurryOfBlowsWeapons(actor) {
    let weapons = actor.system.actions.filter( h => h.visible && h.item?.isMelee && h.item?.system?.traits?.value?.includes("unarmed") );

    if ( actor.system.actions.some( e => e.visible && e.origin?.type === "effect" && e.origin?.slug.includes("stance") ) ) {
        weapons = actor.system.actions.filter( e => e.visible && e.origin?.type === "effect" && e.origin?.slug.includes("stance") ).concat(actor.system.actions.filter( h => h.visible && h.item?.isMelee && h.item?.system?.traits?.value?.includes("unarmed") && h.origin?.type !== "effect" ));
    }

    if ( actor.itemTypes.feat.some( s => s.slug === "monastic-weaponry" ) && actor.system.actions.some( h => h.item?.isHeld && h.item?.system?.traits?.value.includes("monk") ) ) {
        let baseWeapons = actor.system.actions.filter( h => h.item?.isHeld && h.ready && h.item?.system?.traits?.value.includes("monk") );
        baseWeapons = baseWeapons.filter(a=>!a.item.isRanged).concat(baseWeapons.filter(a=>a.item.isRanged && a.altUsages.length > 0).map(a=>a.altUsages[0]))

        weapons = baseWeapons.concat(weapons)
    }

    if ( actor.itemTypes.effect.some( s => s.slug === "stance-monastic-archer-stance" ) && actor.system.actions.some( h => h.item?.isHeld && h.item?.group === "bow" && h.item?.reload === "0" ) ) {
        weapons.unshift( actor.system.actions.find( h => h.item?.isHeld && h.item?.group === "bow" && h.item?.reload === "0" ) )
    }

    return weapons;
};

async function flurryOfBlows(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if ( !actor?.itemTypes?.action?.find(c => "flurry-of-blows" === c.slug) && !actor?.itemTypes?.feat?.find(c => "flurry-of-blows" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Flurry of Blows!`);
        return;
    }

    const weapons = flurryOfBlowsWeapons(actor)
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} not have correct weapon`);
        return;
    }

    let weaponOptions = '';
    const hasRangedDesc = weapons.some(w=>w?.options?.includes("ranged") );
    for ( const w of weapons ) {
        const isRanged = !hasRangedDesc ? '' :w?.options?.includes("ranged") ? " (Ranged Usage)" : ' (Melee Usage)';
        weaponOptions += `<option value=${w.item.id} data-ranged="${!!w?.options?.includes("ranged")}">${w.item.name}${isRanged}</option>`
    }

    const { weapon1, weapon2, map } = await Dialog.wait({
        title:"Flurry of Blows",
        content: `
            <div class="row-flurry"><div class="column-flurry first-flurry"><h3>First Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div><div class="column-flurry second-flurry"><h3>Second Attack</h3>
            <select id="fob2">
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
                    callback: (html) => { return {
                            weapon1: [$(html[0]).find("#fob1").val(), $(html[0]).find("#fob1").find(':selected').attr('data-ranged')  === 'true'],
                            weapon2: [$(html[0]).find("#fob2").val(), $(html[0]).find("#fob2").find(':selected').attr('data-ranged')  === 'true'],
                            map: parseInt(html[0].querySelector("#map").value)
                        }
                    }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        render: (html) => {
            html.parent().parent()[0].style.cssText += 'box-shadow: 0 0 30px red;';
            for (const child of html.parent().parent().children()) {
                child.style.cssText += 'box-shadow: 0 0 15px yellow;';
            }
        },
        default: "ok"
    });

    if ( weapon1 === undefined || weapon2 === undefined || map === undefined ) { return; }

    const map2 = map === 2 ? map : map + 1;

    let primary =  getWeapon(actor, weapon1[0], weapon1[1]);
    let secondary =  getWeapon(actor, weapon2[0], weapon2[1]);
    if ( !primary || !secondary ) { ui.notifications.error("Can't map to correct weapon");return; }

    const options = actor?.itemTypes?.feat?.find(c => "stunning-fist" === c.slug) ? ["stunning-fist"] : [];

    combinedDamage("Flurry Of Blows", primary, secondary, options, map, map2);
}

function getWeapon(actor, id, isRanged) {
    const _w = actor.system.actions.filter( w => w.item.id === id );
    if (_w.length === 1) {
        if (isRanged && _w[0].options?.includes("ranged")) {
            return _w[0];
        } else if (!isRanged && !_w[0].options?.includes("ranged")) {
            return _w[0];
        } else if (!isRanged && _w[0].options?.includes("ranged") && _w[0].altUsages.length > 0) {
            return _w[0].altUsages.find(aa => !aa.options?.includes("ranged") ) ?? null
        }
        return null;
    }
    return null;
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "flurryOfBlows": flurryOfBlows,
    })
});