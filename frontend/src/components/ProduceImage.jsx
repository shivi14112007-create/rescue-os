import { useState } from "react";
import { produceImageUrl, produceEmoji } from "./produceVisuals";

/**
 * Shows a real product photo for the produce type. If the photo fails to
 * load for any reason, falls back to the emoji tile automatically - so the
 * UI never shows a broken-image icon, even if the image service is down
 * during a live demo.
 */
export default function ProduceImage({ produceType, className = "", emojiClassName = "", emojiSize = "text-5xl" }) {
  const [failed, setFailed] = useState(false);
  const url = produceImageUrl(produceType);

  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center ${emojiClassName || className}`}>
        <span className={emojiSize}>{produceEmoji(produceType)}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={produceType}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
