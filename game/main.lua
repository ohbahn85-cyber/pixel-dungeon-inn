-- NECROMANCER DUNGEON & LEGION — Powered by 0x72 DungeonTileset II v1.7 (CC0 Official Pixel Art Atlas)
-- Love2D + Lua

local Starter = require("starter_character")
local Targeting = require("combat_targeting")
local Progress = require("run_progress")
local CharacterPreview = require("character_preview")

local atlasImg
local quads = {}

local mode = "preview" -- "preview" | "camp" | "battle" | "levelup" | "victory" | "gameover"
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

-- Camp flasks are consumed automatically during combat.
local potions = { heal = 2, frenzy = 1, soul = 1 }

-- 0x72 에셋 기반 네크로맨서 근접 무기 5단계 (네크로맨서는 근접 무기만 가능!)
local WEAPONS = {
    { id = 1, name = "Spiked Club",     quadKey = "wp_club",    w = 10, h = 24, baseAtk = 18, arcRadius = 62,  cd = 0.38, costIron = 0,  costBones = 0,  col = {0.90, 0.85, 0.72} },
    { id = 2, name = "Butcher Cleaver", quadKey = "wp_cleaver", w = 8,  h = 19, baseAtk = 32, arcRadius = 74,  cd = 0.35, costIron = 4,  costBones = 4,  col = {0.82, 0.90, 1.00} },
    { id = 3, name = "Sawtooth Blade",  quadKey = "wp_saw",     w = 10, h = 25, baseAtk = 52, arcRadius = 88,  cd = 0.33, costIron = 7,  costBones = 7,  col = {0.75, 0.50, 1.00} },
    { id = 4, name = "Executioner Axe", quadKey = "wp_waraxe",  w = 12, h = 23, baseAtk = 78, arcRadius = 102, cd = 0.31, costIron = 11, costBones = 11, col = {1.00, 0.45, 0.45} },
    { id = 5, name = "Golden Greatsword",quadKey= "wp_gold",    w = 10, h = 30, baseAtk = 115,arcRadius = 118, cd = 0.28, costIron = 16, costBones = 16, col = {1.00, 0.86, 0.25} },
}

-- 주인공 네크로맨서 상태 (4단계 외형 진화: 0x72 에셋 내 거지 소년 -> 마도사 -> 붉은 후드 네크로맨서 -> 데몬 로드)
local necro = {
    x = 480, y = 290,
    hp = 165, maxHp = 165,
    level = 1,
    stage = 1,
    weaponIdx = 1,
    weaponEnhance = 0,
    armorEnhance = 0,
    facing = 1,
    direction = "down",
    walkDistance = 0,
    walkFrame = 0,
    moving = false,
    swingTimer = 0,
    swingDuration = 0.20,
    swingAngle = 0,
    swingDirection = "down",
    swingFacing = 1,
    swingPending = false,
    swingCooldown = 0,
    invulnTimer = 0,
    frenzyTimer = 0,
    soulBoostTimer = 0,
}

-- 0x72 에셋 기반 12종 소환수 상향 트리 (4계보 x 3단계)
local UNIT_DB = {
    -- 1. 해골 전사 트리 (C -> B -> A)
    [1]  = { id = 1,  name = "Tiny Skeleton",   animKey = "tiny_zombie", tree = "warrior", tier = "C", nextId = 2,   role = "melee",  hp = 75,  atk = 12, spd = 130, range = 26,  cd = 0.78, scale = 2.6, oy = 16 },
    [2]  = { id = 2,  name = "Bone Warrior",    animKey = "skelet",      tree = "warrior", tier = "B", nextId = 3,   role = "melee",  hp = 160, atk = 25, spd = 138, range = 30,  cd = 0.72, scale = 2.8, oy = 16 },
    [3]  = { id = 3,  name = "Masked Boneknight",animKey= "masked_orc",  tree = "warrior", tier = "A", nextId = nil, role = "melee",  hp = 320, atk = 48, spd = 145, range = 34,  cd = 0.68, scale = 2.8, oy = 23 },

    -- 2. 언데드 원거리/암살 트리 (C -> B -> A)
    [4]  = { id = 4,  name = "Ghoul Slinger",   animKey = "goblin",      tree = "archer",  tier = "C", nextId = 5,   role = "ranged", hp = 58,  atk = 14, spd = 120, range = 195, cd = 0.92, scale = 2.6, oy = 16 },
    [5]  = { id = 5,  name = "Frost Zombie",    animKey = "ice_zombie",  tree = "archer",  tier = "B", nextId = 6,   role = "ranged", hp = 120, atk = 29, spd = 125, range = 225, cd = 0.84, scale = 2.8, oy = 16 },
    [6]  = { id = 6,  name = "Plague Doctor",   animKey = "doc",         tree = "archer",  tier = "A", nextId = nil, role = "ranged", hp = 225, atk = 56, spd = 135, range = 265, cd = 0.74, scale = 2.8, oy = 23 },

    -- 3. 저주 마법/주술 트리 (C -> B -> A)
    [7]  = { id = 7,  name = "Swamp Ectoplasm", animKey = "swampy",      tree = "mage",    tier = "C", nextId = 8,   role = "ranged", hp = 55,  atk = 16, spd = 125, range = 180, cd = 0.88, scale = 2.6, oy = 16 },
    [8]  = { id = 8,  name = "Bone Shaman",     animKey = "orc_shaman",  tree = "mage",    tier = "B", nextId = 9,   role = "ranged", hp = 115, atk = 33, spd = 125, range = 215, cd = 0.82, scale = 2.8, oy = 23 },
    [9]  = { id = 9,  name = "Crimson Lich",    animKey = "necro",       tree = "mage",    tier = "A", nextId = nil, role = "ranged", hp = 230, atk = 62, spd = 130, range = 250, cd = 0.75, scale = 2.8, oy = 23 },

    -- 4. S급 초월 돌연변이 트리 (합성 대성공 또는 5% 극악 가챠!)
    [10] = { id = 10, name = "Abomination Tank",animKey = "big_zombie",  tree = "mutant",  tier = "S", nextId = nil, role = "melee",  hp = 680, atk = 96, spd = 145, range = 44,  cd = 0.58, scale = 2.5, oy = 36 },
    [11] = { id = 11, name = "Pumpkin Reaper",  animKey = "pumpkin",     tree = "mutant",  tier = "S", nextId = nil, role = "ranged", hp = 440, atk = 115,spd = 145, range = 280, cd = 0.62, scale = 3.0, oy = 23 },
    [12] = { id = 12, name = "Abyss Demon Lord",animKey = "big_demon",   tree = "mutant",  tier = "S", nextId = nil, role = "melee",  hp = 580, atk = 112,spd = 160, range = 46,  cd = 0.55, scale = 2.5, oy = 36 },
}

local TIER_COLORS = {
    C = {0.74, 0.80, 0.88},
    B = {0.25, 0.80, 1.00},
    A = {0.82, 0.45, 1.00},
    S = {1.00, 0.84, 0.20},
}

local function summonTag(meta)
    if meta.role == "melee" then return "melee" end
    return meta.tree == "mage" and "magic" or "ranged"
end

