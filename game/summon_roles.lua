local Targeting = require("combat_targeting")
local Waves = require("raid_waves")
local Roles = {}

local function distanceSquared(a, b)
    return (a.x - b.x)^2 + (a.y - b.y)^2
end

function Roles.new()
    return { effects = {}, echoes = {} }
end

local function ripple(state, source, radius, duration)
    state.effects[#state.effects + 1] = {
        x = source.x, y = source.y, radius = radius, color = source.meta.accent,
        life = duration, duration = duration,
    }
end

local function link(state, source, target)
    state.effects[#state.effects + 1] = {
        x = source.x, y = source.y - 17, tx = target.x, ty = target.y - 15,
        color = source.meta.accent, life = 0.34, duration = 0.34,
    }
end

local function shiftEnemy(enemy, x, y, distance)
    local dx, dy = enemy.x - x, enemy.y - y
    local length = math.sqrt(dx * dx + dy * dy)
    if length <= 0 then return end
    enemy.x, enemy.y = Waves.clamp(enemy.x + dx * distance / length, enemy.y + dy * distance / length)
end

local function slowEnemy(enemy, amount, now)
    if not amount then return end
    if not enemy.slowUntil or enemy.slowUntil <= now or enemy.slowAmount <= amount then
        enemy.slowAmount, enemy.slowUntil = amount, now + 1.5
    end
end

function Roles.enemySlow(enemy, now)
    local roleSlow = (enemy.slowUntil or 0) > now and enemy.slowAmount or 0
    return math.max(enemy.burnSlow or 0, roleSlow)
end

local function blast(state, source, radius, damage, enemies, hit, now, canEcho, searing)
    local numHit = 0
    local ability = source.meta.ability
    ripple(state, source, radius, 0.36)
    for _, enemy in ipairs(enemies) do
        if enemy.hp > 0 and distanceSquared(enemy, source) <= (radius + enemy.radius)^2 then
            numHit = numHit + 1
            local dealt = searing and enemy.burning and math.floor(damage * 1.30) or damage
            hit(source, enemy, dealt, source.meta.accent)
            if enemy.hp > 0 and canEcho then
                if ability.push then shiftEnemy(enemy, source.x, source.y, ability.push * (enemy.isBoss and 0.25 or 1)) end
                slowEnemy(enemy, ability.slow, now)
            end
        end
    end
    if canEcho and ability.echo and numHit >= 3 then
        state.echoes[#state.echoes + 1] = {
            source = source, delay = 0.32, radius = radius * 0.78, damage = math.floor(damage * 0.60), searing = searing,
        }
    end
end

function Roles.explode(state, source, damage, enemies, hit, now, searing)
    local stats = source.slot.stats
    local radius = source.meta.ability.radius + (stats.radius or 0)
    local dealt = math.floor(damage * (1 + (stats.damage or 0)))
    blast(state, source, radius, dealt, enemies, hit, now, true, searing)
    source.hp, source.fuseTime = 0, nil
end

function Roles.update(state, dt, now, enemies, hit)
    for i = #state.effects, 1, -1 do
        local effect = state.effects[i]
        effect.life = effect.life - dt
        if effect.life <= 0 then table.remove(state.effects, i) end
    end
    for i = #state.echoes, 1, -1 do
        local echo = state.echoes[i]
        echo.delay = echo.delay - dt
        if echo.delay <= 0 then
            blast(state, echo.source, echo.radius, echo.damage, enemies, hit, now, false, echo.searing)
            table.remove(state.echoes, i)
        end
    end
end

function Roles.haste(actor, now)
    if (actor.hasteUntil or 0) > now then return actor.haste, actor.moveHaste end
    return 0, 0
end

local function pulse(state, source, allies, hero, synergies, now)
    local ability, stats = source.meta.ability, source.slot.stats
    local radius = ability.radius * (1 + (stats.radius or 0))
    local expires = now + ability.duration + (stats.duration or 0)
    local affected = false

    local function haste(ally, bonus)
        if ally.hp <= 0 or distanceSquared(source, ally) > radius^2 then return end
        local attackSpeed = ability.haste + bonus
        local current = Roles.haste(ally, now)
        if attackSpeed >= current then
            ally.haste, ally.moveHaste, ally.hasteUntil = attackSpeed, ability.move or 0, expires
        end
        affected = true
    end

    for _, ally in ipairs(allies) do
        if not ally.meta.support then
            haste(ally, synergies.tailwind and ally.meta.family == "archer" and 0.12 or 0)
        end
    end
    if ability.hero then haste(hero, 0) end
    if affected then ripple(state, source, radius, 0.52) end
    return affected
end

function Roles.barrier(actor, now)
    if (actor.barrierUntil or 0) > now then return actor.barrierHp end
    return 0
end

function Roles.absorb(actor, damage, now)
    local absorbed = math.min(Roles.barrier(actor, now), damage)
    if absorbed > 0 then actor.barrierHp = actor.barrierHp - absorbed end
    return damage - absorbed
