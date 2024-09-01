import {DEFAULT_FAVORITE, moduleName} from "../const.js";

export function initSettings() {
    game.settings.register(moduleName, "skipRollDialogMacro", {
        name: "Skip RollDialog for macros",
        hint: "Skipping RollDialog for macros which used for combined damage",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register(moduleName, "defAidDC", {
        name: "Default Aid DC (macro)",
        scope: "world",
        config: true,
        default: 'remaster',
        choices: {
            'remaster': 'DC is 15',
            'old': 'DC is 20',
            'homebrew10': 'DC is 10',
            'homebrew13': 'DC is 13',
        },
        type: String,
    });

    game.settings.register(moduleName, "aidWeaponTop", {
        name: "Show weapon above skills",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(moduleName, "useFavoriteWeapons", {
        name: "Use favorite weapons",
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
    });

    game.settings.register(moduleName, "favoriteWeapons", {
        scope: "client",
        config: false,
        default: DEFAULT_FAVORITE,
        type: Array,
    });
}