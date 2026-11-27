-- Necromancer Gacha Roguelike — Step 1: 4-Stage Evolution Character Showcase (Love2D + Lua)

local stagesImg
local stageQuads = {}
local selectedStage = 1
local timeAcc = 0
local castTimer = 0
local particles = {}

local STAGES = {
    {
        id = 1,
        code = "LV.1",
        title = "STAGE 1: BROKE NOVICE",
        sub = "Heart Boxers + Tattered Sackcloth + Twig",
        auraR = 0.72, auraG = 0.54, auraB = 0.36,
        wisps = 0,
        hover = false,
    },
    {
        id = 2,
        code = "LV.10",
        title = "STAGE 2: HOODED NECROMANCER",
        sub = "Purple Hood + Glowing Green Eyes + Skull Staff",
        auraR = 0.45, auraG = 0.90, auraB = 0.55,
        wisps = 1,
        hover = false,
    },
    {
        id = 3,
        code = "LV.25",
        title = "STAGE 3: ARCH-NECROMANCER",
        sub = "Gilded Robe + Bone Pauldrons + Soul Wisp",
        auraR = 0.25, auraG = 0.95, auraB = 0.55,
        wisps = 2,
        hover = false,
    },
    {
        id = 4,
        code = "LV.50",
        title = "STAGE 4: AWAKENED LICH KING",
        sub = "Horned Crown + Levitation Aura + Grand Staff",
        auraR = 0.18, auraG = 1.00, auraB = 0.58,
        wisps = 4,
        hover = true,
    },
}

function love.load()
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.09, 0.07, 0.14)

    stagesImg = love.graphics.newImage("assets/necromancer_stages.png")
    local w, h = stagesImg:getDimensions()
    for i = 0, 3 do
        stageQuads[i + 1] = love.graphics.newQuad(i * 28, 0, 28, 32, w, h)
    end
end

local function spawnCastParticles(cx, cy, stageIdx)
    local count = 12 + stageIdx * 8
    for _ = 1, count do
        local ang = math.random() * math.pi * 2
        local spd = 45 + math.random() * 115
        table.insert(particles, {
            x = cx + (math.random() - 0.5) * 30,
            y = cy - 40 + (math.random() - 0.5) * 30,
            vx = math.cos(ang) * spd,
            vy = math.sin(ang) * spd - 35,
            life = 0.45 + math.random() * 0.45,
            maxLife = 0.9,
            size = (stageIdx >= 3) and 6 or 4,
            isGreen = (stageIdx >= 2),
        })
    end
end

function love.update(dt)
    timeAcc = timeAcc + dt
    if castTimer > 0 then
        castTimer = math.max(0, castTimer - dt)
    end

    for i = #particles, 1, -1 do
        local p = particles[i]
        p.x = p.x + p.vx * dt
        p.y = p.y + p.vy * dt
        p.vy = p.vy - 25 * dt
        p.life = p.life - dt
        if p.life <= 0 then
            table.remove(particles, i)
        end
    end
end

function love.keypressed(key)
    if key == "1" then selectedStage = 1; castTimer = 0.4; spawnCastParticles(480, 395, 1)
    elseif key == "2" then selectedStage = 2; castTimer = 0.4; spawnCastParticles(480, 395, 2)
    elseif key == "3" then selectedStage = 3; castTimer = 0.4; spawnCastParticles(480, 395, 3)
    elseif key == "4" then selectedStage = 4; castTimer = 0.4; spawnCastParticles(480, 395, 4)
    elseif key == "space" then
        castTimer = 0.5
        spawnCastParticles(480, 395, selectedStage)
    elseif key == "right" then
        selectedStage = (selectedStage % 4) + 1
        castTimer = 0.45
        spawnCastParticles(480, 395, selectedStage)
    elseif key == "left" then
        selectedStage = ((selectedStage - 2) % 4) + 1
        castTimer = 0.45
        spawnCastParticles(480, 395, selectedStage)
    end
end

function love.mousepressed(x, y, button)
    if button ~= 1 then return end

    -- 상단 4개 진화 카드 클릭 감지
    for i = 1, 4 do
        local cx = 30 + (i - 1) * 230
        local cy = 48
        if x >= cx and x <= cx + 210 and y >= cy and y <= cy + 178 then
            selectedStage = i
            castTimer = 0.45
            spawnCastParticles(480, 395, i)
            return
        end
    end

    -- 하단 중앙 스포트라이트 클릭 시 소환 마법 시전 연출!
    if x >= 180 and x <= 780 and y >= 245 and y <= 515 then
        castTimer = 0.5
        spawnCastParticles(480, 395, selectedStage)
    end
end

local function drawSoulWisps(cx, cy, count, radiusX, radiusY, scale)
    for i = 1, count do
        local a = timeAcc * 2.2 + (i - 1) * (math.pi * 2 / count)
        local wx = cx + math.cos(a) * radiusX
        local wy = cy + math.sin(a) * radiusY - 45 + math.sin(timeAcc * 5 + i) * 5
        love.graphics.setColor(0.20, 0.95, 0.55, 0.35)
        love.graphics.rectangle("fill", math.floor(wx - scale), math.floor(wy - scale), scale * 2, scale * 2)
        love.graphics.setColor(0.65, 1.0, 0.78, 1)
        love.graphics.rectangle("fill", math.floor(wx - scale * 0.5), math.floor(wy - scale * 0.5), scale, scale)
    end
