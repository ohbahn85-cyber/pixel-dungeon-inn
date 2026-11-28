local Catalog = {}

local tiers = { "C", "B", "A", "S" }
local families = {
    {
        key = "sword", tag = "melee", size = 0.65, speed = 150, reach = 25, cooldown = 0.64,
        accent = {1, 0.31, 0.20}, gearHeight = {35, 41, 47, 55},
        gearNames = {
            { "Rusty Short Sword", "Iron Longsword", "Red Falchion", "Ember Cleaver" },
            { "Copper Dagger", "Copper Arming Sword", "Grave Rapier", "Twin-Prong Sunblade" },
        },
        names = { "Rusty Sword Skeleton", "Iron Sword Skeleton", "Grave Skirmisher", "Grave Scout" },
        health = { 57, 77, 105, 145 }, damage = { 12, 17, 23, 33 },
        rings = {
            { name = "Rusty Blade Pile", bonus = "Swarm of three", limit = 3, cooldown = 7, speed = 0 },
            { name = "Quick Hilt", bonus = "+20% attack speed", limit = 2, cooldown = 5, speed = 20 },
        },
    },
    {
        key = "shield", tag = "aggro", size = 0.80, speed = 132, reach = 31, cooldown = 1.08,
        accent = {0.30, 0.59, 1}, gearHeight = {55, 62, 68, 74},
        gearNames = {
            { "Plank Shield", "Coffin Shield", "Iron Heater", "Cobalt Tower Shield" },
            { "Wood Buckler", "Iron Buckler", "Riveted Kite Shield", "Gilded Spiked Shield" },
        },
        names = { "Bone Shield Bearer", "Coffin Guard", "Ossuary Knight", "Grave Gate Warden" },
        health = { 126, 179, 245, 346 }, damage = { 11, 16, 22, 30 },
        rings = {
            { name = "Brass Sentry", bonus = "+1s mark duration", limit = 1, cooldown = 5, speed = 20, mark = 1, push = 0 },
            { name = "Coffin Vanguard", bonus = "+25% knockback", limit = 2, cooldown = 9, speed = 0, mark = 0, push = 0.25 },
        },
    },
    {
        key = "archer", tag = "ranged", size = 0.75, speed = 127, reach = 174, cooldown = 0.94,
        accent = {0.36, 1, 0.77}, gearHeight = {51, 57, 63, 73},
        gearNames = {
            { "Wooden Shortbow", "Bone Recurve", "Brass Compound Bow", "Jade Rune Longbow" },
            { "Forked Stave Bow", "Twin Recurve", "Jagged Composite Bow", "Wraithhook Recurve" },
        },
        names = { "Skeleton Archer", "Bonebow Hunter", "Brass Archer", "Grave Tracker" },
        health = { 59, 79, 109, 149 }, damage = { 13, 19, 26, 36 },
        rings = {
            { name = "Brass Tracker", bonus = "+15% range against marked foes", limit = 1, cooldown = 5, speed = 25, markedRange = 0.15, pierce = 0 },
            { name = "Twin Fletching", bonus = "+20% base damage after piercing from B rank", limit = 2, cooldown = 9, speed = 0, markedRange = 0, pierce = 0.20 },
        },
    },
    {
        key = "ember", tag = "magic / aoe", size = 0.60, speed = 135, reach = 157, cooldown = 2.25,
        names = { "Grave Flame", "Wake Lantern", "Ember Censer", "Violet Pyre" },
        health = { 46, 64, 87, 122 }, damage = { 5, 7, 9, 12 },
        fire = {
            { radius = 34, duration = 2.0, color = {1, 0.77, 0.27}, trait = "Sets the ground alight" },
            { radius = 44, duration = 2.4, color = {1, 0.53, 0.23}, trait = "Wider, longer fires" },
            { radius = 48, duration = 2.6, color = {1, 0.35, 0.49}, slow = 0.22, trait = "Fires slow foes by 22%" },
            { radius = 54, duration = 2.8, color = {0.76, 0.46, 1}, slow = 0.22, spread = true,
                trait = "First burn kill spreads fire" },
        },
        rings = {
            { name = "Cinder Ring", bonus = "+15% fire radius", limit = 1, cooldown = 6, speed = 20, radius = 0.15, duration = 0 },
            { name = "Ash Nest Ring", bonus = "+0.75s fire duration", limit = 2, cooldown = 10, speed = 0, radius = 0, duration = 0.75 },
        },
    },
    {
        key = "spider", tag = "burst / aoe", size = 0.55, speed = 186, reach = 22, cooldown = 0.50,
        accent = {1, 0.41, 0.17}, artRow = 1,
        names = { "Bone Spider", "Copper Burster", "Cracked Brood", "Magma Widow" },
        health = {42, 58, 79, 108}, damage = {29, 37, 45, 61},
        abilities = {
            { radius = 47, trait = "Charges into foes and bursts" },
            { radius = 57, push = 18, trait = "Wider blast knocks foes back" },
            { radius = 62, push = 18, slow = 0.30, trait = "Blast slows foes by 30% for 1.5s" },
            { radius = 68, push = 18, slow = 0.30, echo = true, trait = "Hit 3 or more foes to trigger an aftershock" },
        },
        rings = {
            { name = "Clutch Ring", bonus = "+12 blast radius", limit = 2, cooldown = 6, speed = 0, radius = 12 },
            { name = "Hot Fuse Ring", bonus = "+20% blast damage", limit = 1, cooldown = 4, speed = 0, damage = 0.20 },
        },
    },
    {
        key = "moth", tag = "buff / aura", size = 0.63, speed = 148, reach = 0, cooldown = 3.8,
        accent = {0.42, 0.73, 1}, artRow = 2, support = true,
        names = { "Funeral Moth", "Pallwing", "Moon Veil", "Rimewing Herald" },
        health = {42, 57, 77, 106}, damage = {0, 0, 0, 0},
        abilities = {
            { radius = 104, duration = 2.5, haste = 0.18, trait = "+18% attack speed to nearby attackers" },
            { radius = 130, duration = 3.0, haste = 0.22, trait = "Larger pulse gives +22% attack speed" },
            { radius = 140, duration = 3.0, haste = 0.26, move = 0.12, trait = "+26% attack speed and +12% movement" },
            { radius = 154, duration = 3.3, haste = 0.34, move = 0.12, hero = true, trait = "+34% attack speed, also affects the necromancer" },
        },
        rings = {
            { name = "Wide Wing Ring", bonus = "+20% aura radius", limit = 1, cooldown = 7, speed = 0, radius = 0.20 },
            { name = "Echowing Ring", bonus = "+0.7s buff duration", limit = 2, cooldown = 10, speed = 0, duration = 0.70 },
        },
    },
    {
        key = "doll", tag = "heal / support", size = 0.55, speed = 141, reach = 0, cooldown = 3.3,
        accent = {0.38, 1, 0.64}, artRow = 3, support = true,
        names = { "Stitch Doll", "Moss Stitcher", "Thread Keeper", "Jade Seamstress" },
        health = {52, 69, 92, 125}, damage = {14, 18, 24, 31},
        abilities = {
            { radius = 108, targets = 1, trait = "Mends one wounded summon" },
            { radius = 120, targets = 2, trait = "Mends up to two wounded summons" },
            { radius = 130, targets = 2, hero = true, trait = "Can also heal the necromancer" },
            { radius = 142, targets = 2, hero = true, barrier = 12, trait = "Healing adds a 12 HP barrier for 4s" },
        },
        rings = {
            { name = "Wax Thread Ring", bonus = "+15% healing", limit = 1, cooldown = 7, speed = 0, heal = 0.15 },
            { name = "Long Spool Ring", bonus = "+15% healing range", limit = 1, cooldown = 5, speed = 20, radius = 0.15 },
        },
    },
    {
        key = "wraith", tag = "pull / control", size = 0.62, speed = 142, reach = 147, cooldown = 2.6,
        accent = {0.72, 0.49, 1}, artRow = 4,
        names = { "Chain Wraith", "Shackle Shade", "Gallows Hook", "Gilded Jailer" },
        health = {49, 67, 92, 126}, damage = {9, 13, 18, 25},
        abilities = {
            {targets = 1, pull = 34, trait = "Pulls one foe inward"},
            {targets = 2, pull = 43, trait = "Pulls up to two foes"},
            {targets = 3, pull = 54, slow = 0.25, trait = "Up to three chains that also slow"},
            {targets = 4, pull = 70, slow = 0.35, trait = "Up to four longer pulls with stronger slow"},
        },
        rings = {
            {name = "Heavy Link Ring", bonus = "+20% pull distance", limit = 1, cooldown = 7, speed = 0, pull = 0.20},
            {name = "Quick Shackle Ring", bonus = "+25% attack speed", limit = 1, cooldown = 5, speed = 25},
        },
    },
    {
        key = "raven", tag = "curse / ranged", size = 0.57, speed = 151, reach = 167, cooldown = 1.65,
        accent = {1, 0.40, 0.68}, artRow = 5,
        names = { "Curse Raven", "Grave Beak", "Scarlet Raven", "Omen of Ruin" },
        health = {45, 61, 83, 115}, damage = {8, 11, 15, 21},
        abilities = {
            {targets = 1, curse = 0.18, trait = "Cursed foes deal 18% less damage"},
            {targets = 2, curse = 0.18, trait = "Curses up to two foes"},
            {targets = 2, curse = 0.28, trait = "Cursed foes deal 28% less damage"},
            {targets = 3, curse = 0.28, execute = 0.14, trait = "Finishes non-boss foes under 14% health"},
        },
        rings = {
            {name = "Omen Ring", bonus = "+1.5s curse duration", limit = 1, cooldown = 6, speed = 0, duration = 1.5},
            {name = "Black Quill Ring", bonus = "+20% attack speed", limit = 2, cooldown = 10, speed = 20},
        },
    },
    {
        key = "mole", tag = "loot / support", size = 0.53, speed = 159, reach = 0, cooldown = 2.3,
        accent = {1, 0.73, 0.29}, artRow = 6, support = true,
        names = { "Grave Mole", "Cellar Digger", "Amber Delver", "Vaultburrow Mole" },
        health = {48, 65, 89, 122}, damage = {0, 0, 0, 0},
        abilities = {
            {radius = 152, trait = "Draws nearby XP gems to the necromancer"},
            {radius = 180, materials = true, trait = "Also gathers crafting materials"},
            {radius = 190, materials = true, every = 6, trait = "+1 XP per six gems it gathers"},
            {radius = 218, materials = true, every = 4, trait = "+1 XP per four gems it gathers"},
        },
        rings = {
            {name = "Deep Pocket Ring", bonus = "+20% pickup radius", limit = 1, cooldown = 6, speed = 0, radius = 0.20},
            {name = "Gem Pouch Ring", bonus = "+20% gathering speed", limit = 2, cooldown = 10, speed = 20},
        },
    },
}

