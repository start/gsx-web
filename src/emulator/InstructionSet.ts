import {Gsx} from './Gsx.ts'
import {GeneralPurposeRegisterName} from './Registers.ts'
import {INT8_MAX, INT8_MIN, UINT32_MAX} from './DataTypeConstants.ts'
import {getFloatBytes} from '../helpers/getFloatBytes.ts'

/*
  This dictionary's key is the mnemonic; the value is the bytecode.

  Here, the word "keyable" simply means these mnemonics can be used
  as keys in a dictionary. In other words, we can take the mnemonic
  as the user typed it, normalize its spacing and capitalization,
  then plug it into this simple dictionary to find its corresponding
  bytecode.

  No real parsing is necessary!

  Of our 256 mnemonics, 250 are keyable. Keyable mnemonics include
  the following:

    exit
    push t
    new t = r - y
    call y

  In contrast, the six non-keyable mnemonics are described in a
  large comment later in this file. All six involve assigning an
  arbitrary numeric constant to a register, and all six produce
  more than a single byte of bytecode.
*/
const bytecodeByKeyableMnemonic: Record<string, number | undefined> = {}


/**
 * Run a single bytecode instruction.
 *
 * @param instructionBytecode - The bytecode of the instruction to run.
 * @param gsx - The state of the registers and RAM.
 * @param programBytecode - The bytecode of the entire program.
 */
export function runInstruction(
  instructionBytecode: number,
  gsx: Gsx,
  programBytecode: DataView
): void {
  instructionByBytecode[instructionBytecode](gsx, programBytecode)
}


/**
 * Translates an assembly program into bytecode.
 *
 * @param {string} program - The assembly program as a multi-line string.
 * @returns {[DataView, string[]]} - A DataView containing the bytecode of the
 * program, and an array of syntax errors encountered during translation. If
 * there are any syntax errors, the bytecode DataView will be empty.
 */
