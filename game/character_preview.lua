local Starter = require("starter_character")
local Targeting = require("combat_targeting")
local Preview = {}

local lg = love.graphics
local screen = "character"
local portraitDirection = "down"
local walker = { x = 240, y = 175, direction = "down", frame = 0, distance = 0, cooldown = 0 }
local preferredDirection = "down"
local room, headingFont, labelFont, smallFont

local width, height = 960, 540
local roomBounds = { left = 58, top = 98, right = 422, bottom = 237 }
local attackReach, attackCooldown = 31, 0.38
local trainingTargets = {
    { x = 146, y = 175, radius = 9, hp = 1, flash = 0 },
    { x = 318, y = 175, radius = 9, hp = 1, flash = 0 },
    { x = 347, y = 199, radius = 9, hp = 1, flash = 0 },
}
local tabs = {
    { id = "character", label = "Character", x = 512, width = 132 },
    { id = "dungeon", label = "Dungeon", x = 654, width = 132 },
    { id = "camp", label = "Camp", x = 814, width = 114 },
}
local views = {
    { id = "down", label = "Front", x = 598, y = 130 },
    { id = "up", label = "Back", x = 767, y = 130 },
    { id = "left", label = "Left", x = 598, y = 301 },
    { id = "right", label = "Right", x = 767, y = 301 },
}
local directionAngles = { down = math.pi / 2, up = -math.pi / 2, left = math.pi, right = 0 }
local directionLabels = { down = "Down", up = "Up", left = "Left", right = "Right" }

local color = {
    background = { 0.064, 0.068, 0.082 },
    surface = { 0.10, 0.106, 0.126 },
    raised = { 0.135, 0.142, 0.166 },
    line = { 0.217, 0.226, 0.258 },
    selected = { 0.195, 0.167, 0.136 },
    accent = { 0.88, 0.71, 0.48 },
    text = { 0.94, 0.91, 0.86 },
    muted = { 0.67, 0.69, 0.72 },
}

local function filled(tint, x, y, w, h, radius)
    lg.setColor(tint)
    lg.rectangle("fill", x, y, w, h, radius, radius)
end

local function panel(x, y, w, h, active)
    filled(active and color.selected or color.surface, x, y, w, h, 8)
    lg.setColor(active and color.accent or color.line)
    lg.rectangle("line", x + 0.5, y + 0.5, w - 1, h - 1, 8, 8)
end

local function text(value, font, tint, x, y)
    lg.setFont(font)
    lg.setColor(tint)
    lg.print(value, x, y)
end

local function centered(value, font, tint, x, y, w)
    lg.setFont(font)
    lg.setColor(tint)
    lg.printf(value, x, y, w, "center")
end

local function inside(x, y, left, top, w, h)
    return x >= left and x < left + w and y >= top and y < top + h
end

