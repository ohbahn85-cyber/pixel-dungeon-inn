-- NECROMANCER GACHA ROGUELIKE — Top-Down Hades-Style Action + Camp Gacha Prep (Love2D + Lua)

local necroImg, summonsImg, enemiesImg
local necroQuads, summonQuads, enemyQuads = {}, {}, {}

local mode = "camp" -- "camp" | "battle" | "blessing" | "gameover"
local wave = 1
local souls = 120
local timeAcc = 0
local shakeTimer = 0
local shakeMag = 0

-- 네크로맨서 (주인공) 상태
local necro = {
    x = 480, y = 290,
    hp = 120, maxHp = 120,
    atk = 16,
    speed = 185,
    level = 1,
    stage = 1, -- 1: 하트팬티+거적대기, 2: 보라후드, 3: 대네크로맨서, 4: 사령군주
    dashTimer = 0,
    dashCooldown = 0,
    dashDx = 0, dashDy = 0,
    invulnTimer = 0,
    fireCooldown = 0,
    facing = 1,
    afterimages = {},
    boltBonus = 1.0,
    summonSpdBonus = 1.0,
}

-- 가챠로 뽑은 소환수 로스터 & 장비 인벤토리
local roster = {}
local gearBag = {}
local selectedRosterIdx = 1
local selectedGearIdx = nil
local lastGachaMsg = "Welcome! Spend Souls to pull Summons & Gear, then Enter Arena!"
local lastGachaColor = {0.65, 0.95, 0.72}

-- 전투 엔티티
local activeSummons = {}
local enemies = {}
local bullets = {}
local enemyBullets = {}
local soulOrbs = {}
local particles = {}
local popTexts = {}
local blessingChoices = {}

local TIER_COLORS = {
    C = {0.70, 0.76, 0.85},
    B = {0.25, 0.78, 1.00},
    A = {0.78, 0.48, 1.00},
    S = {1.00, 0.82, 0.22},
}

local SUMMON_POOL = {
    { kind = 1, name = "Skeleton",    role = "melee",  tier = "C", hp = 70,  atk = 11, spd = 115, range = 26, cd = 0.85 },
    { kind = 2, name = "Bone Archer", role = "ranged", tier = "B", hp = 60,  atk = 15, spd = 105, range = 210, cd = 1.05 },
    { kind = 3, name = "Bone Knight", role = "melee",  tier = "A", hp = 155, atk = 22, spd = 110, range = 30, cd = 0.90 },
    { kind = 4, name = "Cursed Lich", role = "ranged", tier = "S", hp = 120, atk = 34, spd = 100, range = 250, cd = 0.95 },
}

local GEAR_POOL = {
    { name = "Rusty Blade",  tier = "C", atk = 6,  hp = 10 },
    { name = "Bone Buckler", tier = "C", atk = 2,  hp = 35 },
    { name = "Soul Longbow", tier = "B", atk = 12, hp = 20 },
    { name = "Iron Plate",   tier = "B", atk = 5,  hp = 65 },
    { name = "Reaper Scythe",tier = "A", atk = 22, hp = 35 },
    { name = "Lich Crown",   tier = "S", atk = 36, hp = 95 },
}

local function addShake(dur, mag)
    shakeTimer = math.max(shakeTimer, dur)
    shakeMag = math.max(shakeMag, mag)
end

local function spawnPop(x, y, text, col)
    table.insert(popTexts, {
        x = x, y = y,
        text = text,
        col = col or {1, 1, 1},
        life = 0.75,
        maxLife = 0.75,
    })
end

local function spawnParticles(x, y, col, count, speed)
    for _ = 1, count do
        local a = math.random() * math.pi * 2
        local s = (0.3 + math.random() * 0.7) * (speed or 90)
        table.insert(particles, {
            x = x, y = y,
            vx = math.cos(a) * s,
            vy = math.sin(a) * s,
            life = 0.25 + math.random() * 0.3,
            maxLife = 0.55,
            size = 4,
            col = col,
        })
    end
end

local function createSummonUnit(template)
    return {
        kind = template.kind,
        name = template.name,
        role = template.role,
        tier = template.tier,
        level = 1,
        baseHp = template.hp,
        baseAtk = template.atk,
        spd = template.spd,
        range = template.range,
        cd = template.cd,
        gear = nil,
    }
end

local function getSummonStats(u)
    local hp = math.floor(u.baseHp * (1 + (u.level - 1) * 0.25)) + (u.gear and u.gear.hp or 0)
    local atk = math.floor(u.baseAtk * (1 + (u.level - 1) * 0.28)) + (u.gear and u.gear.atk or 0)
    return hp, atk
end

local function updateNecroEvolution()
    if necro.level >= 7 then necro.stage = 4
    elseif necro.level >= 5 then necro.stage = 3
    elseif necro.level >= 3 then necro.stage = 2
    else necro.stage = 1
    end
end

function love.load()
    math.randomseed(os.time())
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.08, 0.06, 0.12)

    necroImg = love.graphics.newImage("assets/necromancer_stages.png")
    local nw, nh = necroImg:getDimensions()
    for i = 0, 3 do
        necroQuads[i + 1] = love.graphics.newQuad(i * 28, 0, 28, 32, nw, nh)
    end

    summonsImg = love.graphics.newImage("assets/summons.png")
    local sw, sh = summonsImg:getDimensions()
    for i = 0, 3 do
        summonQuads[i + 1] = love.graphics.newQuad(i * 16, 0, 16, 16, sw, sh)
    end

    enemiesImg = love.graphics.newImage("assets/enemies.png")
    local ew, eh = enemiesImg:getDimensions()
    for i = 0, 2 do
        enemyQuads[i + 1] = love.graphics.newQuad(i * 16, 0, 16, 16, ew, eh)
    end

    -- 시작 시 기본 해골 병사 1기 지급
    table.insert(roster, createSummonUnit(SUMMON_POOL[1]))
    selectedRosterIdx = 1