end

function love.draw()
    -- 상단 타이틀 바
    love.graphics.setColor(0.60, 1.0, 0.72, 1)
    love.graphics.print("NECROMANCER GACHA ROGUELIKE  |  STEP 1: 4-STAGE EVOLUTION PIXEL ART (28x32)", 30, 16)
    love.graphics.setColor(0.75, 0.78, 0.88, 1)
    love.graphics.print("Click a Stage or Press [1-4] / [Space]", 680, 16)

    -- 1. 상단 4단계 성장 비교 카드 (4x 정수 도트 확대)
    for i = 1, 4 do
        local st = STAGES[i]
        local cardX = 30 + (i - 1) * 230
        local cardY = 48
        local isSel = (i == selectedStage)

        love.graphics.setColor(isSel and 0.20 or 0.14, isSel and 0.15 or 0.11, isSel and 0.30 or 0.21, 1)
        love.graphics.rectangle("fill", cardX, cardY, 210, 178, 10, 10)
        if isSel then
            love.graphics.setColor(0.35, 0.98, 0.60, 1)
            love.graphics.setLineWidth(3)
        else
            love.graphics.setColor(0.34, 0.28, 0.48, 1)
            love.graphics.setLineWidth(1.5)
        end
        love.graphics.rectangle("line", cardX, cardY, 210, 178, 10, 10)

        -- 라벨
        love.graphics.setColor(isSel and 0.60 or 0.85, isSel and 1.0 or 0.88, isSel and 0.72 or 0.95, 1)
        love.graphics.print(st.code .. "  STAGE " .. i, cardX + 12, cardY + 10)

        local bob = st.hover and (math.sin(timeAcc * 4 + i) * 5 - 6) or (math.sin(timeAcc * 4 + i) > 0 and 0 or 2)
        local drawX = cardX + 105
        local drawY = cardY + 158

        -- 발밑 그림자
        love.graphics.setColor(0.04, 0.03, 0.08, 0.5)
        love.graphics.ellipse("fill", drawX, drawY + 2, 34, 10)

        -- 4x 정수 픽셀 렌더링
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(stagesImg, stageQuads[i], drawX, math.floor(drawY + bob), 0, 4, 4, 14, 30)

        if st.wisps > 0 then
            drawSoulWisps(drawX, drawY - 12, math.min(2, st.wisps), 44, 12, 4)
        end
    end

    -- 2. 하단 중앙 스포트라이트 확대 검수대 (6x 정수 도트 확대 + 소환 마법 연출)
    local cur = STAGES[selectedStage]
    love.graphics.setColor(0.14, 0.11, 0.22, 1)
    love.graphics.rectangle("fill", 30, 242, 900, 278, 12, 12)
    love.graphics.setColor(0.45, 0.35, 0.65, 1)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", 30, 242, 900, 278, 12, 12)

    -- 현재 단계 설명
    love.graphics.setColor(0.99, 0.90, 0.40, 1)
    love.graphics.print(cur.title, 54, 260)
    love.graphics.setColor(0.80, 0.85, 0.94, 1)
    love.graphics.print(cur.sub, 54, 282)
    love.graphics.setColor(0.55, 0.98, 0.68, 1)
    love.graphics.print("Click here or press [SPACE] to test Summon Cast!", 54, 490)

    -- 마법진 발판 (단계가 높을수록 네크로 마법진이 화려하게 발광!)
    local spotX = 480
    local spotY = 456
    local pulse = 0.65 + math.sin(timeAcc * 4) * 0.25
    love.graphics.setColor(cur.auraR, cur.auraG, cur.auraB, (selectedStage == 1 and 0.15 or 0.32) * pulse)
    love.graphics.ellipse("fill", spotX, spotY + 4, 92, 26)
    love.graphics.setColor(cur.auraR, cur.auraG, cur.auraB, 0.85)
    love.graphics.setLineWidth(2)
    love.graphics.ellipse("line", spotX, spotY + 4, 92, 26)

    -- 6x 확대 네크로맨서 본체
    local castJump = castTimer > 0 and (-math.sin((castTimer / 0.5) * math.pi) * 14) or 0
    local bigBob = cur.hover and (math.sin(timeAcc * 3.5) * 7 - 10) or (math.sin(timeAcc * 3.5) > 0 and 0 or 3)

    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(
        stagesImg,
        stageQuads[selectedStage],
        spotX,
        math.floor(spotY + bigBob + castJump),
        0,
        6,
        6,
        14,
        30
    )

    if cur.wisps > 0 then
        drawSoulWisps(spotX, spotY - 30, cur.wisps, 88, 22, 6)
    end

    -- 소환 시전 도트 파티클
    for _, p in ipairs(particles) do
        local alpha = math.max(0, p.life / p.maxLife)
        if p.isGreen then
            love.graphics.setColor(0.40, 1.0, 0.65, alpha)
        else
            love.graphics.setColor(0.95, 0.45, 0.55, alpha)
        end
        love.graphics.rectangle("fill", math.floor(p.x), math.floor(p.y), p.size, p.size)
    end
end
