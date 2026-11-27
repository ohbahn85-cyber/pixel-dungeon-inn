-- Pixel Dungeon Inn — LÖVE (Love2D) + Lua Starter Environment
-- 1) 24x28 4-Way Pixel Art Sprite Sheet (assets/blacksmith_4way.png)
-- 2) 12-Layer GPU Sprite-Stacking PNG Strip (assets/anvil_stack.png)

local blacksmithImg
local blacksmithQuads = {}
local anvilImg
local anvilQuads = {}

local timeAcc = 0
local anvilAngle = 0
local autoRotate = true

local player = {
    x = 240,
    y = 395,
    speed = 115,
    dir = 1, -- 1: front, 2: back, 3: left, 4: right
    moving = false,
    targetX = nil,
    targetY = nil,
}

local dirLabels = { "1. FRONT", "2. BACK", "3. LEFT", "4. RIGHT" }

function love.load()
    -- 도트 그래픽이 흐려지지 않도록 Nearest-Neighbor 필터 전역 적용
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setBackgroundColor(0.11, 0.09, 0.16)

    -- 1. 4방향 대장장이 도트 스프라이트 시트 로드 (96x28 -> 24x28 x 4)
    blacksmithImg = love.graphics.newImage("assets/blacksmith_4way.png")
    local bw, bh = blacksmithImg:getDimensions()
    for i = 0, 3 do
        blacksmithQuads[i + 1] = love.graphics.newQuad(i * 24, 0, 24, 28, bw, bh)
    end

    -- 2. 12층 Sprite-Stacking 모루 PNG 스트립 로드 (192x16 -> 16x16 x 12)
    anvilImg = love.graphics.newImage("assets/anvil_stack.png")
    local aw, ah = anvilImg:getDimensions()
    for z = 0, 11 do
        anvilQuads[z + 1] = love.graphics.newQuad(z * 16, 0, 16, 16, aw, ah)
    end
end

function love.update(dt)
    timeAcc = timeAcc + dt

    if autoRotate then
        anvilAngle = anvilAngle + dt * 1.15
    end
    if love.keyboard.isDown("q") then
        autoRotate = false
        anvilAngle = anvilAngle - dt * 2.2
    elseif love.keyboard.isDown("e") then
        autoRotate = false
        anvilAngle = anvilAngle + dt * 2.2
    end

    -- 키보드(WASD / 방향키) 이동 처리
    local dx, dy = 0, 0
    if love.keyboard.isDown("w", "up") then dy = dy - 1 end
    if love.keyboard.isDown("s", "down") then dy = dy + 1 end
    if love.keyboard.isDown("a", "left") then dx = dx - 1 end
    if love.keyboard.isDown("d", "right") then dx = dx + 1 end

    if dx ~= 0 or dy ~= 0 then
        player.targetX = nil
        player.targetY = nil
        local len = math.sqrt(dx * dx + dy * dy)
        dx, dy = dx / len, dy / len
        player.x = player.x + dx * player.speed * dt
        player.y = player.y + dy * player.speed * dt
        player.moving = true

        if math.abs(dx) > math.abs(dy) then
            player.dir = (dx < 0) and 3 or 4
        else
            player.dir = (dy < 0) and 2 or 1
        end
    elseif player.targetX and player.targetY then
        -- 마우스 클릭 이동 처리
        local tx = player.targetX - player.x
        local ty = player.targetY - player.y
        local dist = math.sqrt(tx * tx + ty * ty)
        if dist < 4 then
            player.targetX = nil
            player.targetY = nil
            player.moving = false
        else
            tx, ty = tx / dist, ty / dist
            player.x = player.x + tx * player.speed * dt
            player.y = player.y + ty * player.speed * dt
            player.moving = true
            if math.abs(tx) > math.abs(ty) then
                player.dir = (tx < 0) and 3 or 4
            else
                player.dir = (ty < 0) and 2 or 1
            end
        end
    else
        player.moving = false
    end

    -- 테스트 바닥 영역 안으로 좌표 제한
    player.x = math.max(58, math.min(442, player.x))
    player.y = math.max(305, math.min(495, player.y))
end

function love.mousepressed(x, y, button)
    if button == 1 then
        if x >= 30 and x <= 470 and y >= 270 and y <= 515 then
            player.targetX = x
            player.targetY = y
        elseif x >= 490 and x <= 930 and y >= 270 and y <= 515 then
            autoRotate = not autoRotate
        end
    end
end

function love.keypressed(key)
    if key == "space" then
        autoRotate = not autoRotate
    end
end

local function drawPanel(x, y, w, h, title)
    love.graphics.setColor(0.16, 0.13, 0.24, 1)
    love.graphics.rectangle("fill", x, y, w, h, 10, 10)
    love.graphics.setColor(0.95, 0.74, 0.16, 0.85)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", x, y, w, h, 10, 10)

    love.graphics.setColor(0.99, 0.88, 0.35, 1)
    love.graphics.print(title, x + 14, y + 10)
end

