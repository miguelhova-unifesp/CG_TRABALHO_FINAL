// Carregamento das texturas PNG de public/textures/ (geradas por scripts/generate-textures.js).
import { ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';

const loader = new TextureLoader();
let anisotropy = 1;

/**
 * Chamar antes de getMaterials(): usa a anisotropia maxima da GPU em todas as texturas.
 * @param {import('three').WebGLRenderer} renderer
 */
export function configureTextures(renderer) {
  anisotropy = renderer.capabilities.getMaxAnisotropy();
}

/**
 * @param {string} name nome do arquivo sem extensao
 * @param {{ color?: boolean, repeat?: [number, number], clamp?: boolean,
 *   onLoad?: (t: import('three').Texture) => void }} [options]
 *   color: textura de cor (sRGB); normal/rugosidade ficam em espaco linear
 * @returns {import('three').Texture}
 */
export function loadTexture(name, { color = false, repeat = [1, 1], clamp = false, onLoad } = {}) {
  const texture = loader.load(`${import.meta.env.BASE_URL}textures/${name}.png`, onLoad);
  texture.name = name;
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = clamp ? ClampToEdgeWrapping : RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = anisotropy;
  // mipmaps: padrao do three (generateMipmaps + LinearMipmapLinearFilter)
  return texture;
}
