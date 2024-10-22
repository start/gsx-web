export function renderDataViewAsHex(dataView: DataView, maxLengthToRender = 1000) {
  const bufferOfItemsToRender = dataView.buffer.slice(0, maxLengthToRender)
  const bytesToRender = new Uint8Array(bufferOfItemsToRender)

  // The built-in `map` on typed arrays can only produce a new typed array.
  return Array.prototype.map.call(
    bytesToRender,
    (byte: number) => byte.toString(16).padStart(2, '0')
  ).join(' ')
}