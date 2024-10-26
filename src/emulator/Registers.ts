import {toFloat32, toUint8, toUint32} from './TypeCasting.ts'


export type GeneralPurposeRegisterName = 't' | 'r' | 'y'
export type RegisterName = GeneralPurposeRegisterName | 'pc' | 'as' | 'js'

export class Registers {
  // 32-bit unsigned integer
  private _programCounter = 0

  get programCounter(): number {
    return this._programCounter
  }

  set programCounter(value: number) {
    this._programCounter = toUint32(value)
  }

  // 8-bit unsigned integer
  private _argumentStackPointer = 0

  get argumentStackPointer(): number {
    return this._argumentStackPointer
  }

  set argumentStackPointer(value: number) {
    this._argumentStackPointer = toUint8(value)
  }

  // 8-bit unsigned integer
  private _jumpStackPointer = 0

  get jumpStackPointer(): number {
    return this._jumpStackPointer
  }

  set jumpStackPointer(value: number) {
    this._jumpStackPointer = toUint8(value)
  }

  // 32-bit float
  private _t = 0

  get t(): number {
    return this._t
  }

  set t(value: number) {
    this._t = toFloat32(value)
  }

  // 32-bit float
  private _r = 0

  get r(): number {
    return this._r
  }

  set r(value: number) {
    this._r = toFloat32(value)
  }

  // 32-bit float
  private _y = 0

  get y(): number {
    return this._y
  }

  set y(value: number) {
    this._y = toFloat32(value)
  }

  get(which: RegisterName): number {
    switch (which) {
      case 'pc':
        return this.programCounter
      case 'as':
        return this.argumentStackPointer
      case 'js':
        return this.jumpStackPointer
      case 't':
        return this.t
      case 'r':
        return this.r
      case 'y':
        return this.y
    }
  }

  set(which: RegisterName, value: number): void {
    switch (which) {
      case 'pc':
        this.programCounter = value
        return
      case 'as':
        this.argumentStackPointer = value
        return
      case 'js':
        this.jumpStackPointer = value
        return
      case 't':
        this.t = value
        return
      case 'r':
        this.r = value
        return
      case 'y':
        this.y = value
        return
    }
  }

  reset(): void {
    this.programCounter = 0
    this.argumentStackPointer = 0
    this.jumpStackPointer = 0
    this.t = 0
    this.r = 0
    this.y = 0
  }
}

