function huntedShotWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && h.visible && h.item?.isRanged && (h.item?.ammo || h.item?.isThrowable))
        .filter( h => "0" === h?.item?.reload);
};

function twinTakedownWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && (h.item?.isMelee || (h?.item?.isRanged && h.altUsages[0]?.options?.includes('melee') )) && h.item?.isHeld && h.item?.hands === "1" && h.item?.handsHeld === 1 && !h.item?.system?.traits?.value?.includes("unarmed") );
};

async function huntedShot(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if (!actor?.itemTypes?.action?.find(c => "hunted-shot" === c.slug) && !actor?.itemTypes?.feat?.find(c => "hunted-shot" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Hunted Shot!`);
        return;
    }

    const weapons = huntedShotWeapons(actor)
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon'`);
        return;
    }

    let weaponOptions = '';
    for ( const w of weapons ) {
        weaponOptions += `<option value=${w.item.id}>${w.item.name}</option>`
    }

    const { currentWeapon, map } = await Dialog.wait({
        title:"Hunted Shot",
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
    const map2 = map === 2 ? map : map + 1;

    let primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );
    let secondary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    combinedDamage("Hunted Shot", primary, secondary, [], map, map2);
};

async function twinTakedown(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if (!actor?.itemTypes?.feat?.find(c => "twin-takedown" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Twin Takedown!`);
        return;
    }

    const weapons = twinTakedownWeapons(actor);
    if (weapons.length != 2) {
        ui.notifications.warn(`${actor.name} needs only 2 one-handed melee weapons can be equipped at a time.'`);
        return;
    }

    const { map } = await Dialog.wait({
        title:"Twin Takedown",
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
    const map2 = map === 2 ? map : map + 1;

    let primary = weapons[0].item.isMelee ? weapons[0] : weapons[0].altUsages[0] ;
    let secondary = weapons[1].item.isMelee ? weapons[1] : weapons[1].altUsages[0] ;
    if (primary.item.system.traits.value.includes("agile")) {
        primary = weapons[1].item.isMelee ? weapons[1] : weapons[1].altUsages[0] ;
        secondary = weapons[0].item.isMelee ? weapons[0] : weapons[0].altUsages[0] ;
    }

    combinedDamage("Twin Takedown", primary, secondary, [], map, map2);
}

async function rangerLink(actor) {
    if (!game.user.isGM) {
        ui.notifications.info(`Only GM can run script`);
        return
    }
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if ("ranger" != actor?.class?.slug) {
        ui.notifications.info(`Actor should be Ranger`);
        return
    }
    if (game.user.targets.size != 1) {
        ui.notifications.info(`Need to select 1 token of animal companion as target`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("animal-companion" != target?.class?.slug) {
        ui.notifications.info(`Need to select 1 token of animal companion as target`);
        return
    }

    await target.setFlag(engineModuleName, "ranger", actor.id);
    await actor.setFlag(engineModuleName, "animalCompanion", target.uuid);

    ui.notifications.info(`Ranger and Animal Companion were linked`);
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "huntedShot": huntedShot,
        "twinTakedown": twinTakedown,
        "rangerLink": rangerLink,
    })
});