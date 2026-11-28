-- NECROMANCER DUNGEON & LEGION — Powered by 0x72 DungeonTileset II v1.7 (CC0 Official Pixel Art Atlas)
-- Love2D + Lua

local Starter = require("starter_character")
local Melee = require("melee_attack")
local Targeting = require("combat_targeting")
local Progress = require("run_progress")
local Waves = require("raid_waves")
local Catalog = require("summon_catalog")
local SummonArt = require("summon_art")
local SummonPose = require("summon_combat_pose")
local GraveFire = require("grave_fire")
local Roles = require("summon_roles")
local CharacterPreview = require("character_preview")

local atlasImg
local quads = {}

local mode = "camp" -- "preview" | "camp" | "battle" | "levelup" | "reward" | "gameover"
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
    { name = "Spiked Club", baseAtk = 18, arcRadius = 62, cd = 0.38, costIron = 0, costBones = 0, col = {0.90, 0.85, 0.72} },
    { name = "Butcher Cleaver", quadKey = "wp_cleaver", baseAtk = 32, arcRadius = 74, cd = 0.35, costIron = 4, costBones = 4, col = {0.82, 0.90, 1.00} },
    { name = "Sawtooth Blade", quadKey = "wp_saw", baseAtk = 52, arcRadius = 88, cd = 0.33, costIron = 7, costBones = 7, col = {0.75, 0.50, 1.00} },
    { name = "Executioner Axe", quadKey = "wp_waraxe", baseAtk = 78, arcRadius = 102, cd = 0.31, costIron = 11, costBones = 11, col = {1.00, 0.45, 0.45} },
    { name = "Golden Greatsword", quadKey = "wp_gold", baseAtk = 115, arcRadius = 118, cd = 0.28, costIron = 16, costBones = 16, col = {1.00, 0.86, 0.25} },
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
    swingCooldown = 0,
    invulnTimer = 0,
    frenzyTimer = 0,
    soulBoostTimer = 0,
}

local UNIT_DB = Catalog

local TIER_COLORS = {
    C = {0.74, 0.80, 0.88},
    B = {0.25, 0.80, 1.00},
    A = {0.82, 0.45, 1.00},
    S = {1.00, 0.84, 0.20},
}

local legion = {}
local selectedUnitIdx = 1
local fusionMateIdx = nil
local rosterScroll = 0
local maxEquippedRings = 10
local choiceCards = { x = 136, y = 222, width = 220, height = 132, gap = 14 }
local run = Progress.new()
local runSynergies = {}
local raidWave = 1
local waveRespite = 1.05
local nextWaveIn, ringRewards
local xpColor = { 0.40, 0.83, 1.0 }
local markColor = { 0.97, 0.74, 0.39 }

local bannerMsg = "Select a summon in the inventory, then Equip Ring to take it into a raid."
local bannerCol = {0.55, 1.0, 0.72}

