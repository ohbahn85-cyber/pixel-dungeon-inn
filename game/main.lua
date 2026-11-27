-- NECROMANCER DUNGEON & LEGION — Complete Prep & Melee/Swarm Combat Loop (Love2D + Lua)
-- Features:
-- 1) Sleek 3.5-head Dark-Fantasy Pixel Art (24x32 Necromancer 4-Stage Evolution + 20x24 12-Unit Summon Trees)
-- 2) Necromancer is MELEE ONLY (Cleaving Scythe/Blade arc that buffs nearby summons & harvests loot!)
-- 3) Dungeon Loot: Souls, Bone Shards, Blood Herbs, Dark Iron
-- 4) Camp Prep:
--    - Summon Gacha (No small cap! Swarm the screen with 20~40+ undead!)
--    - Individual Summon Upgrade Tree (C -> B -> A inside Warrior / Archer / Mage branches)
--    - Mutant Fusion (Combine 2 same-tier summons -> 65% Higher Tier in a DIFFERENT Tree / 35% Fail -> Random Same-Tier Summon!)
--    - Crafting (Potions from Herbs, Melee Weapons from Dark Iron)
--    - Probability Enhancement (+1, +2... with decreasing success chance!)

local necroImg, summonsImg, enemiesImg
local necroQuads, summonQuads, enemyQuads = {}, {}, {}

local mode = "camp" -- "camp" | "battle" | "victory" | "gameover"
local dungeonStage = 1
local timeAcc = 0
local shakeTimer, shakeMag = 0, 0

-- 던전 전리품 4종 자원
local res = {
    souls = 180,
    bones = 12,
    herbs = 6,
    iron = 6,
}

-- 포션 인벤토리 (전투 중 [1], [2], [3] 키로 즉시 사용)
local potions = {
    heal = 2,   -- [1] Blood Vial: 네크로맨서 & 전체 소환수 체력 45% 회복
    frenzy = 1, -- [2] Frenzy Elixir: 10초간 전체 소환수 공격/이동속도 +65%
    soul = 1,   -- [3] Soul Magnet: 주변 전리품 즉시 흡수 & 8초간 전리품 드랍 2배
}

-- 근접 무기 카탈로그 (네크로맨서는 근접 무기만 장착 가능!)
local WEAPONS = {
    { id = 1, name = "Bone Club",       baseAtk = 18, arcRadius = 62,  cd = 0.40, costIron = 0,  costBones = 0,  col = {0.90, 0.88, 0.80} },
    { id = 2, name = "Skull Cleaver",   baseAtk = 32, arcRadius = 74,  cd = 0.36, costIron = 4,  costBones = 4,  col = {0.75, 0.85, 0.98} },
    { id = 3, name = "Cursed Halberd",  baseAtk = 54, arcRadius = 90,  cd = 0.34, costIron = 8,  costBones = 8,  col = {0.78, 0.45, 1.00} },
    { id = 4, name = "Reaper's Scythe", baseAtk = 88, arcRadius = 112, cd = 0.30, costIron = 14, costBones = 14, col = {0.25, 1.00, 0.65} },
}

-- 주인공 네크로맨서 상태
local necro = {
    x = 480, y = 290,
    hp = 160, maxHp = 160,
    level = 1,
    stage = 1, -- 1: 하트팬티+거적대기, 2: 다크코트, 3: 데스나이트, 4: 각성 사령군주
    weaponIdx = 1,
    unlockedWeapons = { true, false, false, false },
    weaponEnhance = 0, -- 확률 강화 수치 (+0, +1, +2 ...)
    armorEnhance = 0,  -- 갑옷 확률 강화 수치
    facing = 1,
    swingTimer = 0,
    swingDuration = 0.20,
    swingAngle = 0,
    swingCooldown = 0,
    dashTimer = 0,
    dashCooldown = 0,
    dashDx = 0, dashDy = 0,
    invulnTimer = 0,
    frenzyTimer = 0,
    soulBoostTimer = 0,
    afterimages = {},
}

-- 12종 소환수 상향 트리 카탈로그
-- tree: "warrior" (1->2->3), "archer" (4->5->6), "mage" (7->8->9), "mutant" (10, 11, 12)
local UNIT_DB = {
    [1]  = { id = 1,  name = "Skeleton Pawn",   tree = "warrior", tier = "C", nextId = 2,   role = "melee",  hp = 75,  atk = 12, spd = 125, range = 26,  cd = 0.80 },
    [2]  = { id = 2,  name = "Bone Gladiator",  tree = "warrior", tier = "B", nextId = 3,   role = "melee",  hp = 155, atk = 24, spd = 135, range = 30,  cd = 0.75 },
    [3]  = { id = 3,  name = "Death Knight",    tree = "warrior", tier = "A", nextId = nil, role = "melee",  hp = 310, atk = 46, spd = 145, range = 34,  cd = 0.70 },

    [4]  = { id = 4,  name = "Bone Archer",     tree = "archer",  tier = "C", nextId = 5,   role = "ranged", hp = 55,  atk = 14, spd = 115, range = 195, cd = 0.95 },
    [5]  = { id = 5,  name = "Skull Crossbow",  tree = "archer",  tier = "B", nextId = 6,   role = "ranged", hp = 115, atk = 28, spd = 120, range = 225, cd = 0.85 },
    [6]  = { id = 6,  name = "Wraith Sniper",   tree = "archer",  tier = "A", nextId = nil, role = "ranged", hp = 210, atk = 54, spd = 130, range = 265, cd = 0.75 },

    [7]  = { id = 7,  name = "Soul Wisp",       tree = "mage",    tier = "C", nextId = 8,   role = "ranged", hp = 50,  atk = 16, spd = 125, range = 175, cd = 0.90 },
    [8]  = { id = 8,  name = "Bone Warlock",    tree = "mage",    tier = "B", nextId = 9,   role = "ranged", hp = 110, atk = 32, spd = 120, range = 210, cd = 0.85 },
    [9]  = { id = 9,  name = "High Lich",       tree = "mage",    tier = "A", nextId = nil, role = "ranged", hp = 220, atk = 60, spd = 125, range = 245, cd = 0.78 },

    [10] = { id = 10, name = "Reaper Lord",     tree = "mutant",  tier = "S", nextId = nil, role = "melee",  hp = 520, atk = 95, spd = 165, range = 42,  cd = 0.55 },
    [11] = { id = 11, name = "Arch-Lich King",  tree = "mutant",  tier = "S", nextId = nil, role = "ranged", hp = 420, atk = 110,spd = 135, range = 280, cd = 0.65 },
    [12] = { id = 12, name = "Bone Dragon",     tree = "mutant",  tier = "S", nextId = nil, role = "melee",  hp = 680, atk = 105,spd = 155, range = 46,  cd = 0.60 },
}

local TIER_COLORS = {
    C = {0.72, 0.78, 0.86},
    B = {0.25, 0.80, 1.00},
    A = {0.80, 0.45, 1.00},
    S = {1.00, 0.84, 0.20},
}

local TREE_LABELS = {
    warrior = "WARRIOR TREE",
    archer  = "ARCHER TREE",
    mage    = "MAGE TREE",
    mutant  = "S-MUTANT TREE",
}

-- 내 언데드 군단 리스트 (제한 없이 많을수록 좋음!)
local legion = {}
local selectedUnitIdx = 1
local fusionMateIdx = nil
local rosterScroll = 0

local bannerMsg = "Welcome! Pull Summons, Upgrade Trees, Fuse Mutants, Enhance Melee Weapon & Conquer the Dungeon!"
local bannerCol = {0.55, 1.0, 0.72}

-- 전투 중 객체들
local activeSummons = {}
local enemies = {}
local projectiles = {}
local enemyProjectiles = {}
local lootDrops = {}
local particles = {}
local popTexts = {}
local dungeonLootEarned = { souls = 0, bones = 0, herbs = 0, iron = 0 }

local function addShake(dur, mag)
    shakeTimer = math.max(shakeTimer, dur)
    shakeMag = math.max(shakeMag, mag)
end

local function setBanner(msg, col)
    bannerMsg = msg
    bannerCol = col or {1, 1, 1}
end

local function spawnPop(x, y, text, col)
    table.insert(popTexts, { x = x, y = y, text = text, col = col or {1, 1, 1}, life = 0.75, maxLife = 0.75 })
