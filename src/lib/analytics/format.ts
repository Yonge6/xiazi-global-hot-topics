export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "待统计";
  if (seconds < 60) return `${Math.round(seconds)}秒`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}小时${remainingMinutes}分` : `${hours}小时`;
}
