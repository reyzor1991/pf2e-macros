import {initSettings} from "../settings/index.js";
import {initMacros} from "../classes/index.js";
import {moduleName} from "../const.js";

export let DamageRoll = undefined;
export let DamageInstance = undefined;
export let ArithmeticExpression = undefined;
export let InstancePool = undefined;

export const Init = {
    listen() {
        Hooks.once("init", () => {
            DamageRoll = CONFIG.Dice.rolls.find(r => r.name === "DamageRoll");

            DamageInstance = CONFIG.Dice.rolls.find((r) => r.name === "DamageInstance");
            ArithmeticExpression = CONFIG.Dice.termTypes.ArithmeticExpression;
            InstancePool = CONFIG.Dice.termTypes.InstancePool;

            initSettings();
            initMacros();

            foundry.applications.handlebars.loadTemplates([
                `modules/${moduleName}/templates/save.hbs`,
            ]);
        });
    }
}