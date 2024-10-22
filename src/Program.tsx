import styles from './program.module.css';
import React from 'react';


export function Program(props: {
  program: string,
  programBytecodeAsHex: string,
  resetAndRun: () => void,
  errors: string[],
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void,
}) {
  return (
    <section>
      <h2>Program</h2>
      <div id={styles.grid}>
        <div>
          <h3>Assembly</h3>
          <textarea defaultValue={props.program} onChange={props.onChange} cols={32} rows={16}></textarea>
        </div>
        <div>
          <h3>Bytecode</h3>
          <textarea value={props.programBytecodeAsHex} className="bytecode" readOnly={true} cols={32} rows={16}></textarea>
        </div>
        <div>
          {props.errors.length
            ? (
              <div id={styles.errors}>
                <h3>Errors</h3>
                <ul>
                  {props.errors.map(error =>
                    <li key={error}>{error}</li>
                  )}
                </ul>
              </div>
            ) : (<button onClick={props.resetAndRun}>Execute</button>)
          }
        </div>
      </div>
    </section>
  );
}