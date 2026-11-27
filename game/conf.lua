function love.conf(t)
    t.identity = "love2d-lua-project"
    t.version = "11.3"
    t.console = false

    t.window.title = "New Love2D + Lua Project"
    t.window.width = 960
    t.window.height = 540
    t.window.resizable = false
    t.window.vsync = 1

    t.modules.joystick = false
    t.modules.physics = false
    t.modules.video = false
end
