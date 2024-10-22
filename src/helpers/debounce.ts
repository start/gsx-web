// Returns a version of `callback` that won't execute until `delayInMs`
// milliseconds after it was most recently invoked.
export function debounce<T extends unknown[]>(
  callback: (...args: T) => void,
  delayInMs: number
): (...args: T) => void {
  let timeoutHandle: number

  return (...args: T) => {
    clearTimeout(timeoutHandle)

    timeoutHandle =
      setTimeout(() => {
        callback(...args)
      }, delayInMs)
  }
}