local function buildRoom()
    local previousCanvas = lg.getCanvas()
    lg.setCanvas(room)
    lg.clear(0.075, 0.074, 0.093, 1)
    filled({ 0.12, 0.115, 0.136 }, 35, 41, 410, 211)
    filled({ 0.23, 0.218, 0.238 }, 45, 42, 390, 40)
    filled({ 0.167, 0.158, 0.184 }, 46, 81, 388, 164)

    -- Staggered flagstones, with a small variation in texture and brightness.
    lg.setScissor(46, 82, 388, 164)
    for row = 0, 8 do
        for col = -1, 12 do
            local x = 46 + col * 36 + (row % 2) * 18
            local y = 82 + row * 20
            local variation = (col * 23 + row * 47) % 7 / 260
            local base = 0.19 + variation
            filled({ base, base - 0.012, base + 0.012 }, x, y, 35, 19)
            filled({ base + 0.037, base + 0.026, base + 0.047 }, x + 1, y + 1, 33, 1)
            filled({ base - 0.028, base - 0.038, base - 0.021 }, x + 2, y + 17, 32, 1)
            if (row * 5 + col * 7) % 4 == 0 then
                lg.setColor(base - 0.04, base - 0.05, base - 0.035)
                lg.line(x + 19, y + 8, x + 24, y + 8, x + 26, y + 10, x + 29, y + 10)
            end
        end
    end
    lg.setScissor()

    -- Dais, low masonry rails, and a closed doorway on the far wall.
    filled({ 0.122, 0.113, 0.135 }, 45, 42, 390, 16)
    for col = 0, 11 do
        local x = 47 + col * 32
        filled({ 0.281, 0.263, 0.286 }, x, 44, 30, 7)
        filled({ 0.203, 0.192, 0.219 }, x, 53, 30, 23)
        filled({ 0.237, 0.221, 0.247 }, x + 2, 54, 25, 1)
        filled({ 0.151, 0.142, 0.167 }, x, 75, 30, 3)
    end
    filled({ 0.33, 0.304, 0.316 }, 212, 51, 56, 33)
    filled({ 0.112, 0.104, 0.126 }, 217, 55, 46, 29)
    filled({ 0.147, 0.127, 0.141 }, 221, 57, 38, 26)
    for col = 0, 3 do
        filled({ 0.199, 0.166, 0.17 }, 222 + col * 9, 57, 1, 25)
    end
    filled({ 0.274, 0.245, 0.25 }, 207, 83, 66, 4)
    filled({ 0.236, 0.219, 0.231 }, 205, 87, 70, 4)
    filled({ 0.201, 0.177, 0.185 }, 206, 91, 68, 3)

    for _, x in ipairs({ 37, 432 }) do
        filled({ 0.288, 0.264, 0.282 }, x, 46, 11, 201)
        filled({ 0.212, 0.198, 0.220 }, x + 3, 49, 6, 194)
        for y = 52, 231, 20 do
            filled({ 0.146, 0.137, 0.16 }, x, y, 11, 2)
        end
    end
    filled({ 0.332, 0.296, 0.301 }, 37, 245, 406, 2)
    filled({ 0.262, 0.233, 0.248 }, 37, 247, 406, 4)
    filled({ 0.145, 0.131, 0.154 }, 38, 251, 404, 3)

    for _, x in ipairs({ 130, 350 }) do
        for radius = 38, 14, -4 do
            lg.setColor(0.89, 0.51, 0.24, 0.027)
            lg.ellipse("fill", x, 76, radius, radius * 0.64)
        end
        filled({ 0.43, 0.28, 0.20 }, x - 3, 63, 7, 11)
        filled({ 0.25, 0.18, 0.16 }, x - 5, 68, 11, 3)
    end

    lg.setCanvas(previousCanvas)
end

function Preview.load()
    headingFont = lg.newFont(28)
    labelFont = lg.newFont(16)
    smallFont = lg.newFont(13)
    for _, font in ipairs({ headingFont, labelFont, smallFont }) do
        font:setFilter("linear", "linear")
    end
    room = lg.newCanvas(width / 2, height / 2)
    room:setFilter("nearest", "nearest")
    buildRoom()
end

local function changeScreen(nextScreen)
    screen = nextScreen
    walker.frame, walker.distance, walker.cooldown = 0, 0, 0
    walker.attackElapsed, walker.attackTarget = nil, nil
    preferredDirection = walker.direction
    for _, target in ipairs(trainingTargets) do target.flash = 0 end
end

function Preview.open()
    changeScreen("character")
end

function Preview.keypressed(key)
    local direction = Starter.directionForKey(key)
    if screen == "character" then
        if direction then portraitDirection = direction end
        if key == "return" then changeScreen("dungeon") end
    elseif key == "escape" then
        changeScreen("character")
    elseif direction then
        preferredDirection = direction
    end
end

function Preview.mousepressed(x, y)
    for _, tab in ipairs(tabs) do
        if inside(x, y, tab.x, 13, tab.width, 39) then
            if tab.id == "camp" then return "camp" end
            if screen ~= tab.id then changeScreen(tab.id) end
            return
        end
    end
    if screen == "character" then
        for _, view in ipairs(views) do
            if inside(x, y, view.x, view.y, 155, 157) then portraitDirection = view.id end
        end
    end
