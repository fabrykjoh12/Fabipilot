import { describe, it, expect } from 'vitest'
import { downscaleImage } from './image.js'

// downscaleImage er DOM-avhengig (canvas/createImageBitmap), men validerings-
// grenen kjører før noe DOM røres, så den kan testes i node.
describe('downscaleImage — validering', () => {
  it('rejects a missing file', async () => {
    await expect(downscaleImage(null)).rejects.toThrow()
  })
  it('rejects a non-image file', async () => {
    await expect(downscaleImage({ type: 'text/plain' })).rejects.toThrow(/bildefil/i)
  })
})
