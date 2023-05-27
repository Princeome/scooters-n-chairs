import _ from "lodash";
import { safeParseFloat } from "./util";

export type UnixTimeMilliseconds = number;

export type SalesRanks = { [productId: string]: number };

export interface Repository {
  getProductsPage(options: GetProductsPageOptions): Promise<readonly Product[]>;
  countProductsPages(options: CountProductsPagesOptions): Promise<number>;

  getProduct(id: string): Promise<Product>;

  getRelatedProducts(
    category: ProductCategory,
    productId: string,
    price: UsdPrice,
    count: number
  ): Promise<readonly Product[]>;

  getVendorsForCategories(
    categoryIds: readonly string[]
  ): Promise<readonly ProductVendor[]>;
  getColorsForCategories(
    categoryIds: readonly string[]
  ): Promise<readonly ProductColor[]>;

  countProductsInCategory(categoryId: string): Promise<number>;
}

export interface RepositoryUpdater {
  updateData(): Promise<void>;
}

export interface GetProductsPageOptions {
  readonly orderBy: ProductOrderBy;
  readonly pageSize: number;
  readonly pageNumber: number;
  readonly filters?: ProductFilters;
}

export interface CountProductsPagesOptions {
  readonly orderBy: ProductOrderBy;
  readonly pageSize: number;
  readonly filters?: ProductFilters;
}

export type ProductOrderBy =
  | "default"
  | "bestSelling"
  | "priceAscending"
  | "priceDescending"
  | "newest";

export interface ProductFilters {
  readonly categoryIds: readonly string[];
  readonly price: readonly Range[];
  readonly wheels: readonly string[];
  readonly vendor: readonly ProductVendor[];
  readonly groundClearance: readonly Range[];
  readonly color: readonly ProductColor[];
  readonly weightCapacity: readonly Range[];
  readonly turningRadius: readonly Range[];
  readonly travelRange: readonly Range[];
  readonly maxSpeed: readonly Range[];
  readonly search: string;
}

export const emptyProductFilters: ProductFilters = {
  categoryIds: [],
  price: [],
  wheels: [],
  vendor: [],
  groundClearance: [],
  color: [],
  weightCapacity: [],
  turningRadius: [],
  travelRange: [],
  maxSpeed: [],
  search: "",
};

export interface DateUnixMilliseconds {
  readonly unixMilliseconds: number;
}

export interface ProductOption {
  readonly optionName: string;
  readonly optionValues: readonly string[];
}

export interface SelectedOption {
  readonly optionName: string;
  readonly optionValue: string;
}

export interface ProductVariant {
  readonly variantId: string;
  readonly selectedOptions: readonly SelectedOption[];
  readonly price: UsdPrice;
}

export interface Product {
  readonly id: string;
  readonly sku:string;
  readonly title: string;
  readonly vendor: ProductVendor;
  readonly descriptionHtml: string;
  readonly price: UsdPrice;
  readonly listPrice: UsdPrice | null;
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly colors: readonly ProductColor[];
  readonly images: readonly ProductImage[];
  readonly specifications: ProductSpecifications;
  readonly categories: readonly ProductCategory[] | null;
  readonly publishedAt: DateUnixMilliseconds;
  readonly model:string;
  readonly product_type:string;
  readonly model_image:string;
  readonly vendor_filter:string;

}

export function setOption(
  selectedOptions: readonly SelectedOption[],
  optionName: string,
  optionValue: string
): readonly SelectedOption[] {
  return selectedOptions.map((option) =>
    option.optionName === optionName
      ? {
          optionName,
          optionValue,
        }
      : option
  );
}

export function getOption(
  selectedOptions: readonly SelectedOption[],
  optionName: string
): string | undefined {
  return selectedOptions.find((option) => option.optionName === optionName)
    ?.optionValue;
}

export function getDefaultSelectedOptions(
  product: Product
): readonly SelectedOption[] {
  return product.options.map((option) => ({
    optionName: option.optionName,
    optionValue: option.optionValues[0],
  }));
}

export function getSelectedVariant(
  product: Product,
  selectedOptions: readonly SelectedOption[]
): ProductVariant {
  return (
    product.variants.find((variant) =>
      selectedOptions.every((selectedOption) =>
        variant.selectedOptions.some(
          (variantOption) =>
            variantOption.optionName === selectedOption.optionName &&
            variantOption.optionValue === selectedOption.optionValue
        )
      )
    ) ?? product.variants[0]
  );
}

export function getPrimaryCategory(
  product: Product,
  supportedCategories: SupportedCategories
): ProductCategory | undefined {
  return product.categories?.find((category) =>
    supportedCategories
      .getSupportedCategoriesWithoutCatchall()
      .some((supportedCategory) => supportedCategory.id === category.id)
  );
}

export function productIsNew(product: Product): boolean {
  const oneMonth = 31 * 24 * 60 * 60 * 1000;
  return Date.now() - product.publishedAt.unixMilliseconds < oneMonth;
}

