import {
  ProductVariant,
  Product,
  ProductColor,
  ProductOption,
  ProductSpecifications,
  SalesRanks,
  UsdPrice,
} from "../core";
import {
  BestSellingProductsQuery,
  BestSellingProductsQueryVariables,
  MoneyV2,
  ProductsQuery,
  ProductsQueryVariables,
} from "../../generated/graphql";
import { unwrap } from "../../util";
import _ from "lodash";
import { GraphqlClient } from "../../graphqlClient";

export class ShopifyDataSource {
  private static readonly pageSize = 100;

  private readonly graphqlClient = new GraphqlClient<
    "queries/products.graphql" | "queries/bestSellingProducts.graphql"
  >();

  async *getProducts(): AsyncIterable<Product> {
    let cursor: string | undefined;

    while (true) {
      const {
        products: { edges, pageInfo },
      } = await this.graphqlClient.executeGraphql<
        ProductsQuery,
        ProductsQueryVariables
      >("queries/products.graphql", {
        first: ShopifyDataSource.pageSize,
        cursor,
      });

      yield* edges
        .filter(({ node }) => {
          const descriptionHtml: string = node.descriptionHtml;
          return !(
            descriptionHtml.toLowerCase().includes("hidden product") &&
            descriptionHtml
              .toLowerCase()
              .includes("product options application")
          );
        })
        .map(({ node }) => {
         
          
          
          const found = node.metafields.edges.find(obj => {
            return obj.node.key === 'model';
          });

          const product_type = node.metafields.edges.find(obj => {

           

            return obj.node.key === 'product_type';
          });

          const vendor_filter = node.metafields.edges.find(obj => {

           

            return obj.node.key === 'brand';
          });


          const model_image = node.metafields.edges.find(obj => {

           

            return obj.node.key === 'model_image';
          });

          


            
          
          const variants = node.variants.edges;
          if (variants.length === 0) {
            throw new Error(
              `Expected at least one variant for product ${node.title} ${node.handle}, but there were none`
            );
          }

          const firstVariant = variants[0].node;

          return {

            
            
            id: node.handle,
            sku:node.id,
            title: node.title,
            vendor: {
              vendor: node.vendor,
            },
            publishedAt: {
              unixMilliseconds: node.publishedAt,
            },
            descriptionHtml: node.descriptionHtml,
            price: unwrap(ShopifyDataSource.toPrice(firstVariant.priceV2)),
            listPrice: ShopifyDataSource.toPrice(firstVariant.compareAtPriceV2),
            specifications: ShopifyDataSource.parseSpecifications(node.tags),
            colors: ShopifyDataSource.parseColors(node.options),
            options: ShopifyDataSource.getOptions(node.options),
            variants: ShopifyDataSource.getVariants(variants),
            model: found?.node.value ?? "",
            product_type:product_type?.node.value ?? "",
            model_image:model_image?.node.value ?? "",
            vendor_filter:vendor_filter?.node.value ?? "",
           
            categories: node.collections.edges.map(({ node }) => ({
              id: node.handle,
              title: node.title,
            })),
            images: node.media.edges
              .map(({ node }) => ({
                url: node.previewImage?.src ?? "",
                altText: node.previewImage?.altText ?? "",
              }))
              .filter((image) => image.url !== ""),
          };
        });

      cursor = edges[edges.length - 1].cursor;

      if (!pageInfo.hasNextPage) {
        break;
      }
    }
  }

  async getSalesRanks(): Promise<SalesRanks> {
    const result: SalesRanks = {};
    let cursor: string | undefined;
    let rank = 0;

    while (true) {
      const {
        products: { edges, pageInfo },
      } = await this.graphqlClient.executeGraphql<
        BestSellingProductsQuery,
        BestSellingProductsQueryVariables
      >("queries/bestSellingProducts.graphql", {
        cursor,
      });

      for (const { node } of edges) {
        result[node.handle] = rank;
        rank++;
      }

      cursor = edges[edges.length - 1].cursor;

      if (!pageInfo.hasNextPage) {
        break;
      }
    }

    return result;
  }

  private static toPrice(
    priceV2?: MoneyV2 | null | undefined
  ): UsdPrice | null {
    if (!priceV2) {
      return null;
    }

    if (priceV2.currencyCode != "USD") {
      throw new Error(
        `Unexpected currency code "${priceV2.currencyCode}", expected "USD"`
      );
    }

    return {
      usdAmount: priceV2.amount,
    };
  }

  private static getOptions(
    options: readonly {
      readonly name: string;
      readonly values: readonly string[];
    }[]
  ): readonly ProductOption[] {
    return options
      .filter((option) => option.name !== "Title")
      .map((option) => ({
        optionName: option.name,
        optionValues: option.values,
      }));
  }

  private static getVariants(
    variants: readonly {
      readonly node: {
        readonly id: string;
        readonly priceV2: MoneyV2;
        readonly selectedOptions: readonly {
          readonly name: string;
          readonly value: string;
        }[];
      };
    }[]
  ): readonly ProductVariant[] {
    return variants.map(({ node: variant }) => ({
      variantId: variant.id,
      price: unwrap(ShopifyDataSource.toPrice(variant.priceV2)),
      selectedOptions: variant.selectedOptions.map((option) => ({
        optionName: option.name,
        optionValue: option.value,
      })),
    }));
  }

  private static parseColors(
    options: readonly {
      readonly name: string;
      readonly values: readonly string[];
    }[]
  ): readonly ProductColor[] {
    const colorsOption = options.find(
      (option) => option.name.toLowerCase() === "color"
    );

    if (colorsOption === undefined) {
      return [];
    }

    return colorsOption.values.map((color) => ({
      color: color.split(/\s/).map(_.capitalize).join(" "),
    }));
  }

  private static parseSpecifications(tags: string[]): ProductSpecifications {
    const parsedTags = Object.fromEntries(
      tags
        .map((tag) => {
          if (tag.includes(":")) {
            return tag.split(":");
          }
          if (tag.includes("-")) {
            return tag.split("-").reverse();
          }
          return [];
        })
        .filter((split) => split.length === 2)
    );
    return {
      groundClearance: parsedTags["groundclearance"] ?? null,
      weightCapacity: parsedTags["weightcapacity"] ?? null,
      turningRadius: parsedTags["turningradius"] ?? null,
      range: parsedTags["range"] ?? null,
      maxSpeed: parsedTags["speed"] ?? null,
      wheels: parsedTags["wheel"] ?? null,
    };
  }
}
