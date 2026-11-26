export type FacingDir = 'front' | 'back' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'work';

export interface BlacksmithPose {
  bobY: number;
  breathScaleX: number;
  breathScaleY: number;
  leftFootY: number;
  rightFootY: number;
  leftFootX: number;
  rightFootX: number;
  leftArmAngle: number;
  rightArmAngle: number;
  headTilt: number;
  blink: boolean;
  hammerGlow: number;
}

export function getBlacksmithPose(
  state: AnimState,
  t: number
): BlacksmithPose {
  const blink = (t % 3.6) > 3.45;

  if (state === 'walk') {
    const c = t * 9.0;
    const s = Math.sin(c);
    const bounce = Math.abs(s);
    return {
      bobY: -bounce * 6,
      breathScaleX: 1 - bounce * 0.03,
      breathScaleY: 1 + bounce * 0.03,
      leftFootY: Math.max(0, s) * -7,
      rightFootY: Math.max(0, -s) * -7,
      leftFootX: s * 4,
      rightFootX: -s * 4,
      leftArmAngle: s * 0.45,
      rightArmAngle: -s * 0.45,
      headTilt: s * 0.05,
      blink,
      hammerGlow: 0,
    };
  }

  if (state === 'work') {
    // 묵직하게 망치를 들어 올렸다가 내려치는 단조 모션
    const cycle = (t * 1.8) % 1;
    let armAngle = 0;
    let bob = 0;
    let sx = 1;
    let sy = 1;
    let glow = 0;

    if (cycle < 0.55) {
      // 망치 높이 들어올리기
      const p = cycle / 0.55;
      const ease = Math.sin(p * Math.PI * 0.5);
      armAngle = -ease * 1.35;
      bob = -ease * 4;
      sx = 1 - ease * 0.04;
      sy = 1 + ease * 0.04;
    } else if (cycle < 0.72) {
      // 쾅! 내려치기
      const p = (cycle - 0.55) / 0.17;
      armAngle = -1.35 + p * 2.15;
      bob = (1 - p) * -4 + p * 3;
      sx = 1 + p * 0.06;
      sy = 1 - p * 0.06;
      glow = Math.sin(p * Math.PI);
    } else {
      // 반동 회복
      const p = (cycle - 0.72) / 0.28;
      armAngle = (1 - p) * 0.8;
      bob = (1 - p) * 3;
      sx = 1 + (1 - p) * 0.06;
      sy = 1 - (1 - p) * 0.06;
    }

    return {
      bobY: bob,
      breathScaleX: sx,
      breathScaleY: sy,
      leftFootY: 0,
      rightFootY: 0,
      leftFootX: 0,
      rightFootX: 0,
      leftArmAngle: -armAngle * 0.25,
      rightArmAngle: armAngle,
      headTilt: armAngle * 0.08,
      blink: cycle >= 0.55 && cycle < 0.74 ? true : blink,
      hammerGlow: glow,
    };
  }

  // 기본 Idle (부드러운 호흡)
  const b = Math.sin(t * 3.0);
  return {
    bobY: -Math.max(0, b) * 2,
    breathScaleX: 1 + b * 0.015,
    breathScaleY: 1 - b * 0.015,
    leftFootY: 0,
    rightFootY: 0,
    leftFootX: 0,
    rightFootX: 0,
    leftArmAngle: b * 0.06,
    rightArmAngle: -b * 0.06,
    headTilt: Math.sin(t * 1.5) * 0.03,
    blink,
    hammerGlow: 0,
  };
}

/**
 * 대표 캐릭터 1종: [대장장이 명장 발칸]
 * 층간 줄무늬(애벌레/팬케이크 아티팩트)가 절대 생기지 않도록,
 * 각 신체 부위(부츠, 바지, 몸통, 가죽 앞치마, 벨트, 수염, 얼굴, 눈/눈썹, 두건, 양팔, 단조 망치)를
 * 앞(Front) / 뒤(Back) / 좌(Left) / 우(Right) 4방향 전용 2.5D 벡터 일러스트 파츠로 정교하게 렌더링합니다!
 */
