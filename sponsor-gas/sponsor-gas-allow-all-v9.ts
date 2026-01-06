import * as dotenv from 'dotenv'

import {
    SafeAccountEil as SafeAccount,
    AllowAllPaymaster,
    MetaTransaction,
    calculateUserOperationMaxGasCost,
    getFunctionSelector,
    createCallData,
} from "abstractionkit";

async function main(): Promise<void> {
    //get values from .env
    dotenv.config()
    const chainId = BigInt(process.env.CHAIN_ID as string)
    const bundlerUrl = process.env.BUNDLER_URL as string
    const nodeUrl = process.env.NODE_URL as string
    const ownerPublicAddress = process.env.PUBLIC_ADDRESS as string
    const ownerPrivateKey = process.env.PRIVATE_KEY as string

    const paymaster = new AllowAllPaymaster();
    //initializeNewAccount only needed when the smart account
    //have not been deployed yet for its first useroperation.
    //You can store the accountAddress to use it to initialize 
    //the SafeAccount object for the following useroperations
    let smartAccount = SafeAccount.initializeNewAccount(
        [ownerPublicAddress],
        {c2Nonce:12n}
    )

    //After the account contract is deployed, no need to call initializeNewAccount
    //let smartAccount = new SafeAccount(accountAddress)

    console.log("Account address(sender) : " + smartAccount.accountAddress)

    //create two meta transaction to mint two NFTs
    //you can use favorite method (like ethers.js) to construct the call data 
    const nftContractAddress = "0x9a7af758aE5d7B6aAE84fe4C5Ba67c041dFE5336";
    const mintFunctionSignature = 'mint(address)';
    const mintFunctionSelector = getFunctionSelector(mintFunctionSignature);
    const mintTransactionCallData = createCallData(
        mintFunctionSelector,
        ["address"],
        [smartAccount.accountAddress]
    );
    const transaction1: MetaTransaction = {
        to: nftContractAddress,
        value: 0n,
        data: mintTransactionCallData,
    }

    let userOperation = await smartAccount.createPaymasterUserOperation(
        [
            //You can batch multiple transactions to be executed in one useroperation.
            transaction1, //transaction2,
        ],
        await paymaster.getPaymasterFieldsInitValues(chainId),
        nodeUrl, //the node rpc is used to fetch the current nonce and fetch gas prices.
        bundlerUrl, //the bundler rpc is used to estimate the gas limits.
        //uncomment the following values for polygon or any chains where
        //gas prices change rapidly
        //{
        //    maxFeePerGasPercentageMultiplier:130,
        //    maxPriorityFeePerGasPercentageMultiplier:130
        //}
    )

    const cost = calculateUserOperationMaxGasCost(userOperation)
    console.log("This useroperation may cost upto : " + cost + " wei")
    console.log("This example uses a Candide paymaster to sponsor the useroperation, so there is not need to fund the sender account.")
    console.log("Get early access to Candide's sponsor paymaster by visiting our discord https://discord.gg/KJSzy2Rqtg")

    // with ep0.09 the following operations can be done concurrently
    // independant of each other to save time
    // 1 - the user signing
    userOperation.signature = smartAccount.signUserOperation(
        userOperation,
        [ownerPrivateKey],
        chainId,
    )
    // 2- fetching the paymaster approval
    userOperation.paymasterData = await paymaster.getApprovedPaymasterData(userOperation)

    //use the bundler rpc to send a userOperation
    //sendUserOperation will return a SendUseroperationResponse object
    //that can be awaited for the useroperation to be included onchain
    const sendUserOperationResponse = await smartAccount.sendUserOperation(
        userOperation, bundlerUrl
    )

    console.log("Useroperation sent. Waiting to be included ......")
    //included will return a UserOperationReceiptResult when 
    //useroperation is included onchain
    let userOperationReceiptResult = await sendUserOperationResponse.included()

    console.log("Useroperation receipt received.")
    console.log(userOperationReceiptResult)
    if (userOperationReceiptResult.success) {
        console.log("Two Nfts were minted. The transaction hash is : " + userOperationReceiptResult.receipt.transactionHash)
    } else {
        console.log("Useroperation execution failed")
    }
}

main()
