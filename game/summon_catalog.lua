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
}

for familyIndex, family in ipairs(families) do
    for rank, tier in ipairs(tiers) do
        local id = (familyIndex - 1) * #tiers + rank
        Catalog[id] = {
            id = id, family = family.key, familyIndex = familyIndex, tag = family.tag,
            name = family.names[rank], tier = tier, rank = rank,
            nextId = rank < #tiers and id + 1 or nil,
            hp = family.health[rank], atk = family.damage[rank], spd = family.speed,
            reach = family.reach, cd = family.cooldown, size = family.size, accent = family.accent,
        }
    end
    for variant, kit in ipairs(family.gearNames) do
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
    return families[summon.familyIndex].gearNames[ring.variation or 1][summon.rank]
end

function Catalog.options(rank)
    return { rank, rank + #tiers, rank + 2 * #tiers }
end

return Catalog
