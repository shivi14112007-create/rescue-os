import { Award, Leaf, Download, X } from "lucide-react";

export default function RescueCertificate({
  batch,
  sellerName,
  onClose,
}) {
  if (!batch) return null;

  const quantity = Number(batch.quantity_kg || 0);

  const certificateId =
    `RS-${String(batch.id).slice(-6).toUpperCase()}`;

  const date = new Date().toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  // Simple project estimate.
  // We can replace this later with your actual impact model.
  const co2Saved = (quantity * 1.9).toFixed(1);
  const mealsSupported = Math.max(
    1,
    Math.round(quantity * 2)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* CLOSE */}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900"
        >
          <X size={18} />
        </button>

        {/* CERTIFICATE */}

        <div
          id="rescue-certificate"
          className="p-8 sm:p-12 text-center border-8 border-green-50"
        >

          {/* HEADER */}

          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Award
                size={34}
                className="text-green-700"
              />
            </div>
          </div>

          <p className="text-sm uppercase tracking-[0.25em] text-green-700 font-semibold">
            RescueOS
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3">
            Rescue Certificate
          </h1>

          <p className="text-gray-500 mt-2">
            Certificate of Successful Produce Rescue
          </p>

          {/* CONTENT */}

          <div className="my-8">

            <p className="text-gray-500 text-sm">
              This certificate is proudly awarded to
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              {sellerName || "Produce Seller"}
            </h2>

            <p className="text-gray-500 mt-5">
              for successfully rescuing
            </p>

            <div className="text-4xl font-bold text-green-700 mt-2">
              {quantity} kg
            </div>

            <p className="text-lg font-medium capitalize text-gray-800 mt-1">
              {batch.produce_type || "Produce"}
            </p>

          </div>

          {/* IMPACT */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">

            <div className="bg-green-50 rounded-xl p-4">
              <Leaf
                size={22}
                className="mx-auto text-green-700"
              />
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {quantity} kg
              </p>
              <p className="text-xs text-gray-500">
                Food waste avoided
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900">
                {co2Saved}
              </p>
              <p className="text-xs text-gray-500">
                Estimated kg CO₂e avoided
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900">
                {mealsSupported}
              </p>
              <p className="text-xs text-gray-500">
                Potential meals supported
              </p>
            </div>

          </div>

          {/* FOOTER */}

          <div className="border-t border-gray-200 pt-5 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500">

            <div>
              Certificate ID:
              <span className="font-semibold text-gray-700 ml-1">
                {certificateId}
              </span>
            </div>

            <div>
              Issued: {date}
            </div>

          </div>

        </div>

        {/* DOWNLOAD */}

        <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-center">

          <button
            onClick={() =>
              window.print()
            }
            className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800"
          >
            <Download size={17} />
            Download Certificate
          </button>

        </div>

      </div>

    </div>
  );
}