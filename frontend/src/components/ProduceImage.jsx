import { useEffect, useState } from "react";

export default function ProduceImage({ produce }) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!produce) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchImage() {
      setLoading(true);
      setImageUrl("");

      try {
        const query = encodeURIComponent(
          `${produce} fruit vegetable`
        );

        const response = await fetch(
          `https://api.openverse.org/v1/images/?q=${query}&page_size=5`
        );

        if (!response.ok) {
          throw new Error("Image API failed");
        }

        const data = await response.json();

        const results = data?.results || [];

        const validImage = results.find(
          (item) =>
            item?.thumbnail ||
            item?.url
        );

        if (
          !cancelled &&
          validImage
        ) {
          setImageUrl(
            validImage.thumbnail ||
              validImage.url
          );
        }
      } catch (error) {
        console.error(
          "Produce image error:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [produce]);

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-100 animate-pulse" />
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <span className="text-xs text-muted">
          {produce?.charAt(0)?.toUpperCase() || "P"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={produce}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setImageUrl("")}
    />
  );
}