export function drawBlacksmithCharacter(
  ctx: CanvasRenderingContext2D,
  dir: FacingDir,
  pose: BlacksmithPose,
  cx: number,
  groundY: number,
  scale = 1.0
): void {
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(scale, scale);

  // 1. 발밑 그림자 (고정)
  ctx.beginPath();
  ctx.ellipse(0, 4, 34, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12, 8, 20, 0.45)';
  ctx.fill();

  // 캐릭터 전체 호흡/점프 바운스 적용
  ctx.translate(0, pose.bobY);
  ctx.scale(pose.breathScaleX, pose.breathScaleY);

  if (dir === 'front') {
    drawFrontView(ctx, pose);
  } else if (dir === 'back') {
    drawBackView(ctx, pose);
  } else if (dir === 'left') {
    drawSideView(ctx, pose, 'left');
  } else if (dir === 'right') {
    drawSideView(ctx, pose, 'right');
  }

  ctx.restore();
}

const OUTLINE = '#231512';
const LINE_W = 3.2;

/**
 * 1. 정면 (FRONT / 남쪽 바라보기)
 */
function drawFrontView(ctx: CanvasRenderingContext2D, pose: BlacksmithPose): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // [A] 등 뒤 망토 뒷자락
  ctx.beginPath();
  ctx.roundRect(-26, -68, 52, 50, 18);
  ctx.fillStyle = '#3f384c';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // [B] 양발 통통한 가죽 부츠 & 바지
  drawBoot(ctx, -12 + pose.leftFootX * 0.3, -8 + pose.leftFootY, 11, 12);
  drawBoot(ctx, 12 + pose.rightFootX * 0.3, -8 + pose.rightFootY, 11, 12);

  // [C] 통통한 몸통 (대장장이 붉은 갈색 튜닉 + 가죽 앞치마)
  ctx.beginPath();
  ctx.roundRect(-22, -62, 44, 46, [18, 18, 14, 14]);
  const tunicGrad = ctx.createLinearGradient(0, -62, 0, -16);
  tunicGrad.addColorStop(0, '#7c3f1c');
  tunicGrad.addColorStop(1, '#4e240e');
  ctx.fillStyle = tunicGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 가죽 앞치마 (Apron)
  ctx.beginPath();
  ctx.roundRect(-16, -54, 32, 38, [8, 8, 12, 12]);
  const apronGrad = ctx.createLinearGradient(0, -54, 0, -16);
  apronGrad.addColorStop(0, '#b45309');
  apronGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = apronGrad;
  ctx.fill();
  ctx.stroke();

  // 허리 가죽 벨트 & 황금 버클
  ctx.beginPath();
  ctx.roundRect(-22, -36, 44, 8, 3);
  ctx.fillStyle = '#291811';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-6, -38, 12, 12, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.stroke();

  // [D] 왼팔 (캐릭터의 오른쪽 / 화면 좌측 팔)
  ctx.save();
  ctx.translate(-22, -52);
  ctx.rotate(pose.leftArmAngle * 0.5);
  drawArmAndHand(ctx, -4, 0);
  ctx.restore();

  // [E] 머리 & 얼굴 & 풍성한 드워프 수염 (Graveyard Keeper 스타일!)
  ctx.save();
  ctx.translate(0, -68);
  ctx.rotate(pose.headTilt);

  // 양쪽 귀
  drawEar(ctx, -25, -14);
  drawEar(ctx, 25, -14);

  // 둥글고 큼직한 얼굴 본체
  ctx.beginPath();
  ctx.roundRect(-24, -38, 48, 42, [22, 22, 18, 18]);
  const faceGrad = ctx.createLinearGradient(0, -38, 0, 4);
  faceGrad.addColorStop(0, '#ffe2bd');
  faceGrad.addColorStop(0.75, '#f6c492');
  faceGrad.addColorStop(1, '#dfa06b');
  ctx.fillStyle = faceGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 발그레한 볼터치 & 둥근 코
  ctx.beginPath();
  ctx.ellipse(-14, -10, 4.5, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(14, -10, 4.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.fill();

  // 또렷하고 생동감 있는 눈동자 + 하얀 안광
  drawEye(ctx, -10, -16, pose.blink);
  drawEye(ctx, 10, -16, pose.blink);

  // 굵직한 눈썹
  drawEyebrow(ctx, -10, -23, -0.1);
  drawEyebrow(ctx, 10, -23, 0.1);

  // 둥글고 큼직한 주먹코
  ctx.beginPath();
  ctx.ellipse(0, -11, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f2a974';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 턱과 가슴 위를 풍성하게 덮는 구름형 드워프 수염 & 콧수염!
  drawFullFrontBeard(ctx);

  // 이마 위 대장장이 가죽/철제 헤어밴드 & 머리카락
  drawHeadbandFront(ctx);

  ctx.restore();

  // [F] 오른팔 + 드워프 강철 단조 망치 (화면 우측 팔)
  ctx.save();
  ctx.translate(22, -52);
  ctx.rotate(pose.rightArmAngle);
  drawHammerInHand(ctx, 4, 8, pose.hammerGlow);
  drawArmAndHand(ctx, 4, 0);
  ctx.restore();
}

/**
 * 2. 후면 (BACK / 북쪽 바라보기)
 */
function drawBackView(ctx: CanvasRenderingContext2D, pose: BlacksmithPose): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 양발 부츠 뒷모습
  drawBoot(ctx, -12 - pose.leftFootX * 0.3, -8 + pose.leftFootY, 11, 12);
  drawBoot(ctx, 12 - pose.rightFootX * 0.3, -8 + pose.rightFootY, 11, 12);

  // 왼팔(화면 우측, 망치 쥔 팔이 뒤쪽에서 보임)
  ctx.save();
  ctx.translate(-22, -52);
  ctx.rotate(-pose.rightArmAngle);
  drawHammerInHand(ctx, -4, 8, pose.hammerGlow);
  drawArmAndHand(ctx, -4, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(22, -52);
  ctx.rotate(-pose.leftArmAngle * 0.5);
  drawArmAndHand(ctx, 4, 0);
  ctx.restore();

  // 몸통 & 등 뒤 X자 앞치마 가죽 끈
  ctx.beginPath();
  ctx.roundRect(-22, -62, 44, 46, [18, 18, 14, 14]);
  ctx.fillStyle = '#5c2d14';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 등 뒤 X자 가죽 스트랩 & 허리 벨트
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(14, -34);
  ctx.moveTo(14, -58);
  ctx.lineTo(-14, -34);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#92400e';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-22, -36, 44, 8, 3);
  ctx.fillStyle = '#291811';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 뒷머리 & 헤어밴드 매듭
  ctx.save();
  ctx.translate(0, -68);
  ctx.rotate(-pose.headTilt);

  drawEar(ctx, -25, -14);
  drawEar(ctx, 25, -14);

  // 풍성한 오렌지 브라운 뒷머리
  ctx.beginPath();
  ctx.roundRect(-25, -39, 50, 43, [23, 23, 18, 18]);
  const hairGrad = ctx.createLinearGradient(0, -39, 0, 4);
  hairGrad.addColorStop(0, '#ea580c');
  hairGrad.addColorStop(0.7, '#c2410c');
  hairGrad.addColorStop(1, '#7c2d12');
  ctx.fillStyle = hairGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 뒷머리 헤어밴드와 매듭 리본
  ctx.beginPath();
  ctx.roundRect(-25, -28, 50, 9, 4);
  ctx.fillStyle = '#44403c';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -23, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * 3 & 4. 좌측면 (LEFT) / 우측면 (RIGHT)
 * dir === 'left'면 왼쪽(-x)을 바라보고, dir === 'right'면 좌우 반전(scale(-1, 1))하여 오른쪽(+x)을 바라봅니다.
 */
function drawSideView(
  ctx: CanvasRenderingContext2D,
  pose: BlacksmithPose,
  dir: 'left' | 'right'
): void {
  ctx.save();
  if (dir === 'right') {
    ctx.scale(-1, 1);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // [A] 뒤쪽(안쪽) 다리 & 뒤쪽 팔 (먼저 그려서 몸통 뒤에 배치)
  drawSideBoot(ctx, -pose.rightFootX * 0.9, -8 + pose.rightFootY, true);

  ctx.save();
  ctx.translate(2, -50);
  ctx.rotate(-pose.leftArmAngle * 0.6);
  drawArmAndHand(ctx, -4, 2);
  ctx.restore();

  // [B] 앞쪽 다리
  drawSideBoot(ctx, pose.leftFootX * 0.9, -8 + pose.leftFootY, false);

  // [C] 옆모습 통통한 몸통 & 앞쪽으로 나온 가죽 앞치마
  ctx.beginPath();
  ctx.roundRect(-16, -62, 32, 46, [16, 16, 12, 12]);
  const tunicGrad = ctx.createLinearGradient(0, -62, 0, -16);
  tunicGrad.addColorStop(0, '#7c3f1c');
  tunicGrad.addColorStop(1, '#4e240e');
  ctx.fillStyle = tunicGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 앞쪽(-x 방향)을 감싸는 가죽 앞치마
  ctx.beginPath();
  ctx.roundRect(-18, -54, 22, 38, [10, 6, 6, 12]);
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.stroke();

  // 허리 벨트
  ctx.beginPath();
  ctx.roundRect(-18, -36, 35, 8, 3);
  ctx.fillStyle = '#291811';
  ctx.fill();
  ctx.stroke();

  // [D] 옆모습 머리 & 옆으로 볼록 솟은 수염/코/눈
  ctx.save();
  ctx.translate(0, -68);
  ctx.rotate(pose.headTilt * 0.8);

  // 얼굴 옆모습 두상
  ctx.beginPath();
  ctx.roundRect(-21, -38, 42, 42, [20, 20, 16, 16]);
  const faceGrad = ctx.createLinearGradient(0, -38, 0, 4);
  faceGrad.addColorStop(0, '#ffe2bd');
  faceGrad.addColorStop(1, '#dfa06b');
  ctx.fillStyle = faceGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 뒷머리 볼륨 (오른쪽 +x가 뒤통수)
  ctx.beginPath();
  ctx.arc(6, -19, 19, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#c2410c';
  ctx.fill();
  ctx.stroke();

  // 옆얼굴 귀
  drawEar(ctx, 4, -13);

  // 앞으로 톡 튀어나온 귀여운 코 (-x 방향이 정면)
  ctx.beginPath();
  ctx.ellipse(-22, -12, 4.5, 3.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f2a974';
  ctx.fill();
  ctx.stroke();

  // 옆모습 볼터치 & 눈동자
  ctx.beginPath();
  ctx.ellipse(-14, -9, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.fill();

  drawEye(ctx, -13, -16, pose.blink);
  drawEyebrow(ctx, -13, -23, -0.15);

  // 앞으로 풍성하게 뻗은 옆모습 드워프 수염!
  ctx.beginPath();
  ctx.moveTo(-21, -8);
  ctx.quadraticCurveTo(-30, 0, -22, 13);
  ctx.quadraticCurveTo(-10, 17, 0, 7);
  ctx.quadraticCurveTo(3, -3, -6, -8);
  ctx.closePath();
  const beardGrad = ctx.createLinearGradient(0, -8, 0, 15);
  beardGrad.addColorStop(0, '#f97316');
  beardGrad.addColorStop(1, '#9a3412');
  ctx.fillStyle = beardGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 옆모습 이마 헤어밴드
  ctx.beginPath();
  ctx.roundRect(-22, -29, 45, 9, 4);
  ctx.fillStyle = '#44403c';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-24, -30, 7, 11, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // [E] 앞쪽(바깥쪽) 팔 + 드워프 강철 단조 망치
  ctx.save();
  ctx.translate(2, -50);
  ctx.rotate(-pose.rightArmAngle);
  drawSideHammerInHand(ctx, -6, 10, pose.hammerGlow);
  drawArmAndHand(ctx, 0, 0);
  ctx.restore();

  ctx.restore();
}

function drawBoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.beginPath();
  ctx.roundRect(x - w * 0.5, y - h, w, h, [5, 5, 6, 6]);
  ctx.fillStyle = '#451a03';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawSideBoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isBackLeg: boolean
): void {
  ctx.beginPath();
  // 앞코(-x 방향)가 둥글게 나온 옆모습 부츠
  ctx.roundRect(x - 9, y - 12, 16, 12, [7, 4, 4, 5]);
  ctx.fillStyle = isBackLeg ? '#291509' : '#451a03';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawArmAndHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  // 소매
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 4, 12, 16, 6);
  ctx.fillStyle = '#7c3f1c';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 둥근 주먹 손
  ctx.beginPath();
  ctx.arc(x, y + 14, 6.2, 0, Math.PI * 2);
  ctx.fillStyle = '#f6c492';
  ctx.fill();
  ctx.stroke();
}

function drawEar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f2a974';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  blink: boolean
): void {
  if (blink) {
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y);
    ctx.lineTo(x + 4.5, y);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    return;
  }

  // 또렷하고 둥근 눈동자
  ctx.beginPath();
  ctx.ellipse(x, y, 3.8, 4.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1c120e';
  ctx.fill();

  // 반짝이는 안광 하이라이트
  ctx.beginPath();
  ctx.arc(x - 1.2, y - 1.6, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-5.5, -2.2, 11, 4.4, 2.2);
  ctx.fillStyle = '#9a3412';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}

function drawFullFrontBeard(ctx: CanvasRenderingContext2D): void {
  // 풍성한 구름 모양 턱수염
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.quadraticCurveTo(-26, 6, -15, 13);
  ctx.quadraticCurveTo(0, 20, 15, 13);
  ctx.quadraticCurveTo(26, 6, 22, -6);
  ctx.quadraticCurveTo(12, -2, 0, -2);
  ctx.quadraticCurveTo(-12, -2, -22, -6);
  ctx.closePath();

  const beardGrad = ctx.createLinearGradient(0, -6, 0, 18);
  beardGrad.addColorStop(0, '#f97316');
  beardGrad.addColorStop(0.65, '#ea580c');
  beardGrad.addColorStop(1, '#9a3412');
  ctx.fillStyle = beardGrad;
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 양옆으로 멋지게 뻗은 콧수염
  ctx.beginPath();
  ctx.ellipse(-8, -6, 9, 4.2, -0.2, 0, Math.PI * 2);
  ctx.ellipse(8, -6, 9, 4.2, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fb923c';
  ctx.fill();
  ctx.stroke();
}

function drawHeadbandFront(ctx: CanvasRenderingContext2D): void {
  // 윗머리 볼륨
  ctx.beginPath();
  ctx.arc(0, -26, 23, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fillStyle = '#ea580c';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 이마 철제/가죽 대장장이 밴드
  ctx.beginPath();
  ctx.roundRect(-25, -30, 50, 9, 4);
  ctx.fillStyle = '#44403c';
  ctx.fill();
  ctx.stroke();

  // 이마 중앙 황금 모루 징 장식
  ctx.beginPath();
  ctx.roundRect(-6, -31, 12, 11, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.stroke();
}

function drawHammerInHand(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  glow: number
): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(0.25);

  // 망치 나무 자루
  ctx.beginPath();
  ctx.roundRect(-3, -34, 6, 40, 3);
  ctx.fillStyle = '#92400e';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 망치 강철 헤드
  ctx.beginPath();
  ctx.roundRect(-14, -44, 28, 15, 4);
  const headGrad = ctx.createLinearGradient(0, -44, 0, -29);
  headGrad.addColorStop(0, '#cbd5e1');
  headGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.stroke();

  // 타격 순간 불꽃 임팩트
  if (glow > 0.1) {
    ctx.beginPath();
    ctx.arc(0, -36, 18 * glow, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${glow * 0.55})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawSideHammerInHand(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  glow: number
): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.55);

  // 망치 자루
  ctx.beginPath();
  ctx.roundRect(-3, -34, 6, 40, 3);
  ctx.fillStyle = '#92400e';
  ctx.fill();
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 옆으로 향한 망치 헤드
  ctx.beginPath();
  ctx.roundRect(-15, -44, 30, 15, 4);
  const headGrad = ctx.createLinearGradient(0, -44, 0, -29);
  headGrad.addColorStop(0, '#cbd5e1');
  headGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.stroke();

  if (glow > 0.1) {
    ctx.beginPath();
    ctx.arc(-12, -36, 18 * glow, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${glow * 0.6})`;
    ctx.fill();
  }

  ctx.restore();
}