local legion = {}
local selectedUnitIdx = 1
local fusionMateIdx = nil
local rosterScroll = 0
local maxEquippedRings = 10
local upgradeCards = { x = 136, y = 222, width = 220, height = 132, gap = 14 }
local run = Progress.new()
local runSynergies = {}
local xpColor = { 0.40, 0.83, 1.0 }
local markColor = { 0.97, 0.74, 0.39 }
local burstColor = { 0.73, 0.48, 1.0 }

local bannerMsg = "0x72 Official Pixel Art Loaded! Pull Summons, Upgrade Trees, Fuse Mutants & Raid Dungeon!"
local bannerCol = {0.55, 1.0, 0.72}

local activeSummons = {}
local enemies = {}
local projectiles = {}
local enemyProjectiles = {}
local lootDrops = {}
local particles = {}
local popTexts = {}
local dungeonLootEarned = { souls = 0, bones = 0, herbs = 0, iron = 0 }

local function makeAnimQuads(x, y, w, h, count)
    local aw, ah = atlasImg:getDimensions()
    local list = {}
    for i = 0, count - 1 do
        list[i + 1] = love.graphics.newQuad(x + i * w, y, w, h, aw, ah)
    end
    return list
end

function love.load()
    math.randomseed(os.time())
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.08, 0.07, 0.11)

    Starter.load()
    CharacterPreview.load()

    atlasImg = love.graphics.newImage("assets/0x72_dungeon.png")
    local aw, ah = atlasImg:getDimensions()

    -- 1. 던전 바닥 & 벽 타일 & 보물상자 & 포션 플라스크 Quad 등록
    quads.floors = makeAnimQuads(16, 64, 16, 16, 3)
    quads.floors2 = makeAnimQuads(16, 80, 16, 16, 3)
    quads.wall_mid = love.graphics.newQuad(32, 16, 16, 16, aw, ah)
    quads.wall_banner_red = love.graphics.newQuad(16, 32, 16, 16, aw, ah)
    quads.wall_banner_green = love.graphics.newQuad(16, 48, 16, 16, aw, ah)
    quads.skull = love.graphics.newQuad(288, 432, 16, 16, aw, ah)
    quads.chest = love.graphics.newQuad(304, 416, 16, 16, aw, ah)
    quads.heart_full = love.graphics.newQuad(289, 370, 13, 12, aw, ah)
    quads.coin = makeAnimQuads(289, 385, 8, 7, 4)

    -- 포션 플라스크 아이콘 (0x72 정품 도트)
    quads.flask_red = love.graphics.newQuad(288, 336, 16, 16, aw, ah)
    quads.flask_green = love.graphics.newQuad(320, 336, 16, 16, aw, ah)
    quads.flask_yellow = love.graphics.newQuad(336, 336, 16, 16, aw, ah)
    quads.flask_blue = love.graphics.newQuad(304, 336, 16, 16, aw, ah)

    -- 근접 무기 5종 (0x72 정품 도트)
    quads.wp_club    = love.graphics.newQuad(339, 39, 10, 24, aw, ah)
    quads.wp_cleaver = love.graphics.newQuad(294, 105, 5, 22, aw, ah)
    quads.wp_saw     = love.graphics.newQuad(307, 70, 10, 25, aw, ah)
    quads.wp_waraxe  = love.graphics.newQuad(324, 168, 12, 23, aw, ah)
    quads.wp_gold    = love.graphics.newQuad(307, 129, 10, 30, aw, ah)

    -- 네크로맨서 4단계 진화 애니메이션 (Idle 4프레임 + Run 4프레임)
    quads.necro_stages = {
        -- Stage 1: 거지 초보 (elf_m)
        { idle = makeAnimQuads(128, 36, 16, 28, 4), run = makeAnimQuads(192, 36, 16, 28, 4), w = 16, h = 28 },
        -- Stage 2: 마도사 (wizzard_m)
        { idle = makeAnimQuads(128, 164, 16, 28, 4), run = makeAnimQuads(192, 164, 16, 28, 4), w = 16, h = 28 },
        -- Stage 3: 정통 후드 네크로맨서 (necromancer)
        { idle = makeAnimQuads(368, 225, 16, 23, 4), run = makeAnimQuads(368, 225, 16, 23, 4), w = 16, h = 23 },
        -- Stage 4: 각성 사령군주 (chort + golden crown aura)
        { idle = makeAnimQuads(368, 273, 16, 23, 4), run = makeAnimQuads(432, 273, 16, 23, 4), w = 16, h = 23 },
    }

    -- 12종 소환수 & 적군 4프레임 애니메이션 등록
    quads.anims = {
        tiny_zombie = { idle = makeAnimQuads(368, 16, 16, 16, 4),  run = makeAnimQuads(432, 16, 16, 16, 4),  w = 16, h = 16 },
        skelet      = { idle = makeAnimQuads(368, 88, 16, 16, 4),  run = makeAnimQuads(432, 88, 16, 16, 4),  w = 16, h = 16 },
        masked_orc  = { idle = makeAnimQuads(368, 153, 16, 23, 4), run = makeAnimQuads(432, 153, 16, 23, 4), w = 16, h = 23 },
        goblin      = { idle = makeAnimQuads(368, 40, 16, 16, 4),  run = makeAnimQuads(432, 40, 16, 16, 4),  w = 16, h = 16 },
        ice_zombie  = { idle = makeAnimQuads(432, 136, 16, 16, 4), run = makeAnimQuads(432, 136, 16, 16, 4), w = 16, h = 16 },
        doc         = { idle = makeAnimQuads(368, 345, 16, 23, 4), run = makeAnimQuads(432, 345, 16, 23, 4), w = 16, h = 23 },
        swampy      = { idle = makeAnimQuads(432, 112, 16, 16, 4), run = makeAnimQuads(432, 112, 16, 16, 4), w = 16, h = 16 },
        orc_shaman  = { idle = makeAnimQuads(368, 201, 16, 23, 4), run = makeAnimQuads(432, 201, 16, 23, 4), w = 16, h = 23 },
        necro       = { idle = makeAnimQuads(368, 225, 16, 23, 4), run = makeAnimQuads(368, 225, 16, 23, 4), w = 16, h = 23 },
        big_zombie  = { idle = makeAnimQuads(16, 332, 32, 36, 4),  run = makeAnimQuads(144, 332, 32, 36, 4), w = 32, h = 36 },
        pumpkin     = { idle = makeAnimQuads(368, 321, 16, 23, 4), run = makeAnimQuads(432, 321, 16, 23, 4), w = 16, h = 23 },
        big_demon   = { idle = makeAnimQuads(16, 428, 32, 36, 4),  run = makeAnimQuads(144, 428, 32, 36, 4), w = 32, h = 36 },

        -- 적군 (성기사 보병 / 엘프 마법사 / 거대 오우거 보스)
        enemy_knight = { idle = makeAnimQuads(128, 100, 16, 28, 4), run = makeAnimQuads(192, 100, 16, 28, 4), w = 16, h = 28 },
        enemy_mage   = { idle = makeAnimQuads(128, 132, 16, 28, 4), run = makeAnimQuads(192, 132, 16, 28, 4), w = 16, h = 28 },
        enemy_boss   = { idle = makeAnimQuads(16, 380, 32, 36, 4),  run = makeAnimQuads(144, 380, 32, 36, 4), w = 32, h = 36 },
    }

    -- 시작 군단 3기 지급
    table.insert(legion, { id = 1, enhance = 0, equipped = true })
    table.insert(legion, { id = 4, enhance = 0, equipped = true })
    table.insert(legion, { id = 7, enhance = 0, equipped = true })
