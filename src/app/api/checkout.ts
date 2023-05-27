import {
  CartLineInput,
  CreateCartMutation,
  CreateCartMutationVariables,
} from "../../generated/graphql";
import { GraphqlClient } from "../../graphqlClient";
import { CartProduct, getVariantId, removeVariantIdsFromCart } from "./cart";
import * as base64 from "base64-js";

interface CreatedCart {
  readonly invalidMerchandiseIds?: readonly string[];
  readonly checkoutUrl?: URL;
}

class ShopifyCartApi {
  private readonly graphqlClient =
    new GraphqlClient<"queries/createCart.graphql">();

  async createCart(lines: CartLineInput[]): Promise<CreatedCart> {
    const { cartCreate: resp } = await this.graphqlClient.executeGraphql<
      CreateCartMutation,
      CreateCartMutationVariables
    >("queries/createCart.graphql", {
      lines,
    });

    if (resp?.userErrors !== undefined && resp.userErrors.length > 0) {
      if (
        !resp.userErrors.every(
          (e) =>
            e.code === "INVALID" &&
            e.field?.[0] === "input" &&
            e.field?.[1] === "lines" &&
            e.field?.[3] === "merchandiseId"
        )
      ) {
        throw new Error(
          `Bad response from cartCreate: ${JSON.stringify(resp, undefined, 2)}`
        );
      }

      return {
        invalidMerchandiseIds: resp.userErrors.map((e) => {
          const exec = /gid:\/\/shopify\/ProductVariant\/\d+/.exec(e.message);
          if (exec?.length !== 1) {
            throw new Error(
              `Unexpected exec: ${JSON.stringify(exec, undefined, 2)}`
            );
          }
          return base64.fromByteArray(Buffer.from(exec[0], "utf-8"));
        }),
      };
    }

    if (resp?.cart) {
      return {
        checkoutUrl: resp.cart.checkoutUrl,
      };
    }

    throw new Error(
      `Unexpected response ${JSON.stringify(resp, undefined, 2)}`
    );
  }
}

interface CheckoutResult {
  readonly checkoutUrl?: URL;
  readonly updatedCart?: readonly CartProduct[];
}

export async function checkout(
  products: readonly CartProduct[]
): Promise<CheckoutResult> {
  const api = new ShopifyCartApi();
  const createCartResp = await api.createCart(
    products.map((cartProduct) => ({
      merchandiseId: getVariantId(cartProduct),
      quantity: cartProduct.quantity,
    }))
  );

  if (createCartResp.invalidMerchandiseIds !== undefined) {
    return {
      updatedCart: removeVariantIdsFromCart(
        products,
        createCartResp.invalidMerchandiseIds
      ),
    };
  }

  const redirectUrl = new URL("https://scooters-n-chairs-inc.mybigcommerce.com/checkout");
  return {
    checkoutUrl: redirectUrl,
  };
}
