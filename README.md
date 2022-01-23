# symmetric-registry-keeper

This keeper bot will read from the GraphQL endpoint to find all available Symmetric V1 pools
and register all of them (if not already registered) into the onchain registry.

After registration, a sort will be performed on the registry across all token pairs by
liquidity depth.

set your Celo private key as env PRIVATE_KEY
run index.js to register all pools and perform sort
