import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#6d28d9",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "7px",
        }}
      >
        <span
          style={{
            color: "white",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: "22px",
            fontFamily: "Georgia, serif",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          X
        </span>
      </div>
    ),
    { ...size }
  );
}
