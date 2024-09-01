import {moduleName} from "../const.js";
import {
    deleteItem,
    distanceIsCorrect,
    hasEffectBySourceId,
    removeConditionFromActor,
    rollAllRecovery,
    setEffectToActor
} from "../lib.js";

export async function rootToLife(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    const feat = actorFeat(actor, "root-to-life");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Root to Life!`);
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    if (!distanceIsCorrect(_token, game.user.targets.first(), 5)) {
        ui.notifications.info(`Target should be adjacent`);
        return;
    }

    const {action} = await Dialog.wait({
        title: "Root to Life",
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
                callback: (html) => {
                    return {action: parseInt(html[0].querySelector("#map").value)}
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    });
    if (action === undefined) {
        return;
    }

    await removeConditionFromActor(game.user.targets.first().actor, 'dying', true)

    if (action === 2) {
        setEffectToActor(game.user.targets.first().actor, `Compendium.${moduleName}.effects.Item.MyxzXA8wHHs6rxGj`, 1, {
            origin: {
                actor: actor?.uuid,
                item: feat?.uuid
            }
        })
            .then(async () => {
                await rollAllRecovery(game.user.targets.first().actor)
                const eff = hasEffectBySourceId(game.user.targets.first().actor, `Compendium.${moduleName}.effects.Item.MyxzXA8wHHs6rxGj`)
                if (eff) {
                    await deleteItem(eff)
                }
            })

    }
}
