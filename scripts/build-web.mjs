import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gameDir = path.join(root, 'game');
const distDir = path.join(root, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
execSync(
  `npx love.js -c -t "Necromancer Gacha Roguelike (Love2D + Lua)" -m 33554432 "${gameDir}" "${distDir}"`,
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
    <title>네크로맨서 가챠 로그라이크 — Step 1: 4단계 진화 도트 디자인</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #0f0b1a;
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
      .title-wrap { display: flex; align-items: center; gap: 10px; }
      .badge {
        background: #22c55e;
        color: #052e16;
        font-weight: 900;
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 999px;
      }
      h1 { font-size: 18px; color: #bbf7d0; }
      .stage {
        width: min(960px, 100%);
        border: 3px solid #22c55e;
        border-radius: 12px;
        overflow: hidden;
        background: #171226;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
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
        background: #1c152e;
        border: 1.5px solid #3f2f63;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.55;
      }
      .guide strong { color: #86efac; }
    </style>
  </head>
  <body>
    <header>
      <div class="title-wrap">
        <span class="badge">STEP 1 · Love2D + Lua</span>
        <h1>💀 네크로맨서 4단계 성장 진화 도트 디자인 (하트 팬티 → 사령군주)</h1>
      </div>
    </header>

    <div class="stage">
      <canvas id="loadingCanvas" oncontextmenu="event.preventDefault()" width="960" height="540"></canvas>
      <canvas id="canvas" oncontextmenu="event.preventDefault()"></canvas>
    </div>

    <div class="guide">
      <strong>💡 확인 방법:</strong>
      상단 4개의 진화 카드(<strong>1단계 하트팬티+거적대기 → 2단계 보라후드 → 3단계 대네크로맨서 → 4단계 각성 사령군주</strong>)를 클릭하거나
      키보드 <strong>1 / 2 / 3 / 4</strong>를 눌러 하단 확대 검수대에서 자세히 확인해 보세요! (<strong>Space</strong> 또는 중앙 클릭 시 소환 마법 연출!)
    </div>

    <script type="text/javascript">
      var loadingContext = document.getElementById('loadingCanvas').getContext('2d');
      function drawLoadingText(text) {
        var c = loadingContext.canvas;
        loadingContext.fillStyle = '#171226';
        loadingContext.fillRect(0, 0, c.width, c.height);
        loadingContext.font = 'bold 20px sans-serif';
        loadingContext.textAlign = 'center';
        loadingContext.fillStyle = '#bbf7d0';
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
