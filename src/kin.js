async function twoElementInfusion(actor) {
    if (!actor) {
        ui.notifications.info("Please select 1 token");
        return;
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token as target`);
        return;
    }
    let target = game.user.targets.first()

    const feat = actorFeat(actor, "two-element-infusion");
    if (!feat) {
        ui.notifications.warn(`${actor.name} does not have Two-Element Infusion!`);
        return;
    }

    let eb = new game.pf2e.ElementalBlast(actor)
    if (eb.configs.length < 2) {
        ui.notifications.info(`Need to have 2 or more elements`);
        return
    }

    let elements = eb.configs.map(e => `<option value=${e.element}>${game.i18n.localize(e.label)}</option>`).join("")

    let {el1, el2, mapIncreases, melee} = await Dialog.confirm({
        title: "Select Elements",
        content: `
            <div>
                <div>
                    <h3>First Element</h3>
                    <select id="el1">
                        ${elements}
                    </select>
                </div>
                <div>
                    <h3>Second Element</h3>
                    <select id="el2">
                        ${elements}
                    </select>
                </div>
                <div>
                    <h3>Is range?</h3>
                    <input type="checkbox" id="melee">
                </div>
            </div>
            ${getMap()}
        `,
        yes: (html) => {
            return {
                el1: html.find("#el1")?.val(),
                el2: html.find("#el2")?.val(),
                mapIncreases: html.find("#map")?.val(),
                melee: !html.find('#melee').prop("checked")
            }
        }
    });
    if (!el1 || !el2) {
        return
    }
    if (el1 === el2) {
        ui.notifications.info(`Elements should be different`);
        return
    }

    let damageTypes = []
    let r1 = await getDataEBRoll(eb, el1);
    if (!r1) {
        return
    }
    damageTypes.push({damageType: r1, element: el1})
    let r2 = await getDataEBRoll(eb, el2);
    if (!r2) {
        return
    }
    damageTypes.push({damageType: r2, element: el2})

    let active = eb.configs.filter(e => e.element === el1 || e.element === el2)
        .reduce(function (prev, current) {
            return prev && prev.dieFaces > current.dieFaces ? prev : current
        });
    active = damageTypes.find(dt => dt.element === active.element)
    let passive = damageTypes.find(dt => dt.element !== active.element)

    let damages = []

    function PD(cm) {
        if ((cm.author.id || cm.user.id) === game.userId && cm.isDamageRoll) {
            damages.push(cm);
            return false;
        }
    }

    let hookId = Hooks.on('preCreateChatMessage', PD);
    try {
        let res = await eb.attack({...active, melee, mapIncreases})
        if (res.degreeOfSuccess === 2) {
            await eb.damage({...active, melee, outcome: "success"})
        } else if (res.degreeOfSuccess === 3) {
            await eb.damage({...active, melee, outcome: "criticalSuccess"})
        }

        if (res.degreeOfSuccess === 2 || res.degreeOfSuccess === 3) {
            await until(() => damages.length >= 1);
        }

        if (damages.length === 0) {
            Hooks.off('preCreateChatMessage', hookId);
            return
        }

        console.log(`Damage Message is`);
        console.log(damages);

        let total = damages[0].rolls[0].total
        let fDamage = Math.ceil(total / 2);

        let systemFlags = foundry.utils.deepClone(damages[0].flags.pf2e);

        let r = new DamageRoll(`${fDamage}[${active.damageType}],${total - fDamage}[${passive.damageType}]`);
        r.evaluateSync()
        r.toMessage({
            speaker: damages[0].speaker,
            flags: {
                pf2e: {
                    context: systemFlags.context,
                    origin: {
                        actor: systemFlags.origin.actor,
                        rollOptions: [
                            ...systemFlags.origin.rollOptions,
                            `item:damage:type:${passive.damageType}`,
                            `"origin:item:trait:${passive.damageType}`,
                        ],
                        type: systemFlags.origin.type
                    },
                    target: systemFlags.target
                }
            }
        })

    } finally {
        Hooks.off('preCreateChatMessage', hookId);
    }
}

async function getDataEBRoll(eb, element) {
    let e = eb.configs.find(e => e.element === element);

    if (e.damageTypes.length === 1) {
        return e.damageTypes[0].value
    } else {
        return await Dialog.confirm({
            title: "Select Damage Type",
            content: `
            <div>
                <h3>Damage Type for ${game.i18n.localize(e.label)}</h3>
                <select id="dt">
                    ${e.damageTypes.map(dt => `<option value=${dt.value}>${dt.label}</option>`).join("")}
                </select>
            </div>
            <br>
        `,
            yes: (html) => {
                return html.find("#dt").val()
            }
        });
    }
}

Hooks.once("init", () => {
    game.activemacros = foundry.utils.mergeObject(game.activemacros ?? {}, {
        "twoElementInfusion": twoElementInfusion,
    })
});
