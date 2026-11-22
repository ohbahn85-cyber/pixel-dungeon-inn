const UNITS = ['', '만', '억', '조', '경'];

/**
 * 골드 및 일반 큰 숫자를 한국어 단위(만, 억, 조, 경)로 읽기 쉽게 포맷팅합니다.
 * 예: 950 -> "950", 12450 -> "1.25만", 150000000 -> "1.5억"
 */
export function formatKoreanNumber(value: number, allowDecimalUnderTen = false): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0';
  }

  if (value < 10) {
    if (allowDecimalUnderTen && value > 0 && !Number.isInteger(value)) {
      return value.toFixed(1).replace(/\.0$/, '');
    }
    return Math.floor(value).toString();
  }

  if (value < 10000) {
    if (allowDecimalUnderTen && value < 100 && !Number.isInteger(value)) {
      return value.toFixed(1).replace(/\.0$/, '');
    }
    return Math.floor(value).toLocaleString('ko-KR');
  }

  let unitIndex = 0;
  let scaled = value;

  while (scaled >= 10000 && unitIndex < UNITS.length - 1) {
    scaled /= 10000;
    unitIndex++;
  }

  let formatted: string;
  if (scaled >= 1000) {
    formatted = scaled.toFixed(0);
  } else if (scaled >= 100) {
    formatted = scaled.toFixed(1).replace(/\.0$/, '');
  } else {
    formatted = scaled.toFixed(2).replace(/\.?0+$/, '');
  }

  return `${formatted}${UNITS[unitIndex]}`;
}

/**
 * 골드 표시용 (정수 기준, 1만 이상은 만/억/조 단위)
 */
export function formatGold(value: number): string {
  return formatKoreanNumber(Math.floor(value), false);
}

/**
 * 초당 골드(GPS) 표시용 (소수점 1자리 허용)
 */
export function formatRate(value: number): string {
  return formatKoreanNumber(value, true);
}

/**
 * 초 단위 시간을 "X시간 Y분 Z초" 형식으로 변환합니다.
 */
export function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}초`);

  return parts.join(' ');
}
