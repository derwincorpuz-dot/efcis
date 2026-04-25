import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, RefreshCcw, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * CameraCapture
 * - Opens device rear camera via getUserMedia
 * - If requireLocation, capture button is hidden until geolocation is granted
 * - Falls back to file upload if camera unavailable
 *
 * value: { dataUrl, location: {lat,lng,accuracy} | null, capturedAt }
 * onChange: (value) => void
 * portrait: enforce portrait styling
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
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(value?.location || null);
  const [locReq, setLocReq] = useState(false);
  const [locDenied, setLocDenied] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
      if (requireLocation && !location) requestLocation();
    } catch (e) {
      setError("Camera unavailable. Please use file upload.");
      setActive(false);
    }
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
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 720;
    canvas.height = v.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    if (location) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, canvas.height - 64, canvas.width, 64);
      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`📍 ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`, 16, canvas.height - 38);
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.fillText(new Date().toLocaleString(), 16, canvas.height - 16);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    onChange({ dataUrl, location, capturedAt: new Date().toISOString() });
    stopStream();
    setActive(false);
  };

  const onFile = async (e) => {
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

  useEffect(() => () => stopStream(), []);

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
      ) : active ? (
        <div className="space-y-2">
          <div className="camera-frame">
            <video ref={videoRef} playsInline muted className={`w-full ${portrait ? "aspect-[3/4]" : "aspect-video"} object-cover ${requireLocation && !location ? "blur-sm" : ""}`} />
            {requireLocation && !location && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white text-center p-4">
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
          <div className="flex gap-2">
            {showCapture && (
              <Button onClick={capture} type="button" data-testid={`${testid}-capture`} className="flex-1 efcis-gradient text-white">
                <Camera className="w-4 h-4 mr-1.5" /> Capture
              </Button>
            )}
            <Button onClick={() => { stopStream(); setActive(false); }} type="button" variant="outline" data-testid={`${testid}-cancel`}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50">
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
        </div>
      )}
    </div>
  );
}