end

local function spawnParticles(x, y, col, count, spd)
    for _ = 1, count do
        local a = math.random() * math.pi * 2
        local s = (0.3 + math.random() * 0.7) * (spd or 95)
        table.insert(particles, {
            x = x, y = y,
            vx = math.cos(a) * s,
            vy = math.sin(a) * s,
            life = 0.22 + math.random() * 0.28,
            maxLife = 0.5,
            size = 4,
            col = col,
        })
    end
end

local function createLegionUnit(unitId, enhanceLv)
    return {
        id = unitId,
        enhance = enhanceLv or 0,
    }
end

local function getUnitCombatStats(u)
    local meta = UNIT_DB[u.id]
    local mult = 1 + u.enhance * 0.22
    return math.floor(meta.hp * mult), math.floor(meta.atk * mult), meta
end

local function getNecroCombatStats()
    local wp = WEAPONS[necro.weaponIdx]
    local atk = math.floor((wp.baseAtk + (necro.level - 1) * 7) * (1 + necro.weaponEnhance * 0.22))
    local maxHp = math.floor((160 + (necro.level - 1) * 35) * (1 + necro.armorEnhance * 0.20))
    return maxHp, atk, wp
end

local function updateNecroAppearanceStage()
    local score = necro.weaponIdx + math.floor(necro.weaponEnhance / 2) + math.floor(necro.armorEnhance / 2)
    if score >= 6 then necro.stage = 4
    elseif score >= 4 then necro.stage = 3
    elseif score >= 2 then necro.stage = 2
    else necro.stage = 1 end
end

local function getEnhanceSuccessRate(curLv)
    return math.max(20, 90 - curLv * 12)
end

function love.load()
    math.randomseed(os.time())
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.07, 0.06, 0.11)

    necroImg = love.graphics.newImage("assets/necromancer_stages.png")
    local nw, nh = necroImg:getDimensions()
    for i = 0, 3 do
        necroQuads[i + 1] = love.graphics.newQuad(i * 24, 0, 24, 32, nw, nh)
    end

    summonsImg = love.graphics.newImage("assets/summons.png")
    local sw, sh = summonsImg:getDimensions()
    for i = 0, 11 do
        summonQuads[i + 1] = love.graphics.newQuad(i * 20, 0, 20, 24, sw, sh)
    end

    enemiesImg = love.graphics.newImage("assets/enemies.png")
    local ew, eh = enemiesImg:getDimensions()
    for i = 0, 2 do
        enemyQuads[i + 1] = love.graphics.newQuad(i * 20, 0, 20, 24, ew, eh)
    end

    -- 시작 군단: 3대 기본 트리(전사/궁수/위습) 1기씩 지급!
    table.insert(legion, createLegionUnit(1, 0))
    table.insert(legion, createLegionUnit(4, 0))
    table.insert(legion, createLegionUnit(7, 0))
end

-- ==============================================================================
-- 캠프 준비 기능: 1) 소환 가챠 / 2) 상향 트리 진화 / 3) 확률 변이 합성 / 4) 제작 & 확률 강화
-- ==============================================================================

