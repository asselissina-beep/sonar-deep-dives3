import waterLinkedLogo from "@/assets/waterlinked-logo.svg";

export default function WaterLinkedLogo({
  className = "",
  width = 400,
  showSlogan = true,
}: {
  className?: string;
  width?: number;
  // Kept for backwards compatibility — slogan is now baked into the SVG.
  showSlogan?: boolean;
}) {
  void showSlogan;
  return (
    <div className={`inline-flex ${className}`} style={{ width }}>
      <img
        src={waterLinkedLogo}
        alt="Water Linked — Redefining underwater perception"
        width={width}
        style={{ height: "auto", display: "block" }}
      />
    </div>
  );
}
