import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  label?: string;
}

export default function QRCodeDisplay({ url, size = 140, label }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 1,
      color: {
        dark: "#4cd964",
        light: "#0d1b2a",
      },
      errorCorrectionLevel: "M",
    }).catch(() => setError(true));
  }, [url, size]);

  if (error) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded border border-primary/30 p-2 bg-card/60">
        <canvas ref={canvasRef} />
      </div>
      {label && (
        <span className="text-[9px] sm:text-[10px] tracking-widest text-primary font-body">
          {label}
        </span>
      )}
    </div>
  );
}
