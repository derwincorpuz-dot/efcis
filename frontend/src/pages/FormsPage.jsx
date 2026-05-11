import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Download, FileText } from "lucide-react";
import { toast } from "sonner";

function downloadPdf(title, imageDataUrl) {
  if (!imageDataUrl) { toast.error("No form uploaded yet"); return; }
  // 8.5" x 13" at 96dpi = 816 x 1248
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { size: 8.5in 13in; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page { width: 8.5in; height: 13in; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
      h1 { font-family: Arial, sans-serif; text-align: center; margin: 8px 0 4px; font-size: 14pt; }
    </style></head><body>
    <div class="page"><img src="${imageDataUrl}" alt="${title}" /></div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
  </body></html>`);
  w.document.close();
}

export default function FormsPage() {
  const [settings, setSettings] = useState({});

  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data || {})); }, []);

  const items = [
    { key: "loan_form_image", title: "Loan Application Form", icon: ClipboardList, dataUrl: settings.loan_form_image?.dataUrl, name: settings.loan_form_image?.name },
    { key: "comaker_form_image", title: "Co-Maker Form", icon: FileText, dataUrl: settings.comaker_form_image?.dataUrl, name: settings.comaker_form_image?.name },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading">Forms</h3>
            <p className="text-xs text-slate-500">Download blank templates (8.5″ × 13″ PDF)</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Card key={it.key} className="p-5 border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                <it.icon className="w-6 h-6 text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 font-heading">{it.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{it.dataUrl ? it.name || "Uploaded" : "Not uploaded yet"}</p>
                <div className="mt-3">
                  <Button
                    onClick={() => downloadPdf(it.title, it.dataUrl)}
                    disabled={!it.dataUrl}
                    className="efcis-gradient text-white"
                    data-testid={`form-download-${it.key}`}
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Download PDF
                  </Button>
                </div>
              </div>
            </div>
            {it.dataUrl && (
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <img src={it.dataUrl} alt={it.title} className="w-full max-h-72 object-contain" />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
