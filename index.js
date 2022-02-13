const { createAlchemyWeb3 } = require('@alch/alchemy-web3')
const axios = require('axios')

// CELO: wss://forno.celo.org/ws
// XDAI: wss://rpc.gnosischain.com/wss
const web3 = createAlchemyWeb3(
    process.env.RPC_URL || 'wss://forno.celo.org/ws',
    {retryInterval: 50, retryJitter: 0, maxRetries: 20}
)

// CELO: 0x3E30b138ecc85cD89210e1A19a8603544A917372
// XDAI: 0x8BB44cF81A7E263A0b0234Bf4Dd72482a88AFeCf
const registry = new web3.eth.Contract(
    require('./abi/BRegistry.json'),
    process.env.REGISTRY_ADDRESS || '0x3E30b138ecc85cD89210e1A19a8603544A917372')

async function main() {
    // CELO: https://api.thegraph.com/subgraphs/name/centfinance/symmetricv1celo
    // XDAI: https://api.thegraph.com/subgraphs/name/centfinance/symmetric-xdai
    const graphUrl = process.env.GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/centfinance/symmetricv1celo'
    const response = await axios.post(graphUrl, {
        query: `{
            pools(
              orderBy: createTime
              orderDirection: desc
              where: { active: true, liquidity_gt: 0, finalized: true }
            ) {
              id
              active
              liquidity
              tokensCount
              createTime
              swapFee
              controller
              publicSwap
              finalized
              tokens {
                id
                address
                name
                symbol
                balance
                denormWeight
              }
            }
        }`
    })
    const pools = response.data.data.pools

    const privateKey = process.env.PRIVATE_KEY
    const fromAddress = privateKey ? web3.eth.accounts.privateKeyToAccount(privateKey).address : null
    var nonce = fromAddress ? await web3.eth.getTransactionCount(fromAddress, 'pending') : 0
    var allTokens = []

    for (let pool of pools) {
        const poolAddress = web3.utils.toChecksumAddress(pool.id)
        console.info(JSON.stringify({
            pool: poolAddress,
            liquidity: pool.liquidity,
            swapFee: pool.swapFee,
            tokens: pool.tokens.map(t => t.symbol).join(':'),
            createTime: new Date(pool.createTime * 1000).toISOString()
        }, null, 2))

        // for each pair of tokens in this pool, add it to the registry
        for (let i = 0; i < pool.tokens.length - 1; i++) {
            const token1 = pool.tokens[i].address
            const symbol1 = pool.tokens[i].symbol
            for (let j = i + 1; j < pool.tokens.length; j++) {
                const token2 = pool.tokens[j].address
                const symbol2 = pool.tokens[j].symbol

                if (allTokens.indexOf(token1) == -1) {
                    allTokens.push(token1)
                }
                if (allTokens.indexOf(token2) == -1) {
                    allTokens.push(token2)
                }

                const existingPools = await registry.methods.getBestPools(token1, token2).call()
                if (existingPools.indexOf(poolAddress) != -1) {
                    // pool is already registered
                    console.info(`pool ${poolAddress} already registered pair ${symbol1} ${symbol2}`)
                    continue
                } else {
                    console.info(`pool ${poolAddress} need to register pair ${symbol1} ${symbol2}`)
                }

                if (!privateKey) {
                    // no private key, do not add to registry
                    continue
                }

                const encodedData = registry.methods.addPoolPair(
                    poolAddress, // pool address
                    token1, // token1
                    token2 // token2
                ).encodeABI()

                // add the pool into the registry
                const signedTx = await web3.eth.accounts.signTransaction({
                    from: fromAddress,
                    to: registry._address,
                    gas: 200 * 1000, // add pair should use no more than 200k gas
                    gasPrice: process.env.GAS_PRICE || 100000000,
                    nonce: nonce++,
                    data: encodedData
                }, privateKey)

                // send off the add registry transaction
                console.info(`adding pool ${poolAddress} to registry for pair ${symbol1} ${symbol2}`)
                web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            }
        }
    }

    if (privateKey) {
        // sort the pool with pruning
        const encodedData = registry.methods.sortPools(
            allTokens, // all possible tokens
            100 // sort limit
        ).encodeABI()
        const signedTx = await web3.eth.accounts.signTransaction({
            from: fromAddress,
            to: registry._address,
            gas: 10 * 1000 * 1000, // sort all pools can take more gas
            gasPrice: process.env.GAS_PRICE || 100000000,
            nonce: nonce++,
            data: encodedData
        }, privateKey)

        // send off the add registry transaction
        console.info(`sorting registry for all ${allTokens.length} tokens`)
        web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    }

    process.exit()
}

main()
