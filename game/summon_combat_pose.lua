local Catalog = require("summon_catalog")
local pivots = require("assets.summon_pivots")
local g = love.graphics

local Pose = {
    sword = {impact = 0.115, duration = 0.285},
    archer = {impact = 0.185, duration = 0.335},
}

-- Coordinates on the 128 × 112 torso cell, facing screen right.
local shoulders = {
    {52, 45, 73, 45}, {51, 46, 74, 45}, {52, 48, 78, 47}, {62, 51, 86, 49},
    {50, 48, 75, 47}, {51, 48, 76, 47}, {55, 49, 83, 49}, {62, 51, 89, 49},
}
-- Top and bottom nock positions on the eight 96 × 96 bow cells.
local nocks = {
    {45, 13, 35, 81}, {43, 13, 31, 80}, {42, 20, 32, 73}, {43, 17, 32, 82},
    {45, 17, 36, 77}, {42, 18, 31, 81}, {43, 17, 32, 77}, {43, 20, 34, 76},
}

-- Time, near hand offset, far hand offset, blade angle or bow cant.
local swordKeys = {
    {0, -9, 29, 7, 26, 2.53},
    {0.064, -22, -15, 11, 16, 3.94},
    {Pose.sword.impact, 29, 8, 9, 24, 6.00},
    {0.168, 23, 21, 4, 27, 7.18},
    {Pose.sword.duration, -9, 29, 7, 26, 8.81},
}
local bowKeys = {
    {0, -5, 28, 9, 24, 0.34},
    {0.068, 24, 12, 14, 10, 0.02},
    {0.151, 11, 4, 28, 7, 0},
    {Pose.archer.impact, 11, 4, 28, 7, 0},
    {0.225, -2, 5, 29, 8, 0.09},
    {Pose.archer.duration, -5, 28, 9, 24, 0.34},
}

local gear, torsos, limbs, unstrung
local torsoQuads, limbQuads = {}, {}

function Pose.load(equipment)
    gear = equipment
    torsos = g.newImage("assets/summon_torsos.png")
    limbs = g.newImage("assets/summon_limbs.png")
    for i = 1, 8 do
        torsoQuads[i] = g.newQuad((i - 1) % 4 * 128, math.floor((i - 1) / 4) * 112, 128, 112, torsos:getDimensions())
        limbQuads[i] = {}
        for segment = 1, 3 do
            limbQuads[i][segment] = g.newQuad((segment - 1) * 16, (i - 1) * 24, 16, 24, limbs:getDimensions())
        end
    end

    -- The stock bow art includes a static string. Clear just that stroke on the combat texture.
    local data = love.image.newImageData("assets/summon_gear.png")
    for index, nock in ipairs(nocks) do
        local left = (index - 1) % 4 * 96
        local top = (4 + math.floor((index - 1) / 4)) * 96
        for y = nock[2] + 3, nock[4] - 3 do
            local progress = (y - nock[2]) / (nock[4] - nock[2])
            local x = math.floor(nock[1] + (nock[3] - nock[1]) * progress + 0.5)
            for column = x - 2, x + 2 do
                data:setPixel(left + column, top + y, 0, 0, 0, 0)
            end
        end
    end
    unstrung = g.newImage(data)
end

local function sample(keys, elapsed)
    for i = 2, #keys do
        local b = keys[i]
        if elapsed <= b[1] then
            local a = keys[i - 1]
            local t = (elapsed - a[1]) / (b[1] - a[1])
            t = t * t * (3 - 2 * t)
            return a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t,
                a[4] + (b[4] - a[4]) * t, a[5] + (b[5] - a[5]) * t, a[6] + (b[6] - a[6]) * t
        end
    end
    local frame = keys[1]
    return frame[2], frame[3], frame[4], frame[5], frame[6]
end

local function arm(x, y, dx, dy, bend)
    local upper, lower = 16, 16
    local distance = math.max(0.01, math.sqrt(dx * dx + dy * dy))
    local reach = math.min(upper + lower - 0.25, distance)
    local vx, vy = dx / distance, dy / distance
    local midpoint = reach / 2
    local turn = bend * math.sqrt(upper * upper - midpoint * midpoint)
    return x + vx * midpoint - vy * turn, y + vy * midpoint + vx * turn,
        x + vx * reach, y + vy * reach
end

local function animatedArms(meta, attack)
    local archery = meta.family == "archer"
    local index = meta.rank + (archery and 4 or 0)
    local elapsed = attack and attack.elapsed or 0
    local nx, ny, fx, fy, angle = sample(archery and bowKeys or swordKeys, elapsed)
    if attack then
        local pitch = math.atan2(math.sin(attack.angle), math.abs(math.cos(attack.angle)))
        pitch = math.max(-0.49, math.min(0.49, pitch))
        local wind = math.min(1, elapsed / 0.06, ((archery and Pose.archer.duration or Pose.sword.duration) - elapsed) / 0.08)
        ny, fy, angle = ny + pitch * 17 * wind, fy + pitch * 22 * wind, angle + pitch * wind
    end

    local shoulder = shoulders[index]
    local elbowX, elbowY, handX, handY = arm(shoulder[1], shoulder[2], nx, ny, -1)
    local farElbowX, farElbowY, farHandX, farHandY = arm(shoulder[3], shoulder[4], fx, fy, 1)
    return index, shoulder, elbowX, elbowY, handX, handY, farElbowX, farElbowY, farHandX, farHandY, angle
