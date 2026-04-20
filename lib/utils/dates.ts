import dayjs from 'dayjs'

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function yesterday(): string {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
}

export function pastNDays(n: number): string[] {
  const result: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    result.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }
  return result
}

const DOW_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function formatDow(date: string): string {
  return DOW_CN[dayjs(date).day()]
}
