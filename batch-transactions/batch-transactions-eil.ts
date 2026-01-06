import * as dotenv from 'dotenv'

import {
    SafeAccountEil as SafeAccount,
    MetaTransaction,
    getFunctionSelector,
    createCallData,
} from "abstractionkit";

async function main(): Promise<void> {
    //get values from .env
    dotenv.config()
    const chainId1 = BigInt(process.env.CHAIN_ID1 as string)
    const chainId2 = BigInt(process.env.CHAIN_ID2 as string)
    const bundlerUrl1 = process.env.BUNDLER_URL1 as string
    const bundlerUrl2 = process.env.BUNDLER_URL2 as string
    const nodeUrl1 = process.env.NODE_URL1 as string
    const nodeUrl2 = process.env.NODE_URL2 as string
    const ownerPublicAddress = process.env.PUBLIC_ADDRESS as string
    const ownerPrivateKey = process.env.PRIVATE_KEY as string
    
    //initializeNewAccount only needed when the smart account
    //have not been deployed yet for its first useroperation.
    //You can store the accountAddress to use it to initialize 
    //the SafeAccount object for the following useroperations
    let smartAccount = SafeAccount.initializeNewAccount(
        [ownerPublicAddress],
        {c2Nonce: 2n}
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

    const transaction2: MetaTransaction = {
        to: nftContractAddress,
        value: 0n,
        data: mintTransactionCallData,
    }

    //you can override all these values using the overrides parameter.
    const userOperationsResponse = await smartAccount.createUserOperations(
        [
            {
                chainId: chainId1,
                metaTransactions: [
                    transaction1,
                ],
                providerRpc: nodeUrl1, //the node rpc is used to fetch the current nonce and fetch gas prices.
                bundlerRpc: bundlerUrl1, //the bundler rpc is used to estimate the gas limits.
                overrides: {
                }
            },{
                chainId: chainId2,
                metaTransactions: [
                    transaction2,
                ],
                providerRpc: nodeUrl2, //the node rpc is used to fetch the current nonce and fetch gas prices.
                bundlerRpc: bundlerUrl2, //the bundler rpc is used to estimate the gas limits.
                overrides: {
                    preVerificationGasPercentageMultiplier:200
                }
            }

        ]
    )

    if(userOperationsResponse.errors.length > 0){
        const noOfFailedUserOps = userOperationsResponse.errors.length;
        console.log(`${noOfFailedUserOps} Useroperations execution failed`)
        printErrors(userOperationsResponse.errors)
        return
    }
    const userOperations = userOperationsResponse.results

    const signatures = smartAccount.signUserOperations(
        [
            {
                useroperation: userOperations[0],
                chainId: chainId1
            },
            {
                useroperation: userOperations[1],
                chainId: chainId2
            }
        ],
        [ownerPrivateKey],
    );

    userOperations[0].signature = signatures[0];
    userOperations[1].signature = signatures[1];

    const sendUserOperationsResponses = await smartAccount.sendUserOperationsNoOrder(
        [
            {
                userOperation: userOperations[0],
                bundlerRpc: bundlerUrl1
            },{
                userOperation: userOperations[1],
                bundlerRpc: bundlerUrl2
            }
        ]
    )

    if(sendUserOperationsResponses.errors.length > 0){
        const noOfFailedUserOps = sendUserOperationsResponses.errors.length;
        console.log(`${noOfFailedUserOps} sendUseroperations failed`)
        printErrors(sendUserOperationsResponses.errors)
    }
    if(sendUserOperationsResponses.results.length < 1){
        return
    }

    for (const sendUserOperationResponse of sendUserOperationsResponses.results){
         let userOperationReceiptResult = await sendUserOperationResponse.included()

        console.log("Useroperation receipt received.")
        console.log(userOperationReceiptResult)
        if (userOperationReceiptResult.success) {
            console.log("Two Nfts were minted. The transaction hash is : " + userOperationReceiptResult.receipt.transactionHash)
        } else {
            console.log("Useroperation execution failed")
        }
    }
}

function printErrors(errors: Error[]){
    errors.forEach(
        (error, index) => {
            console.log(`error no. ${index+1}`);
            console.log(error.message);
            if("code" in error){
                console.log("code:", error.code);
            }
            if("cause" in error){
                console.log("cause:", error.cause);
            }
            if("context" in error){
                console.log("context:", error.context);
            }
        }
    );
}

main()
