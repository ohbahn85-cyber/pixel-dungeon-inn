local Catalog = require("summon_catalog")
local pivots = require("assets.summon_pivots")
local anchors = require("assets.summon_attack_anchors")
local g = love.graphics

local Pose = {
    sword = {impact = 0.145, follow = 0.205, recover = 0.284, duration = 0.382, turn = 0.054},
    archer = {impact = 0.232, recover = 0.321, duration = 0.423, turn = 0.080},
}

local cellWidth, cellHeight, rootX, feetY, artHeight = 128, 112, 64, 104, 96
local nocks = {
    {45, 13, 35, 81}, {43, 13, 31, 80}, {42, 20, 32, 73}, {43, 17, 32, 82},
    {45, 17, 36, 77}, {42, 18, 31, 81}, {43, 17, 32, 77}, {43, 20, 34, 76},
}
local gear, bodies, unstrung
local bodyQuads, handQuads = {}, {}

function Pose.load(equipment)
    gear = equipment
    bodies = g.newImage("assets/summon_attack_poses.png")
    local width, height = bodies:getDimensions()
    for row, points in ipairs(anchors) do
        bodyQuads[row], handQuads[row] = {}, {}
        for frame, hand in ipairs(points) do
            local x, y = (frame - 1) * cellWidth, (row - 1) * cellHeight
            bodyQuads[row][frame] = g.newQuad(x, y, cellWidth, cellHeight, width, height)
            if row > 4 then
                handQuads[row][frame] = g.newQuad(x + hand[1] - 4, y + hand[2] - 4, 9, 9, width, height)
            end
        end
    end

    -- Remove the idle texture's string so the draw hand can shape the combat string.
    local data = love.image.newImageData("assets/summon_gear.png")
    for index, nock in ipairs(nocks) do
        local left = (index - 1) % 4 * 96
        local top = (4 + math.floor((index - 1) / 4)) * 96
        for y = nock[2] + 3, nock[4] - 3 do
            local progress = (y - nock[2]) / (nock[4] - nock[2])
            local x = math.floor(nock[1] + (nock[3] - nock[1]) * progress + 0.5)
            for column = x - 2, x + 2 do data:setPixel(left + column, top + y, 0, 0, 0, 0) end
        end
    end
    unstrung = g.newImage(data)
end

local function attackFrame(family, elapsed)
    if elapsed < 0.031 then return 1 end
    local timing = Pose[family]
    if family == "sword" then
        if elapsed < timing.impact then return 2 end
        if elapsed < timing.follow then return 3 end
    else
        if elapsed < 0.103 then return 2 end
        if elapsed < timing.impact then return 3 end
    end
    if elapsed < timing.recover then return 4 end
    return 5
end

local function interpolate(elapsed, start, finish, a, b)
    local progress = math.max(0, math.min(1, (elapsed - start) / (finish - start)))
    return a + (b - a) * progress
end

local function weaponAngle(family, frame, elapsed, aim)
    if family == "archer" then
        if frame == 1 then return 0.40 end
        if frame == 5 then return interpolate(elapsed, Pose.archer.recover, Pose.archer.duration, aim, 0.40) end
        return aim
    end
    local timing = Pose.sword
    if frame == 2 then return interpolate(elapsed, 0.031, timing.impact, 3.66, 4.71) + aim * 0.50 end
    if frame == 3 then return interpolate(elapsed, timing.impact, timing.follow, -0.12, 0.48) + aim end
    if frame == 4 then return interpolate(elapsed, timing.follow, timing.recover, 1.01, 1.37) + aim * 0.45 end
    return 2.56
end

local function poseAt(meta, attack)
    local elapsed = attack and attack.elapsed or 0
    local archery = meta.family == "archer"
    local row = meta.rank + (archery and 4 or 0)
    local frame = attackFrame(meta.family, elapsed)
    local aim = 0
    if attack then
        local pitch = math.atan2(math.sin(attack.angle), math.abs(math.cos(attack.angle)))
        aim = math.max(-0.37, math.min(0.37, pitch))
    end
    return row, frame, anchors[row][frame], weaponAngle(meta.family, frame, elapsed, aim)
