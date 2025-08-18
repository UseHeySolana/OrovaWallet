export const blobToJSON = (blob: Blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const json = JSON.parse(reader.result as string);
        resolve(json);
      } else {
        reject("oops");
      }
    };
    reader.readAsText(blob);
  });

export function base64ToArrayBuffer(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}


export function extractImportantInfo(product: any) {
  if (!product || typeof product !== "object") {
    return { error: "Invalid product data" };
  }

  const get = (path: any, fallback = "N/A") =>
    path.reduce(
      (obj: any, key: any) => (obj && key in obj ? obj[key] : undefined),
      product
    ) ?? fallback;

  return {
    name: product.name ?? "Unnamed Product",
    brand: product.brand ?? "Unknown Brand",
    price: product.pricing ?? "Unknown Price",
    rating:
      product.average_rating ?? get(["customer_reviews", "stars"], "No Rating"),
    reviews:
      product.total_reviews ??
      get(["customer_reviews", "ratings_count"], "No Reviews"),
    topReview: product.reviews?.[0]?.review ?? "No reviews yet",
    images: product.images ?? [],
    colors:
      product.customization_options?.color?.map((c: any) => c.value) ?? [],
    sizes: product.customization_options?.size?.length ?? 0,
    category: product.product_category ?? "No Category",
    asin: product.product_information?.asin ?? "No ASIN",
    dimensions:
      product.product_information?.package_dimensions ?? "Unknown Dimensions",
    availableSince:
      product.product_information?.date_first_available ?? "Unknown Date",
    bestSellerRank:
      product.product_information?.best_sellers_rank?.[1] ?? "No Rank",
  };
}
