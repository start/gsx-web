import {Gsx} from './Gsx.ts'
import {GeneralPurposeRegisterName} from './Registers.ts'
import {UINT32_MAX} from './DataTypeConstants.ts'
import {getFloatBytes} from '../helpers/getFloatBytes.ts'


export function runInstruction(instructionBytecode: number, gsx: Gsx, programBytecode: DataView): void {
  instructionByBytecode[instructionBytecode](gsx, programBytecode)
}

export function translateToBytecode(program: string): [DataView, string[]] {
  const syntaxErrors: string[] = []
  const programBytes: number[] = []

  const lines = program.split('\n')

  for (const [lineIndex, line] of lines.entries()) {
    const normalizedMnemonic = normalizeMnemonic(line)

    if (!normalizedMnemonic.length) {
      continue
    }

    const bytecode = bytecodeByMnemonic[normalizedMnemonic]
    const isMnemonicRecognized = (bytecode !== undefined)

    if (isMnemonicRecognized) {
      if (syntaxErrors.length === 0) {
        // We only produce bytecode for programs without any syntax errors.
        programBytes.push(bytecode)
      }

      continue
    }

    // TODO: Explain

    const bytecodeForAssigningConstantToRegister =
      tryToGetBytecodeForAssigningConstantToRegister(normalizedMnemonic)

    if (bytecodeForAssigningConstantToRegister === null) {
      syntaxErrors.push(`Unknown instruction (${line}) on line ${(lineIndex + 1).toLocaleString()}.`)
      continue
    }

    programBytes.push(...bytecodeForAssigningConstantToRegister)
  }

  const bytecode = new DataView(new Uint8Array(
    syntaxErrors.length ? [] : programBytes
  ).buffer)

  return [bytecode, syntaxErrors]
}


function tryToGetBytecodeForAssigningConstantToRegister(normalizedMnemonic: string): number[] | null {
  const PATTERN_FOR_ASSIGNING_CONSTANT_TO_REGISTER =
    /^new([try])=(-?\d+(?:\.\d+)?)$/

  const captures =
    normalizedMnemonic.match(PATTERN_FOR_ASSIGNING_CONSTANT_TO_REGISTER)

  if (!captures) {
    return null
  }

  const [, register, constantAsString] = captures
  const constant = parseFloat(constantAsString)

  const isConstantAByte =
    (constant >= -128) && (constant <= 127) &&
    constant === parseInt(constantAsString, 10)

  if (isConstantAByte) {
    switch (register as GeneralPurposeRegisterName) {
      case 't':
        return [0, constant]
      case 'r':
        return [1, constant]
      case 'y':
        return [2, constant]
    }
  } else {
    switch (register as GeneralPurposeRegisterName) {
      case 't':
        return [3, ...getFloatBytes(constant)]
      case 'r':
        return [4, ...getFloatBytes(constant)]
      case 'y':
        return [5, ...getFloatBytes(constant)]
    }
  }
}


const generalPurposeRegisters = ['t', 'r', 'y'] as const

function otherTwo(register: GeneralPurposeRegisterName) {
  switch (register) {
    case 't':
      return ['r', 'y'] as const
    case 'r':
      return ['t', 'y'] as const
    case 'y':
      return ['t', 'r'] as const
  }
}


type Instruction = (gsx: Gsx, programBytecode: DataView) => void;

/*
  By the end of this file, the `instructionByBytecode` array will
  contain all 256 executable instructions from our assembly language.
  These instructions will be indexed by their corresponding bytecode,
  from 0 to 255.

  We'll start by defining instructions for loading constant values
  into our three general purpose registers. There are six such
  instructions in total.

  Three assign byte constants to registers T, R, and Y:

    new t = 12          # Bytecode: [0]
    new r = -3          # Bytecode: [1]
    new y = 60          # Bytecode: [2]

  And three assign float constants to registers T, R, and Y:

    new t = 0.12        # Bytecode: [3]
    new r = -3.1415927  # Bytecode: [4]
    new y = 60000       # Bytecode: [5]

  The assigned constant value is embedded in the program bytecode
  immediately following the instruction bytecode.

  For byte assignment, the constant value is that single byte:

    new t = 12          # Full bytecode: [0] [12]
    new r = -3          # Full bytecode: [1] [-3]
    new y = 60          # Full bytecode: [2] [60]

  For float assignment, the constant value is the four bytes
  comprising the float:

    new t = 0.12        # Full bytecode: [3] [ 61, -11, -62, -113]
    new r = -3.1415927  # Full bytecode: [4] [-64,  73,  15,  -37]
    new y = 60000       # Full bytecode: [5] [ 71, 106,  96,    0]

  Thus, assigning a byte constant takes a total of two bytes of
  bytecode; assigning a float constant takes a total of five.

  (In contrast, all other 250 instructions require just a single
  byte of bytecode each.)
 */

