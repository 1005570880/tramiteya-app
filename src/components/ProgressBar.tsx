"use client";

import React from "react";

export default function ProgressBar({ value = 0 }: { value: number }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}
