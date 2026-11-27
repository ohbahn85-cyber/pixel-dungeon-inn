function love.conf(t)
    t.identity = "pixel-dungeon-inn-love2d"
    t.version = "11.3"
    t.console = false

    t.window.title = "Pixel Dungeon Inn (Love2D + Lua)"
    t.window.width = 960
    t.window.height = 540
    t.window.resizable = false
    t.window.vsync = 1

    -- 웹(love.js) 호환성을 위해 사용하지 않는 모듈은 비활성화
    t.modules.joystick = false
    t.modules.physics = false
    t.modules.video = false
end
