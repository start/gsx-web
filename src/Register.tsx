import styles from './register.module.css';
import React from 'react';

export function Register(props: {
  name: string,
  value: number,
  width: number,
  description: string | React.JSX.Element
}) {
  return (
    <div id={styles.register}>
      <h2>{props.name}</h2>
      <input id={'value'} aria-label={'Register value'} value={props.value} readOnly={true}></input>
      <div id={'description'}>{props.description}</div>
      <div id={'width'}>{props.width}-bit register</div>
    </div>
  );
}