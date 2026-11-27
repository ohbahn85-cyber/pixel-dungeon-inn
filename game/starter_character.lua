local Starter = { attackDuration = 0.32, attackWindup = 0.085 }

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
local attackWidth, attackFrames = 176, 4
local image, attackImage
local portraits, walking, attacking = {}, {}, {}

function Starter.load()
    image = love.graphics.newImage("assets/starter_character.png")
    local imageWidth, imageHeight = image:getDimensions()
    attackImage = love.graphics.newImage("assets/starter_attack.png")
    local attackImageWidth, attackImageHeight = attackImage:getDimensions()
    for i, direction in ipairs(directions) do
        portraits[direction] = love.graphics.newQuad((i - 1) * width, 0, width, height, imageWidth, imageHeight)
        walking[direction] = {}
        for frame = 0, walkFrames do
            walking[direction][frame] = love.graphics.newQuad(frame * width, i * height, width, height, imageWidth, imageHeight)
        end
        attacking[direction] = {}
        for frame = 1, attackFrames do
            attacking[direction][frame] = love.graphics.newQuad((frame - 1) * attackWidth, (i - 1) * height,
                attackWidth, height, attackImageWidth, attackImageHeight)
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

function Starter.drawWalk(direction, frame, x, y, scale)
    scale = scale * artScale
    love.graphics.draw(image, walking[direction][frame], x, y, 0, scale, scale, originX, originY)
end

function Starter.drawAttack(direction, elapsed, x, y, scale)
    local frame = 4
    if elapsed < Starter.attackWindup then
        frame = 1
    elseif elapsed < 0.145 then
        frame = 2
    elseif elapsed < 0.235 then
        frame = 3
    end
    scale = scale * artScale
    love.graphics.draw(attackImage, attacking[direction][frame], x, y, 0,
        scale, scale, attackWidth / 2, originY)
end

return Starter
