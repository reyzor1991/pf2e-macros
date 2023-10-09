async function rootToLife(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    const feat = actor?.itemTypes?.feat?.find(c => "root-to-life" === c.slug);
    if ( !feat ) {
        ui.notifications.warn(`${actor.name} does not have Root to Life!`);
        return;
    }
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }
    if (!game.actionsupportengine.distanceIsCorrect(_token, game.user.targets.first(), 5)) { ui.notifications.info(`Target should be adjacent`);return; }

    const { action } = await Dialog.wait({
        title:"Root to Life",
        content: `
            <h3>Actions</h3>
            <select id="map">
                <option value=1>1 Action</option>
                <option value=2>2 Action</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Use",
                    icon: "<i class='fa-solid fa-hand-fist'></i>",
                    callback: (html) => { return { action: parseInt(html[0].querySelector("#map").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        default: "ok"
    });
    if ( action === undefined ) { return; }

    await game.actionsupportengine.removeConditionFromActor(game.user.targets.first().actor, 'dying', true)

    if (action === 2) {
        game.actionsupportengine.setEffectToActor(game.user.targets.first().actor, 'Compendium.pf2e-action-support-engine.effects.Item.MyxzXA8wHHs6rxGj', 1, {origin:{actor: actor?.uuid, item:feat?.uuid}})
        .then(async ()=> {
            await game.actionsupportengine.rollAllRecovery(game.user.targets.first().actor)
            const eff = game.actionsupportengine.hasEffectBySourceId(game.user.targets.first().actor, "Compendium.pf2e-action-support-engine.effects.Item.MyxzXA8wHHs6rxGj")
            if (eff) {
                await game.actionsupportengine.deleteItem(eff)
            }
        })

    }
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "rootToLife": rootToLife,
    })
});