import React from "react";

export default function PassRequestPage() {
  return (
    <div className="h-full min-h-[400px] p-4">
      <div className="h-full rounded-md border bg-white shadow-sm overflow-hidden" style={{ minHeight: 400 }}>
        <iframe
          src="/"
          title="การขอบัตรผ่าน"
          className="w-full h-[80vh] min-h-[400px] border-0"
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
