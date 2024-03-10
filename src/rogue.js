function twinFeintWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && h.item?.isMelee && h.item?.isHeld && (h.item?.hands === "1" || h.item?.hands === "1+") && h.item?.handsHeld === 1 && !h.item?.system?.traits?.value?.includes("unarmed") );
};

async function twinFeint(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if ( !actor?.itemTypes?.feat?.find(c => "twin-feint" === c.slug) ) {
        ui.notifications.warn(`${actor.name} does not have Twin Feint!`);
        return;
    }

    const weapons = twinFeintWeapons(actor);
    if (weapons.length != 2) {
        ui.notifications.warn(`${actor.name} needs only 2 melee weapons can be equipped at a time.'`);
        return;
    }

    const { map } = await Dialog.wait({
        title:"Twin Feint",
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

    let primary =  actor.system.actions.find( w => w.item.id === weapons[0].item.id );
    let secondary =  actor.system.actions.find( w => w.item.id === weapons[1].item.id );
    if (primary.item.system.traits.value.includes("agile")) {
        primary =  actor.system.actions.find( w => w.item.id === weapons[1].item.id );
        secondary =  actor.system.actions.find( w => w.item.id === weapons[0].item.id );
    }

    combinedDamage("Twin Feint", primary, secondary, ["twin-feint"], map, map);
}

Hooks.once("init", () => {
    game.activemacros = mergeObject(game.activemacros ?? {}, {
        "twinFeint": twinFeint,
    })
});