local function rollSummonGacha(count)
    local cost = (count == 5) and 120 or 28
    if res.souls < cost then
        setBanner("Not enough Souls! Need " .. cost .. " Souls.", {1, 0.4, 0.4})
        return
    end
    res.souls = res.souls - cost
    local pulledNames = {}
    local bestTier = "C"

    for _ = 1, count do
        local r = math.random()
        local uid
        if r < 0.05 then
            -- 5% 확률로 S급 초월 변이 직통 당첨!
            local sPool = {10, 11, 12}
            uid = sPool[math.random(1, #sPool)]
            bestTier = "S"
        elseif r < 0.18 then
            -- 13% 확률로 A급 상향 트리 유닛
            local aPool = {3, 6, 9}
            uid = aPool[math.random(1, #aPool)]
            if bestTier ~= "S" then bestTier = "A" end
        elseif r < 0.48 then
            -- 30% 확률로 B급 중급 트리 유닛
            local bPool = {2, 5, 8}
            uid = bPool[math.random(1, #bPool)]
            if bestTier == "C" then bestTier = "B" end
        else
            -- 52% 확률로 C급 기본 트리 유닛
            local cPool = {1, 4, 7}
            uid = cPool[math.random(1, #cPool)]
        end
        table.insert(legion, createLegionUnit(uid, 0))
        table.insert(pulledNames, "[" .. UNIT_DB[uid].tier .. "]" .. UNIT_DB[uid].name)
    end

    selectedUnitIdx = #legion
    fusionMateIdx = nil
    setBanner("GACHA (" .. count .. "x): " .. table.concat(pulledNames, ", ") .. " (Total Army: " .. #legion .. ")", TIER_COLORS[bestTier])
    addShake(bestTier == "S" and 0.35 or 0.12, bestTier == "S" and 8 or 3)
    spawnParticles(160, 250, TIER_COLORS[bestTier], count * 8, 140)
end

-- 같은 트리 내 정통 상향 트리 승급 (예: 해골 졸병(C) -> 해골 검투사(B) -> 칠흑의 사령기사(A))
local function promoteUnitTree()
    local u = legion[selectedUnitIdx]
    if not u then return end
    local meta = UNIT_DB[u.id]
    if not meta.nextId then
        setBanner(meta.name .. " is at the peak of its Tree! Try MUTANT FUSION to reach S-Tier!", {1, 0.82, 0.25})
        return
    end
    local soulCost = (meta.tier == "C") and 35 or 75
    local boneCost = (meta.tier == "C") and 3 or 6
    if res.souls < soulCost or res.bones < boneCost then
        setBanner("Tree Upgrade needs " .. soulCost .. " Souls & " .. boneCost .. " Bone Shards!", {1, 0.4, 0.4})
        return
    end
    res.souls = res.souls - soulCost
    res.bones = res.bones - boneCost
    local nextMeta = UNIT_DB[meta.nextId]
    u.id = nextMeta.id
    setBanner("TREE UPGRADE! " .. meta.name .. " evolved into [" .. nextMeta.tier .. "] " .. nextMeta.name .. "!", TIER_COLORS[nextMeta.tier])
    addShake(0.2, 5)
    spawnParticles(520, 240, TIER_COLORS[nextMeta.tier], 20, 130)
end

-- 소환수 확률 강화 (+1, +2 ... 확률 게임!)
local function enhanceSelectedSummon()
    local u = legion[selectedUnitIdx]
    if not u then return end
    local costSouls = 20 + u.enhance * 12
    local costBones = 1 + math.floor(u.enhance / 2)
    if res.souls < costSouls or res.bones < costBones then
        setBanner("Summon Enhance needs " .. costSouls .. " Souls & " .. costBones .. " Bones!", {1, 0.4, 0.4})
        return
    end
    res.souls = res.souls - costSouls
    res.bones = res.bones - costBones
    local rate = getEnhanceSuccessRate(u.enhance)
    if math.random(1, 100) <= rate then
        u.enhance = u.enhance + 1
        setBanner("SUCCESS (" .. rate .. "%)! " .. UNIT_DB[u.id].name .. " is now +" .. u.enhance .. "!", {0.35, 1.0, 0.65})
        spawnParticles(520, 240, {0.35, 1.0, 0.65}, 16, 120)
    else
        setBanner("FAILED (" .. rate .. "% chance)... " .. UNIT_DB[u.id].name .. " stayed at +" .. u.enhance .. ".", {1.0, 0.45, 0.45})
        addShake(0.15, 4)
    end
end

-- ★ 핵심 요구사항: 두 소환수를 합치면 확률(65%)적으로 [더 높은 등급의 다른 트리 소환수]가 나오고,
-- 실패(35%)하면 [같은 등급의 아무 소환수]가 나오는 돌연변이 합성!
local function executeMutantFusion(idx1, idx2)
    if idx1 == idx2 then return end
    local u1, u2 = legion[idx1], legion[idx2]
    if not u1 or not u2 then return end
    local m1, m2 = UNIT_DB[u1.id], UNIT_DB[u2.id]
    if m1.tier ~= m2.tier then
        setBanner("FUSION ERROR: Select two summons of the SAME Tier ([" .. m1.tier .. "] + [" .. m1.tier .. "])!", {1, 0.45, 0.45})
        fusionMateIdx = nil
        return
    end
    if m1.tier == "S" then
        setBanner("S-Tier Mutants are already the ultimate evolution!", {1, 0.85, 0.25})
        fusionMateIdx = nil
        return
    end

    local keptEnhance = math.max(u1.enhance, u2.enhance)
    local higherIdx = math.max(idx1, idx2)
    local lowerIdx = math.min(idx1, idx2)
    table.remove(legion, higherIdx)
    table.remove(legion, lowerIdx)

    local successChance = 65
    local roll = math.random(1, 100)
    local resultId

    if roll <= successChance then
        -- 대성공! 더 높은 등급의 [다른 트리] 소환수 출현!
        local nextTier = (m1.tier == "C") and "B" or (m1.tier == "B" and "A" or "S")
        local candidates = {}
        for id, info in ipairs(UNIT_DB) do
            if info.tier == nextTier and info.tree ~= m1.tree then
                table.insert(candidates, id)
            end
        end
        if #candidates == 0 then
            for id, info in ipairs(UNIT_DB) do
                if info.tier == nextTier then table.insert(candidates, id) end
            end
        end
        resultId = candidates[math.random(1, #candidates)]
        local resMeta = UNIT_DB[resultId]
        table.insert(legion, createLegionUnit(resultId, keptEnhance))
        selectedUnitIdx = #legion
        setBanner("MUTANT FUSION SUCCESS (65%)! Cross-Tree Evolved into [" .. resMeta.tier .. "] " .. resMeta.name .. " (" .. TREE_LABELS[resMeta.tree] .. ")!", TIER_COLORS[resMeta.tier])
        addShake(0.35, 8)
        spawnParticles(520, 240, TIER_COLORS[resMeta.tier], 32, 160)
    else
        -- 실패(35%): 같은 등급의 아무 소환수로 변이!
        local samePool = {}
        for id, info in ipairs(UNIT_DB) do
            if info.tier == m1.tier then table.insert(samePool, id) end
        end
        resultId = samePool[math.random(1, #samePool)]
        local resMeta = UNIT_DB[resultId]
        table.insert(legion, createLegionUnit(resultId, keptEnhance))
        selectedUnitIdx = #legion
        setBanner("FUSION FAILED (35%)... Mutated into random same-tier [" .. resMeta.tier .. "] " .. resMeta.name .. "!", {1.0, 0.65, 0.30})
        addShake(0.18, 4)
    end
    fusionMateIdx = nil
end

-- 네크로맨서 근접 무기 제작 & 해금
local function craftNextMeleeWeapon()
    local nextIdx = necro.weaponIdx + 1
    if nextIdx > #WEAPONS then
        setBanner("Already wielding the ultimate Reaper's Scythe! Enhance it with probability!", {1, 0.85, 0.25})
        return
    end
    local wp = WEAPONS[nextIdx]
    if res.iron < wp.costIron or res.bones < wp.costBones then
        setBanner("Forge [" .. wp.name .. "] needs " .. wp.costIron .. " Dark Iron & " .. wp.costBones .. " Bones!", {1, 0.4, 0.4})
        return
    end
    res.iron = res.iron - wp.costIron
    res.bones = res.bones - wp.costBones
    necro.weaponIdx = nextIdx
    necro.unlockedWeapons[nextIdx] = true
    updateNecroAppearanceStage()
    local maxHp = getNecroCombatStats()
    necro.maxHp = maxHp; necro.hp = maxHp
    setBanner("FORGED MELEE WEAPON: [" .. wp.name .. "]! Wider cleave & Stage " .. necro.stage .. " look!", {0.35, 1.0, 0.65})
    addShake(0.25, 6)
    spawnParticles(160, 250, {0.35, 1.0, 0.65}, 24, 140)
end

-- 네크로맨서 근접 무기 확률 강화!
local function enhanceNecroWeapon()
    local costIron = 2 + math.floor(necro.weaponEnhance / 2)
    local costSouls = 30 + necro.weaponEnhance * 18
    if res.iron < costIron or res.souls < costSouls then
        setBanner("Weapon Enhance needs " .. costSouls .. " Souls & " .. costIron .. " Dark Iron!", {1, 0.4, 0.4})
        return
    end
    res.iron = res.iron - costIron
    res.souls = res.souls - costSouls
    local rate = getEnhanceSuccessRate(necro.weaponEnhance)
    if math.random(1, 100) <= rate then
        necro.weaponEnhance = necro.weaponEnhance + 1
        updateNecroAppearanceStage()
        setBanner("WEAPON ENHANCE SUCCESS (" .. rate .. "%)! " .. WEAPONS[necro.weaponIdx].name .. " is now +" .. necro.weaponEnhance .. "!", {1, 0.85, 0.25})
        addShake(0.25, 6)
        spawnParticles(160, 250, {1, 0.85, 0.25}, 24, 150)
    else
        setBanner("WEAPON ENHANCE FAILED (" .. rate .. "% chance)... Stayed at +" .. necro.weaponEnhance .. ".", {1, 0.45, 0.45})
        addShake(0.15, 4)
    end
end

-- 네크로맨서 갑옷/육체 확률 강화!
local function enhanceNecroArmor()
    local costBones = 2 + math.floor(necro.armorEnhance / 2)
    local costSouls = 25 + necro.armorEnhance * 15
    if res.bones < costBones or res.souls < costSouls then
        setBanner("Armor Enhance needs " .. costSouls .. " Souls & " .. costBones .. " Bones!", {1, 0.4, 0.4})
        return
    end
    res.bones = res.bones - costBones
    res.souls = res.souls - costSouls
    local rate = getEnhanceSuccessRate(necro.armorEnhance)
    if math.random(1, 100) <= rate then
        necro.armorEnhance = necro.armorEnhance + 1
        necro.level = necro.level + 1
        updateNecroAppearanceStage()
        local maxHp = getNecroCombatStats()
        necro.maxHp = maxHp; necro.hp = maxHp
        setBanner("ARMOR ENHANCE SUCCESS (" .. rate .. "%)! Necro Armor +" .. necro.armorEnhance .. " (Stage " .. necro.stage .. ")!", {0.45, 1.0, 0.72})
        spawnParticles(160, 250, {0.45, 1.0, 0.72}, 20, 130)
    else
        setBanner("ARMOR ENHANCE FAILED (" .. rate .. "% chance)... Stayed at +" .. necro.armorEnhance .. ".", {1, 0.45, 0.45})
        addShake(0.15, 4)
    end
end

-- 던전 전리품(약초/뼈)으로 포션 연금 제작!
local function brewPotion(pType)
    if res.herbs < 2 then
        setBanner("Need 2 Blood Herbs from Dungeon Loot to brew a Potion!", {1, 0.4, 0.4})
        return
    end
    res.herbs = res.herbs - 2
    potions[pType] = potions[pType] + 1
    setBanner("BREWED POTION! +1 " .. string.upper(pType) .. " POTION ready for Dungeon keys [1/2/3]!", {0.45, 1.0, 0.65})
end

-- ==============================================================================
-- 던전 전투 시작 & 근접 베기(Melee Cleave) + 대규모 소환수 군단 스웜 전투
-- ==============================================================================

local function startDungeonRun()
    mode = "battle"
    local maxHp = getNecroCombatStats()
    necro.maxHp = maxHp
    necro.hp = maxHp
    necro.x, necro.y = 480, 290
    necro.swingTimer = 0
    necro.swingCooldown = 0
    necro.dashTimer = 0
    necro.invulnTimer = 0.6
    necro.frenzyTimer = 0
    necro.soulBoostTimer = 0
    necro.afterimages = {}
    dungeonLootEarned = { souls = 0, bones = 0, herbs = 0, iron = 0 }

    -- 보유한 모든 소환수 군단 출격! (많을수록 화면을 가득 채우며 적을 포위!)
    activeSummons = {}
    for i, u in ipairs(legion) do
        local hp, atk, meta = getUnitCombatStats(u)
        local ring = 45 + math.floor((i - 1) / 8) * 28
        local ang = ((i - 1) % 8) * (math.pi * 2 / 8)
        table.insert(activeSummons, {
            unit = u,
            meta = meta,
            x = necro.x + math.cos(ang) * ring,
            y = necro.y + math.sin(ang) * ring,
            hp = hp, maxHp = hp,
            atk = atk,
            cdTimer = math.random() * 0.4,
            hitFlash = 0,
            facing = 1,
        })
    end

    enemies = {}
    projectiles = {}
    enemyProjectiles = {}
    lootDrops = {}

    local totalEnemies = 7 + dungeonStage * 4
    for _ = 1, totalEnemies do
        local side = math.random(1, 4)
        local ex, ey
        if side == 1 then ex, ey = 60, math.random(85, 485)
        elseif side == 2 then ex, ey = 900, math.random(85, 485)
        elseif side == 3 then ex, ey = math.random(80, 880), 82
        else ex, ey = math.random(80, 880), 488 end

        local isPriest = (dungeonStage >= 2 and math.random() < 0.35)
        local eHp = math.floor((55 + dungeonStage * 28) * (isPriest and 0.85 or 1.0))
        table.insert(enemies, {
            kind = isPriest and 2 or 1,
            x = ex, y = ey,
            hp = eHp, maxHp = eHp,
            atk = 10 + dungeonStage * 4,
            spd = isPriest and 68 or (82 + dungeonStage * 3),
            cdTimer = 0.7 + math.random() * 0.7,
            hitFlash = 0,
            isBoss = false,
            scale = 2.5,
            radius = 16,
        })
    end

    -- 매 던전마다 수문장 보스 등장!
    local bHp = 380 + dungeonStage * 180
    table.insert(enemies, {
        kind = 3,
        x = 840, y = 280,
        hp = bHp, maxHp = bHp,
        atk = 22 + dungeonStage * 6,
        spd = 66,
        cdTimer = 1.0,
        hitFlash = 0,
        isBoss = true,
        scale = 4.0,
        radius = 28,
    })
end

local function performNecroMeleeSwing()
    local _, atk, wp = getNecroCombatStats()
    local mx, my = love.mouse.getPosition()
    necro.swingAngle = math.atan2(my - (necro.y - 20), mx - necro.x)
    necro.facing = (mx >= necro.x) and 1 or -1
    necro.swingTimer = necro.swingDuration
    necro.swingCooldown = wp.cd

    -- 180도 근접 광역 베기(Melee Cleave) 판정!
    local hitCount = 0
    for _, e in ipairs(enemies) do
        local dx = e.x - necro.x
        local dy = (e.y - 16) - (necro.y - 20)
        local dist = math.sqrt(dx * dx + dy * dy)
        if dist <= wp.arcRadius + e.radius then
            local angToEnemy = math.atan2(dy, dx)
            local diff = math.atan2(math.sin(angToEnemy - necro.swingAngle), math.cos(angToEnemy - necro.swingAngle))
            if math.abs(diff) <= 1.45 then
                e.hp = e.hp - atk
                e.hitFlash = 0.14
                -- 묵직한 근접 넉백!
                local push = e.isBoss and 6 or 18
                e.x = e.x + math.cos(angToEnemy) * push
                e.y = e.y + math.sin(angToEnemy) * push
                spawnPop(e.x, e.y - 28, tostring(atk) .. "!", wp.col)
                spawnParticles(e.x, e.y - 14, wp.col, 6, 110)
                hitCount = hitCount + 1
            end
        end
    end

    if hitCount > 0 then
        addShake(0.10, math.min(7, 2 + hitCount))
    end
end

local function useBattlePotion(slot)
    if mode ~= "battle" then return end
    if slot == 1 and potions.heal > 0 then
        potions.heal = potions.heal - 1
        necro.hp = math.min(necro.maxHp, necro.hp + math.floor(necro.maxHp * 0.45))
        for _, s in ipairs(activeSummons) do
            s.hp = math.min(s.maxHp, s.hp + math.floor(s.maxHp * 0.45))
        end
        spawnPop(necro.x, necro.y - 45, "+45% ARMY HEAL!", {0.35, 1.0, 0.55})
        spawnParticles(necro.x, necro.y - 20, {0.35, 1.0, 0.55}, 22, 130)
    elseif slot == 2 and potions.frenzy > 0 then
        potions.frenzy = potions.frenzy - 1
        necro.frenzyTimer = 10.0
        spawnPop(necro.x, necro.y - 45, "FRENZY (+65% SPD)!", {1.0, 0.45, 0.35})
        spawnParticles(necro.x, necro.y - 20, {1.0, 0.45, 0.35}, 22, 140)
    elseif slot == 3 and potions.soul > 0 then
        potions.soul = potions.soul - 1
        necro.soulBoostTimer = 8.0
        spawnPop(necro.x, necro.y - 45, "2X LOOT MAGNET!", {1.0, 0.85, 0.25})
    end
end

local function updateBattle(dt)
    necro.swingTimer = math.max(0, necro.swingTimer - dt)
    necro.swingCooldown = math.max(0, necro.swingCooldown - dt)
    necro.dashCooldown = math.max(0, necro.dashCooldown - dt)
    necro.invulnTimer = math.max(0, necro.invulnTimer - dt)
    necro.frenzyTimer = math.max(0, necro.frenzyTimer - dt)
    necro.soulBoostTimer = math.max(0, necro.soulBoostTimer - dt)

    local dx, dy = 0, 0
    if love.keyboard.isDown("w", "up") then dy = dy - 1 end
    if love.keyboard.isDown("s", "down") then dy = dy + 1 end
    if love.keyboard.isDown("a", "left") then dx = dx - 1 end
    if love.keyboard.isDown("d", "right") then dx = dx + 1 end
    if dx ~= 0 or dy ~= 0 then
        local len = math.sqrt(dx * dx + dy * dy)
        dx, dy = dx / len, dy / len
        if dx ~= 0 then necro.facing = (dx > 0) and 1 or -1 end
    end

    if necro.dashTimer > 0 then
        necro.dashTimer = necro.dashTimer - dt
        necro.x = necro.x + necro.dashDx * 540 * dt
        necro.y = necro.y + necro.dashDy * 540 * dt
        table.insert(necro.afterimages, { x = necro.x, y = necro.y, life = 0.20 })
    else
        necro.x = necro.x + dx * 190 * dt
        necro.y = necro.y + dy * 190 * dt
    end

    necro.x = math.max(54, math.min(906, necro.x))
    necro.y = math.max(84, math.min(495, necro.y))

    for i = #necro.afterimages, 1, -1 do
        necro.afterimages[i].life = necro.afterimages[i].life - dt
        if necro.afterimages[i].life <= 0 then table.remove(necro.afterimages, i) end
    end

    -- 마우스 좌클릭(또는 홀드) -> 네크로맨서 근접 무기 휘두르기!
    if love.mouse.isDown(1) and necro.swingCooldown <= 0 then
        performNecroMeleeSwing()
    end

    -- 소환수 군단 AI (광란 포션 적용 시 속도 1.65배!)
    local spdMult = (necro.frenzyTimer > 0) and 1.65 or 1.0
    for i = #activeSummons, 1, -1 do
        local s = activeSummons[i]
        s.cdTimer = math.max(0, s.cdTimer - dt * spdMult)
        s.hitFlash = math.max(0, s.hitFlash - dt)

        local nearest, bestDist = nil, 99999
        for _, e in ipairs(enemies) do
            local d = math.sqrt((e.x - s.x)^2 + (e.y - s.y)^2)
            if d < bestDist then bestDist = d; nearest = e end
        end

        local mvx, mvy = 0, 0
        if nearest then
            local ang = math.atan2(nearest.y - s.y, nearest.x - s.x)
            s.facing = (nearest.x >= s.x) and 1 or -1
            if bestDist > s.meta.range then
                mvx = math.cos(ang) * s.meta.spd * spdMult
                mvy = math.sin(ang) * s.meta.spd * spdMult
            elseif s.meta.role == "ranged" and bestDist < 95 then
                mvx = -math.cos(ang) * s.meta.spd * 0.7
                mvy = -math.sin(ang) * s.meta.spd * 0.7
            end

            if bestDist <= s.meta.range + nearest.radius and s.cdTimer <= 0 then
                s.cdTimer = s.meta.cd
                if s.meta.role == "melee" then
                    nearest.hp = nearest.hp - s.atk
                    nearest.hitFlash = 0.10
                    spawnPop(nearest.x, nearest.y - 24, tostring(s.atk), TIER_COLORS[s.meta.tier])
                    spawnParticles(nearest.x, nearest.y - 12, TIER_COLORS[s.meta.tier], 4, 80)
                else
                    table.insert(projectiles, {
                        x = s.x, y = s.y - 14,
                        vx = math.cos(ang) * 380,
                        vy = math.sin(ang) * 380,
                        dmg = s.atk,
                        life = 1.1,
                        col = TIER_COLORS[s.meta.tier],
                    })
                end
            end
        end

        -- 군단 개체 수가 많아도 자연스럽게 에워싸도록 부드러운 분리력(Separation) 적용
        for j, other in ipairs(activeSummons) do
            if i ~= j then
                local ox, oy = s.x - other.x, s.y - other.y
                local od = ox * ox + oy * oy
                if od > 0.1 and od < 520 then
                    local d = math.sqrt(od)
                    mvx = mvx + (ox / d) * 85
                    mvy = mvy + (oy / d) * 85
                end
            end
        end

        s.x = math.max(50, math.min(910, s.x + mvx * dt))
        s.y = math.max(82, math.min(495, s.y + mvy * dt))

        if s.hp <= 0 then
            spawnParticles(s.x, s.y - 12, {0.85, 0.85, 0.8}, 8, 90)
            table.remove(activeSummons, i)
        end
    end

    -- 아군 원거리 소환수 투사체
    for i = #projectiles, 1, -1 do
        local p = projectiles[i]
        p.x = p.x + p.vx * dt
        p.y = p.y + p.vy * dt
        p.life = p.life - dt
        local hit = false
        for _, e in ipairs(enemies) do
            if math.sqrt((e.x - p.x)^2 + ((e.y - 14) - p.y)^2) < e.radius + 5 then
                e.hp = e.hp - p.dmg
                e.hitFlash = 0.10
                spawnPop(e.x, e.y - 24, tostring(p.dmg), p.col)
                hit = true
                break
            end
        end
        if hit or p.life <= 0 then table.remove(projectiles, i) end
    end

    -- 적 AI 및 던전 전리품(영혼 / 뼈조각 / 피약초 / 암흑철) 드랍!
    for i = #enemies, 1, -1 do
        local e = enemies[i]
        e.cdTimer = math.max(0, e.cdTimer - dt)
        e.hitFlash = math.max(0, e.hitFlash - dt)

        if e.hp <= 0 then
            local mult = (necro.soulBoostTimer > 0) and 2 or 1
            local sDrop = (e.isBoss and (80 + dungeonStage * 25) or (12 + dungeonStage * 3)) * mult
            table.insert(lootDrops, { x = e.x, y = e.y, kind = "souls", amount = sDrop, col = {0.35, 1.0, 0.65} })

            -- 확률적 재료 전리품 드랍 (보스는 무조건 대량 드랍!)
            if e.isBoss or math.random() < 0.55 then
                table.insert(lootDrops, { x = e.x + 12, y = e.y - 6, kind = "bones", amount = (e.isBoss and 4 or 1) * mult, col = {0.95, 0.92, 0.82} })
            end
            if e.isBoss or math.random() < 0.42 then
                table.insert(lootDrops, { x = e.x - 12, y = e.y + 6, kind = "herbs", amount = (e.isBoss and 3 or 1) * mult, col = {1.0, 0.35, 0.45} })
            end
            if e.isBoss or math.random() < 0.45 then
                table.insert(lootDrops, { x = e.x + 8, y = e.y + 10, kind = "iron", amount = (e.isBoss and 4 or 1) * mult, col = {0.55, 0.75, 1.0} })
            end

            spawnParticles(e.x, e.y - 14, {1.0, 0.4, 0.4}, e.isBoss and 28 or 10, 130)
            addShake(e.isBoss and 0.35 or 0.08, e.isBoss and 8 or 2.5)
            table.remove(enemies, i)
        else
            local target = necro
            local bestD = math.sqrt((necro.x - e.x)^2 + (necro.y - e.y)^2)
            for _, s in ipairs(activeSummons) do
                local sd = math.sqrt((s.x - e.x)^2 + (s.y - e.y)^2)
                if sd < bestD * 0.92 then bestD = sd; target = s end
            end

            local ang = math.atan2(target.y - e.y, target.x - e.x)
            if e.kind == 2 and bestD < 210 then
                if e.cdTimer <= 0 then
                    e.cdTimer = 1.65
                    table.insert(enemyProjectiles, {
                        x = e.x, y = e.y - 14,
                        vx = math.cos(ang) * 205,
                        vy = math.sin(ang) * 205,
                        dmg = e.atk,
                        life = 2.0,
                    })
                end
            else
                e.x = e.x + math.cos(ang) * e.spd * dt
                e.y = e.y + math.sin(ang) * e.spd * dt
                if bestD < e.radius + 16 and e.cdTimer <= 0 then
                    e.cdTimer = 0.95
                    if target == necro then
                        if necro.invulnTimer <= 0 then
                            necro.hp = necro.hp - e.atk
                            necro.invulnTimer = 0.45
                            addShake(0.14, 5)
                            spawnPop(necro.x, necro.y - 42, "-" .. e.atk, {1, 0.3, 0.3})
                        end
                    else
                        target.hp = target.hp - e.atk
                        target.hitFlash = 0.10
                    end
                end
            end
        end
    end

    -- 적 투사체
    for i = #enemyProjectiles, 1, -1 do
        local ep = enemyProjectiles[i]
        ep.x = ep.x + ep.vx * dt
        ep.y = ep.y + ep.vy * dt
        ep.life = ep.life - dt
        local hit = false
        if math.sqrt((necro.x - ep.x)^2 + ((necro.y - 18) - ep.y)^2) < 17 then
            if necro.invulnTimer <= 0 then
                necro.hp = necro.hp - ep.dmg
                necro.invulnTimer = 0.45
                addShake(0.12, 4)
                spawnPop(necro.x, necro.y - 42, "-" .. ep.dmg, {1, 0.3, 0.3})
            end
            hit = true
        end
        if hit or ep.life <= 0 then table.remove(enemyProjectiles, i) end
    end

    -- 전리품 흡수
    local magnetRange = (necro.soulBoostTimer > 0 or #enemies == 0) and 999 or 175
    for i = #lootDrops, 1, -1 do
        local l = lootDrops[i]
        local d = math.sqrt((necro.x - l.x)^2 + (necro.y - l.y)^2)
        if d < magnetRange then
            local ang = math.atan2(necro.y - l.y, necro.x - l.x)
            l.x = l.x + math.cos(ang) * 360 * dt
            l.y = l.y + math.sin(ang) * 360 * dt
        end
        if d < 24 then
            res[l.kind] = res[l.kind] + l.amount
            dungeonLootEarned[l.kind] = dungeonLootEarned[l.kind] + l.amount
            spawnPop(necro.x, necro.y - 48, "+" .. l.amount .. " " .. string.upper(l.kind), l.col)
            table.remove(lootDrops, i)
        end
    end

    if necro.hp <= 0 then
        mode = "gameover"
    elseif #enemies == 0 and #lootDrops == 0 then
        dungeonStage = dungeonStage + 1
        mode = "victory"
    end
end

function love.update(dt)
    timeAcc = timeAcc + dt
    if shakeTimer > 0 then shakeTimer = math.max(0, shakeTimer - dt) end
    if mode == "battle" then updateBattle(dt) end

    for i = #particles, 1, -1 do
        local p = particles[i]
        p.x = p.x + p.vx * dt; p.y = p.y + p.vy * dt; p.life = p.life - dt
        if p.life <= 0 then table.remove(particles, i) end
    end
    for i = #popTexts, 1, -1 do
        local pt = popTexts[i]
        pt.y = pt.y - 36 * dt; pt.life = pt.life - dt
        if pt.life <= 0 then table.remove(popTexts, i) end
    end
end

function love.keypressed(key)
    if mode == "battle" then
        if key == "space" or key == "lshift" then
            if necro.dashCooldown <= 0 then
                local dx, dy = 0, 0
                if love.keyboard.isDown("w", "up") then dy = dy - 1 end
                if love.keyboard.isDown("s", "down") then dy = dy + 1 end
                if love.keyboard.isDown("a", "left") then dx = dx - 1 end
                if love.keyboard.isDown("d", "right") then dx = dx + 1 end
                if dx == 0 and dy == 0 then
                    local mx, my = love.mouse.getPosition()
                    local ang = math.atan2(my - necro.y, mx - necro.x)
                    dx, dy = math.cos(ang), math.sin(ang)
                else
                    local len = math.sqrt(dx * dx + dy * dy)
                    dx, dy = dx / len, dy / len
                end
                necro.dashDx, necro.dashDy = dx, dy
                necro.dashTimer = 0.14
                necro.dashCooldown = 0.60
                necro.invulnTimer = 0.25
                spawnParticles(necro.x, necro.y - 16, {0.35, 1.0, 0.65}, 8, 95)
            end
        elseif key == "1" then useBattlePotion(1)
        elseif key == "2" then useBattlePotion(2)
        elseif key == "3" then useBattlePotion(3)
        end
    elseif mode == "victory" or mode == "gameover" then
        if key == "space" or key == "return" then
            mode = "camp"
            setBanner("Returned from Dungeon! Use your loot to Craft, Enhance, Gacha & Fuse!", {0.45, 1.0, 0.72})
        end
    end
end

local function inRect(x, y, rx, ry, rw, rh)
    return x >= rx and x <= rx + rw and y >= ry and y <= ry + rh
end

function love.mousepressed(x, y, button)
    if button ~= 1 then return end

    if mode == "camp" then
        -- 좌측: 네크로맨서 근접 무기 제작 / 무기 확률강화 / 갑옷 확률강화 / 던전 출정
        if inRect(x, y, 32, 338, 250, 42) then craftNextMeleeWeapon(); return end
        if inRect(x, y, 32, 386, 122, 46) then enhanceNecroWeapon(); return end
        if inRect(x, y, 160, 386, 122, 46) then enhanceNecroArmor(); return end
        if inRect(x, y, 32, 444, 250, 62) then startDungeonRun(); return end

        -- 중앙 상단: 소환 가챠 1회 / 5연차
        if inRect(x, y, 306, 68, 165, 52) then rollSummonGacha(1); return end
        if inRect(x, y, 478, 68, 175, 52) then rollSummonGacha(5); return end

        -- 우측 상단: 포션 연금 3종
        if inRect(x, y, 668, 68, 86, 52) then brewPotion("heal"); return end
        if inRect(x, y, 760, 68, 86, 52) then brewPotion("frenzy"); return end
        if inRect(x, y, 852, 68, 86, 52) then brewPotion("soul"); return end

        -- 선택된 소환수 액션: [상향 트리 승급] / [확률 강화] / [돌연변이 합성 모드]
        if inRect(x, y, 306, 154, 205, 48) then promoteUnitTree(); return end
        if inRect(x, y, 520, 154, 205, 48) then enhanceSelectedSummon(); return end
        if inRect(x, y, 734, 154, 204, 48) then
            if not legion[selectedUnitIdx] then return end
            if fusionMateIdx then
                fusionMateIdx = nil
                setBanner("Fusion canceled.", {0.8, 0.8, 0.8})
            else
                fusionMateIdx = selectedUnitIdx
                local m = UNIT_DB[legion[selectedUnitIdx].id]
                setBanner("FUSION MODE: Click another [" .. m.tier .. "-Tier] summon below to combine! (65% Cross-Tree Higher Tier / 35% Random Same Tier)", {1, 0.85, 0.25})
            end
            return
        end

        -- 군단 스크롤 버튼
        if inRect(x, y, 845, 212, 42, 22) then rosterScroll = math.max(0, rosterScroll - 1); return end
        if inRect(x, y, 894, 212, 42, 22) then rosterScroll = rosterScroll + 1; return end

        -- 소환수 군단 그리드 클릭 (4열 x 3행 = 페이지당 12칸 표시, 스크롤로 무제한!)
        for slot = 1, 12 do
            local idx = rosterScroll * 4 + slot
            local u = legion[idx]
            if u then
                local col = (slot - 1) % 4
                local row = math.floor((slot - 1) / 4)
                local cx = 306 + col * 160
                local cy = 240 + row * 88
                if inRect(x, y, cx, cy, 152, 80) then
                    if fusionMateIdx and fusionMateIdx ~= idx then
                        executeMutantFusion(fusionMateIdx, idx)
                    else
                        selectedUnitIdx = idx
                    end
                    return
                end
            end
        end
    elseif mode == "victory" or mode == "gameover" then
        mode = "camp"
    end
end

local function drawBtn(x, y, w, h, title, sub, bg, border)
    love.graphics.setColor(bg[1], bg[2], bg[3], 1)
    love.graphics.rectangle("fill", x, y, w, h, 7, 7)
    love.graphics.setColor(border[1], border[2], border[3], 1)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", x, y, w, h, 7, 7)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf(title, x + 2, y + (sub and 7 or (h / 2 - 7)), w - 4, "center")
    if sub then
        love.graphics.setColor(0.85, 0.90, 0.96, 0.92)
        love.graphics.printf(sub, x + 2, y + 26, w - 4, "center")
    end
end

-- 네크로맨서 손에 들린 근접 무기 도트/블레이드 렌더링
local function drawNecroMeleeWeapon(cx, cy, scale, swingRatio)
    local _, _, wp = getNecroCombatStats()
    love.graphics.push()
    love.graphics.translate(cx + 8 * scale * necro.facing, cy - 14 * scale)
    local baseAng = (necro.facing == 1) and 0.35 or (math.pi - 0.35)
    if swingRatio > 0 then
        baseAng = necro.swingAngle - 1.2 + (1 - swingRatio) * 2.4
    end
    love.graphics.rotate(baseAng)

    -- 무기 자루
    love.graphics.setColor(0.45, 0.28, 0.14, 1)
    love.graphics.rectangle("fill", 0, -2, 11 * scale, 4)
    -- 무기 칼날 / 낫 날
    love.graphics.setColor(wp.col[1], wp.col[2], wp.col[3], 1)
    if necro.weaponIdx == 4 then
        -- 사신의 대낫 초승달 칼날
        love.graphics.polygon("fill", 9 * scale, -2, 14 * scale, -9 * scale, 11 * scale, 5 * scale)
    else
        love.graphics.rectangle("fill", 7 * scale, -4, (3 + necro.weaponIdx * 1.5) * scale, 8)
    end
    love.graphics.pop()
end

local function drawCamp()
    -- 상단 전리품 HUD 바
    love.graphics.setColor(0.12, 0.10, 0.19, 1)
    love.graphics.rectangle("fill", 0, 0, 960, 50)
    love.graphics.setColor(0.35, 1.0, 0.65, 1)
    love.graphics.print("DUNGEON STAGE " .. dungeonStage .. " PREP", 22, 16)
    love.graphics.setColor(0.45, 1.0, 0.72, 1)
    love.graphics.print("SOULS: " .. res.souls, 240, 16)
    love.graphics.setColor(0.95, 0.92, 0.82, 1)
    love.graphics.print("BONES: " .. res.bones, 375, 16)
    love.graphics.setColor(1.0, 0.45, 0.55, 1)
    love.graphics.print("HERBS: " .. res.herbs, 495, 16)
    love.graphics.setColor(0.55, 0.78, 1.0, 1)
    love.graphics.print("DARK IRON: " .. res.iron, 610, 16)
    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("LEGION SIZE: " .. #legion .. " UNDEAD", 775, 16)

    -- 좌측 패널: 네크로맨서 (근접 전용) & 외형 진화 & 확률 강화
    love.graphics.setColor(0.13, 0.10, 0.20, 1)
    love.graphics.rectangle("fill", 20, 62, 274, 458, 10, 10)
    love.graphics.setColor(0.42, 0.32, 0.62, 1)
    love.graphics.rectangle("line", 20, 62, 274, 458, 10, 10)

    local maxHp, atk, wp = getNecroCombatStats()
    local stageNames = { "STAGE 1: HEART BOXERS", "STAGE 2: DARK COAT", "STAGE 3: DEATHLORD", "STAGE 4: LICH KING" }
    love.graphics.setColor(1.0, 0.86, 0.28, 1)
    love.graphics.printf(stageNames[necro.stage], 20, 74, 274, "center")
    love.graphics.setColor(0.75, 0.82, 0.95, 1)
    love.graphics.printf("MELEE: " .. wp.name .. " +" .. necro.weaponEnhance, 20, 96, 274, "center")

    -- 네크로맨서 5x 도트 프리뷰 + 손에 든 근접 무기
    local bob = (necro.stage == 4) and (math.sin(timeAcc * 4) * 5 - 6) or (math.sin(timeAcc * 4) > 0 and 0 or 2)
    love.graphics.setColor(0.25, 0.95, 0.55, 0.20)
    love.graphics.ellipse("fill", 157, 265, 62, 16)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(necroImg, necroQuads[necro.stage], 157, math.floor(265 + bob), 0, 5, 5, 12, 28)
    drawNecroMeleeWeapon(157, 265 + bob, 3.8, 0)

    love.graphics.setColor(0.90, 0.94, 0.98, 1)
    love.graphics.printf("HP: " .. maxHp .. " (Armor +" .. necro.armorEnhance .. ")  |  CLEAVE ATK: " .. atk, 20, 292, 274, "center")
    love.graphics.setColor(0.60, 0.95, 0.72, 1)
    love.graphics.printf("Potions: [1]Heal:" .. potions.heal .. " [2]Frenzy:" .. potions.frenzy .. " [3]Loot:" .. potions.soul, 20, 314, 274, "center")

    local nextWp = WEAPONS[necro.weaponIdx + 1]
    local forgeSub = nextWp and ("Need " .. nextWp.costIron .. " Iron, " .. nextWp.costBones .. " Bones") or "MAX WEAPON TIER"
    drawBtn(32, 338, 250, 42, nextWp and ("FORGE: " .. nextWp.name) or "MAX MELEE FORGED", forgeSub, {0.22, 0.16, 0.34}, {0.75, 0.55, 1.0})

    local wpRate = getEnhanceSuccessRate(necro.weaponEnhance)
    local arRate = getEnhanceSuccessRate(necro.armorEnhance)
    drawBtn(32, 386, 122, 46, "WEAPON +" .. (necro.weaponEnhance + 1), wpRate .. "% Chance", {0.28, 0.18, 0.16}, {1.0, 0.78, 0.25})
    drawBtn(160, 386, 122, 46, "ARMOR +" .. (necro.armorEnhance + 1), arRate .. "% Chance", {0.16, 0.24, 0.36}, {0.35, 0.80, 1.0})

    drawBtn(32, 444, 250, 62, "RAID DUNGEON STAGE " .. dungeonStage, "Deploy All " .. #legion .. " Summons!", {0.12, 0.50, 0.28}, {0.35, 1.0, 0.60})

    -- 우측 상단: 소환수 가챠 (1회 / 5연차) & 포션 연금(약초 2개)
    drawBtn(306, 68, 165, 52, "SUMMON 1x", "28 Souls (Gacha)", {0.20, 0.14, 0.34}, {0.35, 0.95, 0.65})
    drawBtn(478, 68, 175, 52, "SUMMON 5x SWARM", "120 Souls (Bonus!)", {0.28, 0.15, 0.42}, {1.0, 0.84, 0.25})

    drawBtn(668, 68, 86, 52, "+1 HEAL", "2 Herbs", {0.26, 0.14, 0.20}, {1.0, 0.40, 0.50})
    drawBtn(760, 68, 86, 52, "+1 FRENZY", "2 Herbs", {0.28, 0.18, 0.12}, {1.0, 0.65, 0.25})
    drawBtn(852, 68, 86, 52, "+1 LOOT", "2 Herbs", {0.16, 0.24, 0.22}, {0.40, 1.0, 0.70})

    -- 안내 배너
    love.graphics.setColor(bannerCol[1], bannerCol[2], bannerCol[3], 1)
    love.graphics.print(bannerMsg, 308, 130)

    -- 선택된 소환수 상향 트리 진화 / 확률 강화 / 이종 트리 돌연변이 합성 바
    local selU = legion[selectedUnitIdx]
    local selMeta = selU and UNIT_DB[selU.id] or nil
    local nextMeta = (selMeta and selMeta.nextId) and UNIT_DB[selMeta.nextId] or nil
    drawBtn(
        306, 154, 205, 48,
        nextMeta and ("TREE UP -> " .. nextMeta.name) or "MAX TREE REACHED",
        nextMeta and ("Same Tree [" .. nextMeta.tier .. "]") or "Use Mutant Fusion -> S!",
        {0.16, 0.26, 0.22}, {0.35, 0.95, 0.60}
    )

    local uRate = selU and getEnhanceSuccessRate(selU.enhance) or 90
    drawBtn(
        520, 154, 205, 48,
        selU and ("ENHANCE +" .. (selU.enhance + 1) .. " (" .. uRate .. "%)") or "ENHANCE UNIT",
        "Probability Stat Boost",
        {0.18, 0.22, 0.36}, {0.40, 0.78, 1.0}
    )

    drawBtn(
        734, 154, 204, 48,
        fusionMateIdx and "SELECT 2ND UNIT..." or "MUTANT FUSION (65%)",
        "2 Same-Tier -> Higher Other Tree!",
        fusionMateIdx and {0.45, 0.28, 0.12} or {0.32, 0.16, 0.38},
        {1.0, 0.82, 0.25}
    )

    -- 군단 헤더 & 스크롤
    love.graphics.setColor(0.85, 0.88, 0.95, 1)
    love.graphics.print("UNDEAD LEGION (" .. #legion .. " Active — No Limit! More is Better!):", 308, 215)
    drawBtn(845, 212, 42, 22, "UP", nil, {0.2, 0.2, 0.3}, {0.5, 0.5, 0.7})
    drawBtn(894, 212, 42, 22, "DN", nil, {0.2, 0.2, 0.3}, {0.5, 0.5, 0.7})

    -- 군단 4x3 그리드
    for slot = 1, 12 do
        local idx = rosterScroll * 4 + slot
        local col = (slot - 1) % 4
        local row = math.floor((slot - 1) / 4)
        local cx = 306 + col * 160
        local cy = 240 + row * 88
        local u = legion[idx]

        local isSel = (idx == selectedUnitIdx)
        local isFuse = (idx == fusionMateIdx)
        love.graphics.setColor(isFuse and 0.36 or (isSel and 0.22 or 0.13), isFuse and 0.22 or (isSel and 0.17 or 0.11), isSel and 0.34 or 0.20, 1)
        love.graphics.rectangle("fill", cx, cy, 152, 80, 7, 7)

        if u then
            local hp, uAtk, meta = getUnitCombatStats(u)
            local tc = TIER_COLORS[meta.tier]
            love.graphics.setColor(tc[1], tc[2], tc[3], (isSel or isFuse) and 1 or 0.65)
            love.graphics.setLineWidth((isSel or isFuse) and 3 or 1.5)
            love.graphics.rectangle("line", cx, cy, 152, 80, 7, 7)

            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.draw(summonsImg, summonQuads[u.id], cx + 24, cy + 56, 0, 2.2, 2.2, 10, 22)

            love.graphics.setColor(tc[1], tc[2], tc[3], 1)
            love.graphics.print("[" .. meta.tier .. "] " .. meta.name, cx + 46, cy + 7)
            love.graphics.setColor(0.75, 0.82, 0.95, 1)
            love.graphics.print(TREE_LABELS[meta.tree], cx + 46, cy + 25)
            love.graphics.setColor(0.92, 0.95, 0.98, 1)
            love.graphics.print("+" .. u.enhance .. "  ATK:" .. uAtk .. " HP:" .. hp, cx + 46, cy + 44)
            if meta.nextId then
                love.graphics.setColor(0.45, 1.0, 0.68, 1)
                love.graphics.print("-> " .. UNIT_DB[meta.nextId].name, cx + 46, cy + 61)
            else
                love.graphics.setColor(1.0, 0.84, 0.25, 1)
                love.graphics.print("* PEAK / FUSE READY", cx + 46, cy + 61)
            end
        else
            love.graphics.setColor(0.26, 0.22, 0.36, 0.5)
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", cx, cy, 152, 80, 7, 7)
        end
    end
end

local function drawBattle()
    -- 던전 바닥 타일
    local ts = 40
    for gx = 1, 22 do
        for gy = 1, 11 do
            love.graphics.setColor((gx + gy) % 2 == 0 and 0.14 or 0.12, 0.10, 0.19, 1)
            love.graphics.rectangle("fill", gx * ts, 24 + gy * ts, ts, ts)
        end
    end
    love.graphics.setColor(0.40, 0.30, 0.58, 1)
    love.graphics.setLineWidth(3)
    love.graphics.rectangle("line", 40, 64, 880, 440, 8, 8)

    -- 전리품 아이콘
    for _, l in ipairs(lootDrops) do
        love.graphics.setColor(l.col[1], l.col[2], l.col[3], 0.35)
        love.graphics.circle("fill", l.x, l.y, 9)
        love.graphics.setColor(l.col[1], l.col[2], l.col[3], 1)
        love.graphics.rectangle("fill", l.x - 4, l.y - 4, 8, 8)
    end

    -- 네크로맨서 근접 베기(Melee Cleave Arc) 이펙트!
    if necro.swingTimer > 0 then
        local _, _, wp = getNecroCombatStats()
        local ratio = necro.swingTimer / necro.swingDuration
        love.graphics.setColor(wp.col[1], wp.col[2], wp.col[3], ratio * 0.55)
        love.graphics.arc("fill", necro.x, necro.y - 18, wp.arcRadius, necro.swingAngle - 1.25, necro.swingAngle + 1.25)
        love.graphics.setColor(1, 1, 1, ratio * 0.9)
        love.graphics.setLineWidth(4)
        love.graphics.arc("line", "open", necro.x, necro.y - 18, wp.arcRadius, necro.swingAngle - 1.25, necro.swingAngle + 1.25)
    end

    -- 대시 잔상
    for _, af in ipairs(necro.afterimages) do
        love.graphics.setColor(0.35, 1.0, 0.65, af.life * 2.2)
        love.graphics.draw(necroImg, necroQuads[necro.stage], af.x, af.y, 0, 2.8 * necro.facing, 2.8, 12, 28)
    end

    -- 깊이 정렬 렌더링
    local drawList = { { kind = "necro", y = necro.y } }
    for _, s in ipairs(activeSummons) do table.insert(drawList, { kind = "summon", y = s.y, ref = s }) end
    for _, e in ipairs(enemies) do table.insert(drawList, { kind = "enemy", y = e.y, ref = e }) end
    table.sort(drawList, function(a, b) return a.y < b.y end)

    for _, item in ipairs(drawList) do
        if item.kind == "necro" then
            love.graphics.setColor(0.04, 0.03, 0.08, 0.5)
            love.graphics.ellipse("fill", necro.x, necro.y + 2, 20, 7)
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.draw(necroImg, necroQuads[necro.stage], math.floor(necro.x), math.floor(necro.y), 0, 2.8 * necro.facing, 2.8, 12, 28)
            drawNecroMeleeWeapon(necro.x, necro.y, 2.6, necro.swingTimer / necro.swingDuration)
        elseif item.kind == "summon" then
            local s = item.ref
            love.graphics.setColor(0.04, 0.03, 0.08, 0.42)
            love.graphics.ellipse("fill", s.x, s.y + 2, 13, 5)
            love.graphics.setColor(1, s.hitFlash > 0 and 0.4 or 1, s.hitFlash > 0 and 0.4 or 1, 1)
            love.graphics.draw(summonsImg, summonQuads[s.unit.id], math.floor(s.x), math.floor(s.y), 0, 2.3 * s.facing, 2.3, 10, 22)
        elseif item.kind == "enemy" then
            local e = item.ref
            love.graphics.setColor(0.04, 0.03, 0.08, 0.48)
            love.graphics.ellipse("fill", e.x, e.y + 2, e.radius, e.radius * 0.4)
            love.graphics.setColor(1, e.hitFlash > 0 and 0.3 or 1, e.hitFlash > 0 and 0.3 or 1, 1)
            love.graphics.draw(enemiesImg, enemyQuads[e.kind], math.floor(e.x), math.floor(e.y), 0, e.scale, e.scale, 10, 22)
            local bw = e.isBoss and 64 or 28
            love.graphics.setColor(0.1, 0.1, 0.15, 0.85)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * 22 - 6, bw, 5)
            love.graphics.setColor(0.95, 0.28, 0.35, 1)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * 22 - 6, bw * math.max(0, e.hp / e.maxHp), 5)
        end
    end

    for _, p in ipairs(projectiles) do
        love.graphics.setColor(p.col[1], p.col[2], p.col[3], 1)
        love.graphics.circle("fill", p.x, p.y, 4.5)
    end
    for _, ep in ipairs(enemyProjectiles) do
        love.graphics.setColor(1.0, 0.42, 0.15, 1)
        love.graphics.circle("fill", ep.x, ep.y, 5.5)
    end

    -- 상단 전투 HUD & 포션 단축키 안내
    love.graphics.setColor(0.10, 0.08, 0.16, 0.94)
    love.graphics.rectangle("fill", 0, 0, 960, 48)
    love.graphics.setColor(0.95, 0.28, 0.35, 1)
    love.graphics.rectangle("fill", 20, 14, 170 * math.max(0, necro.hp / necro.maxHp), 20, 4, 4)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.rectangle("line", 20, 14, 170, 20, 4, 4)
    love.graphics.print("HP " .. math.max(0, math.floor(necro.hp)) .. "/" .. necro.maxHp, 28, 17)

    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("STAGE " .. dungeonStage .. " | ENEMIES: " .. #enemies .. " | ARMY: " .. #activeSummons, 205, 17)
    love.graphics.setColor(0.45, 1.0, 0.72, 1)
    love.graphics.print("[1]Heal:" .. potions.heal .. " [2]Frenzy:" .. potions.frenzy .. " [3]Loot:" .. potions.soul .. " | LMB: Melee Cleave | SPACE: Dash", 510, 17)
end

function love.draw()
    love.graphics.push()
    if shakeTimer > 0 then
        love.graphics.translate((math.random() - 0.5) * shakeMag, (math.random() - 0.5) * shakeMag)
    end

    if mode == "camp" then
        drawCamp()
    elseif mode == "battle" then
        drawBattle()
    elseif mode == "victory" then
        drawBattle()
        love.graphics.setColor(0.05, 0.04, 0.10, 0.86)
        love.graphics.rectangle("fill", 0, 0, 960, 540)
        love.graphics.setColor(0.35, 1.0, 0.65, 1)
        love.graphics.printf("DUNGEON STAGE " .. (dungeonStage - 1) .. " CONQUERED!", 0, 165, 960, "center")
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.printf(
            "LOOT HARVESTED:\n\n+" .. dungeonLootEarned.souls .. " Souls   |   +" ..
            dungeonLootEarned.bones .. " Bone Shards   |   +" ..
            dungeonLootEarned.herbs .. " Blood Herbs   |   +" ..
            dungeonLootEarned.iron .. " Dark Iron",
            0, 215, 960, "center"
        )
        love.graphics.setColor(1.0, 0.85, 0.25, 1)
        love.graphics.printf("Click or Press [SPACE] to return to Camp & Upgrade your Legion!", 0, 330, 960, "center")
    elseif mode == "gameover" then
        drawBattle()
        love.graphics.setColor(0.08, 0.02, 0.05, 0.86)
        love.graphics.rectangle("fill", 0, 0, 960, 540)
        love.graphics.setColor(1.0, 0.35, 0.40, 1)
        love.graphics.printf("FALLEN IN DUNGEON STAGE " .. dungeonStage .. " (You keep all looted materials!)", 0, 220, 960, "center")
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.printf("Click or Press [SPACE] to return to Camp, Gacha/Enhance & Retry!", 0, 265, 960, "center")
    end

    for _, p in ipairs(particles) do
        love.graphics.setColor(p.col[1], p.col[2], p.col[3], math.max(0, p.life / p.maxLife))
        love.graphics.rectangle("fill", p.x, p.y, p.size, p.size)
    end
    for _, pt in ipairs(popTexts) do
        love.graphics.setColor(pt.col[1], pt.col[2], pt.col[3], math.max(0, pt.life / pt.maxLife))
        love.graphics.print(pt.text, pt.x - 16, pt.y)
    end

    love.graphics.pop()
end
