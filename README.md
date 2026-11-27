# 🎮 픽셀 던전 여관 — LÖVE (Love2D) + Lua 프로젝트

**LÖVE (Love2D 11.3) + Lua** 언어로 제작하며, `love.js` WebAssembly 자동 빌드를 통해 **GitHub Pages 웹 브라우저**와 **데스크톱 LÖVE(.love)** 두 곳 모두에서 즉시 실행되는 도트 & Sprite-Stacking 게임 프로젝트입니다.

- **웹 라이브 실행 (설치 불필요)**: [https://ohbahn85-cyber.github.io/pixel-dungeon-inn/](https://ohbahn85-cyber.github.io/pixel-dungeon-inn/)

## 📂 프로젝트 구조

- `game/conf.lua` — LÖVE (Love2D) 창 크기 및 엔진 모듈 설정
- `game/main.lua` — Lua 메인 게임 루프 (`love.load`, `love.update`, `love.draw`)
- `game/assets/` — 진짜 `.png` 도트 스프라이트 시트 & Sprite-Stacking 슬라이스 스트립
- `scripts/generate_assets.py` — `.png` 도트 에셋 생성 스크립트
- `scripts/build-web.mjs` — `love.js` 호환 모드 웹 빌드 & `.love` 데스크톱 패키지 생성 스크립트

## 🛠️ 빌드 명령어

```bash
npm install
npm run build   # dist/ 폴더에 love.js 웹 빌드 + pixel-dungeon-inn.love 생성
```
