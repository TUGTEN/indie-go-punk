import { memo, useId, useMemo } from 'react';
import type { PixelIcon } from './library';
import { iconArtworkSvg, type ArtworkOptions } from './artwork';

/** Local SVG definitions must not collide between the gallery and inspector. */
export const ArtworkGlyph = memo(function ArtworkGlyph({ icon, options }: { icon: PixelIcon; options: ArtworkOptions }) {
  const instance = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const svg = useMemo(() => {
    let markup = iconArtworkSvg(icon, options);
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    for (const id of ids) markup = markup.replaceAll(`id="${id}"`, `id="${instance}-${id}"`).replaceAll(`url(#${id})`, `url(#${instance}-${id})`).replaceAll(`href="#${id}"`, `href="#${instance}-${id}"`).replaceAll(`aria-labelledby="${id}"`, `aria-labelledby="${instance}-${id}"`);
    return markup;
  }, [icon, options, instance]);
  return <span className="icon-artwork" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
});
