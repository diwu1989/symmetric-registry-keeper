# symmetric-registry-keeper

This keeper bot will read from the GraphQL endpoint to find all available Symmetric V1 pools
and register all of them (if not already registered) into the onchain registry.

After registration, a sort will be performed on the registry across all token pairs by
liquidity depth.

set your Celo private key as env PRIVATE_KEY
run index.js to register all pools and perform sort

The onchain registry is deployed at https://explorer.celo.org/address/0x3E30b138ecc85cD89210e1A19a8603544A917372/transactions

It's best to run this keeper bot daily or hourly to maintain the registry.