export function productIsOnSale(product: Product): boolean {
  return product.listPrice != null;
}

export interface ProductVendor {
  readonly vendor: string;
}

export interface ProductCategory {
  readonly id: string;
  readonly title: string;
}

export interface UsdPrice {
  readonly usdAmount: string;
}

export interface ProductColor {
  readonly color: string;
}

export interface ProductImage {
  readonly url: string;
  readonly altText: string;
}

export interface DescriptionSpecifications {
  readonly [name: string]: string;
}

export interface ProductSpecifications {
  readonly groundClearance: string | null;
  readonly weightCapacity: string | null;
  readonly turningRadius: string | null;
  readonly range: string | null;
  readonly maxSpeed: string | null;
  readonly wheels: string | null;
}

export function specificationsAreEmpty(specifications: ProductSpecifications) {
  return Object.values(specifications).every((x) => x === null);
}

export interface SupportedCategories {
  getSupportedCategories(): readonly SupportedCategoryWithSubcategories[];
  getSupportedCategoriesWithoutCatchall(): readonly SupportedCategoryWithSubcategories[];
}

export function getSubcategories(
  supportedCategories: SupportedCategories,
  categoryId: string
): readonly SupportedCategory[] {
  return (
    supportedCategories
      .getSupportedCategories()
      .find((category) => category.id === categoryId)?.subcategories ?? []
  );
}

export function getSupportedFilters(
  supportedCategories: SupportedCategories,
  categoryIds: readonly string[]
): SupportedFilters {
  const supportedFilters = findAllSupportedFilters(
    supportedCategories,
    categoryIds
  );
  return mergeSupportedFilters(supportedFilters);
}

function findAllSupportedFilters(
  supportedCategories: SupportedCategories,
  categoryIds: readonly string[]
): readonly SupportedFilters[] {
  return [...flattenSubcategories(supportedCategories)]
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.supportedFilters);
}

function* flattenSubcategories(
  supportedCategories: SupportedCategories
): Iterable<SupportedCategory> {
  for (const category of supportedCategories.getSupportedCategories()) {
    yield category;
    yield* category.subcategories;
  }
}

function mergeSupportedFilters(
  filters: readonly SupportedFilters[]
): SupportedFilters {
  return filters.reduce(
    (previous, current) => ({
      price: uniqueSortedRanges(previous.price, current.price),
      wheels: uniqueSortedValues(previous.wheels, current.wheels),
      vendor: previous.vendor || current.vendor,
      color: previous.color || current.color,
      groundClearance: uniqueSortedRanges(
        previous.groundClearance,
        current.groundClearance
      ),
      weightCapacity: uniqueSortedRanges(
        previous.weightCapacity,
        current.weightCapacity
      ),
      turningRadius: uniqueSortedRanges(
        previous.turningRadius,
        current.turningRadius
      ),
      travelRange: uniqueSortedRanges(
        previous.travelRange,
        current.travelRange
      ),
      maxSpeed: uniqueSortedRanges(previous.maxSpeed, current.maxSpeed),
    }),
    noSupportedFilters
  );
}

export function getCategoryById(
  supportedCategories: SupportedCategories,
  id: string
): SupportedCategory | undefined {
  return [...flattenSubcategories(supportedCategories)].find(
    (category) => category.id === id
  );
}

function uniqueSortedValues(
  firstArray: readonly string[],
  secondArray: readonly string[]
): readonly string[] {
  return _.uniq([...firstArray, ...secondArray]).sort();
}

function uniqueSortedRanges(
  firstRange: readonly Range[],
  secondRange: readonly Range[]
): readonly Range[] {
  return _([...firstRange, ...secondRange])
    .uniqWith(_.isEqual)
    .sortBy((range) => safeParseFloat(range.from ?? "0"))
    .value();
}

export interface SupportedCategoryWithSubcategories extends SupportedCategory {
  readonly subcategories: readonly SupportedCategory[];
}

export interface SupportedCategory {
  readonly title: string;
  readonly id: string;
  readonly supportedFilters: SupportedFilters;
  readonly image?: string;
}

export type Range =
  | {
      readonly from: string;
      readonly to: null;
    }
  | {
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly from: null;
      readonly to: string;
    };

export interface SupportedFilters {
  readonly price: readonly Range[];
  readonly wheels: readonly string[];
  readonly color: boolean;
  readonly vendor: boolean;
  readonly groundClearance: readonly Range[];
  readonly weightCapacity: readonly Range[];
  readonly turningRadius: readonly Range[];
  readonly travelRange: readonly Range[];
  readonly maxSpeed: readonly Range[];
}

export const noSupportedFilters: SupportedFilters = {
  price: [],
  wheels: [],
  color: false,
  vendor: false,
  groundClearance: [],
  weightCapacity: [],
  turningRadius: [],
  travelRange: [],
  maxSpeed: [],
};

export interface Logger {
  debug(msg: string, context?: any): void;
  info(msg: string, context?: any): void;
  warn(msg: string, context?: any): void;
  error(msg: string, context?: any): void;
}
