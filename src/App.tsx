import './App.css'
import {Register} from './Register.tsx'
import {Program} from './Program.tsx'
import React, {useState} from 'react'
import styles from './app.module.css'
import {Gsx} from './emulator/Gsx.ts'
import {renderDataViewAsHex} from './helpers/renderDataViewAsHex.ts'
import {translateToBytecode} from './emulator/InstructionSet.ts'
import {debounce} from './helpers/debounce.ts'

const gsx = new Gsx()

const initialState = getState(gsx, [
  'new t = 12',
  'new r = 3',
  'new y = t + r',
  '',
  '# Or... new y = y + y',
  'new y = y * 2',
  '',
  'new t = 0',
  'new ram[t] byte = y'
].join('\n'))

function App() {
  const [state, setState] = useState(initialState)
  const [bytecode, translationErrors] = translateToBytecode(state.program)
  const bytecodeAsHex = renderDataViewAsHex(bytecode)

  const debouncedUpdateProgramInState = debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('debouncedUpdateProgramInState', {eventTargetValue: event.target.value})
    const program = event.target.value
    setState(getState(gsx, program))
  }, 300)

  function resetAndRun() {
    gsx.reset()
    gsx.runProgram(bytecode)
    setState(getState(gsx, state.program))
  }

  return (
    <>
      <header>
        <p>
          This page contains a non-graphical emulator for an early-90s family computer,
          the GSX.
        </p>

        <p>
          This is a work in progress. Based on research by <a href={'https://github.com/start'}>start@github</a>.
        </p>
        <h1 className={'logo'}>GSX</h1>
      </header>
      <main>
        <section id={styles.registers}>
          <Register
            name={'PC'}
            value={state.registers.programCounter}
            description={<>
              <b>P</b>rogram <b>C</b>ounter
            </>}
            width={32}>
          </Register>

          <Register
            value={state.registers.argumentStackPointer}
            name={'AS'}
            description={<>
              <b>A</b>rgument <b>S</b>tack Pointer
            </>}
            width={8}>
          </Register>

          <Register
            value={state.registers.jumpStackPointer}
            name={'JS'}
            description={<>
              <b>J</b>ump <b>S</b>tack Pointer
            </>}
            width={8}>
          </Register>

          <Register
            value={state.registers.t}
            name={'T'}
            description={'General Purpose'}
            width={32}>
          </Register>

          <Register
            value={state.registers.r}
            name={'R'}
            description={'General Purpose'}
            width={32}>
          </Register>

          <Register
            value={state.registers.y}
            name={'Y'}
            description={'General Purpose'}
            width={32}>
          </Register>
        </section>

        <Program
          program={state.program}
          programBytecodeAsHex={bytecodeAsHex}
          errors={translationErrors}
          resetAndRun={resetAndRun}
          onChange={debouncedUpdateProgramInState}>
        </Program>
      </main>
    </>
  )
}

export default App


function getState(gsx: Gsx, program: string) {
  return {
    registers: {
      programCounter: gsx.registers.programCounter,
      argumentStackPointer: gsx.registers.argumentStackPointer,
      jumpStackPointer: gsx.registers.jumpStackPointer,
      t: gsx.registers.t,
      r: gsx.registers.r,
      y: gsx.registers.y
    },
    ram: renderDataViewAsHex(gsx.ram),
    program
  } as const
}