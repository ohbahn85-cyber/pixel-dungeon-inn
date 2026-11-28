local Melee = require("melee_attack")
local Starter = {}

local directions = { "down", "left", "right", "up" }
local directionKeys = {
    s = "down", down = "down",
    a = "left", left = "left",
    d = "right", right = "right",
    w = "up", up = "up",
}
local width, height = 120, 144
local originX, originY = 60, 134
local artScale = 0.4
local walkFrames, distancePerFrame = 4, 10
local image, club
local portraits, walking = {}, {}
local grips = {
    down = {{77, 108}, {77, 98}, {77, 100}, {83, 98}, {77, 100}},
    left = {{48, 107}, {38, 100}, {52, 101}, {39, 98}, {52, 101}},
    right = {{72, 107}, {82, 97}, {65, 101}, {81, 97}, {65, 101}},
    up = {{77, 107}, {81, 96}, {77, 99}, {79, 101}, {77, 101}},
}

function Starter.load()
    image = love.graphics.newImage("assets/starter_character.png")
    local imageWidth, imageHeight = image:getDimensions()
    club = love.graphics.newImage("assets/starter_club.png")
    for i, direction in ipairs(directions) do
        portraits[direction] = love.graphics.newQuad((i - 1) * width, 0, width, height, imageWidth, imageHeight)
        walking[direction] = {}
        for frame = 0, walkFrames do
            walking[direction][frame] = love.graphics.newQuad(frame * width, i * height, width, height, imageWidth, imageHeight)
        end
    end
end

function Starter.directionForKey(key)
    return directionKeys[key]
end

function Starter.movementInput()
    local x, y = 0, 0
    if love.keyboard.isDown("a", "left") then x = x - 1 end
    if love.keyboard.isDown("d", "right") then x = x + 1 end
    if love.keyboard.isDown("w", "up") then y = y - 1 end
    if love.keyboard.isDown("s", "down") then y = y + 1 end
    local length = math.sqrt(x * x + y * y)
    if length > 0 then return x / length, y / length end
    return 0, 0
end

function Starter.facing(x, y, preferred)
    local horizontal = x < 0 and "left" or x > 0 and "right"
    local vertical = y < 0 and "up" or y > 0 and "down"
    if preferred == horizontal or preferred == vertical then return preferred end
    return horizontal or vertical or preferred
end

function Starter.attackFacing(x, y, fallback)
    if x == 0 and y == 0 then return fallback end
    if math.abs(x) >= math.abs(y) then
        return x < 0 and "left" or "right"
    end
    return y < 0 and "up" or "down"
end

function Starter.walkFrame(distance)
    return math.floor(distance / distancePerFrame) % walkFrames + 1
end

function Starter.drawPortrait(direction, x, y, scale)
    scale = scale * artScale
    love.graphics.draw(image, portraits[direction], x, y, 0, scale, scale, originX, originY)
end

function Starter.drawClub(x, y, angle, scale)
    scale = scale * artScale
    love.graphics.draw(club, x, y, angle + math.pi / 2, scale, scale, 7, 30)
end

function Starter.drawArmed(direction, frame, x, y, scale, attack, drawWeapon)
    local angle, lean = Melee.pose(attack, direction)
    local grip = grips[direction][frame + 1]
    local bodyScale = scale * artScale
    local gripX, gripY = (grip[1] - originX) * bodyScale, (grip[2] - originY) * bodyScale
    local cos, sin = math.cos(lean), math.sin(lean)
    local handX, handY = x + gripX * cos - gripY * sin, y + gripX * sin + gripY * cos
    local weapon = drawWeapon or Starter.drawClub
    local behind = direction == "up" and math.sin(angle) < -0.5
    if behind then weapon(handX, handY, angle, scale) end
    love.graphics.draw(image, walking[direction][frame], x, y, lean, bodyScale, bodyScale, originX, originY)
    if not behind then weapon(handX, handY, angle, scale) end
end

return Starter
