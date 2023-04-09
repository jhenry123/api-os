const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config();
const BN = require('bn.js')
const opensea = require("opensea-js");
const OpenSeaSDK = opensea.OpenSeaSDK;
const thisNetwork = opensea.Network;
const { OpenSeaStreamClient, Network } = require('@opensea/stream-js');
const { WebSocket } = require('ws');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const fetch = require('node-fetch');

// Import .env values as variables:
const providerUrl = process.env.PROVIDER_URL;
const walletAddress = process.env.WALLET_ADDRESS;
const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
const network = process.env.NETWORK;
const openSeaApiKey = process.env.OPENSEA_API_KEY;
const slug = process.env.COLLECTION_SLUG;

if (!walletAddress || !walletPrivateKey || !openSeaApiKey || !providerUrl || !slug) {
    console.error("Missing .env variables!");
    return;
};

// Setup signer:
const provider = new ethers.providers.JsonRpcProvider(providerUrl);
const signer = new ethers.Wallet(walletPrivateKey, provider);

// Setup seaport for OpenSeaSDK transactions:
const providerEngine = new HDWalletProvider(walletPrivateKey, providerUrl)
const seaport = new OpenSeaSDK(
    providerEngine, {
    networkName: (network == "mainnet" ? thisNetwork.Main : thisNetwork.Goerli),
    apiKey: openSeaApiKey,
},
);

// URL split:
async function splitUrl(url) {
    const a = url.split("/");
    return {
        tokenAddress: a[a.length - 2],
        tokenId: a[a.length - 1],
    }
}

// Convert salt to BigNumber:
const bytesToUint = async (bytes32) => {
    bytes32str = bytes32.replace(/^0x/, '');
    let bn = new BN(bytes32str, 16).fromTwos(256);
    let result = bn.toString();
    console.log(result);
    return result;
}

// Flip contract connection:
const flipContract = async () => {
    const flipAddress = //contract address;
    const rawdata = await fs.readFileSync('goerli-2.json');
    const abi = await JSON.parse(rawdata);
    const flipContract = await new ethers.Contract(flipAddress, abi, provider);
    const flipContractExecution = await flipContract.connect(signer);
    return flipContractExecution;
}

// Get Gas data of the latest blocks:
const gasData = async () => {
    const server = "https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=HHW7FHMDVZYFE26DSMNMKJGXSWAW3N5771";
    const response = await fetch(server, {method: "GET"});
    const data = await response.json();
    const fastGas = Number(data.result.FastGasPrice) * 3000000000
    console.log(`Currrent gas price: ${fastGas} wei`);
    const finalGas = await ethers.BigNumber.from(fastGas);
    return finalGas;
}

// Breakdown considerations:
const considerationArray = async (arr) => {
    let additionalConsiderations = [];
    for (let i = 1; i < arr.length; i++) {
        let item = {};
        item.amount = ethers.BigNumber.from(arr[i].endAmount);
        item.recipient = arr[i].recipient;
        additionalConsiderations.push(item);
    }
    return additionalConsiderations;
}

// Check orders:
const checkOrder = async (assetContractAddress, tokenId) => {
    console.log(`Start checking order of the NFT: ${assetContractAddress}/${tokenId}`);
    try {
        const buyOrders = await seaport.api.getOrders({
            protocol: "seaport",
            side: "ask",
            assetContractAddress,
            tokenId,
            bundled: false,
            orderBy: "eth_price",
            orderDirection: "asc"
        })
        const sellOrders = await seaport.api.getOrders({
            protocol: "seaport",
            side: "bid",
            assetContractAddress,
            tokenId,
            bundled: false,
            orderBy: "eth_price",
            orderDirection: "desc"
        })
        if (buyOrders.orders.length > 0 && sellOrders.orders.length > 0) {
            const cheapestBuy = buyOrders.orders[0];
            const highestSell = sellOrders.orders[0];
            if (parseInt(cheapestBuy.currentPrice) < parseInt(highestSell.currentPrice)) {
                console.log(`Found available sell order to match`);
                const buyOrderParams = cheapestBuy.protocolData.parameters;
                const buyOrderSig = cheapestBuy.protocolData.signature;
                const sellOrderParams = highestSell.protocolData.parameters;
                const sellOrderSig = highestSell.protocolData.signature;
                const buySalt = await bytesToUint(buyOrderParams.salt);
                const sellSalt = await bytesToUint(sellOrderParams.salt);
                const buyConsiderations = await considerationArray(buyOrderParams.consideration);
                const sellConsiderations = await considerationArray(sellOrderParams.consideration);
                const buyData = await {
                    considerationToken: buyOrderParams.consideration[0].token,
                    considerationIdentifier: buyOrderParams.consideration[0].identifierOrCriteria,
                    considerationAmount: ethers.BigNumber.from(buyOrderParams.consideration[0].endAmount),
                    offerer: buyOrderParams.offerer,
                    zone: buyOrderParams.zone,
                    offerToken: buyOrderParams.offer[0].token,
                    offerIdentifier: buyOrderParams.offer[0].identifierOrCriteria,
                    offerAmount: buyOrderParams.offer[0].endAmount,
                    basicOrderType: 0,
                    startTime: buyOrderParams.startTime,
                    endTime: buyOrderParams.endTime,
                    zoneHash: buyOrderParams.zoneHash,
                    salt: buySalt,
                    offererConduitKey: buyOrderParams.conduitKey,
                    fulfillerConduitKey: buyOrderParams.conduitKey,
                    totalOriginalAdditionalRecipients: buyOrderParams.consideration.length - 1,
                    additionalRecipients: buyConsiderations,
                    signature: buyOrderSig
                }
                const sellData = 
				
				// to be completed
				
				
                const price = await ethers.BigNumber.from(cheapestBuy.currentPrice);
                const value = await parseFloat(cheapestBuy.currentPrice)/1e18 * 1.01;
                const flipData = {
                    flip: {
                        buy: buyData,
                        sell: sellData,
                        price: price
                    },
                    value: value
                }
                return flipData;
            }
            else {
                console.log(`Found no available orders to fulfill`);
                return 0;
            }
        } else {
            console.log(`Found no available orders to fulfill`);
            return 0;
        }
    } catch (e) {
        console.log(`Failed to get order: ${e.message}`);
        return 0;
    }
}

// Stream set-up:
const client = new OpenSeaStreamClient({
    network: Network.MAINNET,
    token: openSeaApiKey,
    connectOptions: {
        transport: WebSocket
    }
});
client.connect();

// Stream sell orders from OpenSea Stream API:
const streamEvent = async (slug) => {
    let start = new Date(Date.now());
    console.log(`Process starts from: ${start.toString()}`);
    client.onItemReceivedBid(`${slug}`, async (event) => {
        let link = event.payload.item.permalink;
        let item = await splitUrl(link);
        const contract = await flipContract();
        const orders = await checkOrder(item.tokenAddress, item.tokenId);
        if (orders != 0) {
            
			
			// to be completed 
    });
}

streamEvent(slug);