end

function Preview.update(dt)
    if screen ~= "dungeon" then return end

    local dx, dy = Starter.movementInput()
    walker.direction = Starter.facing(dx, dy, preferredDirection)
    local x = math.max(roomBounds.left, math.min(roomBounds.right, walker.x + dx * 72 * dt))
    local y = math.max(roomBounds.top, math.min(roomBounds.bottom, walker.y + dy * 61 * dt))
    local movedX, movedY = x - walker.x, y - walker.y
    walker.x, walker.y = x, y
    local distance = math.sqrt(movedX * movedX + movedY * movedY)
    if distance > 0 then
        walker.distance = walker.distance + distance
        walker.frame = Starter.walkFrame(walker.distance)
    else
        walker.distance, walker.frame = 0, 0
    end
    if dx == 0 and dy == 0 then preferredDirection = walker.direction end

    for _, target in ipairs(trainingTargets) do
        target.flash = math.max(0, target.flash - dt)
    end

    if walker.attackElapsed then
        local elapsed = walker.attackElapsed + dt
        if walker.attackElapsed < Starter.attackWindup and elapsed >= Starter.attackWindup then
            local target = walker.attackTarget
            local ox, oy = target.x - walker.x, target.y - walker.y
            local reach = attackReach + target.radius
            if ox * ox + oy * oy <= reach * reach then target.flash = 0.14 end
        end
        if elapsed >= Starter.attackDuration then
            walker.attackElapsed, walker.attackTarget = nil, nil
        else
            walker.attackElapsed = elapsed
        end
    end

    walker.cooldown = math.max(0, walker.cooldown - dt)
    if walker.cooldown == 0 then
        local target = Targeting.nearest(trainingTargets, walker.x, walker.y, attackReach)
        if target then
            walker.attackTarget, walker.attackElapsed = target, 0
            walker.attackDirection = Starter.attackFacing(target.x - walker.x, target.y - walker.y, "right")
            walker.cooldown = attackCooldown
        end
    end
end

local function drawHeader()
    filled(color.background, 0, 0, width, 65)
    filled(color.line, 0, 64, width, 1)
    filled(color.accent, 30, 30, 8, 8)
    text("Pixel Dungeon Inn", labelFont, color.text, 49, 23)

    for _, tab in ipairs(tabs) do
        local selected = screen == tab.id
        panel(tab.x, 13, tab.width, 39, selected)
        centered(tab.label, labelFont, selected and color.accent or color.text,
            tab.x, 22, tab.width)
    end
end

local function drawCharacter()
    lg.clear(color.background[1], color.background[2], color.background[3], 1)
    panel(30, 86, 540, 422, false)
    filled(color.raised, 112, 153, 376, 294, 12)
    filled({ 0.117, 0.123, 0.145 }, 132, 173, 336, 254, 9)
    lg.setColor(0.083, 0.086, 0.101)
    lg.ellipse("fill", 300, 418, 76, 13)
    lg.setColor(0.102, 0.106, 0.121)
    lg.ellipse("fill", 300, 416, 58, 8)

    text("Necromancer", headingFont, color.text, 53, 104)
    lg.setColor(1, 1, 1, 1)
    Starter.drawPortrait(portraitDirection, 300, 416, 5)
    centered("Gray hoodie   /   Heart boxers   /   Bare feet", smallFont, color.muted, 45, 471, 510)

    text("View angle", labelFont, color.text, 598, 96)
    for _, view in ipairs(views) do
        local active = view.id == portraitDirection
        panel(view.x, view.y, 155, 157, active)
        lg.setColor(1, 1, 1, 1)
        Starter.drawPortrait(view.id, view.x + 78, view.y + 114, 2)
        centered(view.label, smallFont, active and color.accent or color.text,
            view.x, view.y + 128, 155)
    end
    text("WASD / Arrows   Rotate", smallFont, color.muted, 598, 477)
end

