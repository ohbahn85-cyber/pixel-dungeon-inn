local Fire = {}
local flightTime, burnInterval = 0.25, 0.50

local function distanceSquared(a, b)
    return (a.x - b.x)^2 + (a.y - b.y)^2
end

function Fire.new()
    return { embers = {}, patches = {}, clock = 0 }
end

function Fire.cast(state, caster, target, enemies, damage)
    local spell, stats = caster.meta.fire, caster.slot.stats
    local radius = spell.radius * (1 + stats.radius)
    local bestScore, bestDistance = -1, math.huge
    local center = target
    for _, enemy in ipairs(enemies) do
        local distance = distanceSquared(caster, enemy)
        if enemy.hp > 0 and distance <= (caster.meta.reach + enemy.radius)^2 then
            local score = 0
            for _, neighbor in ipairs(enemies) do
                if neighbor.hp > 0 and distanceSquared(enemy, neighbor) <= radius^2 then
                    score = score + (neighbor.burning and 1 or 2)
                end
            end
            if score > bestScore or (score == bestScore and distance < bestDistance) then
                center, bestScore, bestDistance = enemy, score, distance
            end
        end
    end
    state.embers[#state.embers + 1] = {
        x = center.x, y = center.y,
        startX = caster.x, startY = caster.y - 26, remaining = flightTime,
        caster = caster, color = spell.color, radius = radius, damage = damage,
        life = spell.duration + stats.duration, slow = spell.slow or 0, spread = spell.spread,
    }
    return center
end

function Fire.update(state, enemies, dt, hit)
    state.clock = state.clock + dt
    local patches, embers = state.patches, state.embers
    local hadPatches = #patches > 0
    for i = #patches, 1, -1 do
        local patch = patches[i]
        patch.life = patch.life - dt
        if patch.life <= 0 then table.remove(patches, i) end
    end
    for i = #embers, 1, -1 do
        local ember = embers[i]
        ember.remaining = ember.remaining - dt
        if ember.remaining <= 0 then
            patches[#patches + 1] = ember
            table.remove(embers, i)
        end
    end
    if not hadPatches and #patches == 0 then return end

    local count = #patches
    for _, enemy in ipairs(enemies) do
        local hottest
        enemy.burnSlow = 0
        if enemy.hp > 0 then
            for index = 1, count do
                local patch = patches[index]
                if distanceSquared(patch, enemy) <= patch.radius^2 then
                    enemy.burnSlow = math.max(enemy.burnSlow, patch.slow)
                    if not hottest or patch.damage > hottest.damage
                        or (patch.damage == hottest.damage and patch.spread) then
                        hottest = patch
                    end
                end
            end
        end
        enemy.burning = hottest ~= nil
        if hottest and state.clock >= (enemy.nextBurn or 0) then
            enemy.nextBurn = state.clock + burnInterval
            hit(hottest.caster, enemy, hottest.damage, hottest.color)
            if enemy.hp <= 0 and hottest.spread then
                hottest.spread = false
                patches[#patches + 1] = {
                    x = enemy.x, y = enemy.y, life = 1.35, radius = hottest.radius * 0.60,
                    caster = hottest.caster, color = hottest.color, slow = hottest.slow,
                    damage = math.max(1, math.floor(hottest.damage * 0.65)),
                }
            end
        end
    end
end

function Fire.drawPatches(state)
    for _, patch in ipairs(state.patches) do
        local red, green, blue = unpack(patch.color)
        local fade = math.min(1, patch.life * 4)
        local pulse = 0.75 + 0.25 * math.sin(state.clock * 12)
        love.graphics.setColor(red, green, blue, 0.20 * pulse * fade)
        love.graphics.circle("fill", patch.x, patch.y, patch.radius, 26)
        love.graphics.setLineWidth(2)
        love.graphics.setColor(red, green, blue, 0.70 * fade)
        love.graphics.circle("line", patch.x, patch.y, patch.radius, 26)
        for index = 1, 9 do
            local angle = index * 2.4 + math.sin(state.clock * 2 + index) * 0.17
            local radius = patch.radius * (0.52 + (index % 4) * 0.12)
            local x = math.floor(patch.x + math.cos(angle) * radius)
            local y = math.floor(patch.y + math.sin(angle) * radius)
            local height = 3 + math.floor(3 * (0.5 + math.sin(state.clock * 9 + index) * 0.5))
            love.graphics.rectangle("fill", x, y - height, 2, height)
            love.graphics.rectangle("fill", x - 2, y - 2, 2, 2)
        end
    end
end

function Fire.drawEmbers(state)
    for _, ember in ipairs(state.embers) do
        local t = 1 - ember.remaining / flightTime
        local x = ember.startX + t * (ember.x - ember.startX)
        local y = ember.startY + t * (ember.y - ember.startY) - 28 * math.sin(math.pi * t)
        love.graphics.setColor(ember.color)
        love.graphics.polygon("fill", x, y - 7, x + 6, y, x, y + 7, x - 6, y)
        love.graphics.setColor(1, 0.95, 0.82)
        love.graphics.rectangle("fill", x - 2, y - 2, 4, 4)
    end
end

return Fire