end

local function segment(index, part, x, y, endX, endY)
    local dx, dy = endX - x, endY - y
    g.draw(limbs, limbQuads[index][part], x, y, math.atan2(dy, dx) - math.pi / 2,
        1, math.sqrt(dx * dx + dy * dy) / 19, 8, 2)
end

local function limb(index, x, y, elbowX, elbowY, handX, handY)
    segment(index, 1, x, y, elbowX, elbowY)
    segment(index, 2, elbowX, elbowY, handX, handY)
end

local function fist(index, x, y, angle)
    g.draw(limbs, limbQuads[index][3], x, y, angle, 1, 1, 8, 12)
end

local function bowPoint(x, y, angle, dx, dy)
    return x + math.cos(angle) * dx - math.sin(angle) * dy, y + math.sin(angle) * dx + math.cos(angle) * dy
end

function Pose.arrowOrigin(ring, x, y, height, facing, attack)
    local _, _, _, _, _, _, _, _, bowX, bowY, angle = animatedArms(Catalog[ring.id], attack)
    local tipX, tipY = bowPoint(bowX, bowY, angle, 8, 0)
    local scale = height / 96
    return x + (tipX - 64) * scale * facing, y + (tipY - 104) * scale
end

local function drawBow(item, index, x, y, angle, drawX, drawY, attack, tint)
    local nock = nocks[item.id - 16]
    local grip = pivots.gear[item.id]
    local scale = item.height / 80
    local topX, topY = bowPoint(x, y, angle, (nock[1] - grip[1]) * scale, (nock[2] - grip[2]) * scale)
    local bottomX, bottomY = bowPoint(x, y, angle, (nock[3] - grip[1]) * scale, (nock[4] - grip[2]) * scale)
    local tautX, tautY = (topX + bottomX) / 2, (topY + bottomY) / 2
    local elapsed = attack and attack.elapsed or 0
    local drawn = elapsed >= 0.068 and elapsed < Pose.archer.impact
    local snap = elapsed >= Pose.archer.impact and elapsed < Pose.archer.impact + 0.042

    if drawn then
        local t = math.min(1, (elapsed - 0.068) / 0.031)
        tautX, tautY = tautX + (drawX - tautX) * t, tautY + (drawY - tautY) * t
    elseif snap then
        tautX = tautX + 3 * (1 - (elapsed - Pose.archer.impact) / 0.042)
    end
    g.setColor(0.91, 0.82, 0.64, 0.9)
    g.setLineWidth(2.15)
    g.line(topX, topY, tautX, tautY, bottomX, bottomY)
    g.setColor(tint)
    g.draw(unstrung, gear.quads[item.id], x, y, angle, scale, scale, grip[1], grip[2])
    if drawn then
        local tipX, tipY = bowPoint(x, y, angle, 8, 0)
        g.setColor(1, 0.93, 0.72)
        g.setLineWidth(2.5)
        g.line(tautX, tautY, tipX, tipY)
    end
    g.setColor(tint)
    fist(index, x, y, angle)
end

local function trail(x, y, edgeAngle, length, elapsed, tint)
    local remaining = 1 - (elapsed - Pose.sword.impact) / 0.09
    if remaining <= 0 or remaining > 1 then return end
    g.setColor(1, 0.90, 0.72, 0.66 * remaining)
    g.setLineWidth(3.7)
    g.arc("line", "open", x, y, length, edgeAngle - 0.78, edgeAngle, 8)
    g.setColor(tint)
end

function Pose.draw(ring, x, y, height, facing, attack)
    local meta = Catalog[ring.id]
    local item = Catalog.equipment(ring)
    local index, shoulder, ex, ey, hx, hy, fx, fy, bx, by, angle = animatedArms(meta, attack)
    local red, green, blue, alpha = g.getColor()
    local tint = {red, green, blue, alpha}
    local scale = height / 96

    g.push("all")
    g.translate(x, y)
    g.scale(scale * facing, scale)
    g.translate(-64, -104)
    limb(index, shoulder[3], shoulder[4], fx, fy, bx, by)
    g.draw(torsos, torsoQuads[index], 0, 0)
    if meta.family == "archer" then
        drawBow(item, index, bx, by, angle, hx, hy, attack, tint)
        limb(index, shoulder[1], shoulder[2], ex, ey, hx, hy)
        fist(index, hx, hy, angle)
    else
        fist(index, bx, by, 0)
        limb(index, shoulder[1], shoulder[2], ex, ey, hx, hy)
        local grip = pivots.gear[item.id]
        local itemScale = item.height / 80
        if attack then trail(hx, hy, angle, item.height * 0.74, attack.elapsed, tint) end
        g.draw(gear.image, gear.quads[item.id], hx, hy, angle - 2.35, itemScale, itemScale, grip[1], grip[2])
        fist(index, hx, hy, angle)
    end
    g.pop()
end

return Pose
