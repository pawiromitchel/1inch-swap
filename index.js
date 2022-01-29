require('dotenv').config()

const Web3 = require('web3');
const fetch = require('cross-fetch');

const chainId = process.env.CHAIN_ID;
const web3RpcUrl = process.env.WEB3_RPC_URL;
const walletAddress = process.env.ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

const swapParams = {
    fromTokenAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
    toTokenAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC
    amount: '100',
    fromAddress: walletAddress,
    slippage: 1,
    disableEstimate: false,
    allowPartialFill: false,
};

const broadcastApiUrl = 'https://tx-gateway.1inch.io/v1.1/' + chainId + '/broadcast';
const apiBaseUrl = 'https://api.1inch.io/v4.0/' + chainId;
const web3 = new Web3(web3RpcUrl);

function apiRequestUrl(methodName, queryParams) {
    return apiBaseUrl + methodName + '?' + (new URLSearchParams(queryParams)).toString();
}

async function broadCastRawTransaction(rawTransaction) {
    return fetch(broadcastApiUrl, {
        method: 'post',
        body: JSON.stringify({ rawTransaction }),
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(res => {
            return res.transactionHash;
        });
}

async function signAndSendTransaction(transaction) {
    const { rawTransaction } = await web3.eth.accounts.signTransaction(transaction, privateKey);

    return await broadCastRawTransaction(rawTransaction);
}

async function buildTxForApproveTradeWithRouter(tokenAddress, amount) {
    const url = apiRequestUrl(
        '/approve/transaction',
        amount ? { tokenAddress, amount } : { tokenAddress }
    );

    const transaction = await fetch(url).then(res => res.json());

    const gasLimit = await web3.eth.estimateGas({
        ...transaction,
        from: walletAddress
    });

    return {
        ...transaction,
        gas: gasLimit
    };
}

async function buildTxForSwap(swapParams) {
    const url = apiRequestUrl('/swap', swapParams);

    return fetch(url).then(res => res.json()).then(res => res.tx);
}

async function run() {

    // 1. approve the trade with the router
    const transactionForSign = await buildTxForApproveTradeWithRouter(swapParams.fromTokenAddress);
    // console.log('Transaction for approve: ', transactionForSign);
    const approveTxHash = await signAndSendTransaction(transactionForSign);
    console.log(`Approve tx hash: https://polygonscan.com/tx/${approveTxHash}`);

    // 2. swap
    const swapTransaction = await buildTxForSwap(swapParams);
    // console.log('Transaction for swap: ', swapTransaction);
    const swapTxHash = await signAndSendTransaction(swapTransaction);
    console.log(`Swap transaction hash: https://polygonscan.com/tx/${swapTxHash}`);
}

run();