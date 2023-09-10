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
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
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
                    callback: (html) => { return { currentWeapon: [html[0].querySelector("#fob1").value,html[0].querySelector("#fob2").value], map: parseInt(html[0].querySelector("#map").value)} }
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

    if ( currentWeapon === undefined || map === undefined ) { return; }
    const map2 = map === 2 ? map : map + 1;

    const primary = weapons.find( w => w.item.id === currentWeapon[0] );
    const secondary = weapons.find( w => w.item.id === currentWeapon[1] );

    const options = actorFeat(actor, "stunning-fist") ? ["stunning-fist"] : [];

    combinedDamage("Flurry Of Blows", primary, secondary, options, map, map2);
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "flurryOfBlows": flurryOfBlows,
    })
});