end

local function mend(state, source, allies, hero, synergies, now, pop)
    local ability, stats = source.meta.ability, source.slot.stats
    local radius = ability.radius * (1 + (stats.radius or 0))
    local patients = {}
    local function consider(ally)
        if ally ~= source and ally.hp > 0 and ally.hp < ally.maxHp and distanceSquared(source, ally) <= radius^2 then
            patients[#patients + 1] = ally
        end
    end
    for _, ally in ipairs(allies) do consider(ally) end
    if ability.hero then consider(hero) end
    table.sort(patients, function(a, b)
        local left, right = a.hp / a.maxHp, b.hp / b.maxHp
        if left ~= right then return left < right end
        return distanceSquared(source, a) < distanceSquared(source, b)
    end)

    for index = 1, math.min(#patients, ability.targets) do
        local ally = patients[index]
        local bonus = (stats.heal or 0) + (synergies.bulwark and ally.meta and ally.meta.family == "shield" and 0.35 or 0)
        local amount = math.min(ally.maxHp - ally.hp, math.floor(source.atk * (1 + bonus)))
        ally.hp = ally.hp + amount
        if ability.barrier then
            ally.barrierHp = math.max(Roles.barrier(ally, now), ability.barrier)
            ally.barrierUntil = now + 4
        end
        link(state, source, ally)
        pop(ally.x, ally.y - 32, "+" .. amount .. " HP", source.meta.accent)
    end
    return #patients > 0
end

function Roles.support(state, source, allies, hero, synergies, now, pop)
    if source.meta.family == "moth" then return pulse(state, source, allies, hero, synergies, now) end
    return mend(state, source, allies, hero, synergies, now, pop)
end

function Roles.collect(state, source, drops)
    local ability, stats = source.meta.ability, source.slot.stats
    local radius = ability.radius * (1 + (stats.radius or 0))
    local gathered = false
    for _, drop in ipairs(drops) do
        if not drop.gathered and (ability.materials or drop.kind == "xp") and distanceSquared(source, drop) <= radius^2 then
            drop.gathered, gathered = true, true
            if ability.every and drop.kind == "xp" then
                local count = (source.slot.gemCount or 0) + 1
                if count % ability.every == 0 then drop.amount = drop.amount + 1 end
                source.slot.gemCount = count
            end
        end
    end
    if gathered then ripple(state, source, radius, 0.43) end
    return gathered
end

function Roles.cursed(enemy, now)
    return (enemy.curseUntil or 0) > now
end

function Roles.enemyDamage(enemy, now)
    if Roles.cursed(enemy, now) then return math.max(1, math.floor(enemy.atk * (1 - enemy.cursePower))) end
    return enemy.atk
end

function Roles.strike(state, source, target, enemies, damage, hit, now, synergies)
    local ability, stats = source.meta.ability, source.slot.stats
    local struck = {}
    for _ = 1, ability.targets do
        link(state, source, target)
        struck[target] = true
        local dealt = damage
        if ability.pull then
            local pull = ability.pull * (1 + (stats.pull or 0) + (synergies.snare and 0.35 or 0))
            if target.isBoss then pull = pull * 0.30 end
            local distance = math.sqrt(distanceSquared(source, target))
            shiftEnemy(target, source.x, source.y, -math.min(pull, math.max(0, distance - 20)))
            slowEnemy(target, ability.slow, now)
        else
            if not Roles.cursed(target, now) or target.cursePower <= ability.curse then
                target.cursePower, target.curseUntil = ability.curse, now + 3 + (stats.duration or 0)
            end
            if ability.execute and not target.isBoss and target.hp - dealt <= target.maxHp * ability.execute then
                dealt = math.max(dealt, target.hp)
            end
        end
        hit(source, target, dealt, source.meta.accent)
        target = Targeting.nearest(enemies, source.x, source.y, source.meta.reach, function(foe)
            return not struck[foe]
        end)
        if not target then break end
    end
end

function Roles.draw(state)
    for _, effect in ipairs(state.effects) do
        local r, g, b = unpack(effect.color)
        local fade = effect.life / effect.duration
        if effect.radius then
            love.graphics.setColor(r, g, b, 0.08 * fade)
            love.graphics.circle("fill", effect.x, effect.y, effect.radius, 28)
            love.graphics.setLineWidth(2)
            love.graphics.setColor(r, g, b, 0.68 * fade)
            love.graphics.circle("line", effect.x, effect.y, effect.radius * (1 - 0.65 * fade), 28)
        else
            love.graphics.setLineWidth(3)
            love.graphics.setColor(r, g, b, 0.78 * fade)
            love.graphics.line(effect.x, effect.y, effect.tx, effect.ty)
            love.graphics.rectangle("fill", effect.tx - 3, effect.ty - 3, 6, 6)
        end
    end
end

return Roles
