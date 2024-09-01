import {moduleName} from "../const.js";

export class RepairForm extends FormApplication {
    constructor(actor, items) {
        super({});
        this.actor = actor;
        this.items = items;
    }

    async getData() {
        return foundry.utils.mergeObject(super.getData(), {
            items: this.items.map(i=>{
                return {
                    item: i.name,
                    owner: i.actor.name,
                    hp: ` ${i.system.hp.value}/${i.system.hp.max}`,
                    uuid: i.uuid,
                }
            })
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "Repair items",
            id: `${moduleName}-repair`,
            classes: [moduleName],
            template: `modules/${moduleName}/templates/repair.hbs`,
            width: 500,
            height: 'auto',
            closeOnSubmit: false,
            submitOnChange: false,
            resizable: true,
            dragDrop: [],
        });
    }


    activateListeners($html) {
        super.activateListeners($html);

        let actor = this.actor;

        $html.on('click', '.repair-item', (e)=> {
            let uuid = $(e.target).data('uuid');
            game.pf2e.actions.repair({uuid})
        })

    }
}