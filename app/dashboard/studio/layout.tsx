export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Studio uses full-bleed layout — no padding from the dashboard layout
  return <div className="h-full -m-8 overflow-hidden">{children}</div>;
}