export function translateToBytecode(program: string): [DataView, string[]] {
  const programLines = program.split('\n')
  const syntaxErrors: string[] = []

  // Because some instructions produce more than a single byte of
  // bytecode, we don't know ahead of time how many bytes we'll
  // need.
  //
  // That's why we use a regular "growable" array rather than a
  // `Uint8Array`.
  //
  // (Once we're done, we convert this array into a `Uint8Array`
  // and wrap it in a `DataView`.)
  const programBytes: number[] = []


  // (We need the index to report line numbers for any syntax
  // errors.)
  for (const [lineIndex, line] of programLines.entries()) {
    const normalizedMnemonic = normalizeMnemonic(line)

    // Skip blank lines.
    if (!normalizedMnemonic.length) {
      continue
    }

    const possibleBytecode = bytecodeByKeyableMnemonic[normalizedMnemonic]
    const wasMnemonicRecognized = (possibleBytecode !== undefined)

    if (wasMnemonicRecognized) {
      // We only produce bytecode for programs without any syntax
      // errors.
      if (syntaxErrors.length === 0) {
        programBytes.push(possibleBytecode)
      }

      // Either way, we're finished with this line!
      continue
    }

    const bytecodeForConstantAssignment =
      tryToGetBytecodeForConstantAssignment(normalizedMnemonic)

    if (bytecodeForConstantAssignment === null) {
      syntaxErrors.push(`Unknown instruction (${line}) on line ${(lineIndex + 1).toLocaleString()}.`)
      continue
    }

    programBytes.push(...bytecodeForConstantAssignment)
  }

  const bytecode = new DataView(new Uint8Array(
    syntaxErrors.length ? [] : programBytes
  ).buffer)

  return [bytecode, syntaxErrors]
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
const instructionByBytecode: Instruction[] = []
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

// Read the next byte of program bytecode, then set a register equal
// to that byte.
//
// (We discussed these three instructions just above.)
for (const register of generalPurposeRegisters) {
  instructionByBytecode.push(
    (gsx: Gsx, programBytecode: DataView) => {
      gsx.registers.set(
        register,
        programBytecode.getInt8(gsx.registers.programCounter))

      // Advance the program counter past the byte we just read.
      gsx.registers.programCounter += 1
    })
}

// Read the next four bytes of program bytecode as a float, then set
// a register equal to that float.
//
// (We discussed these three instructions just above, too.)
for (const register of generalPurposeRegisters) {
  instructionByBytecode.push(
    (gsx: Gsx, programBytecode: DataView) => {
      gsx.registers.set(
        register,
        programBytecode.getFloat32(gsx.registers.programCounter))

      // Advance the program counter past the float we just read.
      gsx.registers.programCounter += 4
    })
}

function tryToGetBytecodeForConstantAssignment(normalizedMnemonic: string): number[] | null {
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
    (constant >= INT8_MIN) && (constant <= INT8_MAX) &&
    constant === parseInt(constantAsString, 10)

  if (isConstantAByte) {
    // If the constant is a byte, this instruction takes two bytes:
    // - One byte for the instruction itself
    // - One byte for the constant
    switch (register as GeneralPurposeRegisterName) {
      case 't':
        return [BytecodeForConstantAssignment.ByteToRegisterT, constant]
      case 'r':
        return [BytecodeForConstantAssignment.ByteToRegisterR, constant]
      case 'y':
        return [BytecodeForConstantAssignment.ByteToRegisterY, constant]
    }
  } else {
    // If the constant is a float, this instruction takes five bytes:
    // - One byte for the instruction itself
    // - Four bytes for the constant
    switch (register as GeneralPurposeRegisterName) {
      case 't':
        return [BytecodeForConstantAssignment.FloatToRegisterT, ...getFloatBytes(constant)]
      case 'r':
        return [BytecodeForConstantAssignment.FloatToRegisterR, ...getFloatBytes(constant)]
      case 'y':
        return [BytecodeForConstantAssignment.FloatToRegisterY, ...getFloatBytes(constant)]
    }
  }
}


// The rest of our instructions have "keyable" mnemonics, and they
// all produce just a single byte of bytecode.

/**
 * Define a new assembly instruction with corresponding mnemonics.
 *
 * @param mnemonicOrMnemonics - The mnemonic (or mnemonics) representing the assembly instruction.
 * @param instruction - The function implementing the instruction.
 */
function define(mnemonicOrMnemonics: string | string[], instruction: Instruction) {
  const mnemonics = Array.isArray(mnemonicOrMnemonics)
    ? mnemonicOrMnemonics
    : [mnemonicOrMnemonics]

  const normalizedMnemonics = mnemonics.map(normalizeMnemonic)

  // If `instructionByBytecode` has a length of 6 when this function
  // is called, then we've already defined bytecodes 0–5. Thus, the
  // next bytecode is 6.
  const bytecode = instructionByBytecode.length

  for (const mnemonic of normalizedMnemonics) {
    // Associate each mnemonic with the instruction's bytecode.
    bytecodeByKeyableMnemonic[mnemonic] = bytecode
  }

  // Finally, associate the bytecode with the instruction itself.
  // (Remember
  instructionByBytecode.push(instruction)
}

// Exit a function, or exit the program if invoked outside a function.
define('exit',
  (gsx: Gsx) => {
    if (gsx.registers.jumpStackPointer === 0) {
      // If we made it here, we're invoking `exit` outside a function.
      // We need to end the program! But how?
      //
      // Well, if the program counter ever becomes greater than the
      // program's size in bytes, GSX knows the program is finished,
      // and it stops execution.
      //
      // Thus, to indicate our program should exit, we set the program
      // counter to `UINT32_MAX`, which is dramatically larger than the
      // maximum allowed program size. (Plus, it's the largest value we
      // can store in the 32-bit program counter register.)
      gsx.registers.programCounter = UINT32_MAX
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


/*
  Memory Access
*/

// Use a memory address from a register to read a byte from RAM. Then, set a register equal to that byte.
for (const addressRegister of generalPurposeRegisters) {
  for (const valueRegister of generalPurposeRegisters) {
    define(assign({to: valueRegister, from: `ram[${addressRegister}] byte`}),
      (gsx: Gsx) => {
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

  define([
    assign({to: register, from: `${other1} + ${other2}`}),
    assign({to: register, from: `${other2} + ${other1}`})
  ], (gsx: Gsx) => {
    gsx.registers.set(
      register,
      gsx.registers.get(other1) + gsx.registers.get(other2))
  })
}

// Set a register equal to double its own value.
for (const register of generalPurposeRegisters) {
  define([
    assign({to: register, from: `${register} + ${register}`}),
    assign({to: register, from: `2 * ${register}`}),
    assign({to: register, from: `${register} * 2`})
  ], (gsx: Gsx) => {
    const oldValue = gsx.registers.get(register)
    gsx.registers.set(register, oldValue + oldValue)
  })
}

// Set a register equal to itself plus another register.
for (const register of generalPurposeRegisters) {
  for (const otherRegister of otherTwo(register)) {
    define([
      assign({to: register, from: `${register} + ${otherRegister}`}),
      assign({to: register, from: `${otherRegister} + ${register}`})
    ], (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) + gsx.registers.get(otherRegister))
    })
  }
}


/*
 Multiplication
*/

// Set a register equal to the product of the other two registers.
for (const register of generalPurposeRegisters) {
  const [other1, other2] = otherTwo(register)

  define([
    assign({to: register, from: `${other1} * ${other2}`}),
    assign({to: register, from: `${other2} * ${other1}`})
  ], (gsx: Gsx) => {
    gsx.registers.set(
      register,
      gsx.registers.get(other1) * gsx.registers.get(other2))
  })
}

// Set a register equal to the square of its own value.
for (const register of generalPurposeRegisters) {
  define([
    assign({to: register, from: `${register} * ${register}`}),
    assign({to: register, from: `${register}^2`})
  ], (gsx: Gsx) => {
    const oldValue = gsx.registers.get(register)
    gsx.registers.set(register, oldValue * oldValue)
  })
}

// Set a register equal to itself times another register.
for (const register of generalPurposeRegisters) {
  for (const otherRegister of otherTwo(register)) {
    define([
      assign({to: register, from: `${register} * ${otherRegister}`}),
      assign({to: register, from: `${otherRegister} * ${register}`})
    ], (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) * gsx.registers.get(otherRegister))
    })
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


  /*
    Division
  */

  // Set a register equal to the quotient of the other two registers.
  for (const register of generalPurposeRegisters) {
    const [other1, other2] = otherTwo(register)

    define(assign({to: register, from: `${other1} / ${other2}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) / gsx.registers.get(other2))
    })

    define(assign({to: register, from: `${other2} / ${other1}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other2) / gsx.registers.get(other1))
    })
  }

  // Set a register equal to the quotient of itself and another register.
  for (const register of generalPurposeRegisters) {
    const [other1, other2] = otherTwo(register)

    define(assign({to: register, from: `${register} / ${other1}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) / gsx.registers.get(other1))
    })

    define(assign({to: register, from: `${register} / ${other2}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(register) / gsx.registers.get(other2))
    })

    define(assign({to: register, from: `${other1} / ${register}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other1) / gsx.registers.get(register))
    })

    define(assign({to: register, from: `${other2} / ${register}`}), (gsx: Gsx) => {
      gsx.registers.set(
        register,
        gsx.registers.get(other2) / gsx.registers.get(register))
    })
  }
}


/**
 * Produce a mnemonic representing assignment.
 *
 * @param args - The assignment's destination and source.
 */
function assign(args: { to: string, from: string }): string {
  return `new ${args.to} = ${args.from}`
}

/**
 * Normalize spacing, normalize capitalization, and remove comments.
 *
 * @param mnemonic - The input string to be normalized.
 */
function normalizeMnemonic(mnemonic: string): string {
  return mnemonic
    // This removes all whitespace and comments
    .replace(/\s+|#.*/g, '')
    .toLowerCase()
}

enum BytecodeForConstantAssignment {
  ByteToRegisterT,
  ByteToRegisterR,
  ByteToRegisterY,
  FloatToRegisterT,
  FloatToRegisterR,
  FloatToRegisterY
}