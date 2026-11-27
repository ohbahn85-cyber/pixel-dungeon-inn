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
local walkFrames = 8
local image
local portraits, standing, walking = {}, {}, {}

local columns = { 0, 20, 30, 38, 44, 50, 56, 60, 64, 70, 76, 82, 90, 100, width }
local rows = { 0, 100, 104, 109, 114, 118, 122, 126, 130, 134, height }

local function ramp(value, start, stop)
    return math.max(0, math.min(1, (value - start) / (stop - start)))
end

local function limbOffset(direction, x, y, stride, lift)
    if direction == "left" or direction == "right" then
        local facing = direction == "right" and 1 or -1
        local forward = (x - originX) * facing
        local nearFoot = ramp(y, 119, 130)
        local farFoot = ramp(y, 110, 117) * (1 - ramp(y, 121, 126)) * ramp(forward, 4, 15)
        local arm = ramp(y, 101, 117) * (1 - ramp(y, 121, 129)) * (1 - ramp(forward, 1, 9))
        local dx = facing * (6 * nearFoot - 6 * farFoot - 3 * arm) * stride
        local dy = -2.4 * (nearFoot * math.max(0, lift) + farFoot * math.max(0, -lift))
        return dx, dy
    end

    local side = ramp(x, 48, 72) * 2 - 1
    local feet = ramp(y, 117, 131)
    local arms = ramp(y, 101, 116) * (1 - ramp(y, 121, 126)) * ramp(math.abs(x - originX), 14, 28)
    local forward = direction == "down" and 1 or -1
    local dy = forward * side * stride * (5 * feet - 3 * arms)
    return 0, dy - 2 * feet * math.max(0, side * lift)
end

local function walkPose(direction, frame, cellX, imageWidth, imageHeight)
    local phase = (frame - 1) * 2 * math.pi / walkFrames
    local stride, lift = math.cos(phase), math.sin(phase)
    local bob = math.cos(2 * phase)
    local vertices, indices = {}, {}

    -- The hood and face share one rigid region above the shoulder line.
    -- Only the grid below it articulates the original arms and feet.
    for _, y in ipairs(rows) do
        for _, x in ipairs(columns) do
            local dx, dy = limbOffset(direction, x, y, stride, lift)
            vertices[#vertices + 1] = {
                x + dx, y + dy + bob,
                (cellX + x) / imageWidth, (height + y) / imageHeight,
            }
        end
    end

    for row = 1, #rows - 1 do
        for col = 1, #columns - 1 do
            local a = (row - 1) * #columns + col
            local b, c = a + 1, a + #columns
            local d = c + 1
            indices[#indices + 1] = a
            indices[#indices + 1] = b
            indices[#indices + 1] = c
            indices[#indices + 1] = b
            indices[#indices + 1] = d
            indices[#indices + 1] = c
        end
    end

    local mesh = love.graphics.newMesh(vertices, "triangles", "static")
    mesh:setVertexMap(indices)
    mesh:setTexture(image)
    return mesh
end

function Starter.load()
    image = love.graphics.newImage("assets/starter_character.png")
    local imageWidth, imageHeight = image:getDimensions()
    for i, direction in ipairs(directions) do
        local cellX = (i - 1) * width
        portraits[direction] = love.graphics.newQuad(cellX, 0, width, height, imageWidth, imageHeight)
        standing[direction] = love.graphics.newQuad(cellX, height, width, height, imageWidth, imageHeight)
        walking[direction] = {}
        for frame = 1, walkFrames do
            walking[direction][frame] = walkPose(direction, frame, cellX, imageWidth, imageHeight)
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
    return math.floor(distance / 4.5) % walkFrames + 1
end

function Starter.drawPortrait(direction, x, y, scale)
    scale = scale * artScale
    love.graphics.draw(image, portraits[direction], x, y, 0, scale, scale, originX, originY)
end

function Starter.drawWalk(direction, frame, x, y, scale)
    scale = scale * artScale
    if frame == 0 then
        love.graphics.draw(image, standing[direction], x, y, 0, scale, scale, originX, originY)
    else
        love.graphics.draw(walking[direction][frame], x, y, 0, scale, scale, originX, originY)
    end
end

return Starter
