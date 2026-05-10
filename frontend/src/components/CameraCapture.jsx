import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, Upload, X, AlertCircle } from "lucide-react";

/**
 * CameraCapture — works on all devices (mobile + desktop).
 * - Always renders <video> element so the ref is available before stream attaches.
 * - Uses useEffect to attach stream once the element is mounted.
 * - Falls back to file upload if camera is denied/unavailable.
 *
 * value: { dataUrl, location: {lat,lng,accuracy} | null, capturedAt }
 */
export default function CameraCapture({
  label = "Photo Verification",
  value,
  onChange,
  requireLocation = false,
  portrait = false,
  testid = "camera-capture",
}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(value?.location || null);
  const [locReq, setLocReq] = useState(false);
  const [locDenied, setLocDenied] = useState(false);

  // Attach stream to video element AFTER it has been rendered.
  useEffect(() => {
    if (active && stream && videoRef.current) {
      const v = videoRef.current;
      v.srcObject = stream;
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    }
  }, [active, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setActive(false);
  };

  const tryGetUserMedia = async (constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints);
  };

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera not supported in this browser. Please use Upload.");
      return;
    }
    let s = null;
    try {
      // First try rear camera (mobile). Use `ideal` so desktop falls back.
      s = await tryGetUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      try {
        // Fallback: any camera
        s = await tryGetUserMedia({ video: true, audio: false });
      } catch (e2) {
        setError(
          e2?.name === "NotAllowedError"
            ? "Camera permission denied. Allow it in your browser settings or use Upload."
            : "Camera unavailable. Please use Upload."
        );
        return;
      }
    }
    setStream(s);
    setActive(true);
    if (requireLocation && !location) requestLocation();
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocDenied(true);
      return;
    }
    setLocReq(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocReq(false);
        setLocDenied(false);
      },
      () => {
        setLocReq(false);
        setLocDenied(true);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const capture = () => {
    if (!videoRef.current) return;
    if (requireLocation && !location) {
      requestLocation();
      return;
    }
    const v = videoRef.current;
    const w = v.videoWidth || 720;
    const h = v.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    if (location) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, h - 64, w, 64);
      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`📍 ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`, 16, h - 38);
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.fillText(new Date().toLocaleString(), 16, h - 16);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    onChange({ dataUrl, location, capturedAt: new Date().toISOString() });
    stopStream();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ dataUrl: reader.result, location: location || null, capturedAt: new Date().toISOString() });
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    onChange(null);
    setLocation(null);
  };

  const showCapture = !requireLocation || !!location;

  return (
    <div className="w-full" data-testid={testid}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {requireLocation && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${location ? "text-green-700" : "text-amber-600"}`}>
            <MapPin className="w-3 h-3" /> {location ? "Location locked" : "Location required"}
          </span>
        )}
      </div>

      {value?.dataUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img src={value.dataUrl} alt="Captured" className={`w-full ${portrait ? "aspect-[3/4]" : "aspect-video"} object-cover`} />
          {value.location && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/55 text-white rounded px-2 py-1 text-[11px] font-mono flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-green-300" />
              {value.location.lat.toFixed(5)}, {value.location.lng.toFixed(5)}
              <span className="ml-auto text-green-300">✓ Verified</span>
            </div>
          )}
          <button onClick={clear} type="button" data-testid={`${testid}-clear`} className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow">
            <X className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>
      ) : (
        <div className={active ? "space-y-2" : "border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50"}>
          {/* Always render the video element so videoRef is available, but hide it until active */}
          <div className={active ? "camera-frame relative" : "hidden"}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full ${portrait ? "aspect-[3/4]" : "aspect-video"} object-cover bg-black ${requireLocation && !location ? "blur-md" : ""}`}
            />
            {requireLocation && !location && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white text-center p-4">
                <AlertCircle className="w-8 h-8 text-amber-300 mb-2" />
                <p className="text-sm font-semibold">Allow location to enable capture</p>
                <p className="text-xs text-slate-200 mt-1">Required for verification</p>
                <Button onClick={requestLocation} disabled={locReq} className="mt-3 efcis-gradient text-white" data-testid={`${testid}-allow-location`}>
                  <MapPin className="w-4 h-4 mr-1.5" />
                  {locReq ? "Requesting..." : "Allow Location"}
                </Button>
                {locDenied && <p className="text-[11px] text-red-300 mt-2">Location denied. Enable in browser settings.</p>}
              </div>
            )}
          </div>

          {active ? (
            <div className="flex gap-2">
              {showCapture && (
                <Button onClick={capture} type="button" data-testid={`${testid}-capture`} className="flex-1 efcis-gradient text-white">
                  <Camera className="w-4 h-4 mr-1.5" /> Capture
                </Button>
              )}
              <Button onClick={stopStream} type="button" variant="outline" data-testid={`${testid}-cancel`}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="button" onClick={start} data-testid={`${testid}-open`} className="flex-1 efcis-gradient text-white">
                  <Camera className="w-4 h-4 mr-1.5" /> Open Camera
                </Button>
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" data-testid={`${testid}-upload`} />
                  <span className="w-full h-10 flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium">
                    <Upload className="w-4 h-4" /> Upload
                  </span>
                </label>
              </div>
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
