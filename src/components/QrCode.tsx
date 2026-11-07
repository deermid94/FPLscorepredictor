import QRCode from "qrcode";

export async function QrCode({ url, size = 168 }: { url: string; size?: number }) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#06120d", light: "#ffffff" } });
  return (
    <div
      role="img"
      aria-label={`QR code for ${url}`}
      className="shrink-0 rounded-2xl bg-white p-2 shadow-lg shadow-lime-400/20 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
