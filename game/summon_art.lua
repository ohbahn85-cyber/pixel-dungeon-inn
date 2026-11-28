local Catalog = require("summon_catalog")
local pivots = require("assets.summon_pivots")

local Art = {}
local bodies, equipment

local function loadAtlas(file, width, height, rows)
    local image = love.graphics.newImage("assets/" .. file)
    local quads = {}
    local w, h = image:getDimensions()
    for row = 0, rows - 1 do
        for column = 0, 3 do
            quads[#quads + 1] = love.graphics.newQuad(column * width, row * height, width, height, w, h)
        end
    end
    return { image = image, quads = quads }
end

function Art.load()
    bodies = loadAtlas("summon_ranks.png", 128, 112, 3)
    equipment = loadAtlas("summon_gear.png", 96, 96, 6)
end

function Art.draw(ring, x, y, height, facing, swing)
    local summon = Catalog[ring.id]
    local item = Catalog.equipment(ring)
    local hand, grip = pivots.body[ring.id], pivots.gear[item.id]
    local scale = height / 96
    local itemScale = item.height / 80
    local motion = swing or 0
    local offsetX, offsetY, angle = 0, 0, 0.29 + motion * 1.15
    if summon.family == "shield" then
        offsetX, offsetY, angle = 7 + motion * 3, 6, -motion * 0.25
    elseif summon.family == "archer" then
        offsetX, offsetY, angle = 4, 0, 0.16 + motion * 0.80
    end

    love.graphics.push()
    love.graphics.translate(x, y)
    love.graphics.scale(scale * (facing or 1), scale)
    love.graphics.rotate(motion * 0.13)
    love.graphics.draw(bodies.image, bodies.quads[ring.id], -64, -104)
    love.graphics.draw(equipment.image, equipment.quads[item.id],
        hand[1] - 64 + offsetX, hand[2] - 104 + offsetY,
        angle, itemScale, itemScale, grip[1], grip[2])
    love.graphics.pop()
end

return Art
