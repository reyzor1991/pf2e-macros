import {moduleName} from "../const.js"
import {FavoriteWeapons} from "../forms/favorite.js";
import {isV12} from "../lib.js";

export const RenderSettingsConfig = {
    listen() {
        Hooks.on("renderSettingsConfig", (app, _html) => {
            let html = isV12() ? _html : $(_html);
            const target = html.find(`[data-category="${moduleName}"]`);
            if (target.find(`.${moduleName}-btn-favorite`).length === 0) {
                let syncBtn = document.createElement("div");
                syncBtn.classList.add("form-group", "submenu", `${moduleName}-btn-favorite`);
                syncBtn.innerHTML = `<button type="button"> <i class="	fas fa-swords"></i> <label>Configure favorite weapons</label> </button>`;
                syncBtn.onclick = function () {
                    new FavoriteWeapons().render(true)
                };
                target.find(".form-group").first().before(syncBtn);
            }
        });
    }
}