import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);
}

export function getProductImage(product: { sku?: string; name?: string; image_url?: string | null }): string {
  if (product?.image_url) return product.image_url;
  
  const searchString = `${product?.sku || ""} ${product?.name || ""}`.toLowerCase();
  
  if (searchString.includes("chair")) return "/images/products/office_chair.png";
  if (searchString.includes("book") || searchString.includes("shelf")) return "/images/products/bookshelf.png";
  if (searchString.includes("nightstand")) return "/images/products/nightstand.png";
  
  return "/images/products/dining_table.png";
}
