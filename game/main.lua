-- New LÖVE (Love2D) + Lua Blank Starter

function love.load()
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.09, 0.09, 0.12)
end

function love.update(dt)
end

function love.draw()
    love.graphics.setColor(0.95, 0.96, 0.98, 1)
    love.graphics.printf("LOVE2D (11.3) + LUA — CLEAN SLATE READY", 0, 240, 960, "center")
    love.graphics.setColor(0.60, 0.65, 0.75, 1)
    love.graphics.printf("Ready to build a brand new game from scratch.", 0, 270, 960, "center")
end
