import {Init} from "./init.js";
import {RenderSettingsConfig} from "./renderSettingsConfig.js";
import {Setup} from "./setup.js";

export const ModuleHooks = {
    listenAll() {
        [
            Setup,
            Init,
            RenderSettingsConfig
        ].forEach(listener => listener.listen());
    },
};
