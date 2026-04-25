import React from "react";
import { Card } from "@/components/ui/card";

export default function EmptyPanel({ title, description, icon: Icon }) {
  return (
    <div className="animate-fade-up">
      <Card className="p-10 text-center bg-white border-slate-200 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-xl efcis-gradient flex items-center justify-center mb-4 shadow-md shadow-green-500/25">
          {Icon && <Icon className="w-7 h-7 text-white" />}
        </div>
        <h3 className="text-xl font-bold text-slate-900 font-heading">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</p>
        <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-6 font-semibold">Coming soon</p>
      </Card>
    </div>
  );
}
