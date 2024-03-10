async function inspireHeroics(actor) {
    if ( !actor ) { ui.notifications.info("Please select 1 token"); return;}

    if (!actor.itemTypes.spell.find(a=>a.slug === "inspire-heroics") && !actor.itemTypes.spell.find(a=>a.slug === "fortissimo-composition")) {
        ui.notifications.warn(`${actor.name} does not have Inspire Heroics/Fortissimo Composition spell!`);
        return;
    }

    if (!actor.system.resources.focus.value) { return ui.notifications.warn(`${actor.name} have no focus points`); }

    const defDC = veryHardDCByLvl(actor.level);

    const { dc, spell } = await Dialog.wait({
        title:"Use spell",
        content: `
            <h3>DC of performance check</h3>
            <input id="spell-dc" type="number" min="0" value=${defDC} />
            <hr><h3>Spell effect for aura</h3><select id="spells">
                <option value=0>Inspire Courage/Courageous Anthem</option>
                <option value=1>Inspire Defense/Rallying Anthem</option>
                <option value=2>Song of Strength</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Cast",
                    icon: "<i class='fa-solid fa-magic'></i>",
                    callback: (html) => { return { dc: parseInt(html[0].querySelector("#spell-dc").value), spell: parseInt(html[0].querySelector("#spells").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        render: (html) => {
            html.parent().parent()[0].style.cssText += 'box-shadow: 0 0 10px yellow;';
        },
        default: "ok"
    });

    let degreeOfSuccess = (await actor.skills.performance.roll({ skipDialog: rollSkipDialog(event), dc:{value: dc} })).degreeOfSuccess;

    const aura = (await fromUuid(`Compendium.${moduleName}.effects.Item.mGQMqBoTFRz3or4D`)).toObject();
    let idOfEffect='';
    if (spell === 0) {
        if (degreeOfSuccess === 3) {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.VFereWC1agrwgzPL";
        } else if (degreeOfSuccess === 2) {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.kZ39XWJA3RBDTnqG";
        } else {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.beReeFroAx24hj83";
        }
    } else if (spell === 1) {
        if (degreeOfSuccess === 3) {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.BKam63zT98iWMJH7";
        } else if (degreeOfSuccess === 2) {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.Chol7ExtoN2T36mP";
        } else {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.DLwTvjjnqs2sNGuG";
        }
    } else if (spell === 2) {
        if (degreeOfSuccess === 3) {
            idOfEffect = `Compendium.${moduleName}.effects.Item.Edq4AdKBHUtseItk`;
        } else if (degreeOfSuccess === 2) {
            idOfEffect = `Compendium.${moduleName}.effects.Item.Sc2JpGRqXir7WSx2`;
        } else {
            idOfEffect = "Compendium.pf2e.spell-effects.Item.8adLKKzJy49USYJt";
        }
    }

    aura.system.rules[0].effects[0].uuid = idOfEffect;
    await actor.createEmbeddedDocuments("Item", [aura]);

    if (degreeOfSuccess > 1) {
        await actor.update({"system.resources.focus.value":actor.system.resources.focus.value-1});
    }
}

Hooks.once("init", () => {

    game.actionsupportenginemacro = mergeObject(game.actionsupportenginemacro ?? {}, {
        "inspireHeroics": inspireHeroics,
    })
});