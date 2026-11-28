import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gameDir = path.join(root, 'game');
const distDir = path.join(root, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
execSync(
  `npx love.js -c -t "Pixel Dungeon Inn" -m 33554432 "${gameDir}" "${distDir}"`,
  { stdio: 'inherit' }
);

try {
  execSync(`zip -9 -r "${path.join(distDir, 'necromancer.love')}" .`, {
    cwd: gameDir,
    stdio: 'ignore',
  });
} catch {
  // zip optional
}

const indexPath = path.join(distDir, 'index.html');
const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pixel Dungeon Inn</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #0c0d11;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
        padding: 18px 14px;
      }
      header {
        width: min(960px, 100%);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 12px;
      }
      h1 { font-size: 18px; color: #f0e8db; }
      .stage {
        width: min(960px, 100%);
        border: 1px solid #383b43;
        border-radius: 10px;
        overflow: hidden;
        background: #111216;
      }
      canvas {
        display: block;
        max-width: 100%;
        height: auto;
        image-rendering: pixelated;
      }
      #canvas { visibility: hidden; }
      .guide {
        width: min(960px, 100%);
        margin-top: 12px;
        background: #15161c;
        border: 1px solid #383b43;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.55;
      }
      .guide strong { color: #e0b57a; }
    </style>
  </head>
  <body>
    <header>
      <h1>Pixel Dungeon Inn</h1>
    </header>

    <div class="stage">
      <canvas id="loadingCanvas" oncontextmenu="event.preventDefault()" width="960" height="540"></canvas>
      <canvas id="canvas" width="960" height="540" tabindex="0" aria-label="Pixel Dungeon Inn 게임 화면" oncontextmenu="event.preventDefault()"></canvas>
    </div>

    <div class="guide">
      <strong>Character</strong>에서 방향 카드를 눌러 외형을 확인하세요.
      <strong>Dungeon</strong>에서는 WASD 또는 방향키로 걸으세요. 사거리 안에 표적이 들어오면 자동으로 공격해요.
      <strong>Camp</strong>에서 시작 반지 3개로 바로 출전할 수 있어요. 해골들이 알아서 싸우는 동안 포위를 피하고, 파란 경험치를 모아 강화하세요. 세 웨이브를 모두 넘기면 반지 하나를 골라 가져와요.
      무덤불을 써보려면 Camp에서 <strong>Grave Flame</strong>을 고르고 <strong>Equip Ring</strong>을 누르세요.
    </div>

    <script type="text/javascript">
      var loadingContext = document.getElementById('loadingCanvas').getContext('2d');
      function drawLoadingText(text) {
        var c = loadingContext.canvas;
        loadingContext.fillStyle = '#111216';
        loadingContext.fillRect(0, 0, c.width, c.height);
        loadingContext.font = 'bold 20px sans-serif';
        loadingContext.textAlign = 'center';
        loadingContext.fillStyle = '#e0b57a';
        loadingContext.fillText(text, c.width / 2, c.height / 2);
      }

      window.onload = function () { window.focus(); };
      window.onclick = function () { window.focus(); };
      window.addEventListener('keydown', function (e) {
        if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) e.preventDefault();
      }, false);

      var Module = {
        arguments: ['./'],
        INITIAL_MEMORY: 33554432,
        printErr: console.error.bind(console),
        canvas: (function () {
          var canvas = document.getElementById('canvas');
          canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);
          return canvas;
        })(),
        setStatus: function (text) {
          if (text) {
            drawLoadingText(text);
          } else if (Module.remainingDependencies === 0) {
            document.getElementById('loadingCanvas').style.display = 'none';
            document.getElementById('canvas').style.visibility = 'visible';
          }
        },
        totalDependencies: 0,
        remainingDependencies: 0,
        monitorRunDependencies: function (left) {
          this.remainingDependencies = left;
          this.totalDependencies = Math.max(this.totalDependencies, left);
          Module.setStatus(left ? 'Loading Love2D... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'Ready');
        }
      };
      Module.setStatus('Loading Love2D Engine...');
      var applicationLoad = function () { Love(Module); };
    </script>
    <script type="text/javascript" src="game.js"></script>
    <script async type="text/javascript" src="love.js" onload="applicationLoad()"></script>
  </body>
</html>
`;

fs.writeFileSync(indexPath, html, 'utf8');
