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
local image
local portraits, walking = {}, {}

function Starter.load()
    image = love.graphics.newImage("assets/starter_character.png")
    local imageWidth, imageHeight = image:getDimensions()
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

return Starter
