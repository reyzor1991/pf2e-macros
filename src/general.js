async function scareToDeath(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}
    const feat = actor?.itemTypes?.feat?.find(c => "scare-to-death" === c.slug);
    if ( !feat ) {
        ui.notifications.warn(`${actor.name} does not have Scare to Death!`);
        return;
    }
    if (game.user.targets.size != 1) { ui.notifications.info(`Need to select 1 token as target`);return; }
    if (!game.actionsupportengine.distanceIsCorrect(_token, game.user.targets.first(), 30)) { ui.notifications.info(`Target should be in 30ft radius`);return; }
    if (game.user.targets.first().actor?.itemTypes?.effect?.find(c => `scare-to-death-immunity-${actor.id}` === c.slug)) {ui.notifications.info(`Target has immunity to Scare to Death from ${actor.name}`);return}

    const extraRollOptions = ["action:scare-to-death", "emotion", "fear", "incapacitation", "general", "skill"];
    const traits = ["emotion", "fear", "incapacitation", "general", "skill"];
    const title = "Scare to Death";
    const targetDC = game.user.targets.first().actor?.getStatistic('will')?.dc;
    const dc = {
        scope: "check",
        statistic: targetDC,
        value: targetDC?.value ?? 0
    };
    const modifiers = []
    if (!shareLanguage(actor, game.user.targets.first().actor)) {
        modifiers.push(new game.pf2e.Modifier({
            label: "PF2E.Actions.Demoralize.Unintelligible",
            modifier: -4,
            type: "circumstance"
        }));
    }

    const skipDialog = game.settings.get(moduleName, "skipRollDialogMacro");
    const result = await actor.skills['intimidation'].roll({skipDialog, modifiers, origin: null, dc, traits, title, item: feat, target: game.user.targets.first().actor, extraRollOptions});

    await addImmunity(_token, game.user.targets.first().actor);

    if (result.degreeOfSuccess === 1) {
        game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "frightened", 1);
    } else if (result.degreeOfSuccess === 2) {
        game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "frightened", 2);
    } else if (result.degreeOfSuccess === 3) {
        const actorDC = actor?.getStatistic('intimidation')?.dc
        const cfResult = await game.user.targets.first().actor.saves.fortitude.roll({
            skipDialog: true,
            origin: actor,
            dc: {
                label: "Scare to Death DC",
                value: actorDC?.value ?? 0
            }, traits:[...traits, 'death'], title, item: feat, extraRollOptions: [...extraRollOptions, 'death']
        });
        if (cfResult.degreeOfSuccess === 0) {
            ChatMessage.create({
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: `${game.user.targets.first().actor.name} died because of Scare to Death`
            });
        } else {
            await game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "frightened", 2);
            await game.actionsupportengine.increaseConditionForActor(game.user.targets.first().actor, "fleeing", 1);
        }
    }
}

function shareLanguage(actor, target) {
    if (target?.itemTypes?.condition?.find(c => "deafened" === c.slug)) {return false}

    return (target.system.traits.languages.value ?? []).some(item => actor?.system.traits.languages.value.includes(item))
}

async function addImmunity(_token, target) {
    const exampleImmunityEffect = {
        type: 'effect',
        name: `Scare to Death Immunity (${_token.actor.name})`,
        img: `${_token.document.texture.src}`,
        system: {
            tokenIcon: {show: true},
            duration: { value: '1', unit: 'minutes', sustained: false, expiry: 'turn-start'},
            rules: [],
            slug: `scare-to-death-immunity-${_token.actor.id}`
        },
    };
    await game.actionsupportengine.addItemToActor(target, exampleImmunityEffect);
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "scareToDeath": scareToDeath,
    })
});