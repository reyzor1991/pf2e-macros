function accidentalShotWeapons(actor) {
    return actor.system.actions
        .filter( h => h.ready && h.visible && h.item?.isRanged && h.item?.ammo && h.ready);
};

async function accidentalShot(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    if (game.user.targets.size !== 1) { ui.notifications.info(`Need to select 1 token as target`);return; }

    if (!actorAction(actor, "accidental-shot")) {
        ui.notifications.warn(`${actor.name} does not have Accidental Shot!`);
        return;
    }

    let f1 = favoriteWeapon("accidental-shot")
    const weapons = accidentalShotWeapons(actor);
    if (weapons.length === 0) {
        ui.notifications.warn(`${actor.name} doesn't have correct weapon`);
        return;
    }

    let weaponOptions = weapons.map(w=>`<option value=${w.item.id} ${selectIf(f1, w.item)}>${w.item.name}</option>`).join('');

    const { currentWeapon, map } = await Dialog.wait({
        title: "Accidental Shot",
        content: `
            <div class="row-hunted-shot"><div class="column-hunted-shot first-hunted-shot"><h3>First Attack</h3><select id="fob1" autofocus>
                ${weaponOptions}
            </select></div></div>${getMap()}
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

    if ( map === undefined ) { return; }
    if ( currentWeapon === undefined ) { return; }

    await setEffectToActor(actor, 'Compendium.pf2e.spell-effects.Item.fpGDAz2v5PG0zUSl')

    const primary =  actor.system.actions.find( w => w.item.id === currentWeapon[0] );

    const damages = [];
    function PD(cm) {
        if ( cm.user.id === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }
    let hookId = Hooks.on('preCreateChatMessage', PD);

    const primaryRoll = await primary.variants[map].roll({ event: eventSkipped(event) });
    const primaryDegreeOfSuccess = primaryRoll?.degreeOfSuccess;
    if ( !primaryDegreeOfSuccess || primaryDegreeOfSuccess === 0 || primaryDegreeOfSuccess === 1 ) {
        Hooks.off('preCreateChatMessage', hookId);
        return;
    }

    const isWorkbench = xdyAutoRoll(primaryRoll);

    const options = ["skip-handling-message"];
    if ( primaryDegreeOfSuccess === 2 ) {
        await primary.damage({event: eventSkipped(event, true), options});
    } else {
        await primary.critical({event: eventSkipped(event, true), options});
    }

    if (!isWorkbench) {
        if ( primaryDegreeOfSuccess === 2 ) {
            await primary.damage({event: eventSkipped(event, true)});
        } else {
            await primary.critical({event: eventSkipped(event, true)});
        }
    }

    Hooks.off('preCreateChatMessage', hookId);

    if (damages[0].rolls[0].total > damages[1].rolls[0].total) {
        ChatMessage.createDocuments([damages[0]]);
    } else {
        ChatMessage.createDocuments([damages[1]]);
    }
}

Hooks.once("init", () => {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "accidentalShot": accidentalShot,
    })
});