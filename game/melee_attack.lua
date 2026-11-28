local Targeting = require("combat_targeting")

local Melee = { impact = 0.105, finish = 0.245 }
local halfWidth = 1.45
local releaseEnd, trailDuration = 0.169, 0.092
local windupAngle, releaseAngle = -1.28, 1.30
local directions = { down = 1.29, left = 2.64, right = 0.50, up = -0.94 }

local function angleDifference(from, to)
    return math.atan2(math.sin(to - from), math.cos(to - from))
end

local function smoothstep(t)
    return t * t * (3 - 2 * t)
end

local function releaseOffset(progress)
    return releaseAngle * (1 - (1 - progress)^2)
end

local function targetAngle(x, y, target, fallback)
    if target.x == x and target.y == y then return fallback end
    return math.atan2(target.y - y, target.x - x)
end

function Melee.start(x, y, target, direction)
    local angle = targetAngle(x, y, target, directions[direction])
    return { angle = angle, elapsed = 0, target = target, side = math.cos(angle) < 0 and -1 or 1 }
end

function Melee.advance(attack, dt, x, y, targets, reach)
    if not attack then return nil end
    local nextElapsed = attack.elapsed + dt
    local windingUp = attack.elapsed < Melee.impact
    if windingUp then
        local target = attack.target
        local distance = (target.x - x)^2 + (target.y - y)^2
        if target.hp <= 0 or distance > (reach + target.radius)^2 then
            target = Targeting.nearest(targets, x, y, reach)
        end
        if target then
            local aim = targetAngle(x, y, target, attack.angle)
            local difference = angleDifference(attack.angle, aim)
            local step = 16 * math.min(dt, Melee.impact - attack.elapsed)
            attack.angle = attack.angle + math.max(-step, math.min(step, difference))
            attack.target = target
        end
    end
    attack.elapsed = nextElapsed
    local impact = windingUp and nextElapsed >= Melee.impact and attack or nil
    if nextElapsed >= Melee.finish then return nil, impact end
    return attack, impact
end

function Melee.contains(attack, x, y, target, reach)
    local dx, dy = target.x - x, target.y - y
    return dx * dx + dy * dy <= (reach + target.radius)^2
        and (dx == 0 and dy == 0 or math.abs(angleDifference(attack.angle, math.atan2(dy, dx))) <= halfWidth)
end

function Melee.pose(attack, direction)
    local resting = directions[direction]
    if not attack then return resting, 0 end
    local t = attack.elapsed
    local offset
    if t < Melee.impact then
        local progress = t / Melee.impact
        if progress < 0.53 then
            local cocked = attack.angle + attack.side * windupAngle
            local ramp = smoothstep(progress / 0.53)
            return resting + angleDifference(resting, cocked) * ramp, -0.036 * attack.side * ramp
        end
        offset = windupAngle * (1 - ((progress - 0.53) / 0.47)^2)
    elseif t < releaseEnd then
        local progress = (t - Melee.impact) / (releaseEnd - Melee.impact)
        offset = releaseOffset(progress)
    else
        local progress = math.min(1, (t - releaseEnd) / (Melee.finish - releaseEnd))
        local endAngle = attack.angle + attack.side * releaseAngle
        return endAngle + angleDifference(endAngle, resting) * smoothstep(progress),
            0.047 * attack.side * (1 - progress)
    end
    local lean = -0.036 + 0.083 * (offset - windupAngle) / (releaseAngle - windupAngle)
    return attack.angle + attack.side * offset, lean * attack.side
end

function Melee.drawTrail(attack, x, y, reach, color)
    if not attack then return end
    local elapsed = attack.elapsed - Melee.impact
    if elapsed < 0 or elapsed >= trailDuration then return end

    local g = love.graphics
    local fade = 1 - elapsed / trailDuration
    local progress = math.min(1, elapsed / (releaseEnd - Melee.impact))
    local tip = attack.angle + attack.side * releaseOffset(progress)
    local radius = reach * (0.91 + 0.09 * progress)
    local span = 1.00 + progress * 0.28
    local lastX, lastY, lastInnerX, lastInnerY
    for index = 0, 10 do
        local part = index / 10
        local angle = tip - (1 - part) * span * attack.side
        local dx, dy = math.cos(angle), math.sin(angle)
        local thickness = 1.3 + 5.2 * math.sin(math.pi * part)
        local outer = radius - 5 * (1 - part)
        local ox, oy = x + dx * outer, y + dy * outer
        local ix, iy = x + dx * (outer - thickness), y + dy * (outer - thickness)
        if lastX then
            g.setColor(color[1], color[2], color[3], fade * (0.14 + 0.53 * part))
            g.polygon("fill", lastX, lastY, ox, oy, ix, iy, lastInnerX, lastInnerY)
            if index >= 6 then
                g.setLineWidth(1.4)
                g.setColor(1, 0.96, 0.86, fade * 0.88)
                g.line(lastX, lastY, ox, oy)
            end
        end
        lastX, lastY, lastInnerX, lastInnerY = ox, oy, ix, iy
    end
end

return Melee
