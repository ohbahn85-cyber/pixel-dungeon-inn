local Waves = {
    {
        name = "Closing Ranks",
        packs = { { "raider", 6 }, { "raider", 6 }, { "raider", 6 }, { "raider", 6 }, { "raider", 6 } },
    },
    {
        name = "Guard Line",
        packs = {
            { "raider", 6 }, { "guard", 4 }, { "raider", 6 }, { "caster", 6 },
            { "raider", 6 }, { "guard", 4 }, { "caster", 8 },
        },
    },
    {
        name = "The Crypt Warden",
        packs = {
            { "warden", 1 }, { "raider", 7 }, { "guard", 7 }, { "raider", 7 },
            { "raider", 7 }, { "caster", 7 }, { "raider", 7 }, { "raider", 7 },
        },
    },
}

Waves.width, Waves.height = 1920, 1152
Waves.border = 42

local enemyTypes = {
    raider = { anim = "enemy_knight", hp = 29, hpStep = 9, damage = 7, damageStep = 2, speed = 89, scale = 1.53, radius = 10 },
    guard = { anim = "enemy_knight", hp = 66, hpStep = 16, damage = 11, damageStep = 3, speed = 64, scale = 1.88, radius = 13 },
    caster = { anim = "enemy_mage", hp = 36, hpStep = 11, damage = 8, damageStep = 2, speed = 75, scale = 1.57, radius = 10, ranged = true },
    warden = { anim = "enemy_boss", hp = 410, hpStep = 92, damage = 22, damageStep = 5, speed = 74, scale = 2.21, radius = 23, boss = true },
}

function Waves.clamp(x, y)
    return math.max(Waves.border, math.min(Waves.width - Waves.border, x)),
        math.max(Waves.border, math.min(Waves.height - Waves.border, y))
end

function Waves.spawn(wave, stage, x, y)
    local enemies = {}
    local stageOffset = stage - 1
    local packs = Waves[wave].packs
    local centerX = math.max(248, math.min(Waves.width - 248, x))
    local centerY = math.max(240, math.min(Waves.height - 240, y))
    for packIndex, group in ipairs(packs) do
        local kind = enemyTypes[group[1]]
        local heading = (packIndex - 1) * 2 * math.pi / #packs + (wave - 1) * 0.39
        local normalX, normalY = math.cos(heading), math.sin(heading)
        local packRadius = 300 + (packIndex % 3) * 44
        for i = 1, group[2] do
            local forward = packRadius + math.floor((i - 1) / 3) * 27
            local side = ((i - 1) % 3 - 1) * 29
            local ex, ey = Waves.clamp(centerX + normalX * forward - normalY * side,
                centerY + normalY * forward + normalX * side)
            local ox, oy = ex - x, ey - y
            if ox * ox + oy * oy < 126 * 126 then
                local inward = x < Waves.width / 2 and 164 or -164
                ex = Waves.clamp(x + inward + side, ey)
            end
            local hp = kind.hp + stageOffset * kind.hpStep
            enemies[#enemies + 1] = {
                x = ex, y = ey,
                animKey = kind.anim, isRanged = kind.ranged, isBoss = kind.boss,
                hp = hp, maxHp = hp, atk = kind.damage + stageOffset * kind.damageStep,
                spd = kind.speed, scale = kind.scale, radius = kind.radius,
                cdTimer = 0.65 + (i % 3) * 0.17, hitFlash = 0,
                facing = ex >= x and -1 or 1, animOffset = i * 0.31,
            }
        end
    end
    return enemies
end

return Waves