for familyIndex, family in ipairs(families) do
    for rank, tier in ipairs(tiers) do
        local id = (familyIndex - 1) * #tiers + rank
        local fire = family.fire and family.fire[rank]
        Catalog[id] = {
            id = id, family = family.key, familyIndex = familyIndex, tag = family.tag,
            name = family.names[rank], tier = tier, rank = rank,
            nextId = rank < #tiers and id + 1 or nil,
            hp = family.health[rank], atk = family.damage[rank], spd = family.speed,
            reach = family.reach, cd = family.cooldown, size = family.size, accent = fire and fire.color or family.accent,
            fire = fire,
            ability = family.abilities and family.abilities[rank], artRow = family.artRow, support = family.support,
        }
    end
    for variant, kit in ipairs(family.gearNames or {}) do
        for rank, item in ipairs(kit) do
            kit[rank] = {
                id = ((familyIndex - 1) * 2 + variant - 1) * #tiers + rank,
                name = item, height = family.gearHeight[rank],
            }
        end
    end
end

function Catalog.ring(id, variation)
    return { id = id, enhance = 0, variation = variation or 1 }
end

function Catalog.stats(ring)
    return families[Catalog[ring.id].familyIndex].rings[ring.variation or 1]
end

function Catalog.equipment(ring)
    local summon = Catalog[ring.id]
    local gear = families[summon.familyIndex].gearNames
    return gear and gear[ring.variation or 1][summon.rank]
end

function Catalog.options(rank)
    local options = {}
    for index = 1, #families do options[index] = (index - 1) * #tiers + rank end
    return options
end

return Catalog
