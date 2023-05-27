import { readFile } from "fs/promises";
import path from "path";
import { env } from "./env";

const storefrontUrl =
  "https://scooters-n-chairs.myshopify.com/api/2021-10/graphql.json";

type GraphqlContent = string;


export class GraphqlClient<Filename extends string> {
  private readonly graphqlFileCache: Map<Filename, GraphqlContent> = new Map();

  constructor() {}

  async executeGraphql<T, V>(filename: Filename, variables: V): Promise<T> {
    const query = await this.loadGraphqlQuery(filename);
 
    const resp = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Storefront-Access-Token": "c34710cc7e554a7bff86bafe489b6408",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
 
    
    const json = (await resp.json()) as any;
    if (json.errors) {
      throw new Error(
        `Errors while executing query ${query}\n${JSON.stringify(
          json.errors,
          undefined,
          2
        )}`
      );
    }

    
    return json.data as T;
  }

  private async loadGraphqlQuery(filename: Filename): Promise<GraphqlContent> {
    let result = this.graphqlFileCache.get(filename);
    if (result === undefined) {
      const graphqlFilePath = path.join(process.cwd(), filename);
      result = await readFile(graphqlFilePath, {
        encoding: "utf-8",
      });
      this.graphqlFileCache.set(filename, result);
    }
    return result;
  }
}
