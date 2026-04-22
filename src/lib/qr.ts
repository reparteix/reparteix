import QRCode from 'qrcode'

export async function createQrSvg(payload: string, size = 220): Promise<string> {
  return QRCode.toString(payload, {
    type: 'svg',
    width: size,
    margin: 1,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  })
}