const instructionByBytecode: Instruction[] = [
  // Read the next byte of program bytecode, then set a register equal
  // to that byte.
  ...generalPurposeRegisters.map(register =>
    (gsx: Gsx, programBytecode: DataView) => {
      gsx.registers.set(
        register,
        programBytecode.getInt8(gsx.registers.programCounter))

      gsx.registers.programCounter += 1
    }),

  // Read the next four bytes of program bytecode as a float, then set
  // a register equal to that float.
  ...generalPurposeRegisters.map(register =>
    (gsx: Gsx, programBytecode: DataView) => {
      gsx.registers.set(
        register,
        programBytecode.getFloat32(gsx.registers.programCounter))

      // Each float is four bytes wide, so we need to advance our
      // program counter by a total of four to allow the next
      // instruction to be read from the correct spot in the program
      // bytecode.
      //
      // (We already advanced the program counter by one; here, we
      // advanced it by another three.)
      gsx.registers.programCounter += 4
    })
]

// TODO: Summarize rest of instructions

/*
    new t = t * r
    new ram[y] float = t
    exit
 */


// The key is the mnemonic; the value is the bytecode.
const bytecodeByMnemonic: Record<string, number | undefined> = {}

function define(mnemonic: string, instruction: Instruction) {
  const normalizedMnemonic = normalizeMnemonic(mnemonic)
  const nextBytecode = instructionByBytecode.length

  bytecodeByMnemonic[normalizedMnemonic] = nextBytecode
  instructionByBytecode.push(instruction)
}

// Exit a function, or exit the program if invoked outside a function.
define('exit',
  (gsx: Gsx) => {
    if (gsx.registers.jumpStackPointer === 0) {
      // If we made it here, we're invoking `exit` outside a function.
      // We need to end the program!
      gsx.registers.programCounter = PROGRAM_COUNTER_EXIT
    } else {
      gsx.registers.jumpStackPointer -= 1
      gsx.registers.programCounter = gsx.jumpStack[gsx.registers.jumpStackPointer]
    }
  })

// Call a function whose address is stored in a register.
for (const register of generalPurposeRegisters) {
  define(`run ${register}`,
    (gsx: Gsx) => {
      // When the function exits, we need to return to the instruction
      // after the call.
      gsx.jumpStack[gsx.registers.jumpStackPointer] = 1 + gsx.registers.programCounter
      gsx.registers.jumpStackPointer += 1

      // Let's jump to the function!
      gsx.registers.programCounter = gsx.registers.get(register)
    })
}

// Push a register’s value onto the argument stack.
for (const register of generalPurposeRegisters) {
  define(`push ${register}`,
    (gsx: Gsx) => {
      gsx.argumentStack[gsx.registers.argumentStackPointer] = gsx.registers.get(register)
      gsx.registers.argumentStackPointer += 1
    })
}

// Pop a value from the argument stack into a register.
for (const register of generalPurposeRegisters) {
  define(assign({to: register, from: 'pop'}),
    (gsx: Gsx) => {
      gsx.registers.argumentStackPointer -= 1
      gsx.registers.set(
        register,
        gsx.argumentStack[gsx.registers.argumentStackPointer])
    })
}

// Set a register equal to zero.
for (const register of generalPurposeRegisters) {
  define(assign({to: register, from: '0'}),
    (gsx: Gsx) => {
      gsx.registers.set(register, 0)
    })
}


/*
  Memory Access
*/

// Use a memory address from a register to read a byte from RAM. Then, set a register equal to that byte.
for (const addressRegister of generalPurposeRegisters) {
  for (const valueRegister of generalPurposeRegisters) {
    define(assign({to: valueRegister, from: `ram[${addressRegister}] byte`}),
      (gsx: Gsx) => {
        console.log({valueRegister, addressRegister})
        const address = gsx.registers.get(addressRegister)
        const byteFromRam = gsx.ram.getInt8(address)
        gsx.registers.set(valueRegister, byteFromRam)
      })
  }
}

// Use a memory address from a register to read a float from RAM. Then, set a register equal to that float.
for (const addressRegister of generalPurposeRegisters) {
  for (const valueRegister of generalPurposeRegisters) {
    define(assign({to: valueRegister, from: `ram[${addressRegister}] float`}),
      (gsx: Gsx) => {
        const address = gsx.registers.get(addressRegister)
        const floatFromRam = gsx.ram.getFloat32(address)
        gsx.registers.set(valueRegister, floatFromRam)
      })
  }
}

// Write a byte to RAM using a memory address from one register and a byte from another register.
for (const addressRegister of generalPurposeRegisters) {
  for (const valueRegister of otherTwo(addressRegister)) {
    define(assign({to: `ram[${addressRegister}] byte`, from: valueRegister}),
      (gsx: Gsx) => {
        const byte = gsx.registers.get(valueRegister)
        const address = gsx.registers.get(addressRegister)
        gsx.ram.setInt8(address, byte)
      })
  }
}

