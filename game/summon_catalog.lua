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
