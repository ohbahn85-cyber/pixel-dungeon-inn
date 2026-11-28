local Progress = {}

local upgrades = {
    { id = "weapon", name = "Heavy Swing", description = "Auto attacks deal 25% more base damage." },
    { id = "range", name = "Long Reach", description = "Add 12 to auto-attack reach." },
    { id = "speed", name = "Fleet Bones", description = "Increase base movement speed by 10%." },
    { id = "summon", name = "Legion Focus", description = "Summons deal 20% more base damage." },
    { id = "shot", name = "Silver Fletching", description = "Marked Shot bonus damage increases by 25% of base shot damage.", requires = "markedShot" },
    { id = "kindling", name = "Ember Edge", description = "Sword Skeletons deal another +15% damage to burning foes.", requires = "kindling" },
}

function Progress.new()
    return { level = 1, xp = 0, threshold = 6, ranks = {} }
end

function Progress.offer(run, synergies)
    if run.choices or run.xp < run.threshold then return end

    run.xp = run.xp - run.threshold
    run.threshold = run.threshold + 6
    run.level = run.level + 1

    local available, comboUpgrades = {}, {}
    for _, upgrade in ipairs(upgrades) do
        if not upgrade.requires then
            available[#available + 1] = upgrade
        elseif synergies[upgrade.requires] then
            comboUpgrades[#comboUpgrades + 1] = upgrade
        end
    end

    run.choices = {}
    if #comboUpgrades > 0 then
        run.choices[1] = table.remove(comboUpgrades, math.random(#comboUpgrades))
    end
    for _, upgrade in ipairs(comboUpgrades) do
        available[#available + 1] = upgrade
    end
    while #run.choices < 3 do
        run.choices[#run.choices + 1] = table.remove(available, math.random(#available))
    end
end

function Progress.pick(run, index)
    local choice = run.choices and run.choices[index]
    if not choice then return false end
    local id = choice.id
    run.ranks[id] = (run.ranks[id] or 0) + 1
    run.choices = nil
    return true
end

return Progress