end

local function startWaveBattle()
    mode = "battle"
    necro.x, necro.y = 480, 280
    necro.hp = necro.maxHp
    necro.dashTimer = 0
    necro.invulnTimer = 0.5
    necro.afterimages = {}

    activeSummons = {}
    for i, u in ipairs(roster) do
        local hp, atk = getSummonStats(u)
        local ang = (i - 1) * (math.pi * 2 / math.max(1, #roster))
        table.insert(activeSummons, {
            unit = u,
            x = necro.x + math.cos(ang) * 58,
            y = necro.y + math.sin(ang) * 58,
            hp = hp, maxHp = hp,
            atk = atk,
            cdTimer = 0.2,
            hitFlash = 0,
            facing = 1,
        })
    end

    enemies = {}
    bullets = {}
    enemyBullets = {}
    soulOrbs = {}

    local isBossWave = (wave % 3 == 0)
    local count = 4 + wave * 2
    for i = 1, count do
        local side = math.random(1, 4)
        local ex, ey
        if side == 1 then ex, ey = 60, math.random(85, 480)
        elseif side == 2 then ex, ey = 900, math.random(85, 480)
        elseif side == 3 then ex, ey = math.random(80, 880), 80
        else ex, ey = math.random(80, 880), 485 end

        local isPriest = (wave >= 2 and math.random() < 0.32)
        local eHp = math.floor((42 + wave * 20) * (isPriest and 0.85 or 1.0))
        table.insert(enemies, {
            kind = isPriest and 2 or 1,
            x = ex, y = ey,
            hp = eHp, maxHp = eHp,
            atk = 8 + wave * 3,
            spd = isPriest and 68 or (78 + wave * 4),
            cdTimer = 0.8 + math.random() * 0.8,
            hitFlash = 0,
            isBoss = false,
            scale = 3,
            radius = 16,
            soulDrop = 14 + wave * 3,
        })
    end

    if isBossWave then
        local bHp = 260 + wave * 110
        table.insert(enemies, {
            kind = 3,
            x = 850, y = 280,
            hp = bHp, maxHp = bHp,
            atk = 18 + wave * 4,
            spd = 64,
            cdTimer = 1.2,
            hitFlash = 0,
            isBoss = true,
            scale = 5,
            radius = 28,
            soulDrop = 95 + wave * 20,
        })
        addShake(0.3, 6)
    end
end

local function rollSummonGacha()
    if souls < 40 then
        lastGachaMsg = "Not enough Souls! (Need 40 Souls)"
        lastGachaColor = {1.0, 0.45, 0.45}
        return
    end
    if #roster >= 8 then
        lastGachaMsg = "Army Full (Max 8 Summons)! Upgrade or equip Gear!"
        lastGachaColor = {1.0, 0.75, 0.35}
        return
    end
    souls = souls - 40
    local r = math.random()
    local pick
    if r < 0.12 then pick = SUMMON_POOL[4]      -- S급 리치 (12%)
    elseif r < 0.34 then pick = SUMMON_POOL[3]  -- A급 뼈 기사 (22%)
    elseif r < 0.66 then pick = SUMMON_POOL[2]  -- B급 해골 궁수 (32%)
    else pick = SUMMON_POOL[1] end              -- C급 해골 병사 (34%)

    table.insert(roster, createSummonUnit(pick))
    selectedRosterIdx = #roster
    lastGachaMsg = "GACHA! [" .. pick.tier .. "] " .. pick.name .. " joined your Undead Army!"
    lastGachaColor = TIER_COLORS[pick.tier]
    addShake(pick.tier == "S" and 0.35 or 0.15, pick.tier == "S" and 8 or 4)
    spawnParticles(165, 290, TIER_COLORS[pick.tier], pick.tier == "S" and 28 or 14, 140)
end

local function rollGearGacha()
    if souls < 30 then
        lastGachaMsg = "Not enough Souls! (Need 30 Souls)"
        lastGachaColor = {1.0, 0.45, 0.45}
        return
    end
    if #gearBag >= 6 then
        lastGachaMsg = "Gear Bag Full (Max 6)! Equip gear to a summon first."
        lastGachaColor = {1.0, 0.75, 0.35}
        return
    end
    souls = souls - 30
    local r = math.random()
    local pick
    if r < 0.12 then pick = GEAR_POOL[6]      -- S
    elseif r < 0.30 then pick = GEAR_POOL[5]  -- A
    elseif r < 0.62 then pick = (math.random() < 0.5) and GEAR_POOL[3] or GEAR_POOL[4]
    else pick = (math.random() < 0.5) and GEAR_POOL[1] or GEAR_POOL[2] end

    table.insert(gearBag, { name = pick.name, tier = pick.tier, atk = pick.atk, hp = pick.hp })
    lastGachaMsg = "GEAR! [" .. pick.tier .. "] " .. pick.name .. " (+" .. pick.atk .. " ATK, +" .. pick.hp .. " HP)"
    lastGachaColor = TIER_COLORS[pick.tier]
    addShake(0.15, 4)
end

local function upgradeSelectedSummon()
    local u = roster[selectedRosterIdx]
    if not u then return end
    local cost = 30 + (u.level - 1) * 20
    if souls < cost then
        lastGachaMsg = "Need " .. cost .. " Souls to Level Up " .. u.name .. "!"
        lastGachaColor = {1.0, 0.45, 0.45}
        return
    end
    souls = souls - cost
    u.level = u.level + 1
    lastGachaMsg = u.name .. " leveled up to Lv." .. u.level .. "!"
    lastGachaColor = {0.45, 1.0, 0.65}
    spawnParticles(165, 290, {0.45, 1.0, 0.65}, 14, 110)
end

local function upgradeNecromancer()
    local cost = 45 + (necro.level - 1) * 30
    if souls < cost then
        lastGachaMsg = "Need " .. cost .. " Souls to Evolve Necromancer!"
        lastGachaColor = {1.0, 0.45, 0.45}
        return
    end
    souls = souls - cost
    local oldStage = necro.stage
    necro.level = necro.level + 1
    necro.maxHp = necro.maxHp + 28
    necro.hp = necro.maxHp
    necro.atk = necro.atk + 6
    updateNecroEvolution()
    if necro.stage > oldStage then
        lastGachaMsg = "EVOLUTION!! Necromancer transformed to STAGE " .. necro.stage .. "!"
        lastGachaColor = {1.0, 0.85, 0.25}
        addShake(0.4, 9)
        spawnParticles(165, 290, {0.35, 1.0, 0.65}, 34, 160)
    else
        lastGachaMsg = "Necromancer Lv." .. necro.level .. "! (+6 ATK, +28 HP)"
        lastGachaColor = {0.65, 1.0, 0.75}
        spawnParticles(165, 290, {0.65, 1.0, 0.75}, 14, 100)
    end
end

local function openBlessingChoices()
    mode = "blessing"
    blessingChoices = {
        { title = "SOUL OVERLOAD", desc = "Necromancer Soul Bolt DMG +25%", apply = function() necro.boltBonus = necro.boltBonus + 0.25 end },
        { title = "UNDEAD FRENZY", desc = "All Summons Move & Attack Speed +20%", apply = function() necro.summonSpdBonus = necro.summonSpdBonus + 0.20 end },
        { title = "SOUL HARVEST",  desc = "Gain +85 Bonus Souls immediately!", apply = function() souls = souls + 85 end },
    }
end

local function updateBattle(dt)
    -- 1. 네크로맨서 이동 & 하데스 스타일 섀도우 대시
    necro.dashCooldown = math.max(0, necro.dashCooldown - dt)
    necro.invulnTimer = math.max(0, necro.invulnTimer - dt)
    necro.fireCooldown = math.max(0, necro.fireCooldown - dt)

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
        necro.x = necro.x + necro.dashDx * 520 * dt
        necro.y = necro.y + necro.dashDy * 520 * dt
        table.insert(necro.afterimages, { x = necro.x, y = necro.y, life = 0.22 })
    else
        necro.x = necro.x + dx * necro.speed * dt
        necro.y = necro.y + dy * necro.speed * dt
    end

    necro.x = math.max(54, math.min(906, necro.x))
    necro.y = math.max(82, math.min(495, necro.y))

    for i = #necro.afterimages, 1, -1 do
        necro.afterimages[i].life = necro.afterimages[i].life - dt
        if necro.afterimages[i].life <= 0 then table.remove(necro.afterimages, i) end
    end

    -- 2. 좌클릭(또는 홀드) 영혼탄 발사
    if love.mouse.isDown(1) and necro.fireCooldown <= 0 then
        local mx, my = love.mouse.getPosition()
        local ang = math.atan2(my - (necro.y - 24), mx - necro.x)
        necro.facing = (mx >= necro.x) and 1 or -1
        local dmg = math.floor(necro.atk * necro.boltBonus)
        table.insert(bullets, {
            x = necro.x, y = necro.y - 24,
            vx = math.cos(ang) * 440,
            vy = math.sin(ang) * 440,
            dmg = dmg,
            life = 1.2,
            col = (necro.stage >= 2) and {0.35, 1.0, 0.65} or {0.95, 0.65, 0.45},
            radius = (necro.stage >= 3) and 7 or 5,
        })
        necro.fireCooldown = 0.24
    end

    -- 3. 소환수 군단 AI (겹침 방지 분리력 + 적 추적 / 원거리 사격)
    for i = #activeSummons, 1, -1 do
        local s = activeSummons[i]
        s.cdTimer = math.max(0, s.cdTimer - dt)
        s.hitFlash = math.max(0, s.hitFlash - dt)

        -- 가장 가까운 적 탐색
        local nearest, bestDist = nil, 99999
        for _, e in ipairs(enemies) do
            local d = math.sqrt((e.x - s.x)^2 + (e.y - s.y)^2)
            if d < bestDist then bestDist = d; nearest = e end
        end

        local mvx, mvy = 0, 0
        if nearest then
            local ang = math.atan2(nearest.y - s.y, nearest.x - s.x)
            s.facing = (nearest.x >= s.x) and 1 or -1
            if bestDist > s.unit.range then
                mvx = math.cos(ang) * s.unit.spd * necro.summonSpdBonus
                mvy = math.sin(ang) * s.unit.spd * necro.summonSpdBonus
            elseif s.unit.role == "ranged" and bestDist < 105 then
                -- 원거리 소환수는 적이 너무 가까우면 살짝 뒤로 카이팅
                mvx = -math.cos(ang) * s.unit.spd * 0.7
                mvy = -math.sin(ang) * s.unit.spd * 0.7
            end

            -- 공격 실행
            if bestDist <= s.unit.range + nearest.radius and s.cdTimer <= 0 then
                s.cdTimer = s.unit.cd / necro.summonSpdBonus
                if s.unit.role == "melee" then
                    nearest.hp = nearest.hp - s.atk
                    nearest.hitFlash = 0.12
                    spawnPop(nearest.x, nearest.y - 24, tostring(s.atk), {0.85, 0.95, 1})
                    spawnParticles(nearest.x, nearest.y - 12, {0.95, 0.95, 0.95}, 5, 80)
                else
                    table.insert(bullets, {
                        x = s.x, y = s.y - 16,
                        vx = math.cos(ang) * 360,
                        vy = math.sin(ang) * 360,
                        dmg = s.atk,
                        life = 1.1,
                        col = (s.unit.kind == 4) and {0.75, 0.45, 1.0} or {0.95, 0.92, 0.80},
                        radius = (s.unit.kind == 4) and 6 or 4,
                    })
                end
            end
        else
            -- 적이 없으면 네크로맨서 주변으로 집결
            local dNec = math.sqrt((necro.x - s.x)^2 + (necro.y - s.y)^2)
            if dNec > 65 then
                local ang = math.atan2(necro.y - s.y, necro.x - s.x)
                mvx = math.cos(ang) * s.unit.spd
                mvy = math.sin(ang) * s.unit.spd
            end
        end

        -- 소환수끼리 뭉치지 않게 부드러운 분리(Separation) 힘 적용!
        for j, other in ipairs(activeSummons) do
            if i ~= j then
                local ox, oy = s.x - other.x, s.y - other.y
                local od = math.sqrt(ox * ox + oy * oy)
                if od > 0.1 and od < 34 then
                    mvx = mvx + (ox / od) * 95
                    mvy = mvy + (oy / od) * 95
                end
            end
        end

        s.x = math.max(52, math.min(908, s.x + mvx * dt))
        s.y = math.max(82, math.min(495, s.y + mvy * dt))

        if s.hp <= 0 then
            spawnParticles(s.x, s.y - 12, {0.9, 0.9, 0.85}, 12, 110)
            table.remove(activeSummons, i)
        end
    end

    -- 4. 아군 투사체 이동 및 적 충돌
    for i = #bullets, 1, -1 do
        local b = bullets[i]
        b.x = b.x + b.vx * dt
        b.y = b.y + b.vy * dt
        b.life = b.life - dt
        local hit = false
        for _, e in ipairs(enemies) do
            if math.sqrt((e.x - b.x)^2 + ((e.y - 16) - b.y)^2) < e.radius + b.radius then
                e.hp = e.hp - b.dmg
                e.hitFlash = 0.12
                e.x = e.x + (b.vx / 440) * (e.isBoss and 2 or 8)
                e.y = e.y + (b.vy / 440) * (e.isBoss and 2 or 8)
                spawnPop(e.x, e.y - 26, tostring(b.dmg), b.col)
                spawnParticles(b.x, b.y, b.col, 5, 85)
                hit = true
                break
            end
        end
        if hit or b.life <= 0 or b.x < 30 or b.x > 930 or b.y < 60 or b.y > 515 then
            table.remove(bullets, i)
        end
    end

    -- 5. 적 AI & 사망/영혼 드랍 처리
    for i = #enemies, 1, -1 do
        local e = enemies[i]
        e.cdTimer = math.max(0, e.cdTimer - dt)
        e.hitFlash = math.max(0, e.hitFlash - dt)

        if e.hp <= 0 then
            spawnParticles(e.x, e.y - 14, {1.0, 0.45, 0.45}, e.isBoss and 28 or 12, 130)
            addShake(e.isBoss and 0.35 or 0.08, e.isBoss and 7 or 2.5)
            table.insert(soulOrbs, { x = e.x, y = e.y - 10, val = e.soulDrop })
            table.remove(enemies, i)
        else
            -- 가장 가까운 아군(소환수 우선, 아니면 네크로맨서) 타겟팅
            local target = necro
            local bestD = math.sqrt((necro.x - e.x)^2 + (necro.y - e.y)^2)
            for _, s in ipairs(activeSummons) do
                local sd = math.sqrt((s.x - e.x)^2 + (s.y - e.y)^2)
                if sd < bestD * 0.92 then bestD = sd; target = s end
            end

            local ang = math.atan2(target.y - e.y, target.x - e.x)
            if e.kind == 2 and bestD < 210 then
                -- 화염 사제 원거리 공격
                if e.cdTimer <= 0 then
                    e.cdTimer = 1.6
                    table.insert(enemyBullets, {
                        x = e.x, y = e.y - 16,
                        vx = math.cos(ang) * 210,
                        vy = math.sin(ang) * 210,
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
                            addShake(0.15, 5)
                            spawnPop(necro.x, necro.y - 42, "-" .. e.atk, {1, 0.3, 0.3})
                        end
                    else
                        target.hp = target.hp - e.atk
                        target.hitFlash = 0.12
                    end
                end
            end
        end
    end

    -- 6. 적 화염구 처리
    for i = #enemyBullets, 1, -1 do
        local eb = enemyBullets[i]
        eb.x = eb.x + eb.vx * dt
        eb.y = eb.y + eb.vy * dt
        eb.life = eb.life - dt
        local hit = false
        if math.sqrt((necro.x - eb.x)^2 + ((necro.y - 20) - eb.y)^2) < 18 then
            if necro.invulnTimer <= 0 then
                necro.hp = necro.hp - eb.dmg
                necro.invulnTimer = 0.45
                addShake(0.14, 4)
                spawnPop(necro.x, necro.y - 42, "-" .. eb.dmg, {1, 0.3, 0.3})
            end
            hit = true
        end
        if hit or eb.life <= 0 then table.remove(enemyBullets, i) end
    end

    -- 7. 영혼 구슬(Soul Orb) 자석 흡수
    for i = #soulOrbs, 1, -1 do
        local o = soulOrbs[i]
        local d = math.sqrt((necro.x - o.x)^2 + (necro.y - o.y)^2)
        if d < 220 or #enemies == 0 then
            local ang = math.atan2(necro.y - o.y, necro.x - o.x)
            o.x = o.x + math.cos(ang) * 320 * dt
            o.y = o.y + math.sin(ang) * 320 * dt
        end
        if d < 24 then
            souls = souls + o.val
            spawnPop(necro.x, necro.y - 50, "+" .. o.val .. " SOULS", {0.4, 1.0, 0.65})
            table.remove(soulOrbs, i)
        end
    end

    -- 8. 승패 판정
    if necro.hp <= 0 then
        mode = "gameover"
    elseif #enemies == 0 and #soulOrbs == 0 then
        souls = souls + 35 + wave * 10
        wave = wave + 1
        openBlessingChoices()
    end
end

function love.update(dt)
    timeAcc = timeAcc + dt
    if shakeTimer > 0 then shakeTimer = math.max(0, shakeTimer - dt) end

    if mode == "battle" then
        updateBattle(dt)
    end

    for i = #particles, 1, -1 do
        local p = particles[i]
        p.x = p.x + p.vx * dt
        p.y = p.y + p.vy * dt
        p.life = p.life - dt
        if p.life <= 0 then table.remove(particles, i) end
    end

    for i = #popTexts, 1, -1 do
        local pt = popTexts[i]
        pt.y = pt.y - 38 * dt
        pt.life = pt.life - dt
        if pt.life <= 0 then table.remove(popTexts, i) end
    end
end

function love.keypressed(key)
    if mode == "battle" and (key == "space" or key == "lshift") then
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
            necro.dashCooldown = 0.65
            necro.invulnTimer = 0.25
            spawnParticles(necro.x, necro.y - 16, {0.35, 1.0, 0.65}, 8, 90)
        end
    elseif mode == "camp" and (key == "return" or key == "space") then
        startWaveBattle()
    elseif mode == "gameover" and (key == "r" or key == "space") then
        -- 빠른 로그라이크 재도전
        wave = 1
        souls = 120
        necro.level = 1; necro.stage = 1; necro.maxHp = 120; necro.hp = 120; necro.atk = 16
        necro.boltBonus = 1.0; necro.summonSpdBonus = 1.0
        roster = { createSummonUnit(SUMMON_POOL[1]) }
        gearBag = {}
        selectedRosterIdx = 1
        mode = "camp"
    end
end

local function inRect(x, y, rx, ry, rw, rh)
    return x >= rx and x <= rx + rw and y >= ry and y <= ry + rh
end

function love.mousepressed(x, y, button)
    if button ~= 1 then return end

    if mode == "camp" then
        -- 1) 가챠 & 성장 버튼 4종
        if inRect(x, y, 315, 74, 200, 56) then rollSummonGacha(); return end
        if inRect(x, y, 530, 74, 200, 56) then rollGearGacha(); return end
        if inRect(x, y, 745, 74, 190, 56) then upgradeSelectedSummon(); return end
        if inRect(x, y, 40, 385, 245, 52) then upgradeNecromancer(); return end
        if inRect(x, y, 40, 452, 245, 58) then startWaveBattle(); return end

        -- 2) 소환수 로스터 카드 선택 (최대 8칸: 4x2)
        for i = 1, #roster do
            local col = (i - 1) % 4
            local row = math.floor((i - 1) / 4)
            local cx = 315 + col * 158
            local cy = 172 + row * 104
            if inRect(x, y, cx, cy, 148, 94) then
                selectedRosterIdx = i
                -- 장비가 선택된 상태라면 즉시 장착!
                if selectedGearIdx and gearBag[selectedGearIdx] then
                    local g = table.remove(gearBag, selectedGearIdx)
                    if roster[i].gear then table.insert(gearBag, roster[i].gear) end
                    roster[i].gear = g
                    lastGachaMsg = "Equipped [" .. g.tier .. "] " .. g.name .. " to " .. roster[i].name .. "!"
                    lastGachaColor = TIER_COLORS[g.tier]
                    selectedGearIdx = nil
                end
                return
            end
        end

        -- 3) 장비 가방 카드 클릭 -> 현재 선택된 소환수에게 즉시 장착!
        for i = 1, #gearBag do
            local gx = 315 + (i - 1) * 105
            local gy = 415
            if inRect(x, y, gx, gy, 98, 92) then
                local u = roster[selectedRosterIdx]
                if u then
                    local g = table.remove(gearBag, i)
                    if u.gear then table.insert(gearBag, u.gear) end
                    u.gear = g
                    lastGachaMsg = "Equipped [" .. g.tier .. "] " .. g.name .. " to " .. u.name .. "!"
                    lastGachaColor = TIER_COLORS[g.tier]
                end
                return
            end
        end
    elseif mode == "blessing" then
        for i = 1, 3 do
            local bx = 65 + (i - 1) * 290
            if inRect(x, y, bx, 180, 260, 200) then
                blessingChoices[i].apply()
                mode = "camp"
                lastGachaMsg = "Blessing Acquired: " .. blessingChoices[i].title .. "! Prepare for Wave " .. wave
                lastGachaColor = {0.45, 1.0, 0.65}
                return
            end
        end
    elseif mode == "gameover" then
        love.keypressed("r")
    end
end

local function drawButton(x, y, w, h, label, sub, bgCol, borderCol)
    love.graphics.setColor(bgCol[1], bgCol[2], bgCol[3], 1)
    love.graphics.rectangle("fill", x, y, w, h, 8, 8)
    love.graphics.setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", x, y, w, h, 8, 8)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf(label, x, y + 10, w, "center")
    if sub then
        love.graphics.setColor(0.88, 0.90, 0.95, 0.9)
        love.graphics.printf(sub, x, y + 30, w, "center")
    end
end

local function drawCamp()
    -- 상단 헤더
    love.graphics.setColor(0.14, 0.11, 0.22, 1)
    love.graphics.rectangle("fill", 0, 0, 960, 52)
    love.graphics.setColor(0.35, 1.0, 0.65, 1)
    love.graphics.print("NECROMANCER CAMP  |  NEXT: WAVE " .. wave .. (wave % 3 == 0 and " (BOSS!)" or ""), 24, 18)
    love.graphics.setColor(1.0, 0.85, 0.25, 1)
    love.graphics.print("SOULS: " .. souls, 440, 18)
    love.graphics.setColor(0.75, 0.80, 0.92, 1)
    love.graphics.print("ARMY: " .. #roster .. " / 8  |  STAGE " .. necro.stage .. " NECRO", 640, 18)

    -- 좌측: 네크로맨서 상태 & 외형 진화 제단
    love.graphics.setColor(0.14, 0.11, 0.22, 1)
    love.graphics.rectangle("fill", 24, 68, 276, 454, 10, 10)
    love.graphics.setColor(0.45, 0.35, 0.65, 1)
    love.graphics.rectangle("line", 24, 68, 276, 454, 10, 10)

    local stageTitles = { "BROKE NOVICE (HEART BOXERS)", "HOODED NECROMANCER", "ARCH-NECROMANCER", "AWAKENED LICH KING" }
    love.graphics.setColor(0.99, 0.88, 0.35, 1)
    love.graphics.printf("LV." .. necro.level .. " NECROMANCER", 24, 82, 276, "center")
    love.graphics.setColor(0.65, 0.95, 0.72, 1)
    love.graphics.printf(stageTitles[necro.stage], 24, 104, 276, "center")

    -- 네크로맨서 5x 확대 렌더링
    local bob = (necro.stage == 4) and (math.sin(timeAcc * 4) * 6 - 8) or (math.sin(timeAcc * 4) > 0 and 0 or 2)
    love.graphics.setColor(0.25, 0.95, 0.55, 0.22)
    love.graphics.ellipse("fill", 162, 304, 68, 20)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(necroImg, necroQuads[necro.stage], 162, math.floor(302 + bob), 0, 5, 5, 14, 30)

    love.graphics.setColor(0.88, 0.90, 0.96, 1)
    love.graphics.printf("HP: " .. necro.maxHp .. "   |   BOLT ATK: " .. math.floor(necro.atk * necro.boltBonus), 24, 332, 276, "center")
    love.graphics.setColor(0.65, 0.70, 0.82, 1)
    love.graphics.printf("Evolve at Lv.3 / Lv.5 / Lv.7!", 24, 354, 276, "center")

    local necroCost = 45 + (necro.level - 1) * 30
    drawButton(40, 385, 245, 52, "EVOLVE / LEVEL UP NECRO", "Cost: " .. necroCost .. " Souls", {0.26, 0.18, 0.44}, {0.75, 0.50, 1.0})
    drawButton(40, 452, 245, 58, "ENTER ARENA (WAVE " .. wave .. ")", "Click or Press [SPACE]", {0.12, 0.48, 0.28}, {0.35, 1.0, 0.60})

    -- 우측 상단: 3대 가챠 & 강화 액션 버튼
    drawButton(315, 74, 200, 56, "SUMMON GACHA", "40 Souls (C~S Undead)", {0.22, 0.16, 0.36}, {0.35, 0.95, 0.65})
    drawButton(530, 74, 200, 56, "GEAR GACHA", "30 Souls (C~S Equip)", {0.28, 0.18, 0.20}, {1.0, 0.78, 0.25})
    local selU = roster[selectedRosterIdx]
    local upCost = selU and (30 + (selU.level - 1) * 20) or 30
    drawButton(745, 74, 190, 56, "UPGRADE SUMMON", selU and (selU.name .. " (" .. upCost .. "S)") or "Select unit", {0.16, 0.24, 0.38}, {0.35, 0.78, 1.0})

    -- 메시지 바
    love.graphics.setColor(lastGachaColor[1], lastGachaColor[2], lastGachaColor[3], 1)
    love.graphics.print(lastGachaMsg, 318, 144)

    -- 우측 중단: 내 언데드 군단 로스터 (최대 8기)
    for i = 1, 8 do
        local col = (i - 1) % 4
        local row = math.floor((i - 1) / 4)
        local cx = 315 + col * 158
        local cy = 172 + row * 104
        local u = roster[i]
        local isSel = (i == selectedRosterIdx)

        love.graphics.setColor(isSel and 0.22 or 0.13, isSel and 0.17 or 0.11, isSel and 0.33 or 0.20, 1)
        love.graphics.rectangle("fill", cx, cy, 148, 94, 8, 8)
        if u then
            local tc = TIER_COLORS[u.tier]
            love.graphics.setColor(tc[1], tc[2], tc[3], isSel and 1 or 0.65)
            love.graphics.setLineWidth(isSel and 3 or 1.5)
            love.graphics.rectangle("line", cx, cy, 148, 94, 8, 8)

            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.draw(summonsImg, summonQuads[u.kind], cx + 28, cy + 56, 0, 3, 3, 8, 16)

            love.graphics.setColor(tc[1], tc[2], tc[3], 1)
            love.graphics.print("[" .. u.tier .. "] " .. u.name, cx + 52, cy + 8)
            local hp, atk = getSummonStats(u)
            love.graphics.setColor(0.9, 0.92, 0.96, 1)
            love.graphics.print("Lv." .. u.level .. "  ATK:" .. atk, cx + 52, cy + 28)
            love.graphics.print("HP:" .. hp, cx + 52, cy + 46)
            love.graphics.setColor(1.0, 0.82, 0.35, 1)
            love.graphics.print(u.gear and ("*" .. u.gear.name) or "No Gear", cx + 10, cy + 72)
        else
            love.graphics.setColor(0.28, 0.24, 0.38, 0.6)
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", cx, cy, 148, 94, 8, 8)
            love.graphics.printf("EMPTY SLOT", cx, cy + 38, 148, "center")
        end
    end

    -- 우측 하단: 장비 가방 (클릭하면 선택된 소환수에게 즉시 장착!)
    love.graphics.setColor(0.85, 0.88, 0.95, 1)
    love.graphics.print("GEAR BAG (Click any Gear to equip to selected Summon):", 315, 392)
    for i = 1, 6 do
        local gx = 315 + (i - 1) * 105
        local gy = 415
        local g = gearBag[i]
        love.graphics.setColor(0.14, 0.11, 0.21, 1)
        love.graphics.rectangle("fill", gx, gy, 98, 92, 8, 8)
        if g then
            local tc = TIER_COLORS[g.tier]
            love.graphics.setColor(tc[1], tc[2], tc[3], 0.9)
            love.graphics.setLineWidth(2)
            love.graphics.rectangle("line", gx, gy, 98, 92, 8, 8)
            love.graphics.printf("[" .. g.tier .. "]", gx, gy + 8, 98, "center")
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.printf(g.name, gx + 4, gy + 26, 90, "center")
            love.graphics.setColor(0.65, 1.0, 0.72, 1)
            love.graphics.printf("+" .. g.atk .. "A +" .. g.hp .. "H", gx, gy + 66, 98, "center")
        else
            love.graphics.setColor(0.28, 0.24, 0.38, 0.5)
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", gx, gy, 98, 92, 8, 8)
        end
    end
end

local function drawBattle()
    -- 1. 하데스풍 탑다운 던전 석재 아레나 바닥
    local ts = 40
    for gx = 1, 22 do
        for gy = 1, 11 do
            if (gx + gy) % 2 == 0 then
                love.graphics.setColor(0.15, 0.12, 0.22, 1)
            else
                love.graphics.setColor(0.13, 0.10, 0.19, 1)
            end
            love.graphics.rectangle("fill", gx * ts, 24 + gy * ts, ts, ts)
        end
    end
    love.graphics.setColor(0.38, 0.28, 0.55, 1)
    love.graphics.setLineWidth(3)
    love.graphics.rectangle("line", 40, 64, 880, 440, 8, 8)

    -- 중앙 마법진 장식
    love.graphics.setColor(0.25, 0.90, 0.55, 0.12)
    love.graphics.circle("line", 480, 284, 95)

    -- 2. 영혼 구슬
    for _, o in ipairs(soulOrbs) do
        love.graphics.setColor(0.35, 1.0, 0.65, 0.35)
        love.graphics.circle("fill", o.x, o.y, 9)
        love.graphics.setColor(0.75, 1.0, 0.85, 1)
        love.graphics.rectangle("fill", o.x - 3, o.y - 3, 6, 6)
    end

    -- 3. 대시 잔상
    for _, af in ipairs(necro.afterimages) do
        love.graphics.setColor(0.35, 1.0, 0.65, af.life * 2.2)
        love.graphics.draw(necroImg, necroQuads[necro.stage], af.x, af.y, 0, 3 * necro.facing, 3, 14, 30)
    end

    -- 4. 모든 유닛(소환수 + 적 + 네크로맨서) Y좌표 깊이 정렬 렌더링
    local drawList = {}
    table.insert(drawList, { kind = "necro", y = necro.y })
    for _, s in ipairs(activeSummons) do table.insert(drawList, { kind = "summon", y = s.y, ref = s }) end
    for _, e in ipairs(enemies) do table.insert(drawList, { kind = "enemy", y = e.y, ref = e }) end
    table.sort(drawList, function(a, b) return a.y < b.y end)

    for _, item in ipairs(drawList) do
        if item.kind == "necro" then
            love.graphics.setColor(0.04, 0.03, 0.08, 0.5)
            love.graphics.ellipse("fill", necro.x, necro.y + 2, 24, 9)
            local flash = (necro.invulnTimer > 0 and math.floor(timeAcc * 20) % 2 == 0)
            love.graphics.setColor(1, flash and 0.4 or 1, flash and 0.4 or 1, 1)
            local bob = (necro.stage == 4) and (math.sin(timeAcc * 6) * 4 - 6) or 0
            love.graphics.draw(necroImg, necroQuads[necro.stage], math.floor(necro.x), math.floor(necro.y + bob), 0, 3 * necro.facing, 3, 14, 30)
        elseif item.kind == "summon" then
            local s = item.ref
            love.graphics.setColor(0.04, 0.03, 0.08, 0.45)
            love.graphics.ellipse("fill", s.x, s.y + 2, 16, 6)
            love.graphics.setColor(1, s.hitFlash > 0 and 0.4 or 1, s.hitFlash > 0 and 0.4 or 1, 1)
            love.graphics.draw(summonsImg, summonQuads[s.unit.kind], math.floor(s.x), math.floor(s.y), 0, 3 * s.facing, 3, 8, 16)
            -- 미니 체력바
            love.graphics.setColor(0.1, 0.1, 0.15, 0.85)
            love.graphics.rectangle("fill", s.x - 14, s.y - 52, 28, 4)
            love.graphics.setColor(0.25, 0.95, 0.55, 1)
            love.graphics.rectangle("fill", s.x - 14, s.y - 52, 28 * math.max(0, s.hp / s.maxHp), 4)
        elseif item.kind == "enemy" then
            local e = item.ref
            love.graphics.setColor(0.04, 0.03, 0.08, 0.48)
            love.graphics.ellipse("fill", e.x, e.y + 2, e.radius, e.radius * 0.4)
            love.graphics.setColor(1, e.hitFlash > 0 and 0.3 or 1, e.hitFlash > 0 and 0.3 or 1, 1)
            love.graphics.draw(enemiesImg, enemyQuads[e.kind], math.floor(e.x), math.floor(e.y), 0, e.scale, e.scale, 8, 16)
            local bw = e.isBoss and 64 or 28
            love.graphics.setColor(0.1, 0.1, 0.15, 0.85)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * 16 - 8, bw, 5)
            love.graphics.setColor(0.95, 0.28, 0.35, 1)
            love.graphics.rectangle("fill", e.x - bw / 2, e.y - e.scale * 16 - 8, bw * math.max(0, e.hp / e.maxHp), 5)
        end
    end

    -- 5. 투사체
    for _, b in ipairs(bullets) do
        love.graphics.setColor(b.col[1], b.col[2], b.col[3], 1)
        love.graphics.circle("fill", b.x, b.y, b.radius)
    end
    for _, eb in ipairs(enemyBullets) do
        love.graphics.setColor(1.0, 0.45, 0.15, 1)
        love.graphics.circle("fill", eb.x, eb.y, 6)
    end

    -- 6. 상단 전투 HUD
    love.graphics.setColor(0.10, 0.08, 0.16, 0.92)
    love.graphics.rectangle("fill", 0, 0, 960, 48)
    love.graphics.setColor(0.95, 0.28, 0.35, 1)
    love.graphics.rectangle("fill", 24, 14, 180 * math.max(0, necro.hp / necro.maxHp), 20, 4, 4)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.rectangle("line", 24, 14, 180, 20, 4, 4)
    love.graphics.print("HP " .. math.max(0, math.floor(necro.hp)) .. "/" .. necro.maxHp, 34, 17)

    love.graphics.setColor(0.99, 0.88, 0.35, 1)
    love.graphics.print("WAVE " .. wave .. "   |   ENEMIES LEFT: " .. #enemies .. "   |   SOULS: " .. souls, 235, 17)
    love.graphics.setColor(0.65, 0.95, 0.72, 1)
    love.graphics.print("WASD: Move  |  CLICK: Soul Bolt  |  SPACE: Shadow Dash", 590, 17)
end

local function drawBlessing()
    drawBattle()
    love.graphics.setColor(0.05, 0.04, 0.10, 0.82)
    love.graphics.rectangle("fill", 0, 0, 960, 540)
    love.graphics.setColor(0.45, 1.0, 0.65, 1)
    love.graphics.printf("WAVE CLEARED! CHOOSE A ROGUELIKE BLESSING", 0, 115, 960, "center")

    for i = 1, 3 do
        local b = blessingChoices[i]
        local bx = 65 + (i - 1) * 290
        drawButton(bx, 180, 260, 200, b.title, "\n\n" .. b.desc .. "\n\n[ CLICK TO CHOOSE ]", {0.16, 0.13, 0.26}, {0.40, 1.0, 0.65})
    end
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
    elseif mode == "blessing" then
        drawBlessing()
    elseif mode == "gameover" then
        drawBattle()
        love.graphics.setColor(0.08, 0.02, 0.05, 0.82)
        love.graphics.rectangle("fill", 0, 0, 960, 540)
        love.graphics.setColor(1.0, 0.35, 0.40, 1)
        love.graphics.printf("DEFEATED AT WAVE " .. wave, 0, 220, 960, "center")
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.printf("Click or Press [R] to start a new Roguelike Run!", 0, 260, 960, "center")
    end

    -- 공통 파티클 & 데미지 텍스트
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
