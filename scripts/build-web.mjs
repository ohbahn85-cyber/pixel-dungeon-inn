import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gameDir = path.join(root, 'game');
const distDir = path.join(root, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
execSync(
  `npx love.js -c -t "New Love2D + Lua Project" -m 33554432 "${gameDir}" "${distDir}"`,
  { stdio: 'inherit' }
);

try {
  execSync(`zip -9 -r "${path.join(distDir, 'game.love')}" .`, {
    cwd: gameDir,
    stdio: 'ignore',
  });
} catch {
  // zip optional
}

const indexPath = path.join(distDir, 'index.html');
const cleanHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New Love2D + Lua Project</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #0f0f14;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 16px;
      }
      .stage {
        width: min(960px, 100%);
        border: 2px solid #334155;
        border-radius: 10px;
        overflow: hidden;
        background: #171720;
      }
      canvas {
        display: block;
        max-width: 100%;
        height: auto;
        image-rendering: pixelated;
      }
      #canvas { visibility: hidden; }
    </style>
  </head>
  <body>
    <div class="stage">
      <canvas id="loadingCanvas" oncontextmenu="event.preventDefault()" width="960" height="540"></canvas>
      <canvas id="canvas" oncontextmenu="event.preventDefault()"></canvas>
    </div>

    <script type="text/javascript">
      var loadingContext = document.getElementById('loadingCanvas').getContext('2d');
      function drawLoadingText(text) {
        var c = loadingContext.canvas;
        loadingContext.fillStyle = '#171720';
        loadingContext.fillRect(0, 0, c.width, c.height);
        loadingContext.font = 'bold 20px sans-serif';
        loadingContext.textAlign = 'center';
        loadingContext.fillStyle = '#e2e8f0';
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
          Module.setStatus(left ? 'Loading... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'Ready');
        }
      };
      Module.setStatus('Loading Love2D...');
      var applicationLoad = function () { Love(Module); };
    </script>
    <script type="text/javascript" src="game.js"></script>
    <script async type="text/javascript" src="love.js" onload="applicationLoad()"></script>
  </body>
</html>
`;

fs.writeFileSync(indexPath, cleanHtml, 'utf8');
