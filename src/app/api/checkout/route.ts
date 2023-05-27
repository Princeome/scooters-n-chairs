import { NextApiRequest, NextApiResponse } from "next";
import { CartProduct } from "../cart";
import { checkout } from "../checkout";

// This is used to ensure that this file is included with the serverless function.
// It is necessary if deploying to Vercel.
// require("../../../queries/createCart.graphql");
require("../../../queries/createCart.graphql");

interface Response {
  readonly checkoutUrl: string | null;
  readonly updatedCart: readonly CartProduct[] | null;
}

export default async function checkoutHandler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  if (
    req.method !== "POST" ||
    req.headers["content-type"] !== "application/json"
  ) {
    res.status(400).end();
    return;
  }

  const result = await checkout(req.body);

  res.status(200).json({

    checkoutUrl: result.checkoutUrl?.toString() ?? null,
    updatedCart: result.updatedCart ?? null,
  });
}