end

local function bowPoint(x, y, angle, dx, dy)
    return x + math.cos(angle) * dx - math.sin(angle) * dy,
        y + math.sin(angle) * dx + math.cos(angle) * dy
end

local function arrowPoint(hand, angle)
    return bowPoint(hand[1], hand[2], angle, 8, 0)
end

function Pose.arrowOrigin(ring, x, y, height, facing, attack)
    local _, _, hand, angle = poseAt(Catalog[ring.id], attack)
    local tipX, tipY = arrowPoint(hand, angle)
    local scale = height / artHeight
    return x + (tipX - rootX) * scale * facing, y + (tipY - feetY) * scale
end

local function drawBow(item, hand, angle, elapsed, tint)
    local x, y = hand[1], hand[2]
    local nock, grip = nocks[item.id - 16], pivots.gear[item.id]
    local scale = item.height / 80
    local topX, topY = bowPoint(x, y, angle, (nock[1] - grip[1]) * scale, (nock[2] - grip[2]) * scale)
    local bottomX, bottomY = bowPoint(x, y, angle, (nock[3] - grip[1]) * scale, (nock[4] - grip[2]) * scale)
    local stringX, stringY = (topX + bottomX) / 2, (topY + bottomY) / 2
    local drawn = elapsed >= 0.057 and elapsed < Pose.archer.impact
    if drawn then
        stringX = interpolate(elapsed, 0.057, 0.094, stringX, hand[3])
        stringY = interpolate(elapsed, 0.057, 0.094, stringY, hand[4])
    elseif elapsed >= Pose.archer.impact and elapsed < Pose.archer.impact + 0.045 then
        stringX = stringX + interpolate(elapsed, Pose.archer.impact, Pose.archer.impact + 0.045, 3, 0)
    end

    g.setColor(0.84, 0.73, 0.56, 0.9)
    g.setLineWidth(1.8)
    g.line(topX, topY, stringX, stringY, bottomX, bottomY)
    g.setColor(tint)
    g.draw(unstrung, gear.quads[item.id], x, y, angle, scale, scale, grip[1], grip[2])
    if drawn then
        local tipX, tipY = arrowPoint(hand, angle)
        g.setColor(1, 0.91, 0.68)
        g.setLineWidth(1.9)
        g.line(stringX, stringY, tipX, tipY)
    end
    g.setColor(tint)
end

local function trail(x, y, edgeAngle, length, elapsed, tint)
    local alpha = 1 - (elapsed - Pose.sword.impact) / 0.089
    if alpha <= 0 or alpha > 1 then return end
    g.setColor(1, 0.90, 0.72, 0.54 * alpha)
    g.setLineWidth(2.8)
    g.arc("line", "open", x, y, length, edgeAngle - 0.76, edgeAngle, 8)
    g.setColor(tint)
end

function Pose.draw(ring, x, y, height, facing, attack)
    local meta, item = Catalog[ring.id], Catalog.equipment(ring)
    local row, frame, hand, angle = poseAt(meta, attack)
    local tint = {g.getColor()}
    local elapsed = attack and attack.elapsed or 0
    local scale = height / artHeight

    g.push("all")
    g.translate(x, y)
    g.scale(scale * facing, scale)
    g.translate(-rootX, -feetY)
    if meta.family == "archer" then
        g.draw(bodies, bodyQuads[row][frame], 0, 0)
        drawBow(item, hand, angle, elapsed, tint)
        g.draw(bodies, handQuads[row][frame], hand[1] - 4, hand[2] - 4)
    else
        local grip = pivots.gear[item.id]
        local itemScale = item.height / 80
        trail(hand[1], hand[2], angle, item.height * 0.74, elapsed, tint)
        g.draw(gear.image, gear.quads[item.id], hand[1], hand[2], angle - 2.35, itemScale, itemScale, grip[1], grip[2])
        g.draw(bodies, bodyQuads[row][frame], 0, 0)
    end
    g.pop()
end

return Pose