end

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

local function getUnitCombatStats(u)
    local meta = UNIT_DB[u.id]
    local mult = 1 + u.enhance * 0.22
    return math.floor(meta.hp * mult), math.floor(meta.atk * mult), meta
end

local function getNecroCombatStats()
    local wp = WEAPONS[necro.weaponIdx]
    local atk = math.floor((wp.baseAtk + (necro.level - 1) * 7) * (1 + necro.weaponEnhance * 0.22))
    local maxHp = math.floor((165 + (necro.level - 1) * 35) * (1 + necro.armorEnhance * 0.20))
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

local function getAnimFrame(offset)
    return (math.floor((timeAcc + (offset or 0)) * 8) % 4) + 1
end

-- ==============================================================================
-- 캠프 준비: 가챠 / 상향 트리 / 확률 변이 합성 / 근접 무기 제작 & 확률 강화
-- ==============================================================================

local function equippedRings()
    local equipped = {}
    for _, ring in ipairs(legion) do
        if ring.equipped then equipped[#equipped + 1] = ring end
    end
    return equipped
end

local function getSynergies(equipped)
    local melee, archer, mage = false, false, false
    for _, ring in ipairs(equipped) do
        local tag = summonTag(UNIT_DB[ring.id])
        melee = melee or tag == "melee"
        archer = archer or tag == "ranged"
        mage = mage or tag == "magic"
    end
    return { markedShot = melee and archer, graveBurst = melee and mage }
end

local function toggleSelectedRing()
    local ring = legion[selectedUnitIdx]
    if not ring then return end
    if not ring.equipped and #equippedRings() >= maxEquippedRings then
        setBanner("All ten finger slots are full.", {1, 0.76, 0.45})
        return
    end
    ring.equipped = not ring.equipped
    local action = ring.equipped and " equipped." or " unequipped."
    setBanner(UNIT_DB[ring.id].name .. " ring" .. action, {0.56, 0.9, 0.78})
end

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
            local sPool = {10, 11, 12}
            uid = sPool[math.random(1, #sPool)]
            bestTier = "S"
        elseif r < 0.18 then
            local aPool = {3, 6, 9}
            uid = aPool[math.random(1, #aPool)]
            if bestTier ~= "S" then bestTier = "A" end
        elseif r < 0.48 then
            local bPool = {2, 5, 8}
            uid = bPool[math.random(1, #bPool)]
            if bestTier == "C" then bestTier = "B" end
        else
            local cPool = {1, 4, 7}
            uid = cPool[math.random(1, #cPool)]
        end
        table.insert(legion, { id = uid, enhance = 0 })
        table.insert(pulledNames, "[" .. UNIT_DB[uid].tier .. "]" .. UNIT_DB[uid].name)
    end

    selectedUnitIdx = #legion
    fusionMateIdx = nil
    setBanner("GACHA (" .. count .. "x): " .. table.concat(pulledNames, ", ") .. " (Select a ring to equip)", TIER_COLORS[bestTier])
    addShake(bestTier == "S" and 0.35 or 0.12, bestTier == "S" and 8 or 3)
    spawnParticles(160, 250, TIER_COLORS[bestTier], count * 8, 140)
end

local function promoteUnitTree()
    local u = legion[selectedUnitIdx]
    if not u then return end
    local meta = UNIT_DB[u.id]
    if not meta.nextId then
        setBanner(meta.name .. " reached max Tree! Use MUTANT FUSION (65%) to reach S-Tier!", {1, 0.82, 0.25})
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
    local keepEquipped = u1.equipped or u2.equipped
    table.remove(legion, math.max(idx1, idx2))
    table.remove(legion, math.min(idx1, idx2))

    local roll = math.random(1, 100)
    local resultId
    if roll <= 65 then
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
        table.insert(legion, { id = resultId, enhance = keptEnhance, equipped = keepEquipped })
        selectedUnitIdx = #legion
        setBanner("MUTANT FUSION SUCCESS (65%)! Cross-Tree Evolved into [" .. resMeta.tier .. "] " .. resMeta.name .. "!", TIER_COLORS[resMeta.tier])
        addShake(0.35, 8)
        spawnParticles(520, 240, TIER_COLORS[resMeta.tier], 32, 160)
    else
        local samePool = {}
        for id, info in ipairs(UNIT_DB) do
            if info.tier == m1.tier then table.insert(samePool, id) end
        end
        resultId = samePool[math.random(1, #samePool)]
        local resMeta = UNIT_DB[resultId]
        table.insert(legion, { id = resultId, enhance = keptEnhance, equipped = keepEquipped })
        selectedUnitIdx = #legion
        setBanner("FUSION FAILED (35%)... Mutated into random same-tier [" .. resMeta.tier .. "] " .. resMeta.name .. "!", {1.0, 0.65, 0.30})
        addShake(0.18, 4)
    end
    fusionMateIdx = nil
end

local function craftNextMeleeWeapon()
    local nextIdx = necro.weaponIdx + 1
    if nextIdx > #WEAPONS then
        setBanner("Already wielding the Golden Greatsword! Enhance it with probability!", {1, 0.85, 0.25})
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
    updateNecroAppearanceStage()
    local maxHp = getNecroCombatStats()
    necro.maxHp = maxHp; necro.hp = maxHp
    setBanner("FORGED 0x72 MELEE WEAPON: [" .. wp.name .. "]! Wider cleave & Stage " .. necro.stage .. " form!", {0.35, 1.0, 0.65})
    addShake(0.25, 6)
    spawnParticles(160, 250, {0.35, 1.0, 0.65}, 24, 140)
end

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

local function brewPotion(pType)
    if res.herbs < 2 then
        setBanner("Need 2 Blood Herbs from Dungeon Loot to brew a Potion!", {1, 0.4, 0.4})
        return
    end
    res.herbs = res.herbs - 2
    potions[pType] = potions[pType] + 1
    setBanner("BREWED POTION! +1 " .. string.upper(pType) .. " FLASK ready for automatic use!", {0.45, 1.0, 0.65})
end

-- ==============================================================================
-- 던전 전투 루프
-- ==============================================================================

local function startDungeonRun()
    local deployed = equippedRings()
    run = Progress.new()
    runSynergies = getSynergies(deployed)
    mode = "battle"
    local maxHp = getNecroCombatStats()
    necro.maxHp = maxHp; necro.hp = maxHp
    necro.x, necro.y = 480, 290
    necro.direction, necro.walkFrame, necro.walkDistance = "down", 0, 0
    necro.moving = false
    necro.swingTimer, necro.swingCooldown, necro.swingPending = 0, 0, false
    necro.invulnTimer = 0.6
    necro.frenzyTimer = 0; necro.soulBoostTimer = 0
    dungeonLootEarned = { souls = 0, bones = 0, herbs = 0, iron = 0 }

    activeSummons = {}
    for i, u in ipairs(deployed) do
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
            moving = false,
            animOffset = math.random() * 5,
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
        if side == 1 then ex, ey = 64, math.random(90, 480)
        elseif side == 2 then ex, ey = 896, math.random(90, 480)
        elseif side == 3 then ex, ey = math.random(80, 880), 88
        else ex, ey = math.random(80, 880), 485 end

        local isMage = (dungeonStage >= 2 and math.random() < 0.35)
        local eHp = math.floor((55 + dungeonStage * 28) * (isMage and 0.85 or 1.0))
        table.insert(enemies, {
            animKey = isMage and "enemy_mage" or "enemy_knight",
            isRanged = isMage,
            x = ex, y = ey,
            hp = eHp, maxHp = eHp,
            atk = 10 + dungeonStage * 4,
            spd = isMage and 68 or (82 + dungeonStage * 3),
            cdTimer = 0.7 + math.random() * 0.7,
            hitFlash = 0,
            isBoss = false,
            scale = 2.6,
            radius = 16,
            facing = 1,
            animOffset = math.random() * 5,
        })
    end

    local bHp = 400 + dungeonStage * 190
    table.insert(enemies, {
        animKey = "enemy_boss",
        isRanged = false,
        x = 840, y = 280,
        hp = bHp, maxHp = bHp,
        atk = 24 + dungeonStage * 6,
        spd = 66,
        cdTimer = 1.0,
        hitFlash = 0,
        isBoss = true,
        scale = 3.0,
        radius = 30,
        facing = -1,
        animOffset = 0,
    })
end

local function usesStarterSwing()
    return necro.stage == 1 and necro.weaponIdx == 1
end

local function meleeReach(weapon)
    return weapon.arcRadius + 12 * (run.ranks.range or 0)
end

local function applyNecroMeleeSwing()
    local _, atk, wp = getNecroCombatStats()
    atk = math.floor(atk * (1 + 0.25 * (run.ranks.weapon or 0)))
    local hitCount = 0
    for _, e in ipairs(enemies) do
        local dx = e.x - necro.x
        local dy = e.y - necro.y
        local reach = meleeReach(wp) + e.radius
        if e.hp > 0 and dx * dx + dy * dy <= reach * reach then
            local angToEnemy = math.atan2(dy, dx)
            local diff = math.atan2(math.sin(angToEnemy - necro.swingAngle), math.cos(angToEnemy - necro.swingAngle))
            if (dx == 0 and dy == 0) or math.abs(diff) <= 1.45 then
                e.hp = e.hp - atk
                e.hitFlash = 0.14
                local push = e.isBoss and 6 or 18
                e.x = e.x + math.cos(angToEnemy) * push
                e.y = e.y + math.sin(angToEnemy) * push
                spawnPop(e.x, e.y - 28, tostring(atk) .. "!", wp.col)
                spawnParticles(e.x, e.y - 14, wp.col, 6, 110)
                hitCount = hitCount + 1
            end
        end
    end
    if hitCount > 0 then addShake(0.10, math.min(7, 2 + hitCount)) end
end

local function startNecroMeleeSwing(target, weapon)
    local dx, dy = target.x - necro.x, target.y - necro.y
    necro.swingAngle = math.atan2(dy, dx)
    necro.swingDirection = Starter.attackFacing(dx, dy, "right")
    necro.swingFacing = dx >= 0 and 1 or -1
    necro.swingCooldown = weapon.cd
    local starterSwing = usesStarterSwing()
    necro.swingDuration = starterSwing and Starter.attackDuration or 0.20
    necro.swingTimer = necro.swingDuration
    if starterSwing then
        necro.swingPending = true
    else
        applyNecroMeleeSwing()
    end
end

local function useBattlePotion(kind)
    if kind == "heal" and potions.heal > 0 then
        potions.heal = potions.heal - 1
        necro.hp = math.min(necro.maxHp, necro.hp + math.floor(necro.maxHp * 0.45))
        for _, s in ipairs(activeSummons) do
            s.hp = math.min(s.maxHp, s.hp + math.floor(s.maxHp * 0.45))
        end
        spawnPop(necro.x, necro.y - 45, "+45% ARMY HEAL!", {0.35, 1.0, 0.55})
        spawnParticles(necro.x, necro.y - 20, {0.35, 1.0, 0.55}, 22, 130)
    elseif kind == "frenzy" and potions.frenzy > 0 then
        potions.frenzy = potions.frenzy - 1
        necro.frenzyTimer = 10.0
        spawnPop(necro.x, necro.y - 45, "FRENZY (+65% SPD)!", {1.0, 0.45, 0.35})
        spawnParticles(necro.x, necro.y - 20, {1.0, 0.45, 0.35}, 22, 140)
    elseif kind == "soul" and potions.soul > 0 then
        potions.soul = potions.soul - 1
        necro.soulBoostTimer = 8.0
        spawnPop(necro.x, necro.y - 45, "2X LOOT MAGNET!", {1.0, 0.85, 0.25})
    end
end

local function isMarked(enemy)
    return (enemy.markTimer or 0) > 0
end

local function applySummonProjectile(projectile, enemy)
    local damage = projectile.dmg
    local tint = projectile.col
    if projectile.tag == "ranged" and runSynergies.markedShot and isMarked(enemy) then
        damage = damage + math.floor(damage * (0.5 + 0.25 * (run.ranks.shot or 0)))
        tint = markColor
        spawnParticles(enemy.x, enemy.y - 10, tint, 5, 100)
    end
    enemy.hp = enemy.hp - damage
    enemy.hitFlash = 0.10
    spawnPop(enemy.x, enemy.y - 24, tostring(damage), tint)

    if projectile.tag == "magic" and runSynergies.graveBurst and isMarked(enemy) and enemy.burstReady then
        enemy.burstReady = false
        local rank = run.ranks.burst or 0
        local radius = 70 + rank * 8
        local splash = math.max(1, math.floor(projectile.dmg * (0.5 + rank * 0.25)))
        spawnParticles(enemy.x, enemy.y - 12, burstColor, 13, 145)
        for _, other in ipairs(enemies) do
            local dx, dy = other.x - enemy.x, other.y - enemy.y
            if other ~= enemy and other.hp > 0 and dx * dx + dy * dy <= radius * radius then
                other.hp = other.hp - splash
                other.hitFlash = 0.10
                spawnPop(other.x, other.y - 24, tostring(splash), burstColor)
            end
        end
    end
end

local function offerRunUpgrade()
    Progress.offer(run, runSynergies)
    mode = run.choices and "levelup" or "battle"
end

local function chooseRunUpgrade(index)
    if Progress.pick(run, index) then offerRunUpgrade() end
end

local function updateBattle(dt)
    necro.swingTimer = math.max(0, necro.swingTimer - dt)
    necro.swingCooldown = math.max(0, necro.swingCooldown - dt)
    necro.invulnTimer = math.max(0, necro.invulnTimer - dt)
    necro.frenzyTimer = math.max(0, necro.frenzyTimer - dt)
    necro.soulBoostTimer = math.max(0, necro.soulBoostTimer - dt)
    for _, enemy in ipairs(enemies) do
        if enemy.markTimer then enemy.markTimer = math.max(0, enemy.markTimer - dt) end
    end

    local dx, dy = Starter.movementInput()
    necro.moving = dx ~= 0 or dy ~= 0
    if dx ~= 0 then necro.facing = dx > 0 and 1 or -1 end
    local oldX, oldY = necro.x, necro.y
    necro.direction = Starter.facing(dx, dy, necro.direction)
    local speed = 190 * (1 + 0.10 * (run.ranks.speed or 0))
    necro.x = math.max(54, math.min(906, necro.x + dx * speed * dt))
    necro.y = math.max(84, math.min(495, necro.y + dy * speed * dt))
    local movedX, movedY = necro.x - oldX, necro.y - oldY
    local distance = math.sqrt(movedX * movedX + movedY * movedY)
    if distance > 0 then
        necro.walkDistance = necro.walkDistance + distance / 2
        necro.walkFrame = Starter.walkFrame(necro.walkDistance)
    else
        necro.walkDistance, necro.walkFrame = 0, 0
    end

    if necro.hp <= necro.maxHp * 0.5 then useBattlePotion("heal") end
    if #lootDrops >= 4 and #enemies > 0 and necro.soulBoostTimer <= 0 and potions.soul > 0 then
        local resourcesOnGround = 0
        for _, drop in ipairs(lootDrops) do
            if drop.kind ~= "xp" then resourcesOnGround = resourcesOnGround + 1 end
        end
        if resourcesOnGround >= 4 then useBattlePotion("soul") end
    end

    if necro.swingPending and necro.swingDuration - necro.swingTimer >= Starter.attackWindup then
        necro.swingPending = false
        applyNecroMeleeSwing()
    end
    if necro.swingCooldown <= 0 then
        local weapon = WEAPONS[necro.weaponIdx]
        local target = Targeting.nearest(enemies, necro.x, necro.y, meleeReach(weapon))
        if target then
            if #activeSummons > 0 and necro.frenzyTimer <= 0 then useBattlePotion("frenzy") end
            startNecroMeleeSwing(target, weapon)
        end
    end

    local spdMult = (necro.frenzyTimer > 0) and 1.65 or 1.0
    for i = #activeSummons, 1, -1 do
        local s = activeSummons[i]
        s.cdTimer = math.max(0, s.cdTimer - dt * spdMult)
        s.hitFlash = math.max(0, s.hitFlash - dt)

        local nearest, bestDist
        local tag = summonTag(s.meta)
        if (tag == "ranged" and runSynergies.markedShot) or (tag == "magic" and runSynergies.graveBurst) then
            nearest, bestDist = Targeting.nearest(enemies, s.x, s.y, s.meta.range, isMarked)
        end
        if not nearest then nearest, bestDist = Targeting.nearest(enemies, s.x, s.y) end

        local mvx, mvy = 0, 0
        if nearest and s.hp > 0 then
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
                local damage = math.floor(s.atk * (1 + 0.20 * (run.ranks.summon or 0)))
                if s.meta.role == "melee" then
                    nearest.hp = nearest.hp - damage
                    nearest.hitFlash = 0.10
                    if runSynergies.markedShot or runSynergies.graveBurst then
                        nearest.markTimer = 3
                        nearest.burstReady = runSynergies.graveBurst
                    end
                    spawnPop(nearest.x, nearest.y - 24, tostring(damage), TIER_COLORS[s.meta.tier])
                    spawnParticles(nearest.x, nearest.y - 12, TIER_COLORS[s.meta.tier], 4, 80)
                else
                    table.insert(projectiles, {
                        x = s.x, y = s.y - 14,
                        vx = math.cos(ang) * 380,
                        vy = math.sin(ang) * 380,
                        dmg = damage,
                        tag = tag,
                        life = 1.1,
                        col = TIER_COLORS[s.meta.tier],
                    })
                end
            end
        end

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

        s.moving = (math.abs(mvx) > 5 or math.abs(mvy) > 5)
        s.x = math.max(50, math.min(910, s.x + mvx * dt))
        s.y = math.max(82, math.min(495, s.y + mvy * dt))

        if s.hp <= 0 then
            spawnParticles(s.x, s.y - 12, {0.85, 0.85, 0.8}, 8, 90)
            table.remove(activeSummons, i)
        end
    end

    for i = #projectiles, 1, -1 do
        local p = projectiles[i]
        p.x = p.x + p.vx * dt; p.y = p.y + p.vy * dt; p.life = p.life - dt
        local hit = false
        for _, e in ipairs(enemies) do
            if e.hp > 0 and math.sqrt((e.x - p.x)^2 + ((e.y - 14) - p.y)^2) < e.radius + 5 then
                applySummonProjectile(p, e)
                hit = true
                break
            end
        end
        if hit or p.life <= 0 then table.remove(projectiles, i) end
    end

    for i = #enemies, 1, -1 do
        local e = enemies[i]
        e.cdTimer = math.max(0, e.cdTimer - dt)
        e.hitFlash = math.max(0, e.hitFlash - dt)

        if e.hp <= 0 then
            table.insert(lootDrops, { x = e.x, y = e.y + 7, kind = "xp", amount = e.isBoss and 8 or 2, col = xpColor })
            local mult = (necro.soulBoostTimer > 0) and 2 or 1
            local sDrop = (e.isBoss and (80 + dungeonStage * 25) or (12 + dungeonStage * 3)) * mult
            table.insert(lootDrops, { x = e.x, y = e.y, kind = "souls", amount = sDrop, col = {0.35, 1.0, 0.65} })
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
            e.facing = (target.x >= e.x) and 1 or -1
            if e.isRanged and bestD < 210 then
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

    for i = #enemyProjectiles, 1, -1 do
        local ep = enemyProjectiles[i]
        ep.x = ep.x + ep.vx * dt; ep.y = ep.y + ep.vy * dt; ep.life = ep.life - dt
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

    local magnetRange = (necro.soulBoostTimer > 0 or #enemies == 0) and 999 or 175
    for i = #lootDrops, 1, -1 do
        local l = lootDrops[i]
        local d = math.sqrt((necro.x - l.x)^2 + (necro.y - l.y)^2)
        local pickupRange = l.kind == "xp" and #enemies > 0 and 66 or magnetRange
        if d >= 24 and d < pickupRange then
            local travel = math.min(d, 360 * dt)
            l.x = l.x + (necro.x - l.x) * travel / d
            l.y = l.y + (necro.y - l.y) * travel / d
            d = d - travel
        end
        if d < 24 then
            if l.kind == "xp" then
                run.xp = run.xp + l.amount
            else
                res[l.kind] = res[l.kind] + l.amount
                dungeonLootEarned[l.kind] = dungeonLootEarned[l.kind] + l.amount
            end
            spawnPop(necro.x, necro.y - 48, "+" .. l.amount .. " " .. string.upper(l.kind), l.col)
            table.remove(lootDrops, i)
        end
    end

    if necro.hp <= 0 then
        mode = "gameover"
    elseif #enemies == 0 then
        if #lootDrops == 0 then
            dungeonStage = dungeonStage + 1
            mode = "victory"
        end
    elseif run.xp >= run.threshold then
        offerRunUpgrade()
    end
end

function love.update(dt)
    if mode == "levelup" then return end
    timeAcc = timeAcc + dt
    if shakeTimer > 0 then shakeTimer = math.max(0, shakeTimer - dt) end
    if mode == "preview" then
        CharacterPreview.update(dt)
        return
    end
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
    if mode == "levelup" then
        local index = tonumber(key)
        if index then chooseRunUpgrade(index) end
    elseif mode == "preview" then
        CharacterPreview.keypressed(key)
    elseif mode == "camp" and key == "c" then
        CharacterPreview.open()
        mode = "preview"
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

    if mode == "preview" then
        if CharacterPreview.mousepressed(x, y) == "camp" then mode = "camp" end
    elseif mode == "camp" then
        if inRect(x, y, 50, 263, 214, 20) then
            CharacterPreview.open()
            mode = "preview"
            return
        end
        if inRect(x, y, 32, 338, 250, 42) then craftNextMeleeWeapon(); return end
        if inRect(x, y, 32, 386, 122, 46) then enhanceNecroWeapon(); return end
        if inRect(x, y, 160, 386, 122, 46) then enhanceNecroArmor(); return end
        if inRect(x, y, 32, 444, 250, 62) then startDungeonRun(); return end

        if inRect(x, y, 306, 68, 165, 52) then rollSummonGacha(1); return end
        if inRect(x, y, 478, 68, 175, 52) then rollSummonGacha(5); return end

        if inRect(x, y, 668, 68, 86, 52) then brewPotion("heal"); return end
        if inRect(x, y, 760, 68, 86, 52) then brewPotion("frenzy"); return end
        if inRect(x, y, 852, 68, 86, 52) then brewPotion("soul"); return end

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

        if inRect(x, y, 730, 212, 106, 22) then toggleSelectedRing(); return end
        if inRect(x, y, 845, 212, 42, 22) then rosterScroll = math.max(0, rosterScroll - 1); return end
        if inRect(x, y, 894, 212, 42, 22) then rosterScroll = rosterScroll + 1; return end

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
    elseif mode == "levelup" then
        for index = 1, #run.choices do
            local left = upgradeCards.x + (index - 1) * (upgradeCards.width + upgradeCards.gap)
            if inRect(x, y, left, upgradeCards.y, upgradeCards.width, upgradeCards.height) then
                chooseRunUpgrade(index)
                return
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

-- 0x72 정품 도트 근접 무기를 네크로맨서 손에 렌더링!
local function draw0x72MeleeWeapon(cx, cy, scale, swingRatio)
    local _, _, wp = getNecroCombatStats()
    local q = quads[wp.quadKey]
    if not q then return end

    love.graphics.push()
    local facing = swingRatio > 0 and necro.swingFacing or necro.facing
    love.graphics.translate(cx + 7 * scale * facing, cy - 8 * scale)
    local ang = facing == 1 and 0.45 or -0.45
    if swingRatio > 0 then
        ang = necro.swingAngle + math.pi * 0.5 - 1.2 + (1 - swingRatio) * 2.4
    end
    love.graphics.rotate(ang)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(atlasImg, q, 0, 0, 0, scale * 0.85, scale * 0.85, wp.w / 2, wp.h - 3)
    love.graphics.pop()
end

local function synergyText(synergies)
    if synergies.markedShot and synergies.graveBurst then return "Marked Shot + Grave Burst" end
    if synergies.markedShot then return "Marked Shot" end
    if synergies.graveBurst then return "Grave Burst" end
    return "No synergy"
end

local function drawCamp()
    local deployed = equippedRings()
    local synergies = getSynergies(deployed)
    -- 상단 전리품 HUD
    love.graphics.setColor(0.12, 0.10, 0.18, 1)
    love.graphics.rectangle("fill", 0, 0, 960, 50)
    love.graphics.setColor(0.35, 1.0, 0.65, 1)
    love.graphics.print("DUNGEON STAGE " .. dungeonStage .. " PREP (0x72 ASSET PACK)", 22, 16)
    love.graphics.setColor(0.45, 1.0, 0.72, 1)
    love.graphics.print("SOULS: " .. res.souls, 310, 16)
    love.graphics.setColor(0.95, 0.92, 0.82, 1)
    love.graphics.print("BONES: " .. res.bones, 435, 16)
    love.graphics.setColor(1.0, 0.45, 0.55, 1)
    love.graphics.print("HERBS: " .. res.herbs, 550, 16)
    love.graphics.setColor(0.55, 0.78, 1.0, 1)
    love.graphics.print("DARK IRON: " .. res.iron, 665, 16)
    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("RINGS: " .. #deployed .. "/" .. maxEquippedRings, 825, 16)

    -- 좌측 패널: 0x72 네크로맨서 & 근접 무기 & 확률 강화
    love.graphics.setColor(0.13, 0.11, 0.20, 1)
    love.graphics.rectangle("fill", 20, 62, 274, 458, 10, 10)
    love.graphics.setColor(0.42, 0.32, 0.62, 1)
    love.graphics.rectangle("line", 20, 62, 274, 458, 10, 10)

    local maxHp, atk, wp = getNecroCombatStats()
    local stageNames = { "STAGE 1: BROKE NOVICE", "STAGE 2: DARK WIZARD", "STAGE 3: NECROMANCER", "STAGE 4: DEMON OVERLORD" }
    love.graphics.setColor(1.0, 0.86, 0.28, 1)
    love.graphics.printf(stageNames[necro.stage], 20, 74, 274, "center")
    love.graphics.setColor(0.75, 0.82, 0.95, 1)
    love.graphics.printf("MELEE: " .. wp.name .. " +" .. necro.weaponEnhance, 20, 96, 274, "center")

    -- 0x72 네크로맨서 4프레임 살아 숨쉬는 아이들 애니메이션 (5배 확대)
    local stAnim = quads.necro_stages[necro.stage]
    local fIdx = getAnimFrame(0)
    love.graphics.setColor(0.25, 0.95, 0.55, 0.22)
    love.graphics.ellipse("fill", 157, 260, 58, 16)
    love.graphics.setColor(1, 1, 1, 1)
    if necro.stage == 1 then
        Starter.drawPortrait("down", 157, 257, 3)
    else
        love.graphics.draw(atlasImg, stAnim.idle[fIdx], 157, 260, 0, 5, 5, stAnim.w / 2, stAnim.h)
        draw0x72MeleeWeapon(157, 260, 4.5, 0)
    end
    drawBtn(50, 263, 214, 20, "CHARACTER / WALK TEST [C]", nil, {0.16, 0.15, 0.23}, {0.52, 0.47, 0.64})

    love.graphics.setColor(0.90, 0.94, 0.98, 1)
    love.graphics.printf("HP: " .. maxHp .. " (Armor +" .. necro.armorEnhance .. ")  |  CLEAVE: " .. atk, 20, 286, 274, "center")

    -- 0x72 정품 포션 플라스크 아이콘 표시
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(atlasImg, quads.flask_red, 45, 308, 0, 1.5, 1.5)
    love.graphics.print("x" .. potions.heal, 70, 314)
    love.graphics.draw(atlasImg, quads.flask_green, 125, 308, 0, 1.5, 1.5)
    love.graphics.print("x" .. potions.frenzy, 150, 314)
    love.graphics.draw(atlasImg, quads.flask_yellow, 205, 308, 0, 1.5, 1.5)
    love.graphics.print("x" .. potions.soul, 230, 314)

    local nextWp = WEAPONS[necro.weaponIdx + 1]
    local forgeSub = nextWp and ("Need " .. nextWp.costIron .. " Iron, " .. nextWp.costBones .. " Bones") or "MAX WEAPON TIER"
    drawBtn(32, 338, 250, 42, nextWp and ("FORGE: " .. nextWp.name) or "MAX MELEE FORGED", forgeSub, {0.22, 0.16, 0.34}, {0.75, 0.55, 1.0})

    local wpRate = getEnhanceSuccessRate(necro.weaponEnhance)
    local arRate = getEnhanceSuccessRate(necro.armorEnhance)
    drawBtn(32, 386, 122, 46, "WEAPON +" .. (necro.weaponEnhance + 1), wpRate .. "% Chance", {0.28, 0.18, 0.16}, {1.0, 0.78, 0.25})
    drawBtn(160, 386, 122, 46, "ARMOR +" .. (necro.armorEnhance + 1), arRate .. "% Chance", {0.16, 0.24, 0.36}, {0.35, 0.80, 1.0})

    drawBtn(32, 444, 250, 62, "RAID DUNGEON STAGE " .. dungeonStage, "Deploy " .. #deployed .. " ring summons", {0.12, 0.50, 0.28}, {0.35, 1.0, 0.60})

    -- 우측 상단: 소환 가챠 & 포션 연금
    drawBtn(306, 68, 165, 52, "RING PULL 1x", "28 Souls (Gacha)", {0.20, 0.14, 0.34}, {0.35, 0.95, 0.65})
    drawBtn(478, 68, 175, 52, "RING PULL 5x", "120 Souls (Bonus!)", {0.28, 0.15, 0.42}, {1.0, 0.84, 0.25})

    drawBtn(668, 68, 86, 52, "+1 HEAL", "2 Herbs", {0.26, 0.14, 0.20}, {1.0, 0.40, 0.50})
    drawBtn(760, 68, 86, 52, "+1 FRENZY", "2 Herbs", {0.28, 0.18, 0.12}, {1.0, 0.65, 0.25})
    drawBtn(852, 68, 86, 52, "+1 LOOT", "2 Herbs", {0.16, 0.24, 0.22}, {0.40, 1.0, 0.70})

    love.graphics.setColor(bannerCol[1], bannerCol[2], bannerCol[3], 1)
    love.graphics.print(bannerMsg, 308, 130)

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
        "Fuse two same-tier rings",
        fusionMateIdx and {0.45, 0.28, 0.12} or {0.32, 0.16, 0.38},
        {1.0, 0.82, 0.25}
    )

    love.graphics.setColor(0.85, 0.88, 0.95, 1)
    love.graphics.print(#legion .. " rings owned   |   " .. synergyText(synergies), 308, 215)
    drawBtn(730, 212, 106, 22, selU and selU.equipped and "UNEQUIP" or "EQUIP RING", nil,
        {0.16, 0.26, 0.25}, {0.49, 0.81, 0.70})
    drawBtn(845, 212, 42, 22, "UP", nil, {0.2, 0.2, 0.3}, {0.5, 0.5, 0.7})
    drawBtn(894, 212, 42, 22, "DN", nil, {0.2, 0.2, 0.3}, {0.5, 0.5, 0.7})

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

            -- 0x72 소환수 4프레임 아이들 애니메이션!
            local anim = quads.anims[meta.animKey]
            local uf = getAnimFrame(idx * 0.3)
            local iconScale = (anim.w == 32) and 1.35 or 2.2
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.draw(atlasImg, anim.idle[uf], cx + 24, cy + 62, 0, iconScale, iconScale, anim.w / 2, anim.h)

            love.graphics.setColor(tc[1], tc[2], tc[3], 1)
            local name = "[" .. meta.tier .. "] " .. meta.name
            local stats = "+" .. u.enhance .. "  ATK " .. uAtk .. "  HP " .. hp
            local font = love.graphics.getFont()
            love.graphics.print(name, cx + 46, cy + 7, 0, math.min(1, 101 / font:getWidth(name)), 1)
            love.graphics.setColor(0.75, 0.82, 0.95, 1)
            love.graphics.print("#" .. string.upper(summonTag(meta)), cx + 46, cy + 25)
            love.graphics.setColor(0.92, 0.95, 0.98, 1)
            love.graphics.print(stats, cx + 46, cy + 44, 0, math.min(1, 101 / font:getWidth(stats)), 1)
            if u.equipped then
                love.graphics.setColor(0.45, 1.0, 0.68, 1)
                love.graphics.print("EQUIPPED", cx + 46, cy + 61)
            else
                love.graphics.setColor(0.62, 0.65, 0.72, 1)
                love.graphics.print("IN INVENTORY", cx + 46, cy + 61)
            end
        else
            love.graphics.setColor(0.26, 0.22, 0.36, 0.5)
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", cx, cy, 152, 80, 7, 7)
        end
    end
end

local function drawBattle()
    -- 0x72 정품 던전 석재 바닥 타일맵 렌더링 (48x48 스케일)
    love.graphics.setColor(1, 1, 1, 1)
    for gx = 1, 18 do
        for gy = 1, 9 do
            local q = ((gx + gy) % 2 == 0) and quads.floors[1] or quads.floors2[2]
            love.graphics.draw(atlasImg, q, gx * 48, 32 + gy * 48, 0, 3, 3)
        end
    end
    love.graphics.setColor(0.40, 0.30, 0.58, 1)
    love.graphics.setLineWidth(3)
    love.graphics.rectangle("line", 48, 80, 864, 432, 6, 6)

    -- 전리품 드랍 (0x72 해골 / 플라스크 / 코인 도트 아이콘)
    for _, l in ipairs(lootDrops) do
        love.graphics.setColor(1, 1, 1, 1)
        if l.kind == "xp" then
            local x, y = math.floor(l.x), math.floor(l.y)
            love.graphics.setColor(0.12, 0.28, 0.40)
            love.graphics.polygon("fill", x, y - 8, x + 6, y, x, y + 8, x - 6, y)
            love.graphics.setColor(xpColor)
            love.graphics.polygon("fill", x, y - 6, x + 4, y, x, y + 6, x - 4, y)
            love.graphics.setColor(0.77, 0.96, 1.0)
            love.graphics.rectangle("fill", x - 1, y - 3, 2, 4)
        elseif l.kind == "bones" then
            love.graphics.draw(atlasImg, quads.skull, l.x, l.y, 0, 1.6, 1.6, 8, 8)
        elseif l.kind == "herbs" then
            love.graphics.draw(atlasImg, quads.flask_red, l.x, l.y, 0, 1.5, 1.5, 8, 8)
        elseif l.kind == "iron" then
            love.graphics.draw(atlasImg, quads.flask_blue, l.x, l.y, 0, 1.5, 1.5, 8, 8)
        else
            local cf = getAnimFrame(l.x)
            love.graphics.draw(atlasImg, quads.coin[cf], l.x, l.y, 0, 2.5, 2.5, 4, 4)
        end
    end

    -- 네크로맨서 근접 베기(Melee Cleave Arc)
    local swingWindup = usesStarterSwing() and Starter.attackWindup or 0
    local swingElapsed = necro.swingDuration - necro.swingTimer
    if necro.swingTimer > 0 and swingElapsed >= swingWindup then
        local _, _, wp = getNecroCombatStats()
        local ratio = necro.swingTimer / (necro.swingDuration - swingWindup)
        love.graphics.setColor(wp.col[1], wp.col[2], wp.col[3], ratio * 0.55)
        love.graphics.arc("fill", necro.x, necro.y - 18, meleeReach(wp), necro.swingAngle - 1.25, necro.swingAngle + 1.25)
        love.graphics.setColor(1, 1, 1, ratio * 0.9)
        love.graphics.setLineWidth(4)
        love.graphics.arc("line", "open", necro.x, necro.y - 18, meleeReach(wp), necro.swingAngle - 1.25, necro.swingAngle + 1.25)
    end

    local stAnim = quads.necro_stages[necro.stage]

    -- Y좌표 깊이 정렬 후 0x72 4프레임 애니메이션 렌더링
    local drawList = { { kind = "necro", y = necro.y } }
    for _, s in ipairs(activeSummons) do table.insert(drawList, { kind = "summon", y = s.y, ref = s }) end
    for _, e in ipairs(enemies) do table.insert(drawList, { kind = "enemy", y = e.y, ref = e }) end
    table.sort(drawList, function(a, b) return a.y < b.y end)

    for _, item in ipairs(drawList) do
        if item.kind == "necro" then
            love.graphics.setColor(0.04, 0.03, 0.08, 0.5)
            love.graphics.ellipse("fill", necro.x, necro.y + 2, 20, 7)
            love.graphics.setColor(1, 1, 1, 1)
            local x, y = math.floor(necro.x), math.floor(necro.y)
            if usesStarterSwing() and necro.swingTimer > 0 then
                Starter.drawAttack(necro.swingDirection, swingElapsed, x, y, 2)
            else
                if necro.stage == 1 then
                    Starter.drawWalk(necro.direction, necro.walkFrame, x, y, 2)
                else
                    local nf = getAnimFrame(0)
                    local nQuad = necro.moving and stAnim.run[nf] or stAnim.idle[nf]
                    local facing = necro.swingTimer > 0 and necro.swingFacing or necro.facing
                    love.graphics.draw(atlasImg, nQuad, x, y, 0, 3 * facing, 3, stAnim.w / 2, stAnim.h)
                end
                draw0x72MeleeWeapon(necro.x, necro.y, 3.0, necro.swingTimer / necro.swingDuration)
            end
        elseif item.kind == "summon" then
            local s = item.ref
            local anim = quads.anims[s.meta.animKey]
            local sf = getAnimFrame(s.animOffset)
            local sQuad = s.moving and anim.run[sf] or anim.idle[sf]
            love.graphics.setColor(0.04, 0.03, 0.08, 0.42)
            love.graphics.ellipse("fill", s.x, s.y + 2, 14, 5)
            love.graphics.setColor(1, s.hitFlash > 0 and 0.4 or 1, s.hitFlash > 0 and 0.4 or 1, 1)
            love.graphics.draw(atlasImg, sQuad, math.floor(s.x), math.floor(s.y), 0, s.meta.scale * s.facing, s.meta.scale, anim.w / 2, anim.h)
        elseif item.kind == "enemy" then
            local e = item.ref
            local anim = quads.anims[e.animKey]
            local ef = getAnimFrame(e.animOffset)
            love.graphics.setColor(0.04, 0.03, 0.08, 0.48)
            love.graphics.ellipse("fill", e.x, e.y + 2, e.radius, e.radius * 0.4)
            love.graphics.setColor(1, e.hitFlash > 0 and 0.3 or 1, e.hitFlash > 0 and 0.3 or 1, 1)
            love.graphics.draw(atlasImg, anim.run[ef], math.floor(e.x), math.floor(e.y), 0, e.scale * e.facing, e.scale, anim.w / 2, anim.h)
            local bw = e.isBoss and 64 or 28
            love.graphics.setColor(0.1, 0.1, 0.15, 0.85)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * anim.h - 6, bw, 5)
            love.graphics.setColor(0.95, 0.28, 0.35, 1)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * anim.h - 6, bw * math.max(0, e.hp / e.maxHp), 5)
            if isMarked(e) then
                local x, y = math.floor(e.x), math.floor(e.y - e.scale * anim.h - 14)
                love.graphics.setColor(markColor)
                love.graphics.polygon("fill", x, y - 5, x + 5, y, x, y + 5, x - 5, y)
            end
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

    -- 상단 전투 HUD
    love.graphics.setColor(0.10, 0.08, 0.16, 0.94)
    love.graphics.rectangle("fill", 0, 0, 960, 48)
    love.graphics.setColor(0.95, 0.28, 0.35, 1)
    love.graphics.rectangle("fill", 20, 14, 170 * math.max(0, necro.hp / necro.maxHp), 20, 4, 4)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.rectangle("line", 20, 14, 170, 20, 4, 4)
    love.graphics.print("HP " .. math.max(0, math.floor(necro.hp)) .. "/" .. necro.maxHp, 28, 17)

    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("STAGE " .. dungeonStage .. " | ENEMIES: " .. #enemies .. " | ARMY: " .. #activeSummons, 205, 17)
    love.graphics.setColor(0.94, 0.94, 0.99)
    love.graphics.print("Run Lv. " .. run.level, 505, 9)
    love.graphics.print(run.xp .. " / " .. run.threshold .. " XP", 706, 9)
    love.graphics.setColor(0.17, 0.27, 0.39)
    love.graphics.rectangle("fill", 568, 16, 128, 8, 3, 3)
    love.graphics.setColor(xpColor)
    love.graphics.rectangle("fill", 568, 16, 128 * math.min(1, run.xp / run.threshold), 8, 3, 3)
    love.graphics.setColor(0.68, 0.80, 0.87)
    love.graphics.print("WASD / Arrows", 800, 9)
    love.graphics.print("Auto flasks " .. potions.heal .. "/" .. potions.frenzy .. "/" .. potions.soul, 800, 28)
    love.graphics.setColor(markColor)
    love.graphics.print(synergyText(runSynergies), 505, 28)
end

local function drawLevelUp()
    love.graphics.setColor(0.045, 0.040, 0.075, 0.88)
    love.graphics.rectangle("fill", 0, 0, 960, 540)
    love.graphics.setColor(xpColor)
    love.graphics.printf("RUN LEVEL " .. run.level, 0, 139, 960 / 1.8, "center", 0, 1.8, 1.8)
    love.graphics.setColor(0.91, 0.92, 0.98)
    love.graphics.printf("Choose a boon for this raid", 0, 185, 960, "center")
    local cards = upgradeCards
    for index, choice in ipairs(run.choices) do
        local x = cards.x + (index - 1) * (cards.width + cards.gap)
        local y = cards.y
        love.graphics.setColor(0.14, 0.11, 0.21)
        love.graphics.rectangle("fill", x, y, cards.width, cards.height, 9, 9)
        love.graphics.setLineWidth(2)
        love.graphics.setColor(choice.requires and markColor or xpColor)
        love.graphics.rectangle("line", x, y, cards.width, cards.height, 9, 9)
        love.graphics.print(tostring(index), x + 15, y + 12)
        love.graphics.printf(choice.name, x + 17, y + 32, cards.width - 34, "center")
        love.graphics.setColor(0.89, 0.90, 0.96)
        love.graphics.printf(choice.description, x + 20, y + 66, cards.width - 40, "center")
    end
    love.graphics.setColor(0.71, 0.76, 0.85)
    love.graphics.printf("Click a card or press 1, 2, or 3", 0, 382, 960, "center")
end

function love.draw()
    if mode == "preview" then
        CharacterPreview.draw(timeAcc)
        return
    end
    love.graphics.push()
    if shakeTimer > 0 and mode ~= "levelup" then
        love.graphics.translate((math.random() - 0.5) * shakeMag, (math.random() - 0.5) * shakeMag)
    end

    if mode == "camp" then
        drawCamp()
    elseif mode == "battle" or mode == "levelup" then
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

    if mode == "levelup" then drawLevelUp() end
    love.graphics.pop()
end
