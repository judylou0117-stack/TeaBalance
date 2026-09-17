import { teaImagesFor } from '@/lib/tea-images';

export function TeaIngredientGallery({ teaId, teaName, label }: { teaId: string; teaName: string; label: string }) {
  const entry = teaImagesFor(teaId);
  if (!entry?.images.length) return null;

  return (
    <figure className={`tea-image-gallery count-${entry.images.length}`}>
      <figcaption>{label}</figcaption>
      <div>
        {entry.images.map((source, index) => (
          // Local workbook assets are served directly because Vinext does not provide Next's image optimizer.
          // oxlint-disable-next-line next/no-img-element
          <img
            key={source}
            src={source}
            alt={`${teaName} · ${label} ${index + 1}`}
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