local function drawAttackTrail(x, y, direction, elapsed)
    local progress = (elapsed - Starter.attackWindup) / 0.115
    if progress < 0 or progress >= 1 then return end
    local angle = directionAngles[direction]
    local tip = angle - 0.15 + progress * 1.05
    lg.push()
    lg.translate(x, y - 18)
    lg.scale(1, 0.72)
    lg.setLineWidth(3)
    lg.setColor(0.87, 0.78, 0.65, (1 - progress) * 0.66)
    lg.arc("line", "open", 0, 0, 31, angle - 0.85, tip, 16)
    lg.setLineWidth(1)
    lg.setColor(1, 0.93, 0.79, (1 - progress) * 0.83)
    lg.arc("line", "open", 0, 0, 32, angle - 0.75, tip, 16)
    lg.pop()
end

local function drawTrainingTarget(target)
    local x, y = target.x, target.y
    local lit = target.flash > 0
    lg.setColor(0.09, 0.07, 0.08, 0.6)
    lg.ellipse("fill", x, y + 1, 11, 3)
    filled({ 0.21, 0.14, 0.12 }, x - 2, y - 16, 4, 16)
    filled({ 0.36, 0.24, 0.16 }, x - 6, y - 2, 12, 2)
    filled({ 0.18, 0.12, 0.11 }, x - 10, y - 28, 20, 18)
    filled(lit and { 0.92, 0.70, 0.48 } or { 0.54, 0.33, 0.20 }, x - 9, y - 27, 18, 16)
    filled({ 0.35, 0.22, 0.16 }, x - 7, y - 25, 14, 12)
    filled(lit and { 1.0, 0.94, 0.72 } or { 0.8, 0.45, 0.24 }, x - 5, y - 23, 10, 8)
    filled({ 0.44, 0.26, 0.19 }, x - 3, y - 21, 6, 4)
end

local function drawDungeon(time)
    lg.setColor(1, 1, 1, 1)
    lg.draw(room, 0, 0, 0, 2, 2)

    lg.push()
    lg.scale(2, 2)
    for index, x in ipairs({ 130, 350 }) do
        local flicker = math.floor(time * 8 + index * 3) % 4
        filled({ 0.68, 0.29, 0.13 }, x - 2, 58 - flicker, 5, 9 + flicker)
        filled({ 0.94, 0.56, 0.23 }, x - 1, 59 - flicker, 3, 7 + flicker)
        filled({ 1.0, 0.74, 0.36 }, x, 61 - flicker, 1, 5 + flicker)
    end
    for _, target in ipairs(trainingTargets) do
        if target.y <= walker.y then drawTrainingTarget(target) end
    end

    local x, y = math.floor(walker.x + 0.5), math.floor(walker.y + 0.5)
    lg.setColor(0.074, 0.065, 0.083, 0.60)
    lg.ellipse("fill", x, y + 1, 13, 4)
    if walker.attackElapsed then
        drawAttackTrail(x, y, walker.attackDirection, walker.attackElapsed)
        lg.setColor(1, 1, 1, 1)
        Starter.drawAttack(walker.attackDirection, walker.attackElapsed, x, y, 1)
    else
        lg.setColor(1, 1, 1, 1)
        Starter.drawWalk(walker.direction, walker.frame, x, y, 1)
    end

    for _, target in ipairs(trainingTargets) do
        if target.y > walker.y then drawTrainingTarget(target) end
    end
    lg.pop()

    filled(color.background, 0, 511, width, 29)
    text("WASD / Arrows   Walk", smallFont, color.text, 30, 518)
    text("Auto attack in range", smallFont, color.text, 218, 518)
    text("Esc   Character", smallFont, color.muted, 378, 518)
    local facing = walker.attackElapsed and walker.attackDirection or walker.direction
    text("Facing: " .. directionLabels[facing], smallFont, color.accent, 819, 518)
end

function Preview.draw(time)
    lg.push("all")
    if screen == "character" then drawCharacter() else drawDungeon(time) end
    drawHeader()
    lg.pop()
end

return Preview
