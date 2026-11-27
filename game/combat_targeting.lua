local Targeting = {}

function Targeting.nearest(targets, x, y, reach)
    local nearest
    local minimum = math.huge
    for _, target in ipairs(targets) do
        if target.hp > 0 then
            local dx, dy = target.x - x, target.y - y
            local distance = dx * dx + dy * dy
            local range = reach and reach + target.radius
            if distance < minimum and (not range or distance <= range * range) then
                nearest, minimum = target, distance
            end
        end
    end
    if nearest then return nearest, math.sqrt(minimum) end
end

return Targeting
