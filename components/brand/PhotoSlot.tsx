import { PHOTO_ASSETS, type PhotoAsset, type PhotoAssetKey } from "@/lib/assets/manifest";

/**
 * High-quality image slot with aspect/crop direction. Renders the photo only
 * when the manifest marks it licensed; otherwise an explicit, plated
 * "missing licensed asset" state (never a stock or copied image).
 */
export function PhotoSlot({ asset, className, style, radius = 28 }: { asset: PhotoAssetKey; className?: string; style?: React.CSSProperties; radius?: number }) {
  const a: PhotoAsset = PHOTO_ASSETS[asset];
  const licensed = a.rights === "licensed" && !!a.src;
  return (
    <div className={`photo-slot ${className ?? ""}`} style={{ aspectRatio: a.aspect, borderRadius: radius, ...style }} data-asset={a.id}>
      {licensed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.src} alt={a.alt} loading="eager" />
      ) : (
        <div className="photo-slot__missing" role="img" aria-label="Photo coming soon">
          <div className="photo-slot__plate">
            <div className="t-kicker">{a.id} · Missing licensed asset</div>
            <div className="t-small" style={{ marginTop: 4 }}>{a.brief}</div>
            <div className="t-small t-muted" style={{ marginTop: 2 }}>{a.filename} · {a.crop.split(";")[0]}</div>
          </div>
        </div>
      )}
    </div>
  );
}
