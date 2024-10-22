import {translateToBytecode} from './InstructionSet.ts'
import {describe, expect, test, beforeEach} from 'vitest'
import {toFloat32} from './TypeCasting.ts'
import {Gsx} from './Gsx.ts'

const gsx = new Gsx()

beforeEach(() => {
  gsx.reset()
})


describe('exit', () => {
  test('Outside any function', () => {
    const [bytecode] = translateToBytecode('exit')
    gsx.runProgram(bytecode)

    expect(gsx.registers.programCounter).toBe(4294967295)
  })

  test('Within a function', () => {
    gsx.jumpStack[0] = 100
    gsx.jumpStack[1] = 24
    gsx.registers.jumpStackPointer = 2

    const [bytecode] = translateToBytecode('exit')
    gsx.runProgram(bytecode)

    expect(gsx.registers.programCounter).toBe(24)
  })
})


describe('Memory access', () => {
  describe('float', () => {
    test('new t = ram[t] float', () => {
      gsx.ram.setFloat32(2, -8.58)
      gsx.registers.t = 2

      const [bytecode] = translateToBytecode('new t = ram[t] float')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([-8.58, 0, 0].map(toFloat32))
    })

    test('new t = ram[r] float', () => {
      gsx.ram.setFloat32(4, 123456.78)
      gsx.registers.r = 4

      const [bytecode] = translateToBytecode('new t = ram[r] float')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([123456.78, 4, 0].map(toFloat32))
    })

    test('new t = ram[y] float', () => {
      gsx.ram.setFloat32(13, -0.005)
      gsx.registers.y = 13

      const [bytecode] = translateToBytecode('new t = ram[y] float')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([-0.005, 0, 13].map(toFloat32))
    })


    test('new y = ram[r] float', () => {
      gsx.ram.setFloat32(13, -3.003)
      gsx.registers.r = 13

      const [bytecode] = translateToBytecode('new y = ram[r] float')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([0, 13, -3.003].map(toFloat32))
    })
  })

  describe('byte', () => {
    test('new t = ram[t] byte', () => {
      gsx.ram.setInt8(2, -8)
      gsx.registers.t = 2

      const [bytecode] = translateToBytecode('new t = ram[t] byte')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([-8, 0, 0])
    })

    test('new t = ram[r] byte', () => {
      gsx.ram.setInt8(4, 120)
      gsx.registers.r = 4

      const [bytecode] = translateToBytecode('new t = ram[r] byte')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([120, 4, 0])
    })

    test('new t = ram[y] byte', () => {
      gsx.ram.setInt8(13, -100)
      gsx.registers.y = 13

      const [bytecode] = translateToBytecode('new t = ram[y] byte')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([-100, 0, 13])
    })

    test('new r = ram[t] byte', () => {
      gsx.ram.setInt8(13, -101)
      gsx.registers.t = 13

      const [bytecode] = translateToBytecode('new r = ram[t] byte')
      gsx.runProgram(bytecode)

      const {t, r, y} = gsx.registers
      expect([t, r, y]).toStrictEqual([13, -101, 0])
    })
  })
})

describe('Math', () => {
  test.each([
    // Assign zero to register
    ['new t = 0', [8, 5, 3], [0, 5, 3]],
    ['new r = 0', [8, 5, 3], [8, 0, 3]],
    ['new y = 0', [8, 5, 3], [8, 5, 0]],


    // Addition
    ['new t = r + y', [0, 5, 3], [8, 5, 3]],
    ['new t = y + r', [-5, 4.5, 3], [7.5, 4.5, 3]],

    ['new t = t + t', [7.2, 1, 5], [14.4, 1, 5]],
    ['new t = 2 * t', [6.1, 1.2, 5], [12.2, 1.2, 5]],
    ['new t = t * 2', [-5, 1, -9.5], [-10, 1, -9.5]],

    ['new t = t + r', [7, 5, 0], [12, 5, 0]],
    ['new t = r + t', [7, -3.1, 5], [3.9, -3.1, 5]],

    ['new t = t + y', [7, 0, 6], [13, 0, 6]],
    ['new t = y + t', [-0.25, 0.9, 6], [5.75, 0.9, 6]],

    ['new r = t + y', [-10, 0, 3], [-10, -7, 3]],
    ['new r = y + t', [0.7, 4, 0.3], [0.7, 1, 0.3]],


    // Multiplication
    ['new t = r * y', [9.1, 5, 3], [15, 5, 3]],
    ['new t = y * r', [-5, 0, 3], [0, 0, 3]],

    ['new t = t * t', [7.5, 1, 5], [56.25, 1, 5]],
    ['new t = t ^ 2', [-7.5, 21, 0], [56.25, 21, 0]],

    ['new t = t * r', [7, 5, 1], [35, 5, 1]],
    ['new t = r * t', [0.1, -100, 5], [-10, -100, 5]],

    ['new t = t * y', [7, 0, 6], [42, 0, 6]],
    ['new t = y * t', [-0.25, 0.9, 6], [-1.5, 0.9, 6]],

    ['new r = t * y', [-10, 0, 3], [-10, -30, 3]],
    ['new r = y * t', [0.5, 4, 0.3], [0.5, 0.15, 0.3]],

    // Subtraction
    ['new t = r - y', [9.1, 5, 3], [2, 5, 3]],
    ['new t = y - r', [-5, 0, 3], [3, 0, 3]],

    ['new t = t - r', [7.5, 1, 5], [6.5, 1, 5]],
    ['new t = r - t', [-7.5, 21, 0], [28.5, 21, 0]],

    ['new t = t - y', [7, 5, 1], [6, 5, 1]],
    ['new t = y - t', [0.1, -100, 5], [4.9, -100, 5]],

    ['new r = t - y', [7, 5, 1], [7, 6, 1]],
    ['new r = y - t', [0.1, -100, 5], [0.1, 4.9, 5]],


    // Division
    ['new t = r / y', [9.1, 5, 2], [2.5, 5, 2]],
    ['new t = y / r', [-5, 0.5, 3], [6, 0.5, 3]],

    ['new t = t / r', [7.5, 3, 5], [2.5, 3, 5]],
    ['new t = r / t', [-7.5, 21, 0], [-2.8, 21, 0]],

    ['new t = t / y', [7, 5, 1], [7, 5, 1]],
    ['new t = y / t', [0.1, -100, 5], [50, -100, 5]],

    ['new r = t / y', [7, 5, 1], [7, 7, 1]],
    ['new r = y / t', [0.1, -100, 5], [0.1, 50, 5]],
  ])('%s', (instruction, before, after) => {
    gsx.registers.t = before[0]
    gsx.registers.r = before[1]
    gsx.registers.y = before[2]

    const [bytecode] = translateToBytecode(instruction)
    gsx.runProgram(bytecode)

    const {t, r, y} = gsx.registers
    expect([t, r, y]).toStrictEqual(after.map(toFloat32))
  })
})
