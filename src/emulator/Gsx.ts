import {Registers} from './Registers.ts'
import {runInstruction} from './InstructionSet.ts'


const BYTES_PER_MB = 1048576

export class Gsx {
  public readonly registers = new Registers()
  public readonly ram = new DataView(new ArrayBuffer(3 * BYTES_PER_MB))
  public readonly argumentStack = new Float32Array(256)
  public readonly jumpStack = new Uint32Array(256)

  runProgram(program: DataView): void {
    const MAX_PROGRAM_SIZE = 3 * BYTES_PER_MB

    if (program.byteLength >= MAX_PROGRAM_SIZE) {
      throw new Error(`Program exceeds ${MAX_PROGRAM_SIZE.toLocaleString()} bytes.`)
    }

    while (this.registers.programCounter < program.byteLength) {
      const instructionBytecode = program.getUint8(this.registers.programCounter)
      this.registers.programCounter += 1
      runInstruction(instructionBytecode, this, program)
    }
  }

  reset(): void {
    this.registers.reset()
    new Uint8Array(this.ram.buffer).fill(0)
  }
}