local activeSummons, raidRings = {}, {}
local raidHeroScale = 1.34
local raidHeroHeight = 128 * 0.4 * raidHeroScale
local enemies = {}
local projectiles = {}
local enemyProjectiles = {}
local graveFire = GraveFire.new()
local roleEffects = Roles.new()
local omenXpReadyAt = 0
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
    SummonArt.load()
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

    quads.anims = {
        enemy_knight = { idle = makeAnimQuads(128, 100, 16, 28, 4), run = makeAnimQuads(192, 100, 16, 28, 4), w = 16, h = 28 },
        enemy_mage   = { idle = makeAnimQuads(128, 132, 16, 28, 4), run = makeAnimQuads(192, 132, 16, 28, 4), w = 16, h = 28 },
        enemy_boss   = { idle = makeAnimQuads(16, 380, 32, 36, 4),  run = makeAnimQuads(144, 380, 32, 36, 4), w = 32, h = 36 },
    }

    for index, id in ipairs(Catalog.options(1)) do
        local ring = Catalog.ring(id)
        ring.equipped = index <= 3
        legion[#legion + 1] = ring
    end
end

local function addShake(dur, mag)
    if shakeTimer <= 0 then shakeMag = 0 end
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
    local families = {}
    for _, ring in ipairs(equipped) do
        families[UNIT_DB[ring.id].family] = true
    end
    return {
        markedShot = families.shield and families.archer, kindling = families.sword and families.ember,
        searing = families.ember and families.spider, tailwind = families.moth and families.archer,
        bulwark = families.doll and families.shield, snare = families.wraith and families.spider,
        omen = families.raven and families.mole,
    }
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
    local bestRank = 1
    for _ = 1, count do
        local roll = math.random()
        local rank = roll < 0.05 and 4 or roll < 0.18 and 3 or roll < 0.48 and 2 or 1
        local options = Catalog.options(rank)
        local id = options[math.random(#options)]
        legion[#legion + 1] = Catalog.ring(id, math.random(2))
        bestRank = math.max(bestRank, rank)
    end
    local bestTier = UNIT_DB[bestRank].tier

    selectedUnitIdx = #legion
    rosterScroll = math.max(0, math.floor((selectedUnitIdx - 1) / 4) - 2)
    fusionMateIdx = nil
    setBanner("Pulled " .. count .. " ring(s). Best rank " .. bestTier .. ". Select a ring to equip.", TIER_COLORS[bestTier])
    addShake(bestTier == "S" and 0.35 or 0.12, bestTier == "S" and 8 or 3)
    spawnParticles(160, 250, TIER_COLORS[bestTier], count * 8, 140)
end

local function promoteUnitTree()
    local u = legion[selectedUnitIdx]
    if not u then return end
    local meta = UNIT_DB[u.id]
    if not meta.nextId then
        setBanner(meta.name .. " is already rank S.", {1, 0.82, 0.25})
        return
    end
    local soulCost = ({35, 75, 160})[meta.rank]
    local boneCost = meta.rank * 3
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

local function fuseRings(idx1, idx2)
    if idx1 == idx2 then return end
    local first, second = legion[idx1], legion[idx2]
    if not first or not second then return end
    local meta = UNIT_DB[first.id]
    if first.id ~= second.id or not meta.nextId then
        fusionMateIdx = nil
        setBanner("Fusion needs two rings of the same summon and rank C, B, or A.", {1, 0.66, 0.42})
        return
    end

    first.id = meta.nextId
    first.enhance = math.max(first.enhance, second.enhance)
    first.equipped = first.equipped or second.equipped
    table.remove(legion, idx2)
    selectedUnitIdx = idx1 - (idx2 < idx1 and 1 or 0)
    rosterScroll = math.max(0, math.floor((selectedUnitIdx - 1) / 4) - 2)
    fusionMateIdx = nil
    setBanner("Ring fused into " .. UNIT_DB[first.id].name .. ".", TIER_COLORS[UNIT_DB[first.id].tier])
    spawnParticles(520, 240, TIER_COLORS[UNIT_DB[first.id].tier], 18, 125)
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

local function summonFromRing(slot)
    local ring = slot.ring
    local hp, atk, meta = getUnitCombatStats(ring)
    local angle = (slot.index - 1) * 2.4 + slot.alive * 0.64
    local x, y = Waves.clamp(necro.x + math.cos(angle) * 44, necro.y + math.sin(angle) * 44)
    slot.alive = slot.alive + 1
    activeSummons[#activeSummons + 1] = {
        slot = slot, meta = meta, x = x, y = y, hp = hp, maxHp = hp, atk = atk,
        cdTimer = math.random() * 0.32,
        hitFlash = 0, facing = math.cos(angle) < 0 and -1 or 1, moving = false,
        attackTime = 0, attackAngle = 0, walk = 0,
        guardTime = 0, lungeTime = 0, chainTime = 0, strikes = 0,
    }
    spawnParticles(x, y - 8, (meta.fire or meta.rank == 4) and meta.accent or TIER_COLORS[meta.tier], 5, 70)
end

local function updateRingSummons(dt)
    for _, slot in ipairs(raidRings) do
        if slot.alive < slot.stats.limit then
            slot.timer = slot.timer - dt
            if slot.timer <= 0 then
                summonFromRing(slot)
                slot.timer = slot.stats.cooldown
            end
        end
    end
end

local function beginRaidWave(wave)
    raidWave, nextWaveIn = wave, nil
    enemies = Waves.spawn(wave, dungeonStage, necro.x, necro.y)
    projectiles, enemyProjectiles = {}, {}
    graveFire = GraveFire.new()
    roleEffects = Roles.new()
end

local function startDungeonRun()
    run = Progress.new()
    local equipped = equippedRings()
    runSynergies = getSynergies(equipped)
    ringRewards = nil
    mode = "battle"
    local maxHp = getNecroCombatStats()
    necro.maxHp = maxHp; necro.hp = maxHp
    necro.x, necro.y = Waves.width / 2, Waves.height / 2
    necro.direction, necro.walkFrame, necro.walkDistance = "down", 0, 0
    necro.moving = false
    necro.attack, necro.swingCooldown = nil, 0
    shakeTimer, shakeMag = 0, 0
    necro.invulnTimer = 0.6
    necro.hasteUntil, necro.barrierUntil = 0, 0
    omenXpReadyAt = 0
    necro.frenzyTimer = 0; necro.soulBoostTimer = 0
    dungeonLootEarned = { souls = 0, bones = 0, herbs = 0, iron = 0 }
    activeSummons, raidRings, lootDrops, particles, popTexts = {}, {}, {}, {}, {}
    for index, ring in ipairs(equipped) do
        local stats = Catalog.stats(ring)
        local slot = { ring = ring, stats = stats, alive = 0, timer = stats.cooldown, index = index }
        raidRings[index] = slot
        summonFromRing(slot)
    end
    beginRaidWave(1)
end

local function openRingRewards()
    ringRewards = {}
    local options = Catalog.options(dungeonStage == 1 and 2 or 3)
    for index = 1, 3 do
        local id = table.remove(options, math.random(#options))
        ringRewards[index] = Catalog.ring(id, math.random(2))
    end
    mode = "reward"
end

local function chooseRingReward(index)
    local ring = ringRewards and ringRewards[index]
    if not ring then return end
    table.insert(legion, ring)
    selectedUnitIdx = #legion
    rosterScroll = math.max(0, math.floor((selectedUnitIdx - 1) / 4) - 2)
    ringRewards = nil
    dungeonStage = dungeonStage + 1
    mode = "camp"
    local summon = UNIT_DB[ring.id]
    setBanner(summon.name .. " ring added to inventory. Equip it for the next raid.", TIER_COLORS[summon.tier])
end

local function meleeReach(weapon)
    return weapon.arcRadius + 12 * (run.ranks.range or 0)
end

local function applyNecroMeleeSwing(impact, reach)
    local _, atk, wp = getNecroCombatStats()
    atk = math.floor(atk * (1 + 0.25 * (run.ranks.weapon or 0)))
    local hitCount = 0
    for _, e in ipairs(enemies) do
        if e.hp > 0 and Melee.contains(impact, necro.x, necro.y, e, reach) then
            local angle = math.atan2(e.y - necro.y, e.x - necro.x)
            local pushSpeed = e.isBoss and 71 or 212
            e.hp = e.hp - atk
            e.hitFlash, e.recoilTime = 0.10, 0.085
            e.recoilX, e.recoilY = math.cos(angle) * pushSpeed, math.sin(angle) * pushSpeed
            spawnPop(e.x, e.y - 28, tostring(atk) .. "!", wp.col)
            spawnParticles(e.x, e.y - 14, wp.col, 5, 100)
            hitCount = hitCount + 1
        end
    end
    if hitCount > 0 then addShake(0.075, math.min(3.5, 1.5 + hitCount * 0.5)) end
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

local function directionTo(actor, target)
    return math.atan2(target.y - actor.y, target.x - actor.x)
end

local function summonHeight(summon)
    local heroHeight = necro.stage == 1 and raidHeroHeight or quads.necro_stages[necro.stage].h * 2.1
    return heroHeight * summon.meta.size
end

local function summonBob(summon)
    local family = summon.meta.family
    if summon.meta.fire or family == "moth" or family == "wraith" or family == "raven" then
        return 7 + math.sin(timeAcc * 5 + summon.slot.index * 1.7) * 3
    end
    return summon.moving and math.abs(math.sin(summon.walk)) * 1.6 or 0
end

local function hitWithSummon(summon, target, damage, tint)
    target.hp = target.hp - damage
    target.hitFlash = 0.10
    tint = tint or (summon.meta.rank == 4 and summon.meta.accent or TIER_COLORS[summon.meta.tier])
    spawnPop(target.x, target.y - 22, tostring(damage), tint)
end

local function shootArrow(summon, target, damage, volley)
    local x, y = SummonPose.arrowOrigin(summon.slot.ring, math.floor(summon.x),
        math.floor(summon.y - summonBob(summon)), summonHeight(summon), summon.facing, summon.weaponAttack)
    local angle = math.atan2(target.y - 14 - y, target.x - x)
    projectiles[#projectiles + 1] = {
        x = x, y = y,
        vx = math.cos(angle) * 415, vy = math.sin(angle) * 415,
        dmg = damage, owner = summon, volley = volley, life = 0.90,
        col = summon.meta.rank == 4 and summon.meta.accent or (isMarked(target) and markColor or TIER_COLORS[summon.meta.tier]),
    }
end

local function applySummonProjectile(arrow, enemy)
    local summon = arrow.owner
    local marked = isMarked(enemy)
    local damage = arrow.dmg
    if marked and runSynergies.markedShot then
        damage = damage + math.floor(damage * (0.5 + 0.25 * (run.ranks.shot or 0)))
        spawnParticles(enemy.x, enemy.y - 10, markColor, 3, 90)
    end
    hitWithSummon(summon, enemy, damage, marked and markColor or arrow.col)

    if marked and arrow.volley and summon.meta.rank >= 4 then
        summon.trackingHits = summon.tracking == enemy and (summon.trackingHits or 0) + 1 or 1
        summon.tracking = enemy
        if summon.trackingHits >= 3 then
            summon.trackingHits = 0
            if enemy.hp > 0 and summon.hp > 0 then
                summon.followup = {target = enemy, damage = math.floor(arrow.dmg * 1.35)}
            end
        end
    end

    if marked and not arrow.pierced and summon.meta.rank >= 2 then
        arrow.pierced = enemy
        arrow.dmg = math.max(1, math.floor(arrow.dmg * (0.65 + summon.slot.stats.pierce)))
        return false
    end
    return true
end

local function bashTarget(summon, enemy, damage)
    enemy.markTimer = 3 + summon.slot.stats.mark
    enemy.provokedBy, enemy.provokeUntil = summon, timeAcc + 1.4
    local direction = directionTo(summon, enemy)
    local knockback = enemy.isBoss and 5 or 15 * (1 + summon.slot.stats.push)
    enemy.x, enemy.y = Waves.clamp(enemy.x + math.cos(direction) * knockback,
        enemy.y + math.sin(direction) * knockback)
    hitWithSummon(summon, enemy, damage, markColor)
end

local function strikeWithSummon(summon, target, damage)
    local meta = summon.meta
    if not SummonPose[meta.family] then
        summon.attackTime, summon.attackAngle = 0.23, directionTo(summon, target)
    end
    if meta.family == "shield" then
        if meta.rank >= 2 then summon.guardTime = 0.64 end
        bashTarget(summon, target, damage)
        if meta.rank >= 3 then
            local angle = summon.attackAngle
            local second = Targeting.nearest(enemies, summon.x, summon.y, meta.reach, function(enemy)
                return enemy ~= target and math.cos(directionTo(summon, enemy) - angle) >= 0.30
            end)
            if second then bashTarget(summon, second, damage) end
        end
    elseif meta.family == "sword" then
        summon.strikes = summon.strikes + 1
        if meta.rank >= 2 and summon.strikes % 3 == 0 then damage = damage * 2 end
        if meta.rank >= 4 and summon.chainTime <= 0 and target.lastSword ~= summon
            and timeAcc - (target.lastSwordTime or -100) < 0.9 then
            summon.chainTime = 1.6
            damage = damage + math.floor(summon.atk * 0.75)
        end
        if runSynergies.kindling and target.burning then
            damage = damage + math.floor(damage * (0.30 + 0.15 * (run.ranks.kindling or 0)))
        end
        target.lastSword, target.lastSwordTime = summon, timeAcc
        hitWithSummon(summon, target, damage)
        if meta.rank >= 3 and target.hp <= 0 then
            summon.lungeTime, summon.cdTimer = 0.32, math.min(0.24, summon.cdTimer)
        end
    elseif meta.fire then
        local center = GraveFire.cast(graveFire, summon, target, enemies, damage)
        summon.attackAngle = directionTo(summon, center)
        summon.facing = center.x >= summon.x and 1 or -1
    elseif meta.family == "spider" then
        summon.fuseTime, summon.fuseDamage = 0.32, damage
    elseif meta.ability then
        Roles.strike(roleEffects, summon, target, enemies, damage, hitWithSummon, timeAcc, runSynergies)
    else
        shootArrow(summon, target, damage, true)
        if meta.rank >= 3 and isMarked(target) then
            local second = Targeting.nearest(enemies, summon.x, summon.y, meta.reach,
                function(enemy) return enemy ~= target and isMarked(enemy) end)
            if second then shootArrow(summon, second, math.max(1, math.floor(damage * 0.5)), false) end
        end
    end
end

local function startSummonAttack(summon, target, damage, followup)
    summon.weaponAttack = {
        target = target, damage = damage, elapsed = 0, angle = directionTo(summon, target), followup = followup,
    }
    summon.facing = target.x >= summon.x and 1 or -1
end

local function inAttackRange(summon, target)
    local reach = summon.meta.reach
    if summon.meta.family == "archer" and runSynergies.markedShot and isMarked(target) then
        reach = reach * (1 + summon.slot.stats.markedRange)
    end
    return target.hp > 0 and (summon.x - target.x)^2 + (summon.y - target.y)^2 <= (reach + target.radius)^2
end

local function advanceSummonAttack(summon, fallback, dt)
    local attack = summon.weaponAttack
    local timing = SummonPose[summon.meta.family]
    local elapsed = attack.elapsed + dt
    if attack.elapsed < timing.impact then
        local target = attack.target
        if not inAttackRange(summon, target) then target = fallback end
        local inRange = target and inAttackRange(summon, target)
        if inRange then
            attack.target, attack.angle = target, directionTo(summon, target)
            if math.abs(target.x - summon.x) > 3 then summon.facing = target.x > summon.x and 1 or -1 end
        end
        if elapsed >= timing.impact and inRange then
            attack.elapsed = timing.impact
            if attack.followup then
                shootArrow(summon, target, attack.damage, false)
            else
                strikeWithSummon(summon, target, attack.damage)
            end
        end
    end
    attack.elapsed = elapsed
    if elapsed >= timing.duration then summon.weaponAttack = nil end
end

local function damageSummon(summon, damage, enemy, fromX, fromY)
    if summon.guardTime > 0 then
        local ox, oy = fromX - summon.x, fromY - summon.y
        if ox * math.cos(summon.attackAngle) + oy * math.sin(summon.attackAngle) >= 0 then
            summon.guardTime = 0
            damage = math.max(1, math.floor(damage * 0.4))
            spawnParticles(summon.x, summon.y - 19, markColor, 5, 85)
            if summon.meta.rank >= 4 and enemy and enemy.hp > 0 then
                local dx, dy = enemy.x - summon.x, enemy.y - summon.y
                if dx * dx + dy * dy <= 68 * 68 then
                    summon.attackTime, summon.attackAngle = 0.23, directionTo(summon, enemy)
                    bashTarget(summon, enemy, summon.atk)
                end
            end
        end
    end
    summon.hp = summon.hp - Roles.absorb(summon, damage, timeAcc)
    summon.hitFlash = 0.1
end

local function damageNecro(damage)
    if necro.invulnTimer > 0 then return end
    damage = Roles.absorb(necro, damage, timeAcc)
    necro.hp = necro.hp - damage
    necro.invulnTimer = 0.45
    if damage == 0 then return end
    addShake(0.13, 5)
    spawnPop(necro.x, necro.y - 42, "-" .. damage, {1, 0.3, 0.3})
end

local function enemySeparation(enemy)
    local sx, sy = 0, 0
    for _, other in ipairs(enemies) do
        if enemy ~= other and other.hp > 0 then
            local dx, dy = enemy.x - other.x, enemy.y - other.y
            local distanceSquared = dx * dx + dy * dy
            local spacing = enemy.radius + other.radius + 3
            if distanceSquared > 0.01 and distanceSquared < spacing * spacing then
                local force = (spacing / math.sqrt(distanceSquared) - 1) * 5
                sx, sy = sx + dx * force, sy + dy * force
            end
        end
    end
    return sx, sy
end

local function updateSummon(summon, dt, spdMult)
    local meta, stats = summon.meta, summon.slot.stats
    local attackHaste, moveHaste = Roles.haste(summon, timeAcc)
    summon.cdTimer = math.max(0, summon.cdTimer - dt * spdMult * (1 + attackHaste))
    summon.attackTime = math.max(0, summon.attackTime - dt)
    summon.hitFlash = math.max(0, summon.hitFlash - dt)
    summon.guardTime = math.max(0, summon.guardTime - dt)
    summon.lungeTime = math.max(0, summon.lungeTime - dt)
    summon.chainTime = math.max(0, summon.chainTime - dt)
    if summon.fuseTime then
        summon.moving = false
        summon.fuseTime = summon.fuseTime - dt * (1 + attackHaste)
        if summon.fuseTime <= 0 then
            Roles.explode(roleEffects, summon, summon.fuseDamage, enemies, hitWithSummon, timeAcc, runSynergies.searing)
        end
        return
    end
    if meta.support and summon.cdTimer <= 0 then
        local used
        if meta.family == "mole" then
            used = Roles.collect(roleEffects, summon, lootDrops)
        elseif meta.family == "doll" or Targeting.nearest(enemies, summon.x, summon.y, 285) then
            used = Roles.support(roleEffects, summon, activeSummons, necro, runSynergies, timeAcc, spawnPop)
        end
        if used then summon.cdTimer = meta.cd / (1 + stats.speed / 100) end
    end

    local dx, dy = necro.x - summon.x, necro.y - summon.y
    local leash = dx * dx + dy * dy
    local target, distance
    local reach = meta.reach
    if not meta.support and leash < 305 * 305 then
        if meta.family == "archer" and runSynergies.markedShot then
            reach = reach * (1 + stats.markedRange)
            target, distance = Targeting.nearest(enemies, summon.x, summon.y, reach, isMarked)
            if not target then reach = meta.reach end
        elseif meta.family == "shield" then
            target = Targeting.nearest(enemies, necro.x, necro.y, 205)
            if target then
                local ox, oy = target.x - summon.x, target.y - summon.y
                distance = math.sqrt(ox * ox + oy * oy)
            end
        end
        if not target then target, distance = Targeting.nearest(enemies, summon.x, summon.y, 255) end
    end

    local mx, my = 0, 0
    if summon.weaponAttack then
        advanceSummonAttack(summon, target, dt * math.min(1.65, spdMult * (1 + attackHaste)))
    end
    if not summon.weaponAttack and summon.followup then
        local followup = summon.followup
        summon.followup = nil
        if inAttackRange(summon, followup.target) then
            startSummonAttack(summon, followup.target, followup.damage, true)
        end
    end
    if target then
        local angle = directionTo(summon, target)
        if not summon.weaponAttack then summon.facing = target.x >= summon.x and 1 or -1 end
        if distance <= reach + target.radius then
            if summon.cdTimer <= 0 and not summon.weaponAttack and target.hp > 0 then
                summon.cdTimer = meta.cd / (1 + stats.speed / 100)
                local damage = math.floor(summon.atk * (1 + 0.20 * (run.ranks.summon or 0)))
                if SummonPose[meta.family] then
                    startSummonAttack(summon, target, damage)
                else
                    strikeWithSummon(summon, target, damage)
                end
            end
            if (meta.family == "archer" or meta.fire or meta.family == "raven" or meta.family == "wraith") and distance < 52 then
                mx, my = -math.cos(angle) * 65, -math.sin(angle) * 65
            end
        else
            local speed = meta.spd * spdMult * (summon.lungeTime > 0 and 1.85 or 1)
            mx, my = math.cos(angle) * speed, math.sin(angle) * speed
        end
    elseif leash > 58 * 58 then
        local angle = math.atan2(dy, dx)
        local speed = math.max(meta.spd, math.min(220, math.sqrt(leash) * 1.8))
        mx, my = math.cos(angle) * speed, math.sin(angle) * speed
        if not summon.weaponAttack then summon.facing = dx >= 0 and 1 or -1 end
    end

    for _, other in ipairs(activeSummons) do
        if other ~= summon then
            local ox, oy = summon.x - other.x, summon.y - other.y
            local distanceSquared = ox * ox + oy * oy
            if distanceSquared > 0.1 and distanceSquared < 390 then
                local repulsion = 56 / math.sqrt(distanceSquared)
                mx, my = mx + ox * repulsion, my + oy * repulsion
            end
        end
    end

    summon.x, summon.y = Waves.clamp(summon.x + mx * (1 + moveHaste) * dt, summon.y + my * (1 + moveHaste) * dt)
    summon.moving = math.abs(mx) > 9 or math.abs(my) > 9
    if summon.moving then summon.walk = summon.walk + dt * 16 end
end

local function offerRunUpgrade()
    Progress.offer(run, runSynergies)
    mode = run.choices and "levelup" or "battle"
end

local function chooseRunUpgrade(index)
    if Progress.pick(run, index) then offerRunUpgrade() end
end

local function updateBattle(dt)
    local heroHaste, heroMoveHaste = Roles.haste(necro, timeAcc)
    local attackDt = dt * (1 + heroHaste)
    necro.swingCooldown = math.max(0, necro.swingCooldown - attackDt)
    necro.invulnTimer = math.max(0, necro.invulnTimer - dt)
    necro.frenzyTimer = math.max(0, necro.frenzyTimer - dt)
    necro.soulBoostTimer = math.max(0, necro.soulBoostTimer - dt)
    for _, enemy in ipairs(enemies) do
        if enemy.markTimer then enemy.markTimer = math.max(0, enemy.markTimer - dt) end
    end
    GraveFire.update(graveFire, enemies, dt, hitWithSummon)
    Roles.update(roleEffects, dt, timeAcc, enemies, hitWithSummon)

    local dx, dy = Starter.movementInput()
    necro.moving = dx ~= 0 or dy ~= 0
    if dx ~= 0 then necro.facing = dx > 0 and 1 or -1 end
    local oldX, oldY = necro.x, necro.y
    necro.direction = Starter.facing(dx, dy, necro.direction)
    local speed = 190 * (1 + 0.10 * (run.ranks.speed or 0)) * (1 + heroMoveHaste)
    necro.x, necro.y = Waves.clamp(necro.x + dx * speed * dt, necro.y + dy * speed * dt)
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

    local weapon = WEAPONS[necro.weaponIdx]
    local reach = meleeReach(weapon)
    local impact
    necro.attack, impact = Melee.advance(necro.attack, attackDt, necro.x, necro.y, enemies, reach)
    if impact then applyNecroMeleeSwing(impact, reach) end
    if not necro.attack and necro.swingCooldown <= 0 then
        local target = Targeting.nearest(enemies, necro.x, necro.y, reach)
        if target then
            if #activeSummons > 0 and necro.frenzyTimer <= 0 then useBattlePotion("frenzy") end
            necro.attack = Melee.start(necro.x, necro.y, target, necro.direction)
            necro.swingCooldown = weapon.cd
        end
    end
    if not necro.moving and necro.attack then
        local angle = necro.attack.angle
        necro.direction = Starter.attackFacing(math.cos(angle), math.sin(angle), necro.direction)
        if necro.direction == "left" then necro.facing = -1 end
        if necro.direction == "right" then necro.facing = 1 end
    end

    updateRingSummons(dt)
    local spdMult = (necro.frenzyTimer > 0) and 1.65 or 1.0
    for i = #activeSummons, 1, -1 do
        local summon = activeSummons[i]
        if summon.hp <= 0 then
            summon.slot.alive = summon.slot.alive - 1
            spawnParticles(summon.x, summon.y - 12, {0.85, 0.85, 0.8}, 5, 90)
            table.remove(activeSummons, i)
        else
            updateSummon(summon, dt, spdMult)
        end
    end

    for i = #projectiles, 1, -1 do
        local p = projectiles[i]
        p.x = p.x + p.vx * dt; p.y = p.y + p.vy * dt; p.life = p.life - dt
        local hit = false
        for _, e in ipairs(enemies) do
            local dx, dy = e.x - p.x, e.y - 14 - p.y
            if e ~= p.pierced and e.hp > 0 and dx * dx + dy * dy < (e.radius + 5)^2 then
                hit = applySummonProjectile(p, e)
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
            local amount = e.isBoss and 8 or 1
            if runSynergies.omen and timeAcc >= omenXpReadyAt and Roles.cursed(e, timeAcc) then
                amount, omenXpReadyAt = amount + 1, timeAcc + 4
            end
            table.insert(lootDrops, { x = e.x, y = e.y + 7, kind = "xp", amount = amount, col = xpColor })
            local mult = (necro.soulBoostTimer > 0) and 2 or 1
            local sDrop = (e.isBoss and (80 + dungeonStage * 25) or (4 + dungeonStage)) * mult
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
            spawnParticles(e.x, e.y - 14, {1.0, 0.4, 0.4}, e.isBoss and 28 or 5, 130)
            if e.isBoss then addShake(0.35, 8) end
            table.remove(enemies, i)
        elseif (e.recoilTime or 0) > 0 then
            local travel = math.min(e.recoilTime, dt)
            e.x, e.y = Waves.clamp(e.x + e.recoilX * travel, e.y + e.recoilY * travel)
            e.recoilTime = e.recoilTime - travel
        else
            local target = necro
            if e.provokedBy and e.provokedBy.hp > 0 and e.provokeUntil > timeAcc then
                target = e.provokedBy
            else
                local bestD = (necro.x - e.x)^2 + (necro.y - e.y)^2
                for _, s in ipairs(activeSummons) do
                    local distanceSquared = (s.x - e.x)^2 + (s.y - e.y)^2
                    if s.hp > 0 and distanceSquared < bestD * 0.85 then
                        bestD, target = distanceSquared, s
                    end
                end
            end

            local ang = directionTo(e, target)
            local distance = math.sqrt((target.x - e.x)^2 + (target.y - e.y)^2)
            local sx, sy = enemySeparation(e)
            e.facing = (target.x >= e.x) and 1 or -1
            if e.isRanged and distance < 210 then
                e.x, e.y = Waves.clamp(e.x + sx * dt, e.y + sy * dt)
                if e.cdTimer <= 0 then
                    e.cdTimer = 1.65 + e.animOffset * 0.26
                    table.insert(enemyProjectiles, {
                        x = e.x, y = e.y - 14,
                        vx = math.cos(ang) * 205,
                        vy = math.sin(ang) * 205,
                        dmg = Roles.enemyDamage(e, timeAcc),
                        attacker = e,
                        life = 2.0,
                    })
                end
            else
                local speed = distance > e.radius + 9 and e.spd * (1 - Roles.enemySlow(e, timeAcc)) or 0
                e.x, e.y = Waves.clamp(e.x + (math.cos(ang) * speed + sx) * dt,
                    e.y + (math.sin(ang) * speed + sy) * dt)
                if distance < e.radius + 16 and e.cdTimer <= 0 then
                    e.cdTimer = 0.95
                    if target == necro then
                        damageNecro(Roles.enemyDamage(e, timeAcc))
                    else
                        damageSummon(target, Roles.enemyDamage(e, timeAcc), e, e.x, e.y)
                    end
                end
            end
        end
    end

    for i = #enemyProjectiles, 1, -1 do
        local ep = enemyProjectiles[i]
        ep.x = ep.x + ep.vx * dt; ep.y = ep.y + ep.vy * dt; ep.life = ep.life - dt
        local target, closest
        local heroDistance = (necro.x - ep.x)^2 + (necro.y - 14 - ep.y)^2
        if heroDistance < 15 * 15 then target, closest = necro, heroDistance end
        for _, summon in ipairs(activeSummons) do
            local distanceSquared = (summon.x - ep.x)^2 + (summon.y - 14 - ep.y)^2
            if summon.hp > 0 and distanceSquared < 12 * 12 and (not closest or distanceSquared < closest) then
                target, closest = summon, distanceSquared
            end
        end
        if target == necro then
            damageNecro(ep.dmg)
        elseif target then
            damageSummon(target, ep.dmg, ep.attacker, target.x - ep.vx, target.y - ep.vy)
        end
        if target or ep.life <= 0 then table.remove(enemyProjectiles, i) end
    end

    local cleared = #enemies == 0
    local magnetRange = cleared and math.huge or (necro.soulBoostTimer > 0 and 999 or 175)
    for i = #lootDrops, 1, -1 do
        local l = lootDrops[i]
        local d = math.sqrt((necro.x - l.x)^2 + (necro.y - l.y)^2)
        local pickupRange = l.kind == "xp" and not cleared and 66 or magnetRange
        if d >= 24 and (l.gathered or d < pickupRange) then
            local travel = math.min(d, (cleared and 900 or (l.gathered and 510 or 360)) * dt)
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
            if l.kind == "xp" and not cleared then
                spawnPop(necro.x, necro.y - 48, "+" .. l.amount .. " " .. string.upper(l.kind), l.col)
            end
            table.remove(lootDrops, i)
        end
    end

    local finalWave = raidWave == #Waves
    if necro.hp <= 0 then
        mode = "gameover"
    elseif (not cleared or not finalWave) and run.xp >= run.threshold then
        offerRunUpgrade()
    elseif cleared and #lootDrops == 0 then
        if finalWave then
            openRingRewards()
        elseif not nextWaveIn then
            nextWaveIn = waveRespite
            projectiles, enemyProjectiles = {}, {}
            graveFire = GraveFire.new()
            roleEffects = Roles.new()
        else
            nextWaveIn = nextWaveIn - dt
            if nextWaveIn <= 0 then beginRaidWave(raidWave + 1) end
        end
    end
end

function love.update(dt)
    if mode == "levelup" or mode == "reward" then return end
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
    if mode == "levelup" or mode == "reward" then
        local index = tonumber(key)
        if index then
            if mode == "levelup" then chooseRunUpgrade(index) else chooseRingReward(index) end
        end
    elseif mode == "preview" then
        CharacterPreview.keypressed(key)
    elseif mode == "camp" and key == "c" then
        CharacterPreview.open()
        mode = "preview"
    elseif mode == "gameover" then
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
                setBanner("Choose another [" .. m.tier .. "] " .. m.name .. " ring to fuse.", {1, 0.85, 0.25})
            end
            return
        end

        if inRect(x, y, 730, 212, 106, 22) then toggleSelectedRing(); return end
        if inRect(x, y, 845, 212, 42, 22) then rosterScroll = math.max(0, rosterScroll - 1); return end
        if inRect(x, y, 894, 212, 42, 22) then
            rosterScroll = math.min(rosterScroll + 1, math.max(0, math.ceil(#legion / 4) - 3))
            return
        end

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
                        fuseRings(fusionMateIdx, idx)
                    else
                        selectedUnitIdx = idx
                    end
                    return
                end
            end
        end
    elseif mode == "levelup" or mode == "reward" then
        for index = 1, 3 do
            local left = choiceCards.x + (index - 1) * (choiceCards.width + choiceCards.gap)
            if inRect(x, y, left, choiceCards.y, choiceCards.width, choiceCards.height) then
                if mode == "levelup" then chooseRunUpgrade(index) else chooseRingReward(index) end
                return
            end
        end
    elseif mode == "gameover" then
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

local function drawEquippedWeapon(x, y, angle, scale)
    local wp = WEAPONS[necro.weaponIdx]
    if not wp.quadKey then
        Starter.drawClub(x, y, angle, scale)
        return
    end
    local q = quads[wp.quadKey]
    local _, _, width, height = q:getViewport()
    love.graphics.draw(atlasImg, q, x, y, angle + math.pi / 2, scale * 0.80, scale * 0.80, width / 2, height - 3)
end

local comboNames = {
    {"markedShot", "Marked Shot"}, {"kindling", "Kindling"}, {"searing", "Searing Blast"},
    {"tailwind", "Tailwind"}, {"bulwark", "Mended Bulwark"}, {"snare", "Tight Snare"}, {"omen", "Grave Omen"},
}

local function drawActiveCombos(synergies, x, y, width)
    local names = {}
    for _, combo in ipairs(comboNames) do
        if synergies[combo[1]] then names[#names + 1] = combo[2] end
    end
    if #names == 0 then return end
    local label = table.concat(names, "  /  ")
    love.graphics.setColor(markColor)
    love.graphics.print(label, x, y, 0, math.min(1, width / love.graphics.getFont():getWidth(label)), 1)
end

local function ringDisplayName(ring)
    local item = Catalog.equipment(ring)
    return item and item.name or Catalog.stats(ring).name
end

local function drawCamp()
    local deployed = equippedRings()
    local synergies = getSynergies(deployed)
    -- 상단 전리품 HUD
    love.graphics.setColor(0.12, 0.10, 0.18, 1)
    love.graphics.rectangle("fill", 0, 0, 960, 50)
    love.graphics.setColor(0.35, 1.0, 0.65, 1)
    love.graphics.print("DUNGEON STAGE " .. dungeonStage .. " PREP", 22, 16)
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
        drawEquippedWeapon(185, 228, 0.62, 4.5)
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

    drawBtn(32, 444, 250, 62, "RAID DUNGEON STAGE " .. dungeonStage, "3 waves   /   " .. #deployed .. " rings equipped", {0.12, 0.50, 0.28}, {0.35, 1.0, 0.60})

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
    local selStats = selU and Catalog.stats(selU)
    local nextMeta = (selMeta and selMeta.nextId) and UNIT_DB[selMeta.nextId] or nil
    drawBtn(
        306, 154, 205, 48,
        nextMeta and ("TREE UP -> " .. nextMeta.name) or "MAX TREE REACHED",
        nextMeta and ("Next rank [" .. nextMeta.tier .. "]") or "Highest rank [S]",
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
        fusionMateIdx and "SELECT 2ND RING..." or "FUSE DUPLICATES",
        "Same summon and rank",
        fusionMateIdx and {0.45, 0.28, 0.12} or {0.32, 0.16, 0.38},
        {1.0, 0.82, 0.25}
    )

    love.graphics.setColor(0.85, 0.88, 0.95, 1)
    local ringDetails = selStats and (ringDisplayName(selU) .. "  /  " .. selStats.bonus) or (#legion .. " rings owned")
    love.graphics.print(ringDetails, 308, 215)
    local selectedAbility = selMeta and (selMeta.fire or selMeta.ability)
    if selectedAbility then
        love.graphics.setColor(selMeta.accent)
        love.graphics.print("[" .. selMeta.tier .. "] " .. selectedAbility.trait, 308, 500)
    end
    drawActiveCombos(synergies, 308, 519, 628)
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

            love.graphics.setColor(1, 1, 1, 1)
            SummonArt.draw(u, cx + 22, cy + 66, 41)

            love.graphics.setColor(tc[1], tc[2], tc[3], 1)
            local name = "[" .. meta.tier .. "] " .. meta.name
            local stats = "ATK " .. uAtk .. "  HP " .. hp
            if meta.fire then stats = "BURN " .. uAtk .. "  HP " .. hp end
            if meta.family == "doll" then stats = "HEAL " .. uAtk .. "  HP " .. hp end
            if meta.family == "moth" then stats = "HASTE " .. math.floor(meta.ability.haste * 100 + 0.5) .. "%" end
            if meta.family == "mole" then stats = "FIND " .. meta.ability.radius .. "  HP " .. hp end
            local ringStats = Catalog.stats(u)
            local limits = ringStats.limit .. " max / " .. ringStats.cooldown .. "s / +" .. ringStats.speed .. "%"
            local font = love.graphics.getFont()
            local textX, textWidth = cx + 53, 94
            love.graphics.print(name, textX, cy + 7, 0, math.min(1, textWidth / font:getWidth(name)), 1)
            love.graphics.setColor(0.75, 0.82, 0.95, 1)
            local tags = "#" .. string.upper(meta.tag)
            love.graphics.print(tags, textX, cy + 24, 0, math.min(1, textWidth / font:getWidth(tags)), 1)
            love.graphics.setColor(0.92, 0.95, 0.98, 1)
            love.graphics.print(stats, textX, cy + 40, 0, math.min(1, textWidth / font:getWidth(stats)), 1)
            love.graphics.setColor(u.equipped and {0.45, 1.0, 0.68} or {0.62, 0.65, 0.72})
            love.graphics.print(limits, textX, cy + 58, 0, math.min(1, textWidth / font:getWidth(limits)), 1)
            if u.equipped then love.graphics.circle("fill", cx + 34, cy + 68, 3) end
        else
            love.graphics.setColor(0.26, 0.22, 0.36, 0.5)
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", cx, cy, 152, 80, 7, 7)
        end
    end
end

local function drawEffects()
    for _, p in ipairs(particles) do
        love.graphics.setColor(p.col[1], p.col[2], p.col[3], math.max(0, p.life / p.maxLife))
        love.graphics.rectangle("fill", p.x, p.y, p.size, p.size)
    end
    for _, pt in ipairs(popTexts) do
        love.graphics.setColor(pt.col[1], pt.col[2], pt.col[3], math.max(0, pt.life / pt.maxLife))
        love.graphics.print(pt.text, pt.x - 16, pt.y)
    end
end

local function raidCamera()
    return math.floor(math.max(0, math.min(Waves.width - 960, necro.x - 480))),
        math.floor(math.max(0, math.min(Waves.height - 540, necro.y - 270)))
end

local function drawRaidFloor(cameraX, cameraY)
    local tile = 48
    local columns, rows = Waves.width / tile, Waves.height / tile
    for gx = math.max(0, math.floor((cameraX - 8) / tile)), math.min(columns - 1, math.floor((cameraX + 968) / tile)) do
        for gy = math.max(0, math.floor((cameraY - 8) / tile)), math.min(rows - 1, math.floor((cameraY + 548) / tile)) do
            local q = (gx + gy) % 2 == 0 and quads.floors[1] or quads.floors2[2]
            love.graphics.setColor(0.69, 0.66, 0.72)
            if gx == 0 or gy == 0 or gx == columns - 1 or gy == rows - 1 then
                q = (gx + gy) % 5 == 1 and quads.wall_banner_red or quads.wall_mid
                love.graphics.setColor(0.77, 0.72, 0.80)
            elseif (gx == 19 or gx == 20 or gy == 11 or gy == 12) then
                q = quads.floors2[1 + (gx + gy) % 3]
                love.graphics.setColor(0.80, 0.75, 0.74)
            elseif (gx * 13 + gy * 17) % 29 == 0 then
                q = quads.floors[3]
            end
            love.graphics.draw(atlasImg, q, gx * tile, gy * tile, 0, 3, 3)
        end
    end
end

local function drawRaidMap(cameraX, cameraY)
    local x, y, w, h = 832, 450, 108, 65
    local sx, sy = w / Waves.width, h / Waves.height
    love.graphics.setColor(0.10, 0.08, 0.16, 0.93)
    love.graphics.rectangle("fill", x, y, w, h, 3, 3)
    love.graphics.setLineWidth(1)
    love.graphics.setColor(0.52, 0.43, 0.61)
    love.graphics.rectangle("line", x, y, w, h, 3, 3)
    love.graphics.setColor(0.25, 0.21, 0.34)
    love.graphics.rectangle("fill", x + cameraX * sx, y + cameraY * sy, 960 * sx, 540 * sy)
    for _, enemy in ipairs(enemies) do
        love.graphics.setColor(enemy.isBoss and {1, 0.64, 0.26} or {0.74, 0.29, 0.38})
        love.graphics.circle("fill", x + enemy.x * sx, y + enemy.y * sy, enemy.isBoss and 2.5 or 1.2)
    end
    love.graphics.setColor(0.68, 1.0, 0.90)
    love.graphics.circle("fill", x + necro.x * sx, y + necro.y * sy, 2.5)
end

local function drawBattle()
    local cameraX, cameraY = raidCamera()
    love.graphics.push()
    if shakeTimer > 0 and mode == "battle" then
        local amplitude = shakeMag * math.min(1, shakeTimer * 10)
        love.graphics.translate((math.random() - 0.5) * amplitude, (math.random() - 0.5) * amplitude)
    end
    love.graphics.translate(-cameraX, -cameraY)
    drawRaidFloor(cameraX, cameraY)
    GraveFire.drawPatches(graveFire)

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

    local wp = WEAPONS[necro.weaponIdx]
    Melee.drawTrail(necro.attack, necro.x, necro.y - 16, meleeReach(wp), wp.col)

    local stAnim = quads.necro_stages[necro.stage]

    -- Y좌표 깊이 정렬 후 0x72 4프레임 애니메이션 렌더링
    local drawList = { { kind = "necro", y = necro.y } }
    for _, s in ipairs(activeSummons) do
        if s.hp > 0 then table.insert(drawList, {kind = "summon", y = s.y, ref = s}) end
    end
    for _, e in ipairs(enemies) do table.insert(drawList, { kind = "enemy", y = e.y, ref = e }) end
    table.sort(drawList, function(a, b) return a.y < b.y end)

    for _, item in ipairs(drawList) do
        if item.kind == "necro" then
            love.graphics.setColor(0.04, 0.03, 0.08, 0.5)
            love.graphics.ellipse("fill", necro.x, necro.y + 2, 14, 5)
            love.graphics.setColor(1, 1, 1, 1)
            local x, y = math.floor(necro.x), math.floor(necro.y)
            if necro.stage == 1 then
                Starter.drawArmed(necro.direction, necro.walkFrame, x, y, raidHeroScale, necro.attack, drawEquippedWeapon)
            else
                local nf = getAnimFrame(0)
                local nQuad = necro.moving and stAnim.run[nf] or stAnim.idle[nf]
                local angle, lean = Melee.pose(necro.attack, necro.direction)
                love.graphics.draw(atlasImg, nQuad, x, y, lean, 2.1 * necro.facing, 2.1, stAnim.w / 2, stAnim.h)
                drawEquippedWeapon(x + 8 * necro.facing, y - 18, angle, 2.1)
            end
        elseif item.kind == "summon" then
            local s = item.ref
            local bob = summonBob(s)
            local strike = math.sin(s.attackTime / 0.23 * math.pi)
            local x = s.x + math.cos(s.attackAngle) * strike * 5
            local y = s.y + math.sin(s.attackAngle) * strike * 5 - bob
            love.graphics.setColor(0.04, 0.03, 0.08, 0.42)
            love.graphics.ellipse("fill", s.x, s.y + 2, 10, 4)
            if s.fuseTime then
                local radius = s.meta.ability.radius + (s.slot.stats.radius or 0)
                love.graphics.setColor(1, 0.36, 0.16, 0.62 - s.fuseTime)
                love.graphics.setLineWidth(1)
                love.graphics.circle("line", s.x, s.y, radius, 24)
            end
            if Roles.barrier(s, timeAcc) > 0 then
                love.graphics.setColor(0.36, 1, 0.70, 0.6)
                love.graphics.setLineWidth(1)
                love.graphics.ellipse("line", s.x, s.y - 14, 16, 21)
            end
            if s.meta.rank == 4 then
                local col = s.meta.accent
                love.graphics.setColor(col[1], col[2], col[3], 0.62)
                love.graphics.setLineWidth(1)
                love.graphics.ellipse("line", s.x, s.y + 2, 11, 4)
            end
            if s.guardTime > 0 then
                local col = s.meta.rank == 4 and s.meta.accent or markColor
                love.graphics.setColor(col[1], col[2], col[3], 0.66)
                love.graphics.setLineWidth(2)
                love.graphics.arc("line", "open", s.x, s.y - 8, 17, s.attackAngle - 0.9, s.attackAngle + 0.9)
            end
            love.graphics.setColor(1, s.hitFlash > 0 and 0.4 or 1, s.hitFlash > 0 and 0.4 or 1, 1)
            local height = summonHeight(s)
            if SummonPose[s.meta.family] then
                SummonPose.draw(s.slot.ring, math.floor(x), math.floor(y), height, s.facing, s.weaponAttack)
            else
                SummonArt.draw(s.slot.ring, math.floor(x), math.floor(y), height, s.facing, strike)
            end
            if s.meta.family == "shield" and s.attackTime > 0 then
                local col = s.meta.rank == 4 and s.meta.accent
                    or (s.meta.family == "shield" and markColor or TIER_COLORS[s.meta.tier])
                love.graphics.setColor(col[1], col[2], col[3], 0.66 * s.attackTime / 0.23)
                love.graphics.setLineWidth(2)
                love.graphics.arc("line", "open", x, y - 11, s.meta.reach + 5, s.attackAngle - 0.64, s.attackAngle + 0.64)
            end
        elseif item.kind == "enemy" then
            local e = item.ref
            local anim = quads.anims[e.animKey]
            local ef = getAnimFrame(e.animOffset)
            love.graphics.setColor(0.04, 0.03, 0.08, 0.48)
            love.graphics.ellipse("fill", e.x, e.y + 2, e.radius, e.radius * 0.4)
            love.graphics.setColor(1, e.hitFlash > 0 and 0.3 or 1, e.hitFlash > 0 and 0.3 or 1, 1)
            love.graphics.draw(atlasImg, anim.run[ef], math.floor(e.x), math.floor(e.y), 0, e.scale * e.facing, e.scale, anim.w / 2, anim.h)
            if e.isBoss or e.hp < e.maxHp then
                local bw = e.isBoss and 60 or 20
                love.graphics.setColor(0.1, 0.1, 0.15, 0.85)
                love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * anim.h - 5, bw, 3)
                love.graphics.setColor(0.95, 0.28, 0.35, 1)
                love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * anim.h - 5, bw * math.max(0, e.hp / e.maxHp), 3)
            end
            if isMarked(e) then
                local x, y = math.floor(e.x), math.floor(e.y - e.scale * anim.h - 14)
                love.graphics.setColor(markColor)
                love.graphics.polygon("fill", x, y - 5, x + 5, y, x, y + 5, x - 5, y)
            end
            if Roles.cursed(e, timeAcc) then
                love.graphics.setColor(0.97, 0.37, 0.67, 0.86)
                love.graphics.rectangle("fill", math.floor(e.x + 9), math.floor(e.y - e.scale * anim.h - 11), 4, 4)
            end
        end
    end

    Roles.draw(roleEffects)
    GraveFire.drawEmbers(graveFire)
    for _, p in ipairs(projectiles) do
        love.graphics.setColor(p.col[1], p.col[2], p.col[3], 1)
        love.graphics.setLineWidth(1.5)
        love.graphics.line(p.x - p.vx * 0.025, p.y - p.vy * 0.025, p.x, p.y)
        local pointX, pointY = p.x - p.vx * 0.009, p.y - p.vy * 0.009
        love.graphics.polygon("fill", p.x, p.y, pointX - p.vy * 0.005, pointY + p.vx * 0.005,
            pointX + p.vy * 0.005, pointY - p.vx * 0.005)
    end
    for _, ep in ipairs(enemyProjectiles) do
        love.graphics.setColor(1.0, 0.42, 0.15, 1)
        love.graphics.circle("fill", ep.x, ep.y, 5.5)
    end
    drawEffects()
    love.graphics.pop()
    drawRaidMap(cameraX, cameraY)

    -- 상단 전투 HUD
    love.graphics.setColor(0.10, 0.08, 0.16, 0.94)
    love.graphics.rectangle("fill", 0, 0, 960, 48)
    love.graphics.setColor(0.95, 0.28, 0.35, 1)
    love.graphics.rectangle("fill", 20, 14, 170 * math.max(0, necro.hp / necro.maxHp), 20, 4, 4)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.rectangle("line", 20, 14, 170, 20, 4, 4)
    love.graphics.print("HP " .. math.max(0, math.floor(necro.hp)) .. "/" .. necro.maxHp, 28, 17)

    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("STAGE " .. dungeonStage .. "   WAVE " .. raidWave .. "/" .. #Waves
        .. "   FOES " .. #enemies .. "   SUMMONS " .. #activeSummons, 205, 17)
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
    drawActiveCombos(runSynergies, 205, 33, 582)
    local guard = Roles.barrier(necro, timeAcc)
    if guard > 0 then
        love.graphics.setColor(0.36, 1, 0.7)
        love.graphics.print("Barrier " .. guard, 28, 35, 0, 0.85, 0.85)
    end
    love.graphics.setColor(markColor)
    if nextWaveIn then
        love.graphics.printf("Next: " .. Waves[raidWave + 1].name, 0, 57, 960, "center")
    else
        love.graphics.printf(Waves[raidWave].name, 0, 57, 960, "center")
    end
end

local function drawChoiceHeading(title, subtitle, color)
    love.graphics.setColor(0.045, 0.040, 0.075, 0.88)
    love.graphics.rectangle("fill", 0, 0, 960, 540)
    love.graphics.setColor(color)
    love.graphics.printf(title, 0, 139, 960 / 1.8, "center", 0, 1.8, 1.8)
    love.graphics.setColor(0.91, 0.92, 0.98)
    love.graphics.printf(subtitle, 0, 185, 960, "center")
end

local function drawChoiceCard(index, name, description, color)
    local cards = choiceCards
    local x = cards.x + (index - 1) * (cards.width + cards.gap)
    local y = cards.y
    love.graphics.setColor(0.14, 0.11, 0.21)
    love.graphics.rectangle("fill", x, y, cards.width, cards.height, 9, 9)
    love.graphics.setLineWidth(2)
    love.graphics.setColor(color)
    love.graphics.rectangle("line", x, y, cards.width, cards.height, 9, 9)
    love.graphics.print(tostring(index), x + 15, y + 12)
    love.graphics.printf(name, x + 17, y + 32, cards.width - 34, "center")
    love.graphics.setColor(0.89, 0.90, 0.96)
    love.graphics.printf(description, x + 20, y + 66, cards.width - 40, "center")
end

local function drawLevelUp()
    drawChoiceHeading("RUN LEVEL " .. run.level, "Choose a boon for this raid", xpColor)
    for index, choice in ipairs(run.choices) do
        drawChoiceCard(index, choice.name, choice.description, choice.requires and markColor or xpColor)
    end
    love.graphics.setColor(0.71, 0.76, 0.85)
    love.graphics.printf("Click a card or press 1, 2, or 3", 0, 382, 960, "center")
end

local function drawRingRewards()
    drawChoiceHeading("DUNGEON CLEARED", "Choose one ring to bring back to Camp", markColor)
    for index, ring in ipairs(ringRewards) do
        local summon = UNIT_DB[ring.id]
        local x = choiceCards.x + (index - 1) * (choiceCards.width + choiceCards.gap)
        local y = choiceCards.y
        local ringStats = Catalog.stats(ring)
        drawChoiceCard(index, "[" .. summon.tier .. "] " .. summon.name, "", TIER_COLORS[summon.tier])
        love.graphics.setColor(1, 1, 1)
        SummonArt.draw(ring, x + 55, y + 120, 67)
        local details = ringDisplayName(ring) .. "\n" .. ringStats.limit
            .. " max / " .. ringStats.cooldown .. "s respawn"
        love.graphics.printf(details, x + 93, y + 71, choiceCards.width - 104, "center")
    end
    love.graphics.setColor(0.89, 0.90, 0.96)
    local loot = dungeonLootEarned
    love.graphics.printf("+" .. loot.souls .. " Souls   /   +" .. loot.bones .. " Bones   /   +"
        .. loot.herbs .. " Herbs   /   +" .. loot.iron .. " Dark Iron", 0, 374, 960, "center")
    love.graphics.setColor(0.71, 0.76, 0.85)
    love.graphics.printf("Click a ring or press 1, 2, or 3", 0, 407, 960, "center")
end

function love.draw()
    if mode == "preview" then
        CharacterPreview.draw(timeAcc)
        return
    end
    love.graphics.push()
    if shakeTimer > 0 and mode == "camp" then
        love.graphics.translate((math.random() - 0.5) * shakeMag, (math.random() - 0.5) * shakeMag)
    end

    if mode == "camp" then
        drawCamp()
        drawEffects()
    elseif mode == "battle" or mode == "levelup" or mode == "reward" then
        drawBattle()
    elseif mode == "gameover" then
        drawBattle()
        love.graphics.setColor(0.08, 0.02, 0.05, 0.86)
        love.graphics.rectangle("fill", 0, 0, 960, 540)
        love.graphics.setColor(1.0, 0.35, 0.40, 1)
        love.graphics.printf("FALLEN IN DUNGEON STAGE " .. dungeonStage .. " (You keep all looted materials!)", 0, 220, 960, "center")
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.printf("Click or Press [SPACE] to return to Camp, Gacha/Enhance & Retry!", 0, 265, 960, "center")
    end

    if mode == "levelup" then drawLevelUp()
    elseif mode == "reward" then drawRingRewards() end
    love.graphics.pop()
end
