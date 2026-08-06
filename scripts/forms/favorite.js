import {DEFAULT_FAVORITE, moduleName} from "../const.js";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

export class FavoriteWeapons extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: `${moduleName}-favorite-weapons`,
        classes: [moduleName],
        position: {
            width: 500
        },
        window: {
            title: "Favorite weapons",
            resizable: true
        },
        form: {
            handler: this.formHandler,
            closeOnSubmit: true,
            submitOnChange: false,
        }
    };

    static PARTS = {
        hbs: {
            template: `modules/${moduleName}/templates/weapons.hbs`
        },
        footer: {
            template: `modules/${moduleName}/templates/save.hbs`
        }
    };

    getFavoriteWeapons() {
        return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_FAVORITE),
            game.settings.get(moduleName, "favoriteWeapons")
        );
    }

    async _prepareContext() {
        return {
            weapons: this.getFavoriteWeapons()
        };
    }

    static async formHandler(event, form, formData) {
        this._updateObject(event, formData.object);
    }

    async _updateObject(_event, data) {
        let checkData = this.getFavoriteWeapons();
        console.log(checkData);
        for (let w in data) {
            checkData.find(c => c.id === w).value = data[w]
        }
        await game.settings.set(moduleName, "favoriteWeapons", checkData)
    }
}
