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
};

async function aid(actor) {
    if (game.user.targets.size === 0) { ui.notifications.info(`Need to select target to apply Aid effect`); }

    let defDC = game.settings.get(moduleName, "defAidDC") === 'remaster' ? 15 : 20;
    let styles = `style="display: flex; align-items: center; justify-content: space-between;"`
    let weapons = actor.system.actions.filter( h => h.ready);

    let skillsHtml = `<option value="perception" data-skill='true'>${game.i18n.localize("PF2E.PerceptionLabel")}</option>` +Object.values(_token.actor.skills).map(s=>{
        return `<option value="${s.slug}" data-skill='true'>${s.label}</option>`
    });
    let weaponsHtml = weapons.map(s=>{
        return `<option value="${s.slug}" data-skill='false'>${s.label}</option>`
    })

     const { id, isSkill, dc } = await Dialog.wait({
        title:"Aid",
        content: `
            <p ${styles}>
                <strong>Skill or Attack</strong>
                <select id="actions">
                    ${game.settings.get(moduleName, "aidWeaponTop") ? weaponsHtml + skillsHtml : skillsHtml + weaponsHtml}
                    {{/each}}
            </select>
            </p>
            <p ${styles}>
                <strong>DC</strong>
                <input class='dc' type="number" value='${defDC}' min="0" style="width: 5ch;">
            </p>
        `,
        buttons: {
                ok: {
                    label: "Aid",
                    icon: "<i class='fa-solid fa-hand'></i>",
                    callback: (html) => {
                        return {
                            id: html.find("#actions").val(),
                            isSkill: html.find("#actions").find('option:selected').data('skill'),
                            dc: parseInt(html.find('.dc').val()) ?? defDC
                        }
                    }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        default: "ok"
    }, {}, {width: 600});

    if (!id) {return}

    if (isSkill) {
        const skipDialog = game.settings.get(moduleName, "skipRollDialogMacro");
        actor.getStatistic(id).roll({skipDialog, dc, extraRollOptions: [`action:aid:${id}`,'action:aid']})
    } else {
        const ev = game.settings.get(moduleName, "skipRollDialogMacro")
            ? new KeyboardEvent('keydown', {'shiftKey': game.user.flags.pf2e.settings.showRollDialogs})
            : event;

        weapons.find(w=>w.slug===id)?.roll({event:ev, dc, options: [`action:aid:${id}`, 'action:aid']})
    }
}

Hooks.once("init", () => {
    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "scareToDeath": scareToDeath,
        "aid": aid,
    })
});