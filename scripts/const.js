const moduleName = "pf2e-macros";

const DEFAULT_FAVORITE = [
    {id: 'double-slice-1', label: 'Double Slice First Weapon', value: ''},
    {id: 'double-slice-2', label: 'Double Slice Second Weapon', value: ''},
    {id: 'flurry-of-blows-1', label: 'Flurry of Blows First Attack', value: ''},
    {id: 'flurry-of-blows-2', label: 'Flurry of Blows Second Attack', value: ''},
    {id: 'accidental-shot', label: 'Accidental Shot', value: ''},
    {id: 'certain-strike', label: 'Certain Strike', value: ''},
    {id: 'dazing-blow', label: 'Dazing Blow', value: ''},
    {id: 'hunted-shot', label: 'Hunted Shot', value: ''},
    {id: 'slam-down', label: 'Slam down', value: ''},
    {id: 'snagging-strike', label: 'Snagging Strike', value: ''},
    {id: 'twin-takedown-1', label: 'Twin Takedown First Weapon', value: ''},
    {id: 'twin-takedown-2', label: 'Twin Takedown Second Weapon', value: ''},
    {id: 'twin-feint-1', label: 'Twin Feint First Weapon', value: ''},
    {id: 'twin-feint-2', label: 'Twin Feint Second Weapon', value: ''},
]

const dcByLevel = new Map([
    [-1, 13],
    [0, 14],
    [1, 15],
    [2, 16],
    [3, 18],
    [4, 19],
    [5, 20],
    [6, 22],
    [7, 23],
    [8, 24],
    [9, 26],
    [10, 27],
    [11, 28],
    [12, 30],
    [13, 31],
    [14, 32],
    [15, 34],
    [16, 35],
    [17, 36],
    [18, 38],
    [19, 39],
    [20, 40],
    [21, 42],
    [22, 44],
    [23, 46],
    [24, 48],
    [25, 50],
])

const TO_AVERAGE_DMG = {
    'd4': 3,
    'd6': 4,
    'd8': 5,
    'd10': 6,
    'd12': 7,
}

const defDCMap = {
    'remaster': 15,
    'old': 20,
    'homebrew10': 10,
    'homebrew13': 13,
}

const OFF_GUARD_TARGET_EFF = {
    "name": " is Off-guard",
    "type": "effect",
    "effects": [],
    "system": {
        "description": {
            "gm": "",
            "value": ""
        },
        "rules": [
            {
                "key": "EphemeralEffect",
                "selectors": [
                    "attack-roll",
                    "damage"
                ],
                "predicate": [],
                "uuid": "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg"
            }
        ],
        "slug": "target-is-off-guard",
        "traits": {
            "otherTags": [],
            "value": []
        },
        "level": {"value": 1},
        "duration": {
            "value": -1,
            "unit": "unlimited",
            "expiry": null,
            "sustained": false
        },
        "tokenIcon": {"show": true},
    },
    "img": "icons/skills/melee/strike-blade-scimitar-gray-red.webp"
}

export {
    moduleName,
    DEFAULT_FAVORITE,
    TO_AVERAGE_DMG,
    OFF_GUARD_TARGET_EFF,
    defDCMap,
    dcByLevel
}