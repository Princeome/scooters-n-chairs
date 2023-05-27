import { getSelectedVariant, Product, SelectedOption } from "../../core";
import { LocalStorage } from "../../localStorage";

type CartStorage = Record<string, CartProduct>;

const cartStorage = new LocalStorage<CartStorage>("cart", () => ({}));

export interface CartProduct {
  readonly product: Product;
  readonly selectedOptions: readonly SelectedOption[];
  readonly quantity: number;
}

export function getVariantId(cartProduct: CartProduct): string {
  return getSelectedVariant(cartProduct.product, cartProduct.selectedOptions)
    .variantId;
}

export function getCart(): readonly CartProduct[] {
  return Object.values(cartStorage.get());
}

export function overwriteCart(newCart: readonly CartProduct[]): void {
  const newEntries = Object.fromEntries(
    newCart.map((product) => [getVariantId(product), product])
  );
  cartStorage.set(newEntries);
}

export function countProductsInCart(): number {
  return getCart()
    .map((x) => x.quantity)
    .reduce((a, b) => a + b, 0);
}

export function addProductToCart(
  product: Product,
  selectedOptions: readonly SelectedOption[]
): readonly CartProduct[] {
  const entries = cartStorage.get();
  const { variantId } = getSelectedVariant(product, selectedOptions);
  if (entries[variantId] !== undefined) {
    entries[variantId] = {
      ...entries[variantId],
      quantity: entries[variantId].quantity + 1,
    };
  } else {
    entries[variantId] = {
      product,
      selectedOptions,
      quantity: 1,
    };
  }
  cartStorage.set(entries);
  return Object.values(entries);
}

export function removeProductFromCart(
  product: Product,
  selectedOptions: readonly SelectedOption[]
): readonly CartProduct[] {
  const { variantId } = getSelectedVariant(product, selectedOptions);
  const entries = cartStorage.get();
  if (entries[variantId] === undefined) {
    return Object.values(entries);
  }

  const newQuantity = entries[variantId].quantity - 1;
  if (newQuantity === 0) {
    delete entries[variantId];
  } else {
    entries[variantId] = {
      ...entries[variantId],
      quantity: entries[variantId].quantity - 1,
    };
  }
  cartStorage.set(entries);
  return Object.values(entries);
}

export function removeAllProductsFromCart(
  product: Product,
  selectedOptions: readonly SelectedOption[]
): readonly CartProduct[] {
  const entries = cartStorage.get();
  const { variantId } = getSelectedVariant(product, selectedOptions);
  delete entries[variantId];
  cartStorage.set(entries);
  return Object.values(entries);
}

export function totalCartPrice() {
  const entries = cartStorage.get();
  return Object.values(entries)
    .map((cartProduct) => {
      const variant = getSelectedVariant(
        cartProduct.product,
        cartProduct.selectedOptions
      );
      return Number(variant.price.usdAmount);
    })
    .reduce((previous, current) => previous + current, 0);
}

export function removeVariantIdsFromCart(
  products: readonly CartProduct[],
  variantIds: readonly string[]
): readonly CartProduct[] {
  return products.filter(
    (product) => !variantIds.includes(getVariantId(product))
  );
}
