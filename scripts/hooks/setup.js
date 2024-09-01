import {moduleName} from "../const.js";
import {
    addItemToActorId,
    applyDamageById,
    deleteItemById,
    increaseConditionForActorId,
    removeConditionFromActorId,
    removeEffectFromActorId,
    rollAllRecoveryById,
    setEffectToActorId
} from "../lib.js";
import {gmCounteract_step1, gmCounteract_step2} from "../classes/general.js";

export let socketlibSocket = undefined;

const setupSocket = () => {
    if (globalThis.socketlib) {
        socketlibSocket = globalThis.socketlib.registerModule(moduleName);
        socketlibSocket.register("setEffectToActorId", setEffectToActorId);
        socketlibSocket.register("removeConditionFromActorId", removeConditionFromActorId);
        socketlibSocket.register("rollAllRecoveryById", rollAllRecoveryById);
        socketlibSocket.register("deleteItemById", deleteItemById);
        socketlibSocket.register("addItemToActorId", addItemToActorId);
        socketlibSocket.register("increaseConditionForActorId", increaseConditionForActorId);
        socketlibSocket.register("removeEffectFromActorId", removeEffectFromActorId);
        socketlibSocket.register("applyDamageById", applyDamageById);
        socketlibSocket.register("gmCounteract_step1", gmCounteract_step1);
        socketlibSocket.register("gmCounteract_step2", gmCounteract_step2);
    }
    return !!globalThis.socketlib;
};

export const Setup = {
    listen() {
        Hooks.once("setup", function () {
            if (!setupSocket()) console.error("Error: Unable to set up socket lib");
        });
    }
}