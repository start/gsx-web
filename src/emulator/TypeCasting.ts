import {UINT8_MAX, UINT32_MAX} from './DataTypeConstants.ts'


export function toUint8(value: number): number {
  return integerSaturate(value, 0, UINT8_MAX)
}

export function toUint32(value: number): number {
  return integerSaturate(value, 0, UINT32_MAX)
}

export function toFloat32(value: number): number {
  return Math.fround(value)
}

function integerSaturate(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return Math.trunc(value)
}
