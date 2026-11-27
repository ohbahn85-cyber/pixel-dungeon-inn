local Waves = {
    {
        name = "Closing Ranks",
        lineup = {
            { "raider", 88, 238 }, { "raider", 88, 278 }, { "raider", 88, 318 },
            { "raider", 872, 242 }, { "raider", 872, 282 }, { "raider", 872, 322 },
        },
    },
    {
        name = "Guard Line",
        lineup = {
            { "guard", 420, 148 }, { "guard", 480, 148 }, { "guard", 540, 148 },
            { "caster", 400, 91 }, { "caster", 480, 91 }, { "caster", 560, 91 },
        },
    },
    {
        name = "The Crypt Warden",
        lineup = {
            { "warden", 832, 281 },
            { "raider", 772, 232 }, { "raider", 772, 330 },
            { "raider", 160, 442 }, { "raider", 204, 461 },
        },
    },
}

local enemyTypes = {
    raider = { anim = "enemy_knight", hp = 55, hpStep = 16, damage = 10, damageStep = 3, speed = 84, scale = 2.45, radius = 14 },
    guard = { anim = "enemy_knight", hp = 112, hpStep = 25, damage = 14, damageStep = 3, speed = 58, scale = 3.05, radius = 19 },
    caster = { anim = "enemy_mage", hp = 54, hpStep = 16, damage = 11, damageStep = 3, speed = 72, scale = 2.6, radius = 15, ranged = true },
    warden = { anim = "enemy_boss", hp = 390, hpStep = 95, damage = 24, damageStep = 5, speed = 66, scale = 3.25, radius = 30, boss = true },
}

function Waves.spawn(wave, stage)
    local enemies = {}
    local stageOffset = stage - 1
    for i, spawn in ipairs(Waves[wave].lineup) do
        local kind = enemyTypes[spawn[1]]
        local hp = kind.hp + stageOffset * kind.hpStep
        enemies[i] = {
            x = spawn[2], y = spawn[3],
            animKey = kind.anim,
            isRanged = kind.ranged,
            isBoss = kind.boss,
            hp = hp, maxHp = hp,
            atk = kind.damage + stageOffset * kind.damageStep,
            spd = kind.speed,
            scale = kind.scale,
            radius = kind.radius,
            cdTimer = 0.65 + (i % 3) * 0.17,
            hitFlash = 0,
            facing = spawn[2] >= 480 and -1 or 1,
            animOffset = i * 0.31,
        }
    end
    return enemies
end

return Waves
