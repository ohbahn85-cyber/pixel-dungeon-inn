import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gameDir = path.join(root, 'game');
const distDir = path.join(root, 'dist');

// 1. Clean dist and run love.js in compatibility mode (works on GitHub Pages without COOP/COEP headers)
fs.rmSync(distDir, { recursive: true, force: true });
execSync(
  `npx love.js -c -t "Pixel Dungeon Inn (Love2D + Lua)" -m 33554432 "${gameDir}" "${distDir}"`,
  { stdio: 'inherit' }
);

// 2. Also package a real desktop .love archive inside dist/ if zip is available
try {
  execSync(`zip -9 -r "${path.join(distDir, 'pixel-dungeon-inn.love')}" .`, {
    cwd: gameDir,
    stdio: 'ignore',
  });
  console.log('Created dist/pixel-dungeon-inn.love');
} catch {
  console.log('zip not available; skipping .love archive creation');
}

// 3. Polish dist/index.html with a clean dark UI & Korean guide while keeping love.js boot intact
const indexPath = path.join(distDir, 'index.html');
const polishedHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>픽셀 던전 여관 — LÖVE (Love2D) + Lua 엔진</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #14101f;
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
      .title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .badge {
        background: #fbbf24;
        color: #451a03;
        font-weight: 900;
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 999px;
      }
      h1 {
        font-size: 18px;
        color: #fef08a;
      }
      .controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .btn {
        background: #2b2340;
        color: #fef08a;
        border: 1.5px solid #fbbf24;
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
      }
      .btn:hover { background: #3b2f57; }
      .stage-frame {
        position: relative;
        width: min(960px, 100%);
        background: #1c1629;
        border: 3px solid #fbbf24;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
        display: flex;
        justify-content: center;
        align-items: center;
      }
      canvas {
        display: block;
        max-width: 100%;
        height: auto;
        image-rendering: pixelated;
      }
      #canvas { visibility: hidden; }
      .hint-bar {
        width: min(960px, 100%);
        margin-top: 12px;
        background: #221b33;
        border: 1.5px solid #3f325c;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.5;
      }
      .hint-bar strong { color: #fde047; }
    </style>
  </head>
  <body>
    <header>
      <div class="title-wrap">
        <span class="badge">LÖVE 11.3 + Lua</span>
        <h1>🎮 픽셀 던전 여관 — Love2D + Lua 엔진 세팅 완료</h1>
      </div>
      <div class="controls">
        <a class="btn" href="./pixel-dungeon-inn.love" download>📥 PC용 .love 다운로드</a>
        <button class="btn" onclick="goFullScreen()">🖥️ 전체화면</button>
      </div>
    </header>

    <div class="stage-frame">
      <canvas id="loadingCanvas" oncontextmenu="event.preventDefault()" width="960" height="540"></canvas>
      <canvas id="canvas" oncontextmenu="event.preventDefault()"></canvas>
    </div>

    <div class="hint-bar">
      <strong>💡 조작 가이드:</strong>
      좌하단 타일 바닥에서 <strong>WASD / 방향키</strong> 또는 <strong>마우스 클릭</strong>으로 4방향 도트 캐릭터를 걸어 다닐 수 있습니다.
      우하단 <strong>12층 모루 Sprite-Stacking</strong>은 클릭 또는 <strong>Q / E / Space</strong>로 360° 회전을 제어할 수 있습니다.
    </div>

    <script type="text/javascript">
      function goFullScreen() {
        var canvas = document.getElementById('canvas');
        if (canvas.requestFullscreen) canvas.requestFullscreen();
        else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
      }

      var loadingContext = document.getElementById('loadingCanvas').getContext('2d');
      function drawLoadingText(text) {
        var c = loadingContext.canvas;
        loadingContext.fillStyle = '#1c1629';
        loadingContext.fillRect(0, 0, c.width, c.height);
        loadingContext.font = 'bold 24px sans-serif';
        loadingContext.textAlign = 'center';
        loadingContext.fillStyle = '#fef08a';
        loadingContext.fillText('LÖVE (Love2D) + Lua 엔진 로딩 중...', c.width / 2, c.height / 2 - 20);
        loadingContext.font = '16px sans-serif';
        loadingContext.fillStyle = '#cbd5e1';
        loadingContext.fillText(text, c.width / 2, c.height / 2 + 20);
      }

      window.onload = function () { window.focus(); };
      window.onclick = function () { window.focus(); };

      window.addEventListener('keydown', function (e) {
        if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
          e.preventDefault();
        }
      }, false);

      var Module = {
        arguments: ['./'],
        INITIAL_MEMORY: 33554432,
        printErr: console.error.bind(console),
        canvas: (function () {
          var canvas = document.getElementById('canvas');
          canvas.addEventListener('webglcontextlost', function (e) {
            alert('WebGL context lost. 페이지를 새로고침해 주세요.');
            e.preventDefault();
          }, false);
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
          Module.setStatus(
            left
              ? '엔진 리소스 준비 중... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')'
              : '로딩 완료!'
          );
        }
      };
      Module.setStatus('Love2D WebAssembly 다운로드 중...');

      var applicationLoad = function () {
        Love(Module);
      };
    </script>
    <script type="text/javascript" src="game.js"></script>
    <script async type="text/javascript" src="love.js" onload="applicationLoad()"></script>
  </body>
</html>
`;

fs.writeFileSync(indexPath, polishedHtml, 'utf8');
console.log('Polished dist/index.html successfully.');