local function drawSpriteStack(img, quads, cx, cy, angle, scale, sliceStep)
    -- 발밑 그림자
    love.graphics.setColor(0.05, 0.04, 0.09, 0.45)
    love.graphics.ellipse("fill", cx, cy + 8, 28, 13)

    -- Z=1(바닥)부터 Z=12(모루 윗면)까지 GPU 회전 적층!
    love.graphics.setColor(1, 1, 1, 1)
    for z = 1, #quads do
        local drawY = cy - (z - 1) * sliceStep
        love.graphics.draw(img, quads[z], cx, drawY, angle, scale, scale, 8, 8)
    end
end

function love.draw()
    -- 상단 배너
    love.graphics.setColor(0.99, 0.88, 0.35, 1)
    love.graphics.print("LOVE2D (11.3) + LUA ENGINE READY!  |  PIXEL DUNGEON INN", 24, 14)
    love.graphics.setColor(0.75, 0.80, 0.90, 1)
    love.graphics.print("PNG Pixel Assets + Nearest Filter + GPU Sprite-Stacking", 600, 14)

    -- [상단 패널] 4방향 도트 스프라이트 시트 프리뷰 (4x 정수 확대)
    drawPanel(24, 42, 912, 205, "1) 24x28 4-WAY PIXEL ART SHEET (assets/blacksmith_4way.png)")
    local bob = math.sin(timeAcc * 4.5) > 0 and 0 or 2
    for i = 1, 4 do
        local cardX = 54 + (i - 1) * 220
        local cardY = 76
        love.graphics.setColor(0.12, 0.10, 0.19, 1)
        love.graphics.rectangle("fill", cardX, cardY, 192, 152, 8, 8)
        love.graphics.setColor(0.35, 0.29, 0.48, 1)
        love.graphics.rectangle("line", cardX, cardY, 192, 152, 8, 8)

        love.graphics.setColor(0.92, 0.94, 0.98, 1)
        love.graphics.print(dirLabels[i], cardX + 12, cardY + 8)

        -- 그림자 & 4배 정수 배율 도트 렌더링
        love.graphics.setColor(0.05, 0.04, 0.09, 0.45)
        love.graphics.ellipse("fill", cardX + 96, cardY + 134, 30, 10)

        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(
            blacksmithImg,
            blacksmithQuads[i],
            cardX + 96,
            cardY + 134 + bob,
            0,
            4,
            4,
            12,
            28
        )
    end

    -- [좌하단 패널] WASD / 마우스 클릭 이동 테스트 바닥
    drawPanel(24, 262, 446, 256, "2) LIVE WALK TEST — WASD / Arrows or Click Floor")
    -- 타일 바닥 격자
    local tileSize = 32
    for gx = 0, 12 do
        for gy = 0, 5 do
            local tx = 40 + gx * tileSize
            local ty = 296 + gy * tileSize
            if (gx + gy) % 2 == 0 then
                love.graphics.setColor(0.28, 0.23, 0.38, 1)
            else
                love.graphics.setColor(0.23, 0.19, 0.32, 1)
            end
            love.graphics.rectangle("fill", tx, ty, tileSize, tileSize)
        end
    end

    -- 클릭 목적지 표시
    if player.targetX and player.targetY then
        love.graphics.setColor(0.99, 0.85, 0.25, 0.7)
        love.graphics.circle("line", player.targetX, player.targetY, 7)
    end

    -- 플레이어 캐릭터 렌더링 (2.5x/3x 정수 배율 + 걷기 바운스)
    local walkBounce = player.moving and math.abs(math.sin(timeAcc * 12)) * -6 or 0
    love.graphics.setColor(0.05, 0.04, 0.09, 0.45)
    love.graphics.ellipse("fill", player.x, player.y + 2, 22, 8)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(
        blacksmithImg,
        blacksmithQuads[player.dir],
        math.floor(player.x),
        math.floor(player.y + walkBounce),
        0,
        3,
        3,
        12,
        28
    )

    -- [우하단 패널] 진짜 Love2D GPU Sprite-Stacking 데모 (12층 모루 PNG 회전 적층)
    drawPanel(490, 262, 446, 256, "3) REAL LOVE2D SPRITE-STACKING — Click or [Q/E/Space]")

    -- 회전하는 모루 Sprite-Stack (4배 확대)
    drawSpriteStack(anvilImg, anvilQuads, 635, 425, anvilAngle, 4, 4.5)

    -- 우측에 원본 12층 PNG 스트립도 나란히 표시
    love.graphics.setColor(0.82, 0.86, 0.94, 1)
    love.graphics.print("Raw 12-Slice PNG Strip:", 745, 316)
    love.graphics.print("Angle: " .. string.format("%.0f deg", math.deg(anvilAngle) % 360), 745, 420)
    love.graphics.print(autoRotate and "Mode: AUTO SPIN" or "Mode: MANUAL (Q/E)", 745, 442)
    love.graphics.print("FPS: " .. tostring(love.timer.getFPS()), 745, 466)

    -- 12층 원본 슬라이스 4x3 격자 미리보기
    love.graphics.setColor(1, 1, 1, 1)
    for z = 1, 12 do
        local col = (z - 1) % 4
        local row = math.floor((z - 1) / 4)
        love.graphics.draw(anvilImg, anvilQuads[z], 745 + col * 36, 338 + row * 24, 0, 1.8, 1.8)
    end
end
