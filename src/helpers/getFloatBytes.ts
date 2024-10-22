const dataView = new DataView(new ArrayBuffer(4))

export function getFloatBytes(value: number): [number, number, number, number] {
  dataView.setFloat32(0, value)

  return [
    dataView.getInt8(0),
    dataView.getInt8(1),
    dataView.getInt8(2),
    dataView.getInt8(3)
  ]
}