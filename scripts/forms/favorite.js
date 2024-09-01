import {DEFAULT_FAVORITE, moduleName} from "../const.js";

export class FavoriteWeapons extends FormApplication {
    constructor(options = {}) {
        super(options);
    }

    getFavoriteWeapons() {
        return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_FAVORITE),
            game.settings.get(moduleName, "favoriteWeapons")
        );
    }

    async getData() {
        return foundry.utils.mergeObject(super.getData(), {
            weapons: this.getFavoriteWeapons()
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "Favorite weapons",
            id: `${moduleName}-favorite-weapons`,
            classes: [moduleName],
            template: `modules/${moduleName}/templates/weapons.hbs`,
            width: 500,
            height: 'auto',
            closeOnSubmit: true,
            submitOnChange: false,
            resizable: true,
            dragDrop: [],
        });
    }

    activateListeners($html) {
        super.activateListeners($html);
    }

    async _updateObject(_event, data) {
        let checkData = this.getFavoriteWeapons();
        for (let w in data) {
            checkData.find(c => c.id === w).value = data[w]
        }
        game.settings.set(moduleName, "favoriteWeapons", checkData)
    }
}