// Write a float to RAM using a memory address from one register and a float from another register.
for (const addressRegister of generalPurposeRegisters) {
  for (const valueRegister of otherTwo(addressRegister)) {
    define(assign({to: `ram[${addressRegister}] float`, from: valueRegister}),
      (gsx: Gsx) => {
        const float = gsx.registers.get(valueRegister)
        const address = gsx.registers.get(addressRegister)
        gsx.ram.setFloat32(address, float)
      })
  }
}


/*
 Addition
*/

// Set a register equal to the sum of the other two registers.
for (const register of generalPurposeRegisters) {
  const [other1, other2] = otherTwo(register)

  for (const mnemonic of [
    assign({to: register, from: `${other1} + ${other2}`}),
    assign({to: register, from: `${other2} + ${other1}`})
  ]) {
    define(mnemonic, (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) + gsx.registers.get(other2))
    })
  }
}

// Set a register equal to double its own value.
for (const register of generalPurposeRegisters) {
  for (const mnemonic of [
    assign({to: register, from: `${register} + ${register}`}),
    assign({to: register, from: `2 * ${register}`}),
    assign({to: register, from: `${register} * 2`})
  ]) {
    define(mnemonic, (gsx: Gsx) => {
      const oldValue = gsx.registers.get(register)
      gsx.registers.set(register, oldValue + oldValue)
    })
  }
}

// Set a register equal to itself plus another register.
for (const register of generalPurposeRegisters) {
  for (const otherRegister of otherTwo(register)) {
    for (const mnemonic of [
      assign({to: register, from: `${register} + ${otherRegister}`}),
      assign({to: register, from: `${otherRegister} + ${register}`})
    ]) {
      define(mnemonic, (gsx: Gsx) => {
        gsx.registers.set(
          register,
          gsx.registers.get(register) + gsx.registers.get(otherRegister))
      })
    }
  }
}


/*
 Multiplication
*/

// Set a register equal to the product of the other two registers.
for (const register of generalPurposeRegisters) {
  const [other1, other2] = otherTwo(register)

  for (const mnemonic of [
    assign({to: register, from: `${other1} * ${other2}`}),
    assign({to: register, from: `${other2} * ${other1}`})
  ]) {
    define(mnemonic, (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) * gsx.registers.get(other2))
    })
  }
}

// Set a register equal to the square of its own value.
for (const register of generalPurposeRegisters) {
  for (const mnemonic of [
    assign({to: register, from: `${register} * ${register}`}),
    assign({to: register, from: `${register}^2`})
  ]) {
    define(mnemonic, (gsx: Gsx) => {
      const oldValue = gsx.registers.get(register)
      gsx.registers.set(register, oldValue * oldValue)
    })
  }
}

// Set a register equal to itself times another register.
for (const register of generalPurposeRegisters) {
  for (const otherRegister of otherTwo(register)) {
    for (const mnemonic of [
      assign({to: register, from: `${register} * ${otherRegister}`}),
      assign({to: register, from: `${otherRegister} * ${register}`})
    ]) {
      define(mnemonic, (gsx: Gsx) => {
        gsx.registers.set(
          register,
          gsx.registers.get(register) * gsx.registers.get(otherRegister))
      })
    }
  }


  /*
    Subtraction
  */

  // Set a register equal to the difference of the other two registers.
  for (const register of generalPurposeRegisters) {
    const [other1, other2] = otherTwo(register)

    define(assign({to: register, from: `${other1} - ${other2}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) - gsx.registers.get(other2))
    })

    define(assign({to: register, from: `${other2} - ${other1}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other2) - gsx.registers.get(other1))
    })
  }

  // Set a register equal to the difference of itself and another register.
  for (const register of generalPurposeRegisters) {
    const [other1, other2] = otherTwo(register)

    define(assign({to: register, from: `${register} - ${other1}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) - gsx.registers.get(other1))
    })

    define(assign({to: register, from: `${register} - ${other2}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) - gsx.registers.get(other2))
    })

    define(assign({to: register, from: `${other1} - ${register}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) - gsx.registers.get(register))
    })

    define(assign({to: register, from: `${other2} - ${register}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other2) - gsx.registers.get(register))
    })
  }
}


function assign(args: { to: string, from: string }): string {
  return `new ${args.to} = ${args.from}`
}

function normalizeMnemonic(text: string): string {
  return text
    // This removes all whitespace and comments
    .replace(/\s+|#.*/g, '')
    .toLowerCase()
}


// If the program counter ever becomes greater than the program's
// size in bytes, GSX knows the program is finished, and it stops
// execution.
//
// To specifically indicate our program should exit, we set the
// program counter to `DataTypeConstants, which is dramatically larger
// than the maximum allowed program size. (Plus, it's the largest
// value we can store in the 32-bit program counter register.)
const PROGRAM_COUNTER_EXIT = UINT32_MAX
