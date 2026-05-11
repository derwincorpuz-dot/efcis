import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";

/**
 * LocationHistory — renders a grid of photo + GPS cards with a "Maps" button per card.
 * items: [{ label, photo: { dataUrl, location: {lat,lng,accuracy}, capturedAt } }]
 */
export default function LocationHistory({ items = [], title = "Location History" }) {
  const visible = items.filter((i) => i?.photo);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-blue-600">
        <MapPin className="w-5 h-5" />
        <h4 className="text-base font-bold text-slate-900 font-heading">{title}</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((item, idx) => {
          const p = item.photo;
          const hasLoc = p?.location && (p.location.lat || p.location.lng);
          const mapsUrl = hasLoc
            ? `https://www.google.com/maps?q=${p.location.lat},${p.location.lng}`
            : null;
          return (
            <div key={idx} className="border border-slate-200 rounded-xl bg-white p-3 flex gap-3 items-start">
              <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                {p?.dataUrl
                  ? <img src={p.dataUrl} alt={item.label} className="w-full h-full object-cover" />
                  : <MapPin className="w-7 h-7 text-slate-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm leading-tight">{item.label}</div>
                    {p.capturedAt && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.capturedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!mapsUrl}
                    onClick={() => mapsUrl && window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                    className="shrink-0 h-8 text-xs"
                    data-testid={`loc-maps-${idx}`}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Maps
                  </Button>
                </div>
                {hasLoc ? (
                  <>
                    <div className="mt-2 inline-block px-2 py-1 rounded bg-slate-50 border border-slate-200 font-mono text-[12px] text-slate-700">
                      {Number(p.location.lat).toFixed(6)}, {Number(p.location.lng).toFixed(6)}
                    </div>
                    {p.location.accuracy && (
                      <div className="text-xs text-slate-500 mt-1">Accuracy: {Math.round(p.location.accuracy)}m</div>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-xs text-amber-600">No location recorded</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Build a uniform list of location items from a loan application's `data` field. */
export function buildLocationItems(d = {}) {
  return [
    { label: "Step 1: Collector — Present Home", photo: d.home_photo },
    { label: "Step 2: Collector — Business Store", photo: d.store_photo },
    { label: "Step 5: Verifier — Present Home", photo: d.verifier_home_photo },
    { label: "Step 5: Verifier — Business Store", photo: d.verifier_store_photo },
    { label: "Step 8: Releasing Proof", photo: d.release_proof },
